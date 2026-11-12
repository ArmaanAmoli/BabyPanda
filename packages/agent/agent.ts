import { BabyPandaClient } from './client';
import type {
  UserPermission,
  MessagesArray,
  UserMessage,
  SystemMessage,
  AssistantMessage,
  ToolMessage,
  WsToolCallRequest,
  WsToolResultEvent,
  WsToolCallStats,
  WsToolPageResult,
  ToolResultRecord,
} from '@baby-panda/types';
import {
  ContentType,
  LogType,
  // MessageContentSchema,
  ReasoningEffort,
  ShellCallSchema,
  ToolError,
} from '@baby-panda/types';
import { Role } from '@baby-panda/types';
import type { SkillMessage } from '@baby-panda/types';
import type { UrlApi, Tool, ToolResult } from './types';
import { MessageQueueEvents } from './types';
import {
  readFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  writeFileSync,
  promises as fsPromises,
} from 'fs';
import { EventEmitter } from 'events';
import { MCPClient } from './mcp/client';
import {
  getMessages,
  getSession,
  createMessage,
  getMostRecentCompactionSummary,
} from '@baby-panda/db';
import path from 'path';
import { fileURLToPath } from 'url';
import { Models, ProvidersEnum } from '@agent/config/models';
import {
  appendResponse,
  getContent,
  type RawReplyChunkFromLLM,
} from '@/packages/agent/utils/extractFromRawLLMRes';
import { cleanMessages, normalizeToolCalls } from './utils/cleanMessages';
import { compaction } from '@agent/memory/services/compaction';
import { projectDir, memoryFile } from '@agent/memory/constants';
import { readFromMemory } from '@agent/memory/utils/memory';
import {
  writeLogs,
  getSkillsFiles,
  getSkillsInstructions,
  getSkillByName,
  readSkillBody,
  applySkillArguments,
  wrapSkillContent,
} from '@baby-panda/utils';
import type { SkillEventPayload } from '@baby-panda/types';
import { shell } from './mcp/tools/Shell/shell';
import type { ShellResult } from './mcp/tools/Shell/shell';
import { runSandboxed, type SandboxResult } from './mcp/tools/Shell/sandbox';
import { AgentToolCallSchema, type AgentToolCall } from './config/tools';
import { getAgentInstructions } from './memory/services/fetchAgentInstructions';
// import { getSkillsFiles, getSkillsInstructions } from './skill/skill';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();

const instructionsFilePath = path.join(__dirname, 'memory', 'BabyPanda', 'BabyPanda.md');

function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through: malformed arguments become an empty object
  }
  return {};
}

/** Extract the concatenated text of an MCP CallToolResult. */
function mcpResultText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result != null && typeof result === 'object' && 'content' in result) {
    const content = (result as { content: unknown }).content;
    if (Array.isArray(content)) {
      return content
        .map((item) =>
          item != null &&
          typeof item === 'object' &&
          'text' in item &&
          typeof (item as { text: unknown }).text === 'string'
            ? (item as { text: string }).text
            : '',
        )
        .join('');
    }
  }
  return JSON.stringify(result ?? '');
}

