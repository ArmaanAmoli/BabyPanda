import type {MessageAPI , Message } from '@baby-panda/types';
import { Role } from '@baby-panda/types';
import { MessageContentSchema } from '@baby-panda/types'
import { BabyPandaAgent } from '@agent/agent';
import { readFileSync } from 'fs';
import { getContent } from '@agent/utils/getContent'
import { jsonrepair } from 'jsonrepair'

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const compactionInstructionFilePath = path.join(__dirname, 'BabyPanda', 'Compaction.md');
const maxRetries = 2;

function cleanMessageArray(messages: MessageAPI[]) {
    let result:string = ``;
    messages.forEach((msg) => {
        try {
            const parsed = MessageContentSchema.parse(JSON.parse(jsonrepair(msg.content)));
            const pContent = parsed.content;
            if (!pContent.tool_call) {
                console.log("in loop")
                result+=`${parsed.role.toUpperCase}: ${pContent.answer ?? pContent.thought}`;
            }
        } catch (err) {
            // ignore the message and move on to the next message because it means its a tool result
        }
    });
    return result;
}

export async function compaction(messages: MessageAPI[], agent: BabyPandaAgent) {
    const content = `<messages>${cleanMessageArray(messages)}</messages>`;
    // console.log(content);
    const systemInstructions = readFileSync(compactionInstructionFilePath).toString()
    const systemMessage: Message = { role: Role.system, content: systemInstructions }
    const transcript: Message = { role: Role.user, content: content };
    console.log(systemInstructions, transcript)
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
                    response.response?.data.on('error', (error: any) => {
                        reject(error);
                        throw error;
                    });
                });
                console.log("COMPACTION RESULT:", fullReply)
                return fullReply
            }
            catch (err) {
                console.log(err)
                if (!isRetrying) {
                    isRetrying = true;
                    console.log("retrying")
                }
                else if (isRetrying && (retriesDone < maxRetries)) {
                    retriesDone += 1;
                    console.log("retries done: ", retriesDone);
                    if (retriesDone === maxRetries) {
                        isRetrying = false;
                        console.log("retries failed")
                        throw err;
                    }
                }
            }
        } while (isRetrying && retriesDone < maxRetries);
    }
    catch (err: any) {
        throw new Error("compactinon failed ", err)
    }
}