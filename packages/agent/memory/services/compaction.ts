import type { MessagesArray, SystemMessage } from '@baby-panda/types';
import { Role } from '@baby-panda/types';
// import { MessageContentSchema } from '@baby-panda/types';
import { BabyPandaAgent } from '@agent/agent';
import { readFileSync } from 'fs';
import {
  appendResponse,
  getContent,
  type RawReplyChunkFromLLM,
} from '@/packages/agent/utils/extractFromRawLLMRes';
import { cleanMessages } from '@agent/utils/cleanMessages';
// import { jsonrepair } from 'jsonrepair';

import path from 'path';
import { fileURLToPath } from 'url';
import { getMostRecentCompactionSummary, getMessagesForSummary } from '@baby-panda/db';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const compactionInstructionFilePath = path.join(__dirname, 'BabyPanda', 'Compaction.md');
const maxRetries = 2;

// function cleanMessageArray(messages: MessageAPI[]) {
//   let result: string = ``;
//   messages.forEach((msg) => {
//     try {
//       const parsed = MessageContentSchema.parse(JSON.parse(jsonrepair(msg.content)));
//       const pContent = parsed.content;
//       if (!pContent.tool_call) {
//         console.log('in loop');
//         result += `${parsed.role.toUpperCase}: ${pContent.answer ?? pContent.thought}`;
//       }
//     } catch {
//       // ignore the message and move on to the next message because it means its a tool result
//     }
//   });
//   return result;
// }

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
    messages = await getMessagesForSummary(sessionId);
  }

  // The same normalization used in the agent's history read path: legacy rows
  // may miss `role` or hold MCP-shaped content.
  let messages2: MessagesArray = cleanMessages(messages);

  if (compactionSummary !== undefined) {
    messages2 = [{ role: Role.user, content: compactionSummary.content }, ...messages2];
  }
  const systemInstructions = readFileSync(compactionInstructionFilePath).toString();
  const systemMessage: SystemMessage = {
    role: Role.system,
    content: systemInstructions,
  };

  // const transcript: UserMessage = { role: Role.user, content: content };
  const response = await agent.client.chatCompletion(
    [systemMessage, ...messages2],
    agent.model,
    agent.reasoningEffort,
  );

  let fullReply: RawReplyChunkFromLLM = {
    content: '',
    reasoning_content: '',
    tool_calls: [],
    finish_reason: '',
  };
  let isRetrying: boolean = false;
  let retriesDone = 0;
  try {
    do {
      try {
        let buffer = '';
        const regex = /^data:\s/;

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
            resolve(fullReply);
          });
          response.response?.data.on('error', (error: unknown) => {
            reject(error);
            throw error;
          });
        });
        // console.log(`COMPACTION RESULT: ${fullReply.length} characters`);
        return fullReply;
      } catch (err) {
        console.log(err);
        if (!isRetrying) {
          isRetrying = true;
          console.log('retrying');
        } else if (isRetrying && retriesDone < maxRetries) {
          retriesDone += 1;
          console.log('retries done: ', retriesDone);
          if (retriesDone === maxRetries) {
            isRetrying = false;
            console.log('retries failed');
            throw err;
          }
        }
      }
    } while (isRetrying && retriesDone < maxRetries);
  } catch (err: unknown) {
    throw new Error(`compaction failed: `, { cause: err });
  }
}