/** Per-tool stats for the CLI bullets, derived from arguments + result text. */
function computeToolStats(
  name: string,
  args: Record<string, unknown>,
  resultText: string,
  failed: boolean,
): WsToolCallStats | undefined {
  if (failed) return undefined;
  switch (name) {
    case 'write': {
      const content = typeof args['content'] === 'string' ? (args['content'] as string) : '';
      return { lines: countLines(content) };
    }
    case 'edit': {
      const oldStr = typeof args['old_str'] === 'string' ? (args['old_str'] as string) : '';
      const newStr = typeof args['new_str'] === 'string' ? (args['new_str'] as string) : '';
      return { added: countLines(newStr), removed: countLines(oldStr) };
    }
    case 'grep': {
      try {
        const parsed: unknown = JSON.parse(resultText);
        const stdout =
          parsed != null &&
          typeof parsed === 'object' &&
          typeof (parsed as { stdout?: unknown }).stdout === 'string'
            ? ((parsed as { stdout: string }).stdout as string)
            : '';
        return { matches: stdout.split('\n').filter((line) => line.length > 0).length };
      } catch {
        return undefined;
      }
    }
    case 'web_search': {
      try {
        const parsed: unknown = JSON.parse(resultText);
        return Array.isArray(parsed) ? { results: parsed.length } : undefined;
      } catch {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

/** Per-URL outcomes for get_web_page: one entry per requested URL. */
function computeToolPages(
  name: string,
  args: Record<string, unknown>,
  resultText: string,
  error: string | undefined,
): WsToolPageResult[] | undefined {
  if (name !== 'get_web_page') return undefined;
  const urls = Array.isArray(args['url'])
    ? (args['url'] as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];
  if (error !== undefined) {
    return urls.map((url) => ({ url, success: false, error }));
  }
  try {
    const parsed: unknown = JSON.parse(resultText);
    const returned = new Set(
      Array.isArray(parsed)
        ? parsed
            .map((item) =>
              item != null &&
              typeof item === 'object' &&
              typeof (item as { url?: unknown }).url === 'string'
                ? (item as { url: string }).url
                : undefined,
            )
            .filter((url): url is string => url !== undefined)
        : [],
    );
    return urls.map((url) =>
      returned.has(url)
        ? { url, success: true }
        : { url, success: false, error: 'no content returned for this url' },
    );
  } catch {
    return urls.map((url) => ({ url, success: false, error: 'unparseable result' }));
  }
}

/**
 * File content immediately before a write/edit mutation. Returns null when
 * the file does not exist (new file), undefined for non-file tools.
 */
async function captureBeforeContent(
  name: string,
  args: Record<string, unknown>,
): Promise<string | null | undefined> {
  if (name !== 'write' && name !== 'edit') return undefined;
  const filePath = args['path'];
  if (typeof filePath !== 'string') return undefined;
  try {
    return await fsPromises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export class BabyPandaAgent extends EventEmitter {
  client: BabyPandaClient;
  private isRunning = false;
  private messageQueue: MessageQueueEvents[] = [];
  private userMessageQueue: UserMessage[] = [];
  private messagesHistory: MessagesArray = [];
  private mcpClient: MCPClient;
  private cwd = cwd;
  public projectDirectoryName = '';
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
    const context: MessagesArray = [this.systemInstructions];
    const memory = (await readFromMemory()) ?? null;

    if (memory) {
      context.push({ role: Role.system, content: memory });
    }

    //fetch AGENT.md | BABYPANDA.md and insert it in the context.
    const instructions = await getAgentInstructions();
    context.push(...instructions);

    //fetch metadata of all SKILL.md in ./.babypanda folder

    const skillInstruction = getSkillsInstructions();
    const listOfAvailableSkills = (await getSkillsFiles())
      .filter((skill) => !skill.disableModelInvocation) // user-only skills are never listed for the model
      .map((skill) => {
        const hint = skill.argumentHint ? ` ${skill.argumentHint}` : '';
        return `- ${skill.name}${hint} : ${skill.description} (${skill.source})`;
      })
      .join('\n');

    if (listOfAvailableSkills.length > 0) {
      const listOfAvailableSkillsWithInstructions: SystemMessage = {
        role: Role.system,
        content: skillInstruction + '\n' + listOfAvailableSkills,
      };
      context.push(listOfAvailableSkillsWithInstructions);
    }

    let summary: Awaited<ReturnType<typeof getMostRecentCompactionSummary>> | undefined = undefined;
    try {
      summary = await getMostRecentCompactionSummary(this.sessionId);
    } catch (err) {
      writeLogs(LogType.agent, this.projectDirectoryName, this.sessionId, `${err}`);
    }

    const messageHistory: MessagesArray = [];
    if (summary) {
      // fetch 10 messages before the compaction summary.
      messageHistory.push(JSON.parse(summary.content));
      messageHistory.push(...(await this.getMessageHistory(summary.sequence + 1)));
    } else {
      messageHistory.push(...(await this.getMessageHistory()));
    }

    context.push(...messageHistory);
    return context;
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
    const continuePrompt: UserMessage = {
      role: Role.user,
      content: 'Continue',
    };

    let injectContinuePrompt: boolean = false;
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
        userInput !== MessageQueueEvents.lastReplyFromLLMWasEmpty
        // userInput !== MessageQueueEvents.answerMessageBreakPreventer
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
          // this.messageQueue.push(MessageQueueEvents.answerMessageBreakPreventer);
        }
      }
      this.messageQueue.splice(0, 1);

      if (this.contextWindowUsed >= this.contextWindow * 0.75) {
        try {
          await writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            '\n [COMPACTION] start \n',
          );
          const summary = await compaction(this);
          if (summary) {
            /* Storing compaction result as tool because provider only support native roles user , tool , assistant , system */
            const compactionMessage: UserMessage = {
              role: Role.user,
              content: summary.content,
              // reasoning_content: '',
              // tool_calls: [],
            };

            await createMessage(this.sessionId, JSON.stringify(compactionMessage), Role.compaction);
            this.contextWindowUsed = 0;
          }
          await writeLogs(
            LogType.agent,
            this.projectDirectoryName,
            this.sessionId,
            '\n [COMPACTION] done \n',
          );
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
      // some models dont validate assistant prompt at the end. They only allow role: user | tool as the last message
      if (injectContinuePrompt) {
        messages.push(continuePrompt);
        injectContinuePrompt = false;
      }

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

      let toBreak = false;

      await new Promise((resolve, reject) => {
        let toolCall = false;
        let fullReply: RawReplyChunkFromLLM = {
          content: '',
          reasoning_content: '',
          tool_calls: [],
          finish_reason: null,
        };
        let buffer: string = '';
        let finalized = false;
        let firstChunkAt: number | null = null;
        let lastChunkAt: number | null = null;
        const streamStartedAt = Date.now();
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

          if (toolCall) {
            try {
              const toolCalls = fullReply.tool_calls;
              const toolCallsT: AgentToolCall[] = toolCalls.filter(Boolean).map((tool) => {
                const parsedTool = AgentToolCallSchema.safeParse(tool);
                if (parsedTool.success) {
                  return parsedTool.data;
                } else {
                  /*
                   add this error as tool result for agent
                  */
                  const errorMessage = `Tool Call Syntax Error : id -> ${tool.id}  , error -> ${parsedTool.error}, If ID is undefined here is the index of that tool_call from the tool call array you sended before this message index=${tool.index}`;
                  const toolErrorMessage: ToolMessage = {
                    tool_call_id: tool.id ?? 'undefined',
                    role: Role.tool,
                    content: errorMessage,
                  };
                  createMessage(this.sessionId, JSON.stringify(toolErrorMessage), Role.tool);
                  throw new ToolError(errorMessage);
                }
              });

              // One request batch per assistant message, all tools included
              // (write/edit included so the CLI can render their diffs).
              const toolCallRequests: WsToolCallRequest[] = toolCallsT.map((tool) => ({
                id: tool.id,
                name: tool.function.name,
                arguments: parseToolArguments(tool.function.arguments),
              }));
              this.emit(ContentType.tool_call, toolCallRequests);

              // Persists the extended tool row and notifies the CLI, so a
              // call's status/before/stats are visible live and after reload.
              const persistAndEmitResult = async (
                call: Tool,
                content: string,
                success: boolean,
                error: string | undefined,
                before: string | null | undefined,
                stats: WsToolCallStats | undefined,
                pages: WsToolPageResult[] | undefined,
              ) => {
                const record: ToolResultRecord = {
                  role: Role.tool,
                  tool_call_id: call.id,
                  content,
                  success,
                  ...(error !== undefined ? { error } : {}),
                  ...(before !== undefined ? { before } : {}),
                  ...(stats !== undefined ? { stats } : {}),
                  ...(pages !== undefined ? { pages } : {}),
                };
                await createMessage(this.sessionId, JSON.stringify(record), Role.tool);
                const event: WsToolResultEvent = {
                  id: call.id,
                  name: call.name,
                  success,
                  ...(error !== undefined ? { error } : {}),
                  ...(before !== undefined ? { before } : {}),
                  ...(stats !== undefined ? { stats } : {}),
                  ...(pages !== undefined ? { pages } : {}),
                };
                this.emit(ContentType.tool_result, event);
              };

              // Executes one non-shell tool and reports the outcome. write/edit
              // always run through here individually so `before` is captured
              // immediately before that mutation (a later edit to the same file
              // must not reuse an older snapshot).
              const executeSingleMcpTool = async (call: Tool) => {
                const args = call.arguments ?? {};
                const before = await captureBeforeContent(call.name, args);
                const raw: ToolResult = await this.mcpClient.callToolRaw(call);
                const content = JSON.stringify(raw);
                const resultText = mcpResultText(raw.result);
                const stats = computeToolStats(call.name, args, resultText, raw.error != null);
                const pages = computeToolPages(call.name, args, resultText, raw.error);
                await persistAndEmitResult(
                  call,
                  content,
                  raw.error == null,
                  raw.error,
                  before,
                  stats,
                  pages,
                );
              };

              // Executes one shell call: validates the arguments, asks the
              // user for permission (unless always-allow is on), runs the
              // command (sandboxed when enabled) and reports the outcome.
              const executeShellCall = async (call: Tool) => {
                const parsed = ShellCallSchema.safeParse(call.arguments);
                if (!parsed.success) {
                  const errorMessage = `Tool Call Syntax Error : received bad arguments for bash tool here is what you send ${JSON.stringify(call.arguments)} and here is the parsing error ${parsed.error}`;
                  const toolErrorMessage: ToolMessage = {
                    role: Role.tool,
                    tool_call_id: call.id,
                    content: errorMessage,
                  };
                  await createMessage(this.sessionId, JSON.stringify(toolErrorMessage), Role.tool);
                  throw new ToolError(errorMessage);
                }
                const permissionObject: UserPermission = {
                  toolCallId: call.id,
                  permission: false,
                  content: parsed.data.command,
                };
                let granted: boolean = this.alwaysAllowBash === true;
                if (!granted) {
                  this.emit(ContentType.permission, permissionObject);
                  granted = await this.waitForPermission(permissionObject.toolCallId);
                }

                if (granted) {
                  let rawResult: ShellResult | SandboxResult;

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

                  await persistAndEmitResult(
                    call,
                    JSON.stringify(rawResult),
                    true,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                  );
                } else {
                  const deniedMessage =
                    '[PERMISSION DENIED] Command execution denied by user. Ask the user for clarification or alternative instructions.';
                  await persistAndEmitResult(
                    call,
                    deniedMessage,
                    false,
                    deniedMessage,
                    undefined,
                    undefined,
                    undefined,
                  );
                }
              };

              const executeToolCall = async () => {
                const MCPTools: Tool[] = [];
                const flushBatch = async () => {
                  for (const batched of MCPTools) {
                    await executeSingleMcpTool(batched);
                  }
                  MCPTools.length = 0;
                };
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
                    // run pending non-shell tools first so execution order is
                    // preserved, then handle the shell call itself — it must
                    // never be skipped, otherwise no permission prompt is sent
                    // and the CLI stays stuck on "running"
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
                      await flushBatch();
                    }
                    await executeShellCall(call);
                  } else if (call.name === 'write' || call.name === 'edit') {
                    // file mutations run individually (after flushing pending
                    // tools) so the before-snapshot is taken right before the
                    // mutation, in execution order
                    await flushBatch();
                    await executeSingleMcpTool(call);
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
                  await flushBatch();
                }
              };
              await executeToolCall();
              await writeLogs(
                LogType.agent,
                this.projectDirectoryName,
                this.sessionId,
                `[TOOL RESULT] all tool calls finished`,
              );

              this.messageQueue.push(MessageQueueEvents.toolCallDone);
              // to-do save messages code below this
            } catch (err) {
              if (err! instanceof ToolError) {
                // tool specific errors were already added.
                const fullErrMessage = `An error occured while resolving tool call: ${err instanceof Error ? `${err.message} ${err.cause}` : err}`;
                void writeLogs(
                  LogType.mcp,
                  this.projectDirectoryName,
                  this.sessionId,
                  fullErrMessage,
                );
                reject(fullErrMessage);
              } else {
                void writeLogs(LogType.mcp, this.projectDirectoryName, this.sessionId, `${err}`);
                reject(`${err}`);
              }
            }
          }

          if (
            fullReply.tool_calls.length === 0 &&
            fullReply.finish_reason !== 'length' &&
            fullReply.finish_reason !== null
          ) {
            // The model produced a final answer without tool calls or
            // reaches end of turn, so this
            // turn is complete and the loop may end.
            toBreak = true;
          } else {
            if (
              (fullReply.tool_calls.length === 0 && fullReply.finish_reason == 'length') ||
              fullReply.finish_reason == null
            ) {
              // inject continue prompt
              injectContinuePrompt = true;
            }
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

  /**
   * Activates a skill on behalf of the user (`/<skill-name> [args...]` from the
   * CLI). The SKILL.md body (frontmatter stripped, `$arg` placeholders filled)
   * is wrapped in a <skill> tag and persisted as a role='skill' row, keeping
   * its sequence position in the history. Any leftover text after the declared
   * arguments is queued as a normal user message. Emits a 'skill' event with a
   * SkillEventPayload so the server can notify the CLI; on failure nothing is
   * persisted.
   */
  async injectSkill(name: string, args?: string) {
    try {
      const skill = await getSkillByName(name);
      if (!skill) {
        throw new Error(`unknown skill "${name}"`);
      }
      const body = await readSkillBody(skill.filePath);
      const { content, leftover } = applySkillArguments(body, skill.arguments ?? [], args ?? '');
      const wrapped = wrapSkillContent(skill.name, content);
      const stored: SkillMessage = { role: Role.user, name: skill.name, content: wrapped };
      await createMessage(this.sessionId, JSON.stringify(stored), Role.skill);
      await writeLogs(
        LogType.agent,
        this.projectDirectoryName,
        this.sessionId,
        `[SKILL] loaded ${skill.name} (${skill.source}) args=${JSON.stringify(args ?? '')}`,
      );
      const payload: SkillEventPayload = { name: skill.name, ok: true };
      this.emit('skill', payload);
      if (leftover.trim().length > 0) {
        // leftover text is the user's actual message; do not await the loop
        void this.message({ role: Role.user, content: leftover });
      }
    } catch (err) {
      await writeLogs(
        LogType.agent,
        this.projectDirectoryName,
        this.sessionId,
        `[SKILL] failed to load ${name}: ${err}`,
      );
      const payload: SkillEventPayload = {
        name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      this.emit('skill', payload);
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
