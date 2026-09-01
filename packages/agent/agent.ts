import { BabyPandaClient } from './apiCall'
import type { Message, UrlApi } from './types'
import { ReasoningEffort, Role } from './types'
import { readFileSync } from "fs"
import { EventEmitter } from "events"
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

  instructions: string;
  model: string;
  reasoningEffect: ReasoningEffort

  constructor({ url, apikey }: UrlApi) {
    super();
    this.client = new BabyPandaClient({ url, apikey });
    this.model = 'moonshotai/kimi-k3'; // This will be our default model
    this.instructions = readFileSync('test.txt', { encoding: 'utf-8' });
    this.reasoningEffect = ReasoningEffort.none;
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
      /*
        code to verify tool call goes here
      */
      if (!toolCall) {
        let fullReply = '';
        response.response?.data.on('data', (chunk: Buffer | string) => {
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
              if (i === '[DONE]') continue;
              const content = getContent(i);
              if (content !== '[DONE]') {
                fullReply += content;
                //emit event
                this.emit('data' , content)
              } else {
                this.emit('end');
              }
            }
          }
        });
      }

      else {
        //execute tools attach their response and rerun the loop
        //push those replies from tool to the message queue
      }
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