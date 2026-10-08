import { BabyPandaClient } from './client';
import type { Message, MessageAPI, MessageContent, UserPermission } from '@baby-panda/types';
import { ContentType, LogType, MessageContentSchema } from '@baby-panda/types';
import { Role } from '@baby-panda/types';
import type { UrlApi, Tool, ToolResult } from './types';
import { MessageQueueEvents, ReasoningEffort, ShellCallSchema } from './types';
import { readFileSync, existsSync, lstatSync, mkdirSync, writeFileSync } from 'fs';
import { EventEmitter } from 'events';
import { MCPClient } from './mcp/client';
import {
  getMessages,
  getSession,
  createMessage,
  getMostRecentCompactionSummary,
  addCompactionSummary,
  getMessagesAfterTimestamp,
} from '@baby-panda/db';
import { extractFirstJSON } from './utils/FirstJsonExtractor';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelsEnum, Models, ProvidersEnum } from '@agent/config/models';
import { getContent } from '@agent/utils/getContent';
import { compaction } from '@agent/memory/services/compaction';
import { projectDir, memoryFile } from '@agent/memory/constants';
import { readFromMemory } from '@agent/memory/utils/memory';
import { writeLogs } from '@baby-panda/utils';
import { shell } from './mcp/tools/Shell/shell';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();

const instructionsFilePath = path.join(__dirname, 'memory', 'BabyPanda', 'BabyPanda.md');

// let compact = true;
// type MessageHistory = Awaited<ReturnType<typeof getMessages>>;

export class BabyPandaAgent extends EventEmitter {
  client: BabyPandaClient;
  private isRunning = false;
  private messageQueue: MessageQueueEvents[] = [];
  private userMessageQueue: Message[] = [];
  private messagesHistory: MessageAPI[] = [];
  private mcpClient: MCPClient;
  private cwd = cwd;
  private projectDirectoryName = '';
  private contextWindow: number = 0;
  public contextWindowUsed: number = 0;
  private systemInstructions;
  private permissionWaiters = new Map<string, (granted: boolean) => void>(); // tool call id - permissionGranted
  private alwaysAllowBash = false; // when close session we reset this variable thats why not stored in db

  instructions: string;
  model: ModelsEnum;
  sessionId: string;
  reasoningEffect: ReasoningEffort;
  numberOfMessages: number = 0;

  constructor({ url, apikey }: UrlApi, sessionId: string) {
    super();
    console.log('agent cwd ', this.cwd);
    console.log(sessionId, 'in agent constructor');
    this.sessionId = sessionId;
    this.mcpClient = new MCPClient(this.sessionId);
    this.client = new BabyPandaClient({ url, apikey });
    this.model = ModelsEnum['nvidia/nemotron-3-ultra-550b-a55b']; // This will be our default model
    this.instructions = readFileSync(instructionsFilePath, {
      encoding: 'utf-8',
    });
    this.reasoningEffect = ReasoningEffort.none;
    this.contextWindow = Models['Nvidia'].models[this.model].contextLength; // default model
    if (!(existsSync(projectDir) && lstatSync(projectDir).isDirectory())) {
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(memoryFile, '');
    }
    this.projectDirectoryName = process.cwd().replaceAll('/', '-').replace('-', '');

    this.systemInstructions = {
      role: Role.system,
      content: this.instructions + `user current working directory: "${this.cwd}"`,
    };
  }

  public async init() {
    await this.connectToMCP();
    await this.getNoMessages();
    this.messagesHistory = await this.getMessageHistory();
    console.log('agent:init');
  }
  private async connectToMCP() {
    await this.mcpClient.connectToServer(__dirname + '/mcp/index.ts', this.cwd);
    console.log('agent:MCP');
  }
  private async getNoMessages() {
    try {
      const session = await getSession(this.sessionId);
      if (!session[0] || session[0].messagesCount == null) {
        throw new Error('Session Id no found');
      }
      this.numberOfMessages = session[0].messagesCount;
      console.log('agent:MessageCount');
    } catch (err) {
      console.log(`An error occured while initiating agent ${err}`);
      throw err;
    }
  }

  private async getMessageHistory(createdAt?: number) {
    const messageHistoryFromDb = createdAt
      ? await getMessagesAfterTimestamp(this.sessionId, createdAt)
      : await getMessages(this.sessionId);
    console.log('agent:MessageHistory');
    return messageHistoryFromDb.map((msg) => {
      const msgApi: Message = { role: msg.role!, content: msg.content! };
      return msgApi;
    });
  }

