import axios, { AxiosError, type AxiosResponse } from 'axios'
import { setTimeout } from 'node:timers/promises';
import type { Message, ReasoningEffort, UrlApi } from './types' // verbatimModuleSyntax

interface ChatCompletionArgs {
    response?: AxiosResponse;
    systemError?: boolean;
    error?: any;
}
class BabyPandaClient {
    url: string;
    apikey: string;
    token: string;
    isRetrying: boolean;
    private maxRetrys: number;
    private retrysDone: number;
    constructor({ url, apikey }: UrlApi) {
        this.url = url;
        this.apikey = apikey;
        this.token = 'Bearer ' + apikey;
        this.isRetrying = false;
        this.maxRetrys = 3;
        this.retrysDone = 0;
    }
    async chatCompletion(messages: Message[], model: string, reasoning_effort?: ReasoningEffort): Promise<ChatCompletionArgs> {
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
                messages: messages,
                stream_options: { "include_usage": true },
            },
        };
        try {
            console.log("in baby panda client trying ....")
            const response = await axios(options);
            return { response, systemError: false };
        }
        catch (error: any) {
            if (axios.isAxiosError(error)) {
                if (error.status === 429) {
                    await setTimeout(60000);
                    //retry later
                }
                else if (error.status && (error.status >= 500 || error.status === 400)) {
                    //bad request stop the client 
                    console.log("BAD REQUEST")
                    const errorBody = await fetchError(error);
                    return { systemError: true, error:errorBody };
                }
            }
            if (!this.isRetrying && this.retrysDone === 0) {
                this.isRetrying = true;
            }
            if (this.isRetrying && this.retrysDone < this.maxRetrys) {
                this.retrysDone += 1;
                return await this.chatCompletion(messages, model, reasoning_effort);
            }
            else {
                if (this.retrysDone >= this.maxRetrys) {
                    this.isRetrying = false;
                    this.retrysDone = 0;
                }
                const errorBody = await fetchError(error);
                console.error("🔴 API Gateway Validation Error Details:", errorBody);
            }
            return { systemError: true, error };
        }
    }
};

const fetchError = async (error: any) => {
    if (axios.isAxiosError(error)) {
        if (error.response?.data && typeof error.response.data.on === 'function') {
            return new Promise<string>((resolve) => {
                let chunkBuffer = '';
                const res = error.response;
                if(res === undefined){
                    resolve("error");
                    return;
                }
                res.data.on('data', (chunk: Buffer) => { chunkBuffer += chunk.toString(); });
                res.data.on('end', () =>{
                    resolve(chunkBuffer);
                    console.log("[AXIOS ERROR]: ",error.status , ' ' , error.message);
                });
            });
        }
    }

}

export { BabyPandaClient }