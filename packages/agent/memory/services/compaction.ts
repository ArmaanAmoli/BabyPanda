import type { MessageAPI, Message } from '@baby-panda/types';
import { Role } from '@baby-panda/types';
import { MessageContentSchema } from '@baby-panda/types';
import { BabyPandaAgent } from '@agent/agent';
import { readFileSync } from 'fs';
import { getContent } from '@agent/utils/getContent';
import { jsonrepair } from 'jsonrepair';

import path from 'path';
import { fileURLToPath } from 'url';
import { getMostRecentCompactionSummary, getMessagesForSummary } from '@baby-panda/db';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const compactionInstructionFilePath = path.join(__dirname, 'BabyPanda', 'Compaction.md');
const maxRetries = 2;

function cleanMessageArray(messages: MessageAPI[]) {
  let result: string = ``;
  messages.forEach((msg) => {
    try {
      const parsed = MessageContentSchema.parse(JSON.parse(jsonrepair(msg.content)));
      const pContent = parsed.content;
      if (!pContent.tool_call) {
        console.log('in loop');
        result += `${parsed.role.toUpperCase}: ${pContent.answer ?? pContent.thought}`;
      }
    } catch {
      // ignore the message and move on to the next message because it means its a tool result
    }
  });
  return result;
}

export async function compaction(agent: BabyPandaAgent) {
  type T = Awaited<ReturnType<typeof getMessagesForSummary>>;
  // eslint-disable-next-line no-useless-assignment
  let messages: T = [];

  const sessionId = agent.sessionId;
  // const history =
  // last compaction summary ka timestamp , 20th most recent message timestamp
  const compactionSummary = await getMostRecentCompactionSummary(agent.sessionId);
  if (compactionSummary !== undefined && compactionSummary.createdAt != null) {
    const csCreatedAt = compactionSummary.createdAt;
    messages = await getMessagesForSummary(sessionId, csCreatedAt);
  } else {
    messages = await getMessagesForSummary(sessionId);
  }

  // convert to messageAPI type
  const messages2: MessageAPI[] = [];
  messages
    .map((msg) => {
      if (msg.role && msg.content) {
        return {
          role: msg.role,
          content: msg.content,
        };
      }
    })
    .forEach((msg) => {
      if (msg != undefined) {
        messages2.push(msg);
      }
    });

  const content = `<messages>${compactionSummary?.content ?? ''} ${cleanMessageArray(messages2)}</messages>`;
  // console.log(content);
  const systemInstructions = readFileSync(compactionInstructionFilePath).toString();
  const systemMessage: Message = {
    role: Role.system,
    content: systemInstructions,
  };
  const transcript: Message = { role: Role.user, content: content };
  // console.log(systemInstructions, transcript);
  const response = await agent.client.chatCompletion([systemMessage, transcript], agent.model);
  let fullReply = '';
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
              fullReply += content;
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
        console.log(`COMPACTION RESULT: ${fullReply.length} characters`);
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
