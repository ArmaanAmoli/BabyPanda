import axios from 'axios'
import { readFileSync } from 'fs'
import type { Message, ReasoningEffort, UrlApi } from './types' // verbatimModuleSyntax
class BabyPandaClient {
    url: string;
    apikey: string;
    token: string;
    constructor({ url, apikey }: UrlApi) {
        this.url = url;
        this.apikey = apikey;
        this.token = 'Bearer ' + apikey;
    }
    async chatCompletion(messages: Message[], model: string, reasoning_effort?: ReasoningEffort) {
        let options = {
            method: 'POST' as const,
            url: this.url,
            responseType: 'stream' as const,
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: this.token
            },
            data: {
                model: model,
                temperature: 1,
                top_p: 0.95,
                // max_tokens: 16384,
                // reasoning_effort: reasoning_effort ? reasoning_effort : 'none',
                seed: 42,
                stream: true,
                messages: messages
            },
        };
        try {
            console.log("in baby panda client trying ....")
            const response = await axios(options);
            return { response, systemError: false };
        }
        catch (error:any) {
            if (error.response?.data && typeof error.response.data.on === 'function') {
                const errorBody = await new Promise<string>((resolve) => {
                    let chunkBuffer = '';
                    error.response.data.on('data', (chunk: Buffer) => { chunkBuffer += chunk.toString(); });
                    error.response.data.on('end', () => resolve(chunkBuffer));
                });
                console.error("🔴 API Gateway Validation Error Details:", errorBody);
            }
            return { systemError: true, error };
        }
    }
}

export { BabyPandaClient }