  private async createContext() {
    const summary = await getMostRecentCompactionSummary(this.sessionId);
    if (summary) {
      const { content, createdAt } = summary;
      const messageHistory = await this.getMessageHistory(createdAt!);
      const memory = (await readFromMemory()) ?? null;
      if (memory) {
        return [
          this.systemInstructions,
          { role: Role.user, content: `[MEMORY]: ${memory}` },
          { role: Role.user, content: content! },
          ...messageHistory,
        ];
      }
      return [this.systemInstructions, { role: Role.user, content: content! }, ...messageHistory];
    } else {
      const messageHistory = await this.getMessageHistory();
      return [this.systemInstructions, ...messageHistory];
    }
  }

  private async waitForPermission(toolCallId: string) {
    return new Promise<boolean>((resolve) => {
      this.permissionWaiters.set(toolCallId, resolve);
      /* We put the resolve function inside the waiters map,
      now untile we use this function like resolve(true/false),
      the promise will keep the agent loop pause (ofc we will use await)
      to do that as soon as we get the permission from CLI we will
      resolve the promise to the user's decision by using the 
      setPermission() method */
    });
  }

  public async setPermission(toolCallId: string, granted: boolean) {
    const resolve = this.permissionWaiters.get(toolCallId);
    if (resolve) {
      resolve(granted);
      this.permissionWaiters.delete(toolCallId);
    }
  }

