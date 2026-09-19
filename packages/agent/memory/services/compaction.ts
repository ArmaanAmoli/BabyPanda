import type { MessageAPI, Message, ReplyJson } from '@/types'
import { Role, ReplyJsonSchema } from '@/types'
import { BabyPandaClient } from '@/client'
import { readFileSync } from 'fs'
import { extractFirstJSON } from '@/utils/FirstJsonExtractor'

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compactionInstructionFilePath = path.join(__dirname, 'memory', 'BabyPanda', 'Compaction.md');
var maxRetries = 2;

export async function compaction(messages: MessageAPI[], client: BabyPandaClient, sessionId: string, model: string) {
    const content = `<message>${JSON.stringify(messages)}</message>`;
    const systemMessage: Message = { role: Role.system, content: readFileSync(compactionInstructionFilePath) }
    const transcript: Message = { role: Role.user, content: content };
    const response = await client.chatCompletion([systemMessage, transcript], model);
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