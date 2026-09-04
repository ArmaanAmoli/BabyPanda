import { BabyPandaClient } from './apiCall'
import type { Message, UrlApi, ToolMessage } from './types'
import { ReasoningEffort, Role } from './types'
import { readFileSync } from "fs"
import { EventEmitter } from "events"
import { MCPClient } from "./mcp/client"
import * as z from "zod";
import type { Tool, ToolResult } from './types';
import { MessageQueueSpecialElement } from './types';
import { getMessages, getSession, updateSession, createMessage } from '@baby-panda/db';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BabyPandaAgent extends EventEmitter {
  private client: BabyPandaClient;
  private isRunning = false;
  private messageQueue: (Message | MessageQueueSpecialElement)[] = [];
  private messagesHistory: Message[] = [];
  private mcpClient: MCPClient = new MCPClient()

  instructions: string;
  model: string;
  sessionId: string;
  reasoningEffect: ReasoningEffort;
  numberOfMessages: number = 0;

  constructor({ url, apikey }: UrlApi, sessionId: string) {
    console.log(sessionId, "in agent constructor")
    super();
    this.client = new BabyPandaClient({ url, apikey });
    this.model = 'nvidia/nemotron-3.5-lightning-30b-a3b'; // This will be our default model
    this.instructions = readFileSync((__dirname + '/instructions.txt'), { encoding: 'utf-8' });
    this.reasoningEffect = ReasoningEffort.none;
    this.sessionId = sessionId
  }

  public async init() {
    await this.connectToMCP();
    await this.getNoMessages();
  }

  private async connectToMCP() { await this.mcpClient.connectToServer((__dirname + '/mcp/index.ts')); }

  private async getNoMessages() {
    try {
      const session = await getSession(this.sessionId);
      if (!session[0] || session[0].messagesCount == null) {
        throw new Error('Session Id no found')
      }
      this.numberOfMessages = session[0].messagesCount
    }
    catch (err) {
      console.log(`An error occured while initiating agent ${err}`);
      throw err;
    }
  }

  private async loop() {
    while (this.messageQueue.length !== 0) {
      console.log("in the loop")
      this.isRunning = true;
      const messages: Message[] = [{ role: Role.system, content: this.instructions, sessionId: this.sessionId }, ...this.messagesHistory]// need optimization
      if (!this.messageQueue[0]) { // if the first message of messageQueue is undefined then skip this iteration (but atleast tell the user later)
        this.messageQueue.splice(0, 1);
        console.error("message undefined")
        continue;
      }
      const userInput = this.messageQueue[0];
      if (userInput !== MessageQueueSpecialElement.toolCallDone) {
        messages.push(userInput)
      }
      const response = await this.client.chatCompletion(messages, this.model, this.reasoningEffect);
      console.log("first reply")
      if (response.systemError) {
        console.error('Request failed:', response.error);
        process.exit(1);
      }
      const getContent = (encoded: string) => {
        try {
          if (encoded) {
            const json = JSON.parse(encoded);
            if (!json.choices || json.choices.length === 0) return '';
            if (!json.choices[0].delta.content) return '';
            return String(json.choices[0].delta.content);
          }
          return '';
        }
        catch (err) {
          console.error('Failed to parse SSE chunk:', encoded, err)
          return '';
        }
      }

      let toolCall = false;// for now
      let lineChecked = 0;
      let fullReply = "";
      let buffer: string = '';
      const MAX_LINE_THRESHOLD_FOR_TOOL_CALL = 4;
      const toolCallChecker = /^.*"tool_call":.*$/m;
      const lineBuffer: string[] = []
      const regex = /^data:\s/;

      response.response?.data.on('data', (chunk: Buffer | string) => {
        const encodedChunk = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
        buffer += encodedChunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (let line of lines) {
          line = line.trim();
          if (!regex.test(line)) continue;
          line = line.slice(6);
          if (line === '[DONE]') continue;
          const content = getContent(line);
          // console.log(content);
          fullReply += content;
          if (!toolCall && lineChecked < MAX_LINE_THRESHOLD_FOR_TOOL_CALL) {
            // console.log("checking tool call")
            //check for "tool_call"
            if (toolCallChecker.test(fullReply)) {
              toolCall = true;
              console.log("tool called !")
            }
            lineBuffer.push(content);
          }
          if (lineChecked >= MAX_LINE_THRESHOLD_FOR_TOOL_CALL && !toolCall) {
            if (lineBuffer.length > 0) {
              for (const l of lineBuffer) {
                this.emit('data', l)
              }
              lineBuffer.length = 0;
            }
            this.emit('data', content)
          }
          if (content.includes('\n') && lineChecked < MAX_LINE_THRESHOLD_FOR_TOOL_CALL) {
            for (const char of content) {
              if (char === '\n') {
                lineChecked += 1;
                // console.log(content)
                // console.log(lineChecked)
              }
            }
          }
        }
      });
      response.response?.data.on('end', async () => {
        // console.log("full reply: \n", fullReply);
        //store to db
        try {
          await createMessage(this.sessionId, fullReply, Role.assistant);
          this.numberOfMessages += 1;
        } catch (err) {
          throw new Error(`Unable to store assistant message to database: ${err}`);
        }

        if (toolCall) {
          // tool execution
          const ReplyJsonSchema = z.object({
            role: z.string(),
            toolCall: z.array(z.object(
              {
                id: z.string(),
                type: z.string(),
                function: z.string(),
                arguments: z.record(z.string(), z.unknown())
              }
            ))
          });
          type ReplyJson = z.infer<typeof ReplyJsonSchema>
          let replyJson = JSON.parse(fullReply)
          try {
            if (ReplyJsonSchema.parse(replyJson)) {
              let toolCalls = (replyJson as ReplyJson).toolCall
              const toolCallsT: Tool[] = toolCalls.map((tool) => {
                return {
                  id: tool.id,
                  name: tool.function,
                  args: tool.arguments
                }
              });
              const toolResults = await this.mcpClient.callTools(toolCallsT);
              // const lastToolResult = toolResults.pop()
              let i = 0;
              while (i < toolResults.length) {
                if (toolResults.at(i) === undefined) {
                  continue;
                }
                else {
                  try {
                    await createMessage(this.sessionId, JSON.stringify(toolResults.at(i)), Role.tool);
                    this.numberOfMessages += 1;
                    this.messagesHistory.push({
                      role: Role.tool,
                      tool_call_id: toolResults.at(i)!.id,
                      content: toolResults.at(i)!.result,
                      sessionId: this.sessionId
                    }
                    )
                  } catch (err) {
                    throw new Error(`Unable to store tool message to database: ${err}`);
                  }
                }
                i += 1;
              }
              toolResults.length = 0;
              i = 0;
              this.messageQueue.push(MessageQueueSpecialElement.toolCallDone);
            }
          }
          catch (err) {
            console.log(`An error occured while resolving tool call at agent.ts: ${err}`)
          }
        }
        lineChecked = 0;
        toolCall = false;
        fullReply = '';
        this.emit('end');
      })
      response.response?.data.on('error', (err: Error) => { console.error('Stream error:', err) });
      this.messageQueue.splice(0, 1);
    }
    this.isRunning = false;
    console.log('loop has ended')
  }

  async message(msg: Message) {
    this.messageQueue.push(msg);
    if (this.isRunning) {
      return;
    }
    else {
      console.log('called loop')
      await this.loop();
    }
  }
}