  private async loop() {
    let finalBreak: boolean = false;
    while (finalBreak === false) {
      console.log('in the loop');
      this.isRunning = true;

      if (!this.messageQueue.at(0) && !this.userMessageQueue.at(0)) {
        this.messageQueue.splice(0, 1);
        console.error('message undefined');
        continue;
      }

      const userInput = this.messageQueue.at(0);

      if (
        userInput !== MessageQueueEvents.errorInLastIteration &&
        userInput !== MessageQueueEvents.lastReplyFromLLMWasEmpty &&
        userInput !== MessageQueueEvents.answerMessageBreakPreventer
      ) {
        const queuedMessage = this.userMessageQueue.at(0);
        if (queuedMessage) {
          await createMessage(this.sessionId, queuedMessage.content, Role.user);
          this.userMessageQueue.splice(0, 1);
          this.messageQueue.push(MessageQueueEvents.answerMessageBreakPreventer);
        }
      }
      this.messageQueue.splice(0, 1);

      const messages: MessageAPI[] = await this.createContext();
      // console.log(messages)
      if (this.contextWindowUsed >= this.contextWindow * 0.75) {
        try {
          console.log('started compacting...');
          const summary = await compaction(this.messagesHistory, this);
          if (summary) await addCompactionSummary(this.sessionId, summary);
          console.log(summary);
          console.log('stopped compacting...');
          continue;
        } catch (err) {
          console.log(err);
          continue;
        }
      }

      writeLogs(
        LogType.agent,
        this.projectDirectoryName,
        this.sessionId,
        'message sended waiting for response...',
      );
      const response = await this.client.chatCompletion(messages, this.model);
      writeLogs(LogType.agent, this.projectDirectoryName, this.sessionId, 'received first chunk');
      if (response.systemError) {
        writeLogs(
          LogType.agent,
          this.projectDirectoryName,
          this.sessionId,
          `Request failed: ${response.error} restarting loop...`,
        );
        this.messageQueue.push(MessageQueueEvents.errorInLastIteration);
        continue;
      }

      let contentType: ContentType = ContentType.unidentified;
      let toBreak: boolean = false;

      await new Promise((resolve, reject) => {
        const parentContentPropertyRegex = /^.*"content":.*$/m;
        const thoughtRegex = /^.*"thought":.*$/m;
        const answerRegex = /^.*"answer":.*$/m;
        const toolCallRegex = /^.*"tool_call":.*$/m;
        /*
        While contentType is unidentified we want to save the data in the full Reply
        we will use the thought , answer , toolCall Regex to identify the stream only in case of toolCall we will not produce event
        */
        const matchThought = '"thought":';
        const matchAnswer = '"answer":';

        let toolCall = false;
        let fullReply = '';
        let cleanedReplyForCLI = '';
        let buffer: string = '';

        let inParentContentProperty: boolean = false;
        const lineBuffer: string[] = [];
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
            const content = getContent(line, this);
            fullReply += content;
            if (inParentContentProperty) {
              if (contentType === ContentType.unidentified) {
                if (toolCallRegex.test(fullReply)) {
                  toolCall = true;
                  contentType = ContentType.tool_call;
                  // console.log("tool called !")
                  writeLogs(
                    LogType.agent,
                    this.projectDirectoryName,
                    this.sessionId,
                    'received a tool called',
                  );
                } else if (answerRegex.test(fullReply)) {
                  contentType = ContentType.answer;
                  cleanedReplyForCLI = fullReply.substring(
                    fullReply.indexOf(matchAnswer) + matchAnswer.length,
                  );
                  writeLogs(
                    LogType.agent,
                    this.projectDirectoryName,
                    this.sessionId,
                    'received an answer',
                  );
                  toBreak = true;
                } else if (thoughtRegex.test(fullReply)) {
                  contentType = ContentType.thought;
                  cleanedReplyForCLI = fullReply.substring(
                    fullReply.indexOf(matchThought) + matchThought.length,
                  );
                  writeLogs(
                    LogType.agent,
                    this.projectDirectoryName,
                    this.sessionId,
                    'received a thought',
                  );
                  this.messageQueue.push(MessageQueueEvents.lastReplyFromLLMWasThought);
                }
                lineBuffer.push(content);
              } else {
                if (!toolCall) {
                  // later we have to add stack based mechanizm to remove the curly braces
                  if (cleanedReplyForCLI.length) {
                    this.emit(contentType, cleanedReplyForCLI);
                    cleanedReplyForCLI = '';
                  }
                  this.emit(contentType, content);
                }
              }
            } else {
              if (parentContentPropertyRegex.test(fullReply)) {
                inParentContentProperty = true;
              }
            }
          }
        });
        response.response?.data.on('end', async () => {
          writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `[Context Window Used]: ${this.contextWindowUsed}`,
          );
          fullReply = extractFirstJSON(fullReply) ?? '';
          if (!fullReply) {
            writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              'Reply received was empty retrying...',
            );
            this.messageQueue.push(MessageQueueEvents.lastReplyFromLLMWasEmpty);
            toBreak = false;
            resolve('empty reply');
            return;
          }
          writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `[REPLY]: ${fullReply}`,
          );
          try {
            await createMessage(this.sessionId, fullReply, Role.assistant, toolCall);
            this.numberOfMessages += 1;
          } catch (err) {
            reject(new Error(`Unable to store assistant message to database: ${err}`));
          }
          if (toolCall) {
            try {
              let replyJson: MessageContent | undefined;
              try {
                replyJson = MessageContentSchema.parse(JSON.parse(fullReply));
              } catch (err) {
                reject('parsing error');
                createMessage(
                  this.sessionId,
                  `Their is an issue in the reply structure that you gave ${err}`,
                  Role.system,
                  false,
                );
                return;
              }
              if (replyJson) {
                const toolCalls = replyJson.content.tool_call;
                if (!toolCalls) {
                  resolve('no tool call');
                  return;
                }
                const toolCallsT: Tool[] = toolCalls.map((tool) => {
                  return {
                    id: tool.id,
                    name: tool.function,
                    arguments: tool.arguments,
                  };
                });
                const toolResults: ToolResult[] = [];

                const executeToolCall = async () => {
                  const tools: Tool[] = [];
                  for (const call of toolCallsT) {
                    if (call.name === 'shell') {
                      //execute nonShellToolCalls
                      if (tools.length !== 0) {
                        const nonShellToolResults = await this.mcpClient.callTools(tools);
                        toolResults.push(...nonShellToolResults);
                        tools.length = 0;
                      } else {
                        const parsed = ShellCallSchema.safeParse(call.arguments);
                        if (!parsed.success) {
                          await createMessage(
                            this.sessionId,
                            `Tool Call Syntax Error : received bad arguments for bash tool here is what you send ${JSON.stringify(call.arguments)} and here is the parsing error ${parsed.error}`,
                            Role.system,
                            false,
                          );
                        } else {
                          const permissionObject: UserPermission = {
                            toolCallId: call.id,
                            permission: false,
                            content: parsed.data.command,
                          };
                          // eslint-disable-next-line no-useless-assignment
                          let granted: boolean = false;
                          if (this.alwaysAllowBash === true) granted = true;
                          else {
                            this.emit(ContentType.permission, permissionObject);
                            granted = await this.waitForPermission(permissionObject.toolCallId);
                          }

                          if (granted) {
                            const rawResult = await shell(
                              parsed.data.command,
                              parsed.data.timeout!,
                            );
                            const fullResult: ToolResult = {
                              ...call,
                              result: JSON.stringify(rawResult),
                              error: rawResult.error,
                            };
                            toolResults.push(fullResult);
                          } else {
                            const fullResult: ToolResult = {
                              ...call,
                              result:
                                'Command execution denied by user. Ask the user for clarification or alternative instructions.',
                            };
                            toolResults.push(fullResult);
                          }
                        }
                      }
                    } else {
                      tools.push(call);
                    }
                  }
                  // If their is no shell tool call then just execute all
                  if (tools.length !== 0) {
                    const results = await this.mcpClient.callTools(tools);
                    toolResults.push(...results);
                  }
                };
                await executeToolCall();
                writeLogs(
                  LogType.agent,
                  this.projectDirectoryName,
                  this.sessionId,
                  `[TOOL RESULT]: ${toolResults}`,
                );

                let i = 0;
                while (i < toolResults.length) {
                  if (toolResults.at(i) === undefined) {
                    i++;
                    continue;
                  } else {
                    try {
                      const content = JSON.stringify(toolResults.at(i));
                      await createMessage(this.sessionId, content, Role.user, true);
                      // push into compined tool call array
                      this.emit(ContentType.tool_call, [
                        {
                          sessionId: this.sessionId,
                          content: content,
                          role: Role.user,
                          isToolResult: true,
                          messageIndex: null,
                          createdAt: Date.now(),
                        },
                      ]);
                      this.numberOfMessages += 1;
                    } catch (err) {
                      throw new Error(`Unable to store tool message to database`, { cause: err });
                    }
                  }
                  i += 1;
                }
                toolResults.length = 0;
                i = 0;
                this.messageQueue.push(MessageQueueEvents.toolCallDone);
              }
              // to-do save messages code below this
            } catch (err) {
              const fullErrMessage = `An error occured while resolving tool call at agent.ts: ${err}`;
              // console.log(fullErrMessage, "Sending error to llm");
              writeLogs(
                LogType.agent,
                this.projectDirectoryName,
                this.sessionId,
                `[TOOL CALL ERROR]: Informing LLM about it, \n${fullErrMessage}`,
              );
              createMessage(this.sessionId, fullErrMessage, Role.user);
              // this.messageQueue.push(MessageQueueSpecialElement.errorInLastIteration);
              reject(err);
            }
          }
          // toolCall = false;
          // fullReply = '';
          // this.emit('end', contentType);
          resolve('single iteration of loop done.');
        });
        response.response?.data.on('error', (err: Error) => {
          writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `Stream error: ${err}`,
          );
          reject(err);
        });
      }).catch((err) => {
        writeLogs(
          LogType.agent,
          this.projectDirectoryName,
          this.sessionId,
          `[PROMISE ERROR]: ${err}`,
        );
        this.messageQueue.push(MessageQueueEvents.errorInLastIteration);
      });

      // only abort if userMessage queue is empty
      if (this.userMessageQueue.length === 0 && toBreak) {
        this.isRunning = false;
        // this.emit('abort');
        writeLogs(LogType.agent, this.projectDirectoryName, this.sessionId, `Loop has ended`);
        // eslint-disable-next-line no-useless-assignment
        finalBreak = true;
        break;
      }
    }
  }

  async message(msg: Message) {
    this.userMessageQueue.push(msg);
    if (this.isRunning) {
      return;
    } else {
      writeLogs(LogType.agent, this.projectDirectoryName, this.sessionId, `Called loop`);
      await this.loop();
    }
  }

  async setModel(model: ModelsEnum, provider: ProvidersEnum) {
    this.model = model;
    this.contextWindow = Models[provider].models[model].contextLength;
  }

  setAllowAlwaysTrue() {
    this.alwaysAllowBash = true;
    for (const [toolCallId, resolve] of this.permissionWaiters) {
      resolve(true);
    }
    this.permissionWaiters.clear();
  }
}
