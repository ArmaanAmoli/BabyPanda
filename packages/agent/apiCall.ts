import axios from 'axios'
import { readFileSync } from 'fs'
import { Role, type Message, type ReasoningEffort, type UrlApi } from './types' // verbatimModuleSyntax
import { MissingRequiredClientCapabilityError } from '@modelcontextprotocol/client';
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
/*
const key = process.env['NVIDIA_API_KEY']!
const bc = new BabyPandaClient({ url: "https://integrate.api.nvidia.com/v1/chat/completions", apikey: key })
const instructions = readFileSync('instructions.txt', { encoding: 'utf-8' });
console.log('instructions read')

const response = await bc.chatCompletion([
    { role: Role.system, content: instructions },
    { role: Role.user, content: "summarize the index.txt file in the current working directory" }
], "nvidia/nemotron-3-ultra-550b-a55b");
console.log('got the first reply')

if (response.systemError) {
    console.error('Request failed:', response.error);
    process.exit(1);
}

const getContent = (encoded: string) => {
    try {
        if (encoded) {
            const json = JSON.parse(encoded);
            if (!json.choices || json.choices.length === 0) return '';
            if (!json.choices[0].delta.content) return '';
            return String(json.choices[0].delta.content);
        }
        return '';
    }
    catch (err) {
        console.error('Failed to parse SSE chunk:', encoded, err)
        return '';
    }
}

let toolCall = false;// for now
let lineChecked = 0;
let fullReply = "";
let buffer: string = '';
const MAX_LINE_THRESHOLD_FOR_TOOL_CALL = 4;
const toolCallChecker = /^.*"tool_call":.*$/m;
const lineBuffer: string[] = []
const regex = /^data:\s/;

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
        if(toolCall)fullReply+=content;
        if (!toolCall && lineChecked < MAX_LINE_THRESHOLD_FOR_TOOL_CALL) {
            fullReply += content;
            console.log("checking tool call")
            //check for "tool_call"
            if (toolCallChecker.test(fullReply)) {
                toolCall = true;
                console.log("tool called !")
            }
            lineBuffer.push(content);
        }
        if (lineChecked >= MAX_LINE_THRESHOLD_FOR_TOOL_CALL && !toolCall) {
            if (lineBuffer.length > 0) {
                for (const l of lineBuffer) {
                    // this.emit('data', l)
                }
                lineBuffer.length = 0;
            }
            // this.emit('data', content)
        }
        if (content.includes('\n') && lineChecked < MAX_LINE_THRESHOLD_FOR_TOOL_CALL) {
            for (const char of content) {
                if (char === '\n') {
                    lineChecked += 1;
                    console.log(content)
                    console.log(lineChecked)
                }
            }
        }

    }
});

response.response?.data.on('end', () => {
    console.log("full reply: \n", fullReply);
    if (toolCall) {
        // tool execution
        // push new message in queue (this message + tool result)
    }
    lineChecked = 0;
    toolCall = false;
})
response.response?.data.on('error', (err: Error) => { console.error('Stream error:', err) });
*/