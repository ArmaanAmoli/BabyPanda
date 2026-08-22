import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { BabyPandaClient } from './apiCall'
import type { Message, UrlApi } from './types'
import { ReasoningEffort, Role } from './types'

// If no api key then abort
if (!process.env['NVIDIA_API_KEY']) {
  process.abort();
}

export class BabyPandaAgent {
  /*
  what do we need from user when creating an agent ?
    1. api key and url to create the client
    2. declare the client using them.
    3. Provide the user with model settings like temperature , etc. (not nessesary now)
    4. provide effort settings (none , high , max);
  */

  private client: BabyPandaClient;
  private rl:readline.Interface;
  instructions:string;
  model: string;
  reasoningEffect:ReasoningEffort
  constructor({ url, apikey }: UrlApi) {
    this.client = new BabyPandaClient({ url, apikey });
    this.model = 'deepseek-ai/deepseek-v4-flash-0731'; // This will be our default model
    this.rl = readline.createInterface({ input, output });
    this.instructions=`You are Baby Panda a coding agent`;
    this.reasoningEffect = ReasoningEffort.none;
  }

  async loop() {

    // The real question is how to take the response from user cli and put it in this ? 

    while (true) {
      while (true) {

        const messages: Message[] = // this array will store message history for context building
          [
            { role: Role.system, content: this.instructions },
          ]
        const userInput = await this.rl.question('');

        messages.push({ role: Role.user, content: userInput })

        const response = await this.client.chatCompletion(messages, this.model, this.reasoningEffect);
        
        if (response.response?.data?.choices) {
          console.log(response.response.data.choices);
        }
      }
    }
  }

}


const agent = new BabyPandaAgent({'url':'deepseek-ai/deepseek-v4-flash-0731' , 'apikey':process.env['NVIDIA_API_KEY']});
agent.loop();