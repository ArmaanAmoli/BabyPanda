import type { MessageAPI, Message, ReplyJson } from '@/types';
import { Role, ReplyJsonSchema } from '@/types'
import { BabyPandaClient } from '@/client';
import {BabyPandaAgent} from '@/agent';
import { readFileSync } from 'fs';
import { extractFirstJSON } from '@/utils/FirstJsonExtractor';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const compactionInstructionFilePath = path.join(__dirname,'BabyPanda', 'Compaction.md');
const maxRetries = 2;

export async function compaction(messages: MessageAPI[], agent:BabyPandaAgent) {
    const content = `<message>${JSON.stringify(messages)}</message>`;
    const systemMessage: Message = { role: Role.system, content: readFileSync(compactionInstructionFilePath) }
    const transcript: Message = { role: Role.user, content: content };
    const response = await agent.client.chatCompletion([systemMessage, transcript], agent.model);
    let fullReply = '';
    let isRetrying: boolean = false;
    let retriesDone = 0;
    try {
        do {
            try {
                await new Promise((resolve, reject) => {
                    response.response?.data.on('data', (data: any) => {
                        fullReply += data;
                    });
                    response.response?.data.on('end', () => {
                        fullReply = extractFirstJSON(fullReply) ?? ''
                    });
                    response.response?.data.on('error', (error: any) => {
                        throw error;
                    });
                });
                const json = JSON.parse(fullReply);
                const parsed = ReplyJsonSchema.parse(json);
                return parsed;
            }
            catch (err) {
                if (!isRetrying) {
                    isRetrying = true;
                    console.log("retrying")
                }
                else if (isRetrying && (retriesDone < maxRetries)) {
                    retriesDone += 1;
                    if (retriesDone === maxRetries) {
                        isRetrying = false;
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