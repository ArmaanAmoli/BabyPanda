import { BabyPandaClient } from './apiCall'
import type { Message, UrlApi } from './types'
import { ReasoningEffort, Role } from './types'
import { readFileSync } from "fs"
import { EventEmitter } from "events"
import { MCPClient } from "./mcp/client"
// If no api key then abort
if (!process.env['NVIDIA_API_KEY']) {
  process.abort();
}

export class BabyPandaAgent extends EventEmitter {
  /*
  what do we need from user when creating an agent ?
    1. api key and url to create the client
    2. declare the client using them.
    3. Provide the user with model settings like temperature , etc. (not nessesary now)
    4. provide effort settings (none , high , max);
  */

  private client: BabyPandaClient;
  private isRunning = false;
  private messageQueue: Message[] = [];
  private messagesHistory: Message[] = [];
  private mcpClient: MCPClient = new MCPClient()

  instructions: string;
  model: string;
  reasoningEffect: ReasoningEffort

  constructor({ url, apikey }: UrlApi) {
    super();
    this.client = new BabyPandaClient({ url, apikey });
    this.model = 'moonshotai/kimi-k3'; // This will be our default model
    this.instructions = readFileSync('test.txt', { encoding: 'utf-8' });
    this.reasoningEffect = ReasoningEffort.none;
    this.mcpClient.connectToServer('./tools/index.ts');
  }

  private async loop() {
    while (this.messageQueue.length !== 0) {

      this.isRunning = true;

      const messages: Message[] = // this array will store message history for context building
        [...this.messagesHistory,
        { role: Role.system, content: this.instructions },
        ]

      if (!this.messageQueue[0]) { // if the first message of messageQueue is undefined then skip this iteration (but atleast tell the user later)
        this.messageQueue.splice(0, 1);
        continue;
      }

      const userInput: Message = this.messageQueue[0];

      messages.push(userInput)

      const response = await this.client.chatCompletion(messages, this.model, this.reasoningEffect);
      const toolCall: boolean = false;// for now

      if (response.systemError) {
        console.error('Request failed:', response.error);
        process.exit(1);
      }

      console.log('got the first reply')

      let fullReply = "";
      let buffer: string = '';
      const regex = /^data:\s/;

      response.response?.data.on('data', (chunk: Buffer | string) => {
        const encodedChunk = typeof chunk === 'string' ? chunk : chunk.toString('utf-8'); // nvidia sen buffer where as openrouter send text
        buffer += encodedChunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
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
            console.error('Failed to parse SSE chunk:', encoded, err)
            return '';
          }
        }
        for (let line of lines) {
          line = line.trim();
          if (!regex.test(line)) continue;
          line = line.slice(6);
          if (line === '[DONE]') continue;
          const content = getContent(line);
          fullReply += content;
          //emit event  
        }
      }
      );

      response.response?.data.on('end', () => {
        console.log("full reply: ", fullReply)
      })

      response.response?.data.on('error', (err: Error) => { console.error('Stream error:', err) });
    }
    this.isRunning = false;
  }

  async message(msg: Message) {
    //push
    this.messageQueue.push(msg);

    if (this.isRunning) { // this mean the loop is already running we just push in message queue;
      return;
    }
    else {
      await this.loop();
    }
  }

}