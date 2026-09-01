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

const key = process.env['AI_KEY']!
const bc = new BabyPandaClient({ url: "https://openrouter.ai/api/v1/chat/completions", apikey: key })
const instructions = readFileSync('instructions.txt', { encoding: 'utf-8' });
console.log('instructions read')

const reply = await bc.chatCompletion([
    { role: Role.system, content: instructions },
    { role: Role.user, content: "summarize the index.txt file in the current working directory" }
], "nvidia/nemotron-3-ultra-550b-a55b:free");

console.log('got the first reply')

let fullReply = "";

reply.response?.data.on('data', (chunk: Buffer | string) => {
    const phase1 = typeof chunk === 'string' ? chunk : chunk.toString('utf-8'); // nvidia sen buffer where as openrouter send text
    const phase2 = phase1.split('\n');
    const regex = /^data:\s/;
    const getContent = (encoded: string) => {
        try {
            if (encoded) {
                const json = JSON.parse(encoded);
                // console.log(json.choices[0].delta.content);
                if (!json.choices[0].delta.content) return '';
                return String(json.choices[0].delta.content);
            }
            return '';
        }
        catch (err) {
            return "[DONE]"
        }
    }
    for (let i of phase2) {
        i = i.trim();
        if (regex.test(i)) {
            i = i.slice(6);
            if(i==='[DONE]') continue;
            const content = getContent(i);
            if(content !== '[DONE]'){
                fullReply += content;
                //emit event
            }else{//end emit
            }
        }
    }
});
reply.response?.data.on('end', () => {
    console.log("full reply: ", fullReply)
})
