import { BabyPandaClient } from './client'
import type { Message, UrlApi, MessageAPI } from './types'
import { ReasoningEffort, Role } from './types'
import { readFileSync } from "fs"
import { EventEmitter } from "events"
import { MCPClient } from "./mcp/client"
import * as z from "zod";
import type { Tool, ToolResult } from './types';
import { MessageQueueSpecialElement } from './types';
import { getMessages, getSession, createMessage } from '@baby-panda/db';
import { extractFirstJSON } from './utils/FirstJsonExtractor';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

export class BabyPandaAgent extends EventEmitter {
  private client: BabyPandaClient;
  private isRunning = false;
  private messageQueue: (MessageAPI | MessageQueueSpecialElement)[] = [];
  private messagesHistory: MessageAPI[] = [];
  private mcpClient: MCPClient = new MCPClient();
  private cwd = cwd;

  instructions: string;
  model: string;
  sessionId: string;
  reasoningEffect: ReasoningEffort;
  numberOfMessages: number = 0;

  constructor({ url, apikey }: UrlApi, sessionId: string) {
    super();
    console.log("agent cwd ", this.cwd);
    console.log(sessionId, "in agent constructor")
    this.client = new BabyPandaClient({ url, apikey });
    this.model = 'nvidia/nemotron-3.5-lightning-30b-a3b'; // This will be our default model
    this.instructions = readFileSync((__dirname + '/memory/BabyPanda/BabyPanda.md'), { encoding: 'utf-8' });
    this.reasoningEffect = ReasoningEffort.none;
    this.sessionId = sessionId
  }

  public async init() {
    await this.connectToMCP();
    await this.getNoMessages();
    this.messagesHistory = await this.getMessageHistory();
    console.log("agent:init");
  }
  private async connectToMCP() { await this.mcpClient.connectToServer((__dirname + '/mcp/index.ts'), this.cwd); console.log("agent:MCP") }
  private async getNoMessages() {
    try {
      const session = await getSession(this.sessionId);
      if (!session[0] || session[0].messagesCount == null) {
        throw new Error('Session Id no found')
      }
      this.numberOfMessages = session[0].messagesCount
      console.log("agent:MessageCount")
    }
    catch (err) {
      console.log(`An error occured while initiating agent ${err}`);
      throw err;
    }
  }

  private async getMessageHistory() {
    const messageHistoryFromDb = await getMessages(this.sessionId);
    console.log("agent:MessageHistory")
    return messageHistoryFromDb.map((msg) => {
      const msgApi: Message = { role: msg.role!, content: msg.content! }
      return msgApi;
    })
  }

