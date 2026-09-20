import type { MessageAPI, Message, ReplyJson } from '@/types';
import { Role, ReplyJsonSchema } from '@/types'
import { BabyPandaClient } from '@/client';
import { BabyPandaAgent } from '@/agent';
import { readFileSync } from 'fs';
import { extractFirstJSON } from '@/utils/FirstJsonExtractor';
import { getContent } from '@/utils/getContent'

import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const compactionInstructionFilePath = path.join(__dirname, 'BabyPanda', 'Compaction.md');
const maxRetries = 2;

export async function compaction(messages: MessageAPI[], agent: BabyPandaAgent) {
    const content = `<message>${JSON.stringify(messages)}</message>   YOU HAVE TO SUMMARIZE THE TEXT GIVEN INSIDE <message> </message> tags as per the instrutions`;
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
                const lineBuffer: string[] = []
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
                            // console.log(content);
                            fullReply += content;
                        }
                    });
                    response.response?.data.on('end', () => {
                        fullReply = extractFirstJSON(fullReply) ?? ''
                        resolve(fullReply);
                    });
                    response.response?.data.on('error', (error: any) => {
                        reject(error);
                        throw error;
                    });
                });
                console.log("COMPACTION RESULT:", fullReply)
                const json = JSON.parse(fullReply);
                console.log("COMPACTION JSON:", json);
                const parsed = ReplyJsonSchema.parse(json);
                console.log("COMPACTION Parsed:", parse);
                // return parsed;
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