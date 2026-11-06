import { BabyPandaClient } from './client';
// import type { Message, MessageAPI, MessageContent, UserPermission } from '@baby-panda/types';
import type {
  UserPermission,
  MessagesArray,
  UserMessage,
  SystemMessage,
  AssistantMessage,
  ToolMessage,
} from '@baby-panda/types';
import {
  ContentType,
  LogType,
  // MessageContentSchema,
  ReasoningEffort,
  ShellCallSchema,
} from '@baby-panda/types';
import { Role } from '@baby-panda/types';
import type { UrlApi, Tool, ToolResult } from './types';
import { MessageQueueEvents } from './types';
import { readFileSync, existsSync, lstatSync, mkdirSync, writeFileSync } from 'fs';
import { EventEmitter } from 'events';
import { MCPClient } from './mcp/client';
import {
  getMessages,
  getSession,
  createMessage,
  getMostRecentCompactionSummary,
} from '@baby-panda/db';
// import { extractFirstJSON } from './utils/FirstJsonExtractor';
import path from 'path';
import { fileURLToPath } from 'url';
import { Models, ProvidersEnum } from '@agent/config/models';
import {
  appendResponse,
  // appendToolCallArray,
  getContent,
  type RawReplyChunkFromLLM,
} from '@/packages/agent/utils/extractFromRawLLMRes';
import { cleanMessages, contentToText, normalizeToolCalls } from './utils/cleanMessages';
// import { cleanMessages } from '@agent/utils/cleanMessages';
// import { extractStreamingField } from '@agent/utils/StreamingContentExtractor';
import { compaction } from '@agent/memory/services/compaction';
import { projectDir, memoryFile } from '@agent/memory/constants';
import { readFromMemory } from '@agent/memory/utils/memory';
import { writeLogs } from '@baby-panda/utils';
import { shell } from './mcp/tools/Shell/shell';
import type { ShellResult } from './mcp/tools/Shell/shell';
import { runSandboxed, type SandboxResult } from './mcp/tools/Shell/sandbox';
import {
  AgentToolCallSchema,
  type AgentToolCall,
  // type AgentToolCallUncertain,
} from './config/tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();

const instructionsFilePath = path.join(__dirname, 'memory', 'BabyPanda', 'BabyPanda.md');

// function parseMessageContent(rawReply: string) {
//   const parsed = JSON.parse(jsonrepair(rawReply)) as {
//     role?: unknown;
//     content?: {
//       // tool_call?: Array<{
//       //   id?: unknown;
//       //   type?: unknown;
//       //   function?: unknown;
//       //   arguments?: unknown;
//       // }>;
//       thought?: unknown;
//       answer?: unknown;
//     };
//   };

//   // if (Array.isArray(parsed.content?.tool_call)) {
//   //   parsed.content.tool_call = parsed.content.tool_call.map((call) => {
//   //     let args = call.arguments;
//   //     if (typeof args === 'string') {
//   //       args = JSON.parse(jsonrepair(args));
//   //     }

//   //     let functionName = call.function;
//   //     if (functionName && typeof functionName === 'object' && 'name' in functionName) {
//   //       functionName = functionName.name;
//   //     }

//   //     return {
//   //       ...call,
//   //       function: functionName,
//   //       arguments: args,
//   //     };
//   //   });
//   // }

//   return MessageContentSchema.parse(parsed);
// }

// let compact = true;
// type MessageHistory = Awaited<ReturnType<typeof getMessages>>;

export class BabyPandaAgent extends EventEmitter {
  client: BabyPandaClient;
  private isRunning = false;
  private messageQueue: MessageQueueEvents[] = [];
  private userMessageQueue: UserMessage[] = [];
  private messagesHistory: MessagesArray = [];
  private mcpClient: MCPClient;
  private cwd = cwd;
  private projectDirectoryName = '';
  private contextWindow: number = 0;
  public contextWindowUsed: number = 0;
  private systemInstructions: SystemMessage;
  private permissionWaiters = new Map<string, (granted: boolean) => void>(); // tool call id - permissionGranted
  private alwaysAllowBash = false; // when close session we reset this variable thats why not stored in db
  private sandbox = false;

  instructions: string;
  model: string;
  provider: ProvidersEnum;
  sessionId: string;
  reasoningEffort: ReasoningEffort;
  numberOfMessages: number = 0;