  private async loop() {
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

    const systemMessage = { role: Role.system, content: (this.instructions + `user current working directory: "${this.cwd}"`) }
    while (this.messageQueue.length !== 0) {
      console.log("in the loop")
      this.isRunning = true;
      this.messagesHistory = await this.getMessageHistory();
      const messages: MessageAPI[] = [systemMessage, ...this.messagesHistory]

      if (!this.messageQueue[0]) {
        this.messageQueue.splice(0, 1);
        console.error("message undefined");
        continue;
      }

      const userInput = this.messageQueue[0];

      if (userInput !== MessageQueueSpecialElement.toolCallDone &&
        userInput !== MessageQueueSpecialElement.errorInLastIteration &&
        userInput !== MessageQueueSpecialElement.lastReplyFromLLMWasEmpty &&
        userInput !== MessageQueueSpecialElement.lastReplyFromLLMWasThought) {
        messages.push(userInput);
        await createMessage(this.sessionId, userInput.content as string, Role.user);
      }
      this.messageQueue.splice(0, 1);
      // console.log('MESSAGES' , messages)
      const response = await this.client.chatCompletion(messages, this.model, this.reasoningEffect);
      console.log("first reply");
      if (response.systemError) {
        console.error('Request failed:', response.error);
        this.isRunning = false;
        this.messageQueue.push(MessageQueueSpecialElement.errorInLastIteration);
        continue;
      }
      enum ContentType {
        content = 'content',
        thought = 'thought',
        tool_call = 'tool_call',
        unidentified = 'unidentified'
      }
      let contentType: ContentType = ContentType.unidentified;
      let toBreak:boolean = false;

      await new Promise((resolve, reject) => {
        const parentContentPropertyRegex = /^.*"content":.*$/m;
        const thoughtRegex = /^.*"thought":.*$/m;
        const answerRegex = /^.*"answer":.*$/m;
        const toolCallRegex = /^.*"tool_call":.*$/m;
        /*
        While contentType is unidentified we want to save the data in the full Reply
        we will use the thought , answer , toolCall Regex to identify the stream only in case of toolCall we will not produce event
        */
        let toolCall = false;
        let fullReply = "";
        let buffer: string = '';

        let inParentContentProperty: boolean = false;
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
            if (inParentContentProperty) {
              if (contentType === ContentType.unidentified) {
                // console.log("checking tool call")
                //check for "tool_call"
                if (toolCallRegex.test(fullReply)) {
                  toolCall = true;
                  contentType = ContentType.tool_call;
                  console.log("tool called !")
                }
                else if (answerRegex.test(fullReply)) {
                  contentType = ContentType.content;
                  toBreak = true;
                }
                else if (thoughtRegex.test(fullReply)) {
                  contentType = ContentType.thought
                  this.messageQueue.push(MessageQueueSpecialElement.lastReplyFromLLMWasThought);
                }
                lineBuffer.push(content);
              }
              else {
                if (!toolCall) {
                  if (lineBuffer.length > 0) {
                    for (const l of lineBuffer) {
                      this.emit(contentType, l)
                    }
                    lineBuffer.length = 0;
                  }
                  this.emit(contentType, content)
                }
              }
            }
            else {
              if (parentContentPropertyRegex.test(fullReply)) {
                inParentContentProperty = true;
              }
            }

          }
        });

        const ReplyJsonSchema = z.object({
          role: z.string(),
          content: z.object({
            tool_call: z.array(z.object(
              {
                id: z.string(),
                type: z.string(),
                function: z.string(),
                arguments: z.record(z.string(), z.unknown())
              }
            )).optional(),
            thought: z.string().optional(),
            content: z.string().optional()
          })
        });
        type ReplyJson = z.infer<typeof ReplyJsonSchema>;

        response.response?.data.on('end', async () => {
          fullReply = extractFirstJSON(fullReply) ?? ""
          if (!fullReply) {
            console.log("Full reply is empty");
            this.messageQueue.push(MessageQueueSpecialElement.lastReplyFromLLMWasEmpty);
            resolve("empty reply");
            return;
          }
          console.log("full reply: \n", fullReply);
          try {
            await createMessage(this.sessionId, fullReply, Role.assistant);
            this.numberOfMessages += 1;
          } catch (err) {
            reject(new Error(`Unable to store assistant message to database: ${err}`));
          }
          if (toolCall) {
            try {
              let replyJson: ReplyJson | undefined;
              try {
                replyJson = ReplyJsonSchema.parse(JSON.parse(fullReply)) // to-do: try to make it more safe
              } catch (err) {
                reject("parsing error");
                this.messageQueue.push(MessageQueueSpecialElement.errorInLastIteration)
                createMessage(this.sessionId, `Their is an issue in the reply structure that you gave ${err}`, Role.user)
                return;
              }
              if (replyJson) {
                let toolCalls = replyJson.content.tool_call;
                if (!toolCalls) {
                  MessageQueueSpecialElement.toolCallDone;
                  resolve('no tool call');
                  return;
                }
                const toolCallsT: Tool[] = toolCalls.map((tool) => {
                  return {
                    id: tool.id,
                    name: tool.function,
                    arguments: tool.arguments
                  }
                });
                const toolResults = await this.mcpClient.callTools(toolCallsT);
                console.log('agent:tool result from mcp', toolResults)
                let i = 0;
                while (i < toolResults.length) {
                  if (toolResults.at(i) === undefined) {
                    i++;
                    continue;
                  }
                  else {
                    try {
                      await createMessage(this.sessionId, JSON.stringify(toolResults.at(i)), Role.user);
                      this.numberOfMessages += 1;
                    } catch (err) {
                      reject(new Error(`Unable to store tool message to database: ${err}`));
                    }
                  }
                  i += 1;
                }
                toolResults.length = 0;
                i = 0;
                this.messageQueue.push(MessageQueueSpecialElement.toolCallDone);
              }
              // to-do save messages code below this
            }
            catch (err) {
              const fullErrMessage = `An error occured while resolving tool call at agent.ts: ${err}`
              console.log(fullErrMessage, "Sending error to llm");
              createMessage(this.sessionId, fullErrMessage, Role.user)
              this.messageQueue.push(MessageQueueSpecialElement.errorInLastIteration)
              reject(err);
            }
          }
          toolCall = false;
          fullReply = '';
          this.emit('end');
          resolve("single iteration of loop done.");

        });
        response.response?.data.on('error', (err: Error) => {
          console.error(
            'Stream error:', err);
          this.isRunning = false;
          reject(err);
        });
      }).then(
        () => {
          this.isRunning = false
        })
        .catch((err) => {
          this.isRunning = false;
          console.log("[ERROR]: ", err)
          this.messageQueue.push(MessageQueueSpecialElement.errorInLastIteration);
        });
        if(toBreak) break;
    }
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