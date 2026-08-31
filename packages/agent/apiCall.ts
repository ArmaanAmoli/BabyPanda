import axios from 'axios'
import { readFileSync } from 'fs'
import { Role, type Message, type ReasoningEffort, type UrlApi } from './types' // verbatimModuleSyntax
class BabyPandaClient {
    /*
    we want user's
        api key
        url
    */
    url: string;
    apikey: string;
    token: string;
    constructor({ url, apikey }: UrlApi) {
        this.url = url;
        this.apikey = apikey;
        this.token = 'Bearer ' + apikey;
    }

    // write a member function to send a chat message.
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
                reasoning_effort: reasoning_effort ? reasoning_effort : 'none',
                seed: null,
                stream: true,
                messages: messages
            },
        };

        try {
            console.log("in baby panda client trying ....")
            const response = await axios(options);
            return { response, systemError: false };
        }
        catch (error) {
            return { systemError: true, error }
        }
    }

}

export { BabyPandaClient }

const key = process.env['NVIDIA_API_KEY']!
const bc = new BabyPandaClient({ url: "https://integrate.api.nvidia.com/v1/chat/completions", apikey: key })
const instructions = readFileSync('instructions.txt', { encoding: 'utf-8' });
console.log('instructions read')

const reply = await bc.chatCompletion([
    { role: Role.system, content: instructions },
    { role: Role.user, content: "summarize the index.txt file in the current working directory" }
], "deepseek-ai/deepseek-v4-flash-0731");

console.log('got the first reply')

let fullReply = '';

reply.response?.data.on('data', (chunk: Buffer) => {
    // const encoded = chunk.toString('utf8').trim().slice(6);
    const encoded1 = chunk.toString('utf-8').split('\n');
    // console.log(encoded1[0]);
    const encoded = encoded1[0]?.trim().slice(6)

    // const chk = JSON.parse(chunk.toString('utf8').trim().slice(6)).data.choices[0]?.delta.content;
    const chkFn = () => {
        // console.log("chkFn called")
        try {
            if (encoded) {
                const json = JSON.parse(encoded);
                console.log(json.choices[0].delta.content);
                // console.log(json.choices[0]);
                if(!json.choices[0].delta.content) return '';
                return String(json.choices[0].delta.content);
            }
            return '';

        }
        catch (err) {
            return "[DONE]"
        }
    }
    const chk = chkFn();

    if (chk != "[DONE]") {
        // console.log(fullReply+chk);
        fullReply += chk;
    }
    else {
        console.log("stream ended")
        console.log(fullReply)
    }
    // console.log(chk)
    // console.log(chunk.toString('utf8'))

});