  constructor({ url, apikey }: UrlApi, sessionId: string) {
    super();
    console.log('agent cwd ', this.cwd);
    console.log(sessionId, 'in agent constructor');
    this.sessionId = sessionId;
    this.mcpClient = new MCPClient(this.sessionId);
    this.client = new BabyPandaClient({ url, apikey }, sessionId);
    this.provider = ProvidersEnum.Nvidia;
    this.model = 'minimaxai/minimax-m3.1-flash';
    this.instructions = readFileSync(instructionsFilePath, {
      encoding: 'utf-8',
    });
    this.reasoningEffort = ReasoningEffort.none;
    const defaultModel = Models.Nvidia.models[this.model];
    if (!defaultModel) {
      throw new Error(`Unknown default model: ${this.model}`);
    }
    this.contextWindow = defaultModel.contextLength;
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
  public setSandbox(sandbox: boolean) {
    this.sandbox = sandbox;
  }
  private async getMessageHistory(index: number = 0): Promise<MessagesArray> {
    const messageHistoryFromDb = await getMessages(this.sessionId, index);
    console.log('agent:MessageHistory');
    // Stored rows may miss `role` (or hold MCP-shaped content), so every entry
    // is normalized before the history is used for LLM requests.
    return cleanMessages(messageHistoryFromDb);
  }

  private async createContext(): Promise<MessagesArray> {
    const summary = await getMostRecentCompactionSummary(this.sessionId);
    if (summary) {
      const { content } = summary;
      const messageHistory = await this.getMessageHistory(summary.sequence);
      const memory = (await readFromMemory()) ?? null;
      if (memory) {
        return [
          this.systemInstructions,
          { role: Role.system, content: content! },
          { role: Role.user, content: `[MEMORY]: ${memory}` },
          ...messageHistory,
        ];
      }
      return [this.systemInstructions, { role: Role.system, content: content! }, ...messageHistory];
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

  private llmRawReplyIsEmpty(reply: RawReplyChunkFromLLM) {
    return reply.content === '' && reply.reasoning_content === '' && reply.tool_calls.length === 0;
  }

  private async loop() {
    // let finalBreak: boolean = false;
    while (true) {
      console.log('in the loop');
      this.isRunning = true;

      if (!this.messageQueue.at(0) && !this.userMessageQueue.at(0)) {
        writeLogs(
          LogType.agent,
          this.projectDirectoryName,
          this.sessionId,
          '[Message queue empty]',
        );
      }

      const userInput = this.messageQueue.at(0);

      if (
        userInput !== MessageQueueEvents.errorInLastIteration &&
        userInput !== MessageQueueEvents.lastReplyFromLLMWasEmpty &&
        userInput !== MessageQueueEvents.answerMessageBreakPreventer
      ) {
        if (this.userMessageQueue.length >= 1) {
          for (const msg of this.userMessageQueue) {
            await createMessage(this.sessionId, JSON.stringify(msg) ?? '', Role.user);
            await writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              `[USER]: ${msg.content}`,
            );
          }
          this.userMessageQueue.length = 0;
          this.messageQueue.push(MessageQueueEvents.answerMessageBreakPreventer);
        }
      }
      this.messageQueue.splice(0, 1);

      // console.log(messages)
      if (this.contextWindowUsed >= this.contextWindow * 0.75) {
        try {
          // console.log('started compacting...');
          await writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            '\n [COMPACTION] start \n',
          );
          const summary = await compaction(this);
          if (summary) {
            await createMessage(this.sessionId, summary, Role.compaction);
            this.contextWindowUsed = 0;
          }
          // console.log(summary);
          await writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            '\n [COMPACTION] done \n',
          );
          // console.log('stopped compacting...');
          continue;
        } catch (err) {
          await writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `\n [COMPACTION] error while compacting ${err}\n`,
          );
          this.isRunning = false;
          break;
        }
      }

      const messages = await this.createContext();

      await writeLogs(
        LogType.agent,
        this.projectDirectoryName,
        this.sessionId,
        'message sended waiting for response...',
      );
      const response = await this.client.chatCompletion(messages, this.model, this.reasoningEffort);
      await writeLogs(
        LogType.agent,
        this.projectDirectoryName,
        this.sessionId,
        'response headers received, waiting for stream data...',
      );
      if (response.systemError) {
        await writeLogs(
          LogType.agent,
          this.projectDirectoryName,
          this.sessionId,
          `Request failed: ${this.client.url} ${response.error} restarting loop...`,
        );
        this.messageQueue.push(MessageQueueEvents.errorInLastIteration);
        continue;
      }

      // let contentType: ContentType = ContentType.unidentified;
      // Set to true only when the model answered without any tool calls, so the
      // loop keeps running across tool-call turns and ends after a final answer.
      let toBreak = false;

      await new Promise((resolve, reject) => {
        // const parentContentPropertyRegex = /^.*"content":.*$/m;
        // const thoughtRegex = /^.*"thought":.*$/m;
        // const answerRegex = /^.*"answer":.*$/m;
        /*
        While contentType is unidentified we want to save the data in the full Reply
        we will use the thought , answer , toolCall Regex to identify the stream only in case of toolCall we will not produce event
        */
        let toolCall = false;
        // let responsePersisted = false;
        let fullReply: RawReplyChunkFromLLM = {
          content: '',
          reasoning_content: '',
          tool_calls: [],
          finish_reason: null,
        };
        // const streamedReply = '';
        let buffer: string = '';
        let finalized = false;
        let firstChunkAt: number | null = null;
        let lastChunkAt: number | null = null;
        const streamStartedAt = Date.now();

        // const inParentContentProperty: boolean = false;
        // const lineBuffer: string[] = [];
        const regex = /^data:\s/;

        const processLine = (rawLine: string) => {
          let line = rawLine.trim();
          if (!regex.test(line)) return;
          line = line.slice(6);
          if (line === '[DONE]') return;
          let content: RawReplyChunkFromLLM;
          try {
            content = getContent(line, this);
          } catch (err) {
            // A malformed chunk must never kill the whole turn; log it and continue.
            void writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              `[STREAM] skipping unparseable chunk: ${err instanceof Error ? err.message : String(err)}`,
            );
            return;
          }
          fullReply = appendResponse(fullReply, content);

          if (content.content.length > 0) {
            this.emit(ContentType.content, content.content);
          }
          if (content.reasoning_content.length > 0) {
            this.emit(ContentType.reasoning_content, content.reasoning_content);
          }
          // if (typeof content !== 'string') {
          //   toolCall = true;
          //   appendToolCallArray(toolCalls, content);
          // } else {
          //   fullReply += content;
          //   if (!inParentContentProperty && parentContentPropertyRegex.test(fullReply)) {
          //     inParentContentProperty = true;
          //   }

          //   if (inParentContentProperty) {
          //     if (contentType === ContentType.unidentified) {
          //       if (answerRegex.test(fullReply)) {
          //         contentType = ContentType.content;
          // void writeLogs(
          //   LogType.agent,
          //   this.projectDirectoryName,
          //   this.sessionId,
          //   'received an answer',
          // );
          //         toBreak = true;
          //       } else if (thoughtRegex.test(fullReply)) {
          //         contentType = ContentType.reasoning_content;
          //         void writeLogs(
          //           LogType.agent,
          //           this.projectDirectoryName,
          //           this.sessionId,
          //           'received a thought',
          //         );
          //         this.messageQueue.push(MessageQueueEvents.lastReplyFromLLMWasThought);
          //       }
          //       lineBuffer.push(content);
          //     }
          //     if (
          //       !toolCall &&
          //       (contentType === ContentType.content || contentType === ContentType.reasoning_content)
          //     ) {
          //       const field = contentType === ContentType.content ? 'answer' : 'thought';
          //       const visibleReply = extractStreamingField(fullReply, field);
          //       if (visibleReply.length > streamedReply.length) {
          //         this.emit(contentType, visibleReply.slice(streamedReply.length));
          //         streamedReply = visibleReply;
          //       }
          //     }
          //   }
          // }
        };

        response.response?.data.on('data', (chunk: Buffer | string) => {
          const now = Date.now();
          if (firstChunkAt == null) {
            firstChunkAt = now;
            void writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              `[STREAM] first byte received ${now - streamStartedAt}ms after headers`,
            );
          } else if (lastChunkAt != null && now - lastChunkAt > 30_000) {
            void writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              `[STREAM] stalled: ${Math.round((now - lastChunkAt) / 1000)}s between chunks`,
            );
          }
          lastChunkAt = now;
          const encodedChunk = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
          buffer += encodedChunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) processLine(line);
        });
        const finalizeStream = async (reason: string): Promise<void> => {
          if (finalized) {
            void writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              `[STREAM] ${reason}: stream was already finalized, ignoring duplicate finalize`,
            );
            return;
          }
          finalized = true;
          // Release the socket so aborted connections do not linger.
          response.response?.data.destroy?.();
          await writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `[STREAM] finalized by ${reason} after ${Date.now() - streamStartedAt}ms | finish_reason=${fullReply.finish_reason} | content=${fullReply.content.length} chars | reasoning=${fullReply.reasoning_content.length} chars | tool_calls=${fullReply.tool_calls.length}`,
          );
          processLine(buffer);
          buffer = '';
          if (fullReply.tool_calls.length > 0) toolCall = true;

          await writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `[Context Window Used]: ${this.contextWindowUsed}`,
          );

          if (this.llmRawReplyIsEmpty(fullReply)) {
            await writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              'Reply received was empty retrying...',
            );
            this.messageQueue.push(MessageQueueEvents.lastReplyFromLLMWasEmpty);
            resolve('empty reply');
            return;
          }

          const assistantMessage: AssistantMessage = {
            role: Role.assistant,
            content: fullReply.content,
            reasoning_content: fullReply.reasoning_content,
            tool_calls: normalizeToolCalls(fullReply.tool_calls),
          };
          await createMessage(this.sessionId, JSON.stringify(assistantMessage), Role.assistant);

          // if (!toolCall) {
          /*

            common store to db fn
            
             
             */
          // if (!fullReply && fullReply.trim().length > 0) {
          //   this.emit(ContentType.content, fullReply);
          //   await createMessage(this.sessionId, fullReply, Role.assistant);
          //   responsePersisted = true;
          //   toBreak = true;
          //   await writeLogs(
          //     LogType.agent,
          //     this.projectDirectoryName,
          //     this.sessionId,
          //     `[REPLY]: ${fullReply}`,
          //   );
          //   resolve('single iteration of loop done.');
          //   return;
          // }
          // fullReply = fullReply ?? '';
          // if (!fullReply && toolCalls.length === 0) {
          //   await writeLogs(
          //     LogType.agent,
          //     this.projectDirectoryName,
          //     this.sessionId,
          //     'Reply received was empty retrying...',
          //   );
          //   this.messageQueue.push(MessageQueueEvents.lastReplyFromLLMWasEmpty);
          //   toBreak = false;
          //   resolve('empty reply');
          //   return;
          // }
          // let parsedReply: MessageContent;
          // try {
          //   parsedReply = parseMessageContent(fullReply);
          // } catch (error) {
          //   reject(new Error(`Unable to parse model response: ${String(error)}`));
          //   return;
          // }
          // const parsedContent = parsedReply.content;
          // if (contentType === ContentType.unidentified) {
          //   try {
          //     if (typeof parsedContent.answer === 'string') {
          //       contentType = ContentType.content;
          //       toBreak = true;
          //     } else if (typeof parsedContent.thought === 'string') {
          //       contentType = ContentType.reasoning_content;
          //       this.messageQueue.push(MessageQueueEvents.lastReplyFromLLMWasThought);
          //       if (streamedReply.length === 0) {
          //         this.emit(ContentType.reasoning_content, parsedContent.thought);
          //       }
          //     }
          //   } catch (err) {
          //     reject(new Error(`Unable to classify model response: ${String(err)}`));
          //     return;
          //   }
          // } else if (
          //   contentType === ContentType.reasoning_content &&
          //   parsedContent.thought != undefined
          // ) {
          //   if (!this.messageQueue.includes(MessageQueueEvents.lastReplyFromLLMWasThought)) {
          //     this.messageQueue.push(MessageQueueEvents.lastReplyFromLLMWasThought);
          //   }
          //   await createMessage(this.sessionId, parsedContent.thought, Role.thought, false);
          //   responsePersisted = true;
          // } else if (contentType === ContentType.content && parsedContent.answer !== undefined) {
          //   await createMessage(this.sessionId, parsedContent.answer, Role.assistant, false);
          //   responsePersisted = true;
          // }
          // await writeLogs(
          //   LogType.agent,
          //   this.projectDirectoryName,
          //   this.sessionId,
          //   `[REPLY]: ${fullReply}`,
          // );
          // }
          if (toolCall) {
            try {
              // try {
              //   replyJson = parseMessageContent(fullReply);
              // } catch (err) {
              //   reject(new Error(`Unable to parse model tool call: ${String(err)}`));

              //   await createMessage(
              //     this.sessionId,
              //     `Their is an issue in the reply structure that you gave ${err}`,
              //     Role.system,
              //     false,
              //   );
              //   return;
              // }
              // const toolCalls = replyJson.content.tool_call;
              const toolCalls = fullReply.tool_calls;
              const toolCallsT: AgentToolCall[] = toolCalls.filter(Boolean).map((tool) => {
                const parsedTool = AgentToolCallSchema.safeParse(tool);
                if (parsedTool.success) {
                  return parsedTool.data;
                } else {
                  throw parsedTool.error;
                }
              });

              const visibleToolCalls = toolCallsT
                .filter((tool) => tool.function.name !== 'write' && tool.function.name !== 'edit')
                .map((tool) => ({
                  sessionId: this.sessionId,
                  content: JSON.stringify({
                    name: tool.function.name,
                    argument: tool.function.arguments,
                  }),
                  role: Role.tool,
                }));
              if (visibleToolCalls.length > 0) {
                this.emit(ContentType.tool_call, visibleToolCalls);
              }

              const toolResults: ToolResult[] = [];

              const executeToolCall = async () => {
                const MCPTools: Tool[] = [];
                for (const rawcall of toolCallsT) {
                  const call: Tool = {
                    id: rawcall.id,
                    name: rawcall.function.name,
                    arguments: JSON.parse(rawcall.function.arguments),
                  };
                  await writeLogs(
                    LogType.agent,
                    this.projectDirectoryName,
                    this.sessionId,
                    `[TOOL CALL] id=${call.id} name=${call.name} arguments=${JSON.stringify(call.arguments)}`,
                  );
                  if (call.name === 'shell') {
                    //execute nonShellToolCalls
                    if (MCPTools.length !== 0) {
                      await writeLogs(
                        LogType.agent,
                        this.projectDirectoryName,
                        this.sessionId,
                        `[TOOL CALL BATCH] executing ${MCPTools.length} non-shell tool(s) before shell: ${JSON.stringify(
                          MCPTools.map((tool) => ({
                            id: tool.id,
                            name: tool.name,
                            arguments: tool.arguments,
                          })),
                        )}`,
                      );
                      const nonShellToolResults = await this.mcpClient.callTools(MCPTools);
                      toolResults.push(...nonShellToolResults);
                      MCPTools.length = 0;
                    } else {
                      const parsed = ShellCallSchema.safeParse(call.arguments);
                      if (!parsed.success) {
                        await createMessage(
                          this.sessionId,
                          `Tool Call Syntax Error : received bad arguments for bash tool here is what you send ${JSON.stringify(call.arguments)} and here is the parsing error ${parsed.error}`,
                          Role.tool,
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
                          // eslint-disable-next-line no-useless-assignment
                          let rawResult: ShellResult | null | SandboxResult = null;

                          await writeLogs(
                            LogType.agent,
                            this.projectDirectoryName,
                            this.sessionId,
                            `[TOOL CALL EXECUTING] shell sandbox=${this.sandbox} command=${JSON.stringify(parsed.data.command)} timeout=${parsed.data.timeout ?? 'default'}ms`,
                          );
                          const shellStartedAt = Date.now();
                          if (this.sandbox) {
                            rawResult = await runSandboxed({
                              workspace: process.cwd(),
                              command: parsed.data.command,
                              timeoutMs: parsed.data.timeout,
                            });
                            await writeLogs(
                              LogType.agent,
                              this.projectDirectoryName,
                              this.sessionId,
                              `[TOOL RESULT] shell (sandboxed, ${Date.now() - shellStartedAt}ms) ${JSON.stringify(rawResult)}`,
                            );
                          } else {
                            rawResult = await shell(parsed.data.command, parsed.data.timeout!);
                            await writeLogs(
                              LogType.agent,
                              this.projectDirectoryName,
                              this.sessionId,
                              `[TOOL RESULT] shell (${Date.now() - shellStartedAt}ms) ${JSON.stringify(rawResult)}`,
                            );
                          }

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
                    MCPTools.push(call);
                  }
                }
                // If their is no shell tool call then just execute all
                if (MCPTools.length !== 0) {
                  await writeLogs(
                    LogType.agent,
                    this.projectDirectoryName,
                    this.sessionId,
                    `[TOOL CALL BATCH] executing ${MCPTools.length} non-shell tool(s): ${JSON.stringify(
                      MCPTools.map((tool) => ({
                        id: tool.id,
                        name: tool.name,
                        arguments: tool.arguments,
                      })),
                    )}`,
                  );
                  const results = await this.mcpClient.callTools(MCPTools);
                  toolResults.push(...results);
                }
              };
              await executeToolCall();
              await writeLogs(
                LogType.agent,
                this.projectDirectoryName,
                this.sessionId,
                `[TOOL RESULT] all tool calls finished, ${toolResults.length} result(s): ${JSON.stringify(
                  toolResults.map((result) => ({
                    id: result.id,
                    name: result.name,
                    error: result.error ?? null,
                    resultPreview: String(result.result).slice(0, 1000),
                  })),
                )}`,
              );

              let i = 0;
              while (i < toolResults.length) {
                if (toolResults.at(i) === undefined) {
                  i++;
                  continue;
                } else {
                  try {
                    const toolResult = toolResults.at(i);
                    if (toolResult == undefined) continue;
                    const toolMessage: ToolMessage = {
                      role: Role.tool,
                      tool_call_id: toolResult.id,
                      content: toolResult.error ?? contentToText(toolResult.result),
                    };
                    await createMessage(this.sessionId, JSON.stringify(toolMessage), Role.tool);
                  } catch (err) {
                    throw new Error(`Unable to store tool message to database`, { cause: err });
                  }
                }
                i += 1;
              }
              toolResults.length = 0;
              i = 0;
              this.messageQueue.push(MessageQueueEvents.toolCallDone);
              // to-do save messages code below this
            } catch (err) {
              const fullErrMessage = `An error occured while resolving tool call at agent.ts: ${err instanceof Error ? `${err.message} ${err.cause}` : err}`;
              await createMessage(this.sessionId, fullErrMessage, Role.user);
              reject(fullErrMessage);
            }
          }

          if (fullReply.tool_calls.length === 0) {
            // The model produced a final answer without tool calls, so this
            // turn is complete and the loop may end.
            toBreak = true;
          }

          resolve('single iteration of loop done.');
        };
        response.response?.data.on('end', async () => {
          await finalizeStream('stream end reached');
        });
        response.response?.data.on('error', async (err: Error) => {
          void writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `Stream error: ${err}`,
          );
          if (this.llmRawReplyIsEmpty(fullReply)) {
            void writeLogs(
              LogType.agent,
              this.projectDirectoryName,
              this.sessionId,
              `[STREAM] no usable data was received before the stream error, failing this attempt | firstByte=${firstChunkAt != null ? `${firstChunkAt - streamStartedAt}ms after headers` : 'n/a'}`,
            );
            reject(err);
            return;
          }
          // NVIDIA closes the stream without sending `data: [DONE]`, which Node
          // surfaces as `Error: aborted`. If deltas were already received the
          // reply must be salvaged, persisted and its tool calls executed,
          // instead of discarding everything and re-sending the request.
          void writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            `[STREAM] salvaging the already received reply despite the stream error: ${err}`,
          );
          await finalizeStream(`stream error salvaged [${err}]`);
        });
      }).catch(async (err) => {
        await writeLogs(
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
        await writeLogs(LogType.agent, this.projectDirectoryName, this.sessionId, `Loop has ended`);
        // finalBreak = true;
        this.emit('end');
        break;
      }
    }
  }

  async message(msg: UserMessage) {
    this.userMessageQueue.push(msg);
    if (this.isRunning) {
      return;
    } else {
      await writeLogs(LogType.agent, this.projectDirectoryName, this.sessionId, `Called loop`);
      await this.loop();
    }
  }

  async setModel(model: string, provider: ProvidersEnum) {
    const modelDetails = Models[provider].models[model];
    if (!modelDetails) {
      throw new Error(`Unknown model "${model}" for provider "${provider}"`);
    }
    this.model = model;
    this.provider = provider;
    this.contextWindow = modelDetails.contextLength;
    if (!modelDetails.reasoningEfforts.includes(this.reasoningEffort)) {
      this.reasoningEffort = modelDetails.reasoningEfforts[0] ?? ReasoningEffort.none;
    }
  }

  setReasoningEffort(reasoningEffort: ReasoningEffort) {
    this.reasoningEffort = reasoningEffort;
  }

  getModelState() {
    return {
      provider: this.provider,
      model: this.model,
      contextWindow: this.contextWindow,
      contextWindowUsed: this.contextWindowUsed,
      reasoningEffort: this.reasoningEffort,
      reasoningEfforts: Models[this.provider].models[this.model]?.reasoningEfforts ?? [
        ReasoningEffort.none,
      ],
    };
  }

  setAllowAlwaysTrue() {
    this.alwaysAllowBash = true;
    for (const resolve of this.permissionWaiters.values()) {
      resolve(true);
    }
    this.permissionWaiters.clear();
  }
}
