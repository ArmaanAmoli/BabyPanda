import type { MessagesArray, SystemMessage, UserMessage } from '@baby-panda/types';
import { LogType, Role } from '@baby-panda/types';
// import { MessageContentSchema } from '@baby-panda/types';
import { BabyPandaAgent } from '@agent/agent';
import { readFileSync } from 'fs';
import {
  appendResponse,
  getContent,
  type RawReplyChunkFromLLM,
} from '@/packages/agent/utils/extractFromRawLLMRes';
import { cleanMessages, normalizeToolCalls } from '@agent/utils/cleanMessages';
// import { jsonrepair } from 'jsonrepair';

import path from 'path';
import { fileURLToPath } from 'url';
import { getMostRecentCompactionSummary, getMessagesForSummary } from '@baby-panda/db';
import { writeLogs } from '@baby-panda/utils';

const MAX_RETRIES = 2;
const MAX_CONTINUES = 3;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const systemInstructionFilePath = path.join(__dirname, 'BabyPanda', 'BabyPanda.md');
const CompactionInstructionFilePath = path.join(__dirname, 'BabyPanda', 'Compaction.md');

export async function compaction(agent: BabyPandaAgent) {
  type T = Awaited<ReturnType<typeof getMessagesForSummary>>;
  // eslint-disable-next-line no-useless-assignment
  let messages: T = [];

  const sessionId = agent.sessionId;
  // const history =
  // last compaction summary ka timestamp , 20th most recent message timestamp
  const compactionSummary = await getMostRecentCompactionSummary(agent.sessionId);
  if (compactionSummary !== undefined) {
    const lastCompactionSummaryIndex = compactionSummary.sequence;
    messages = await getMessagesForSummary(sessionId, lastCompactionSummaryIndex);
  } else {
    // If thier are no pre existing summary we will get all the messages.
    messages = await getMessagesForSummary(sessionId);
  }

  // converting to OpenAi style
  let messages2: MessagesArray = cleanMessages(messages);

  if (compactionSummary !== undefined) {
    messages2 = [{ role: Role.user, content: compactionSummary.content }, ...messages2];
  }
  const systemInstructions = readFileSync(systemInstructionFilePath).toString();
  const compactionInstructions = readFileSync(CompactionInstructionFilePath).toString();

  // Some models strictly want user message strictly at the end of message
  const compactionInstructionsMessage: UserMessage = {
    role: Role.user,
    content: compactionInstructions,
  };

  // In case if we hit finish_reason = length or null in that case we want model to continue
  const continueMessage: UserMessage = {
    role: Role.user,
    content:
      'The compaction summary generation was cut off mid-output due to token limits. Please continue writing the summary exactly where you left off, resuming from the last incomplete sentence or section. Do not restart the summary from the beginning—just complete the missing historical context and consolidation.',
  };

  const systemMessage: SystemMessage = {
    role: Role.system,
    content: systemInstructions,
  };

  let isRetrying: boolean = false;
  let retriesDone = 0;
  let toBreak: boolean = false;
  let continueMessagesCount = 0;

  let summary: RawReplyChunkFromLLM = {
    content: '',
    reasoning_content: '',
    tool_calls: [],
    finish_reason: null,
  };

  const context: MessagesArray = [systemMessage, ...messages2, compactionInstructionsMessage];

  try {
    do {
      // start with new response at every retry
      const response = await agent.client.chatCompletion(
        context,
        agent.model,
        agent.reasoningEffort,
      );

      if (response.systemError === true) {
        throw new Error(`Error in compaction request ${response.error ?? ''}`);
      }
      // stores result for this iteration
      let fullReply: RawReplyChunkFromLLM = {
        content: '',
        reasoning_content: '',
        tool_calls: [],
        finish_reason: null,
      };
      try {
        let buffer = '';
        const regex = /^data:\s/;

        // wait for all chunks.
        await new Promise((resolve, reject) => {
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
              fullReply = appendResponse(fullReply, content);
            }
          });

          response.response?.data.on('end', () => {
            summary = appendResponse(summary, fullReply);
            writeLogs(
              LogType.agent,
              agent.projectDirectoryName,
              agent.sessionId,
              JSON.stringify(summary),
            );
            if (!(fullReply.finish_reason === 'length' || fullReply.finish_reason === null)) {
              // can break safely we have reached a natural stop
              toBreak = true;
              // appended final summary
              resolve(summary);
            } else {
              // did not reach natural stop then resend the message with continue message
              if (continueMessagesCount >= MAX_CONTINUES) {
                toBreak = true;
                resolve(summary);
              } else {
                context.push({
                  role: Role.assistant,
                  reasoning_content: fullReply.reasoning_content,
                  content: fullReply.content,
                  tool_calls: normalizeToolCalls(fullReply.tool_calls),
                });
                context.push(continueMessage);
                continueMessagesCount += 1;
              }
            }
          });

          response.response?.data.on('error', (error: unknown) => {
            reject(error);
            throw error;
          });
        });
      } catch (err) {
        console.log(err);
        if (!isRetrying) {
          isRetrying = true;
        } else if (isRetrying && retriesDone < MAX_RETRIES) {
          retriesDone += 1;
          if (retriesDone === MAX_RETRIES) {
            isRetrying = false;
            toBreak = true;
            throw err;
          }
        }
      }
    } while (!toBreak);
    return summary;
  } catch (err: unknown) {
    throw new Error(`compaction failed: `, { cause: err });
  }
}
