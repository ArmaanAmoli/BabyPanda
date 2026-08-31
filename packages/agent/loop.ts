import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { BabyPandaClient } from './apiCall'
import type { Message, UrlApi } from './types'
import { ReasoningEffort, Role } from './types'
import {readFileSync} from "fs"

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
  private rl: readline.Interface;
  private isRunning = false;
  private messageQueue: Message[] = [];
  private messagesHistory: Message[] = [];

  instructions: string;
  model: string;
  reasoningEffect: ReasoningEffort
  constructor({ url, apikey }: UrlApi) {
    this.client = new BabyPandaClient({ url, apikey });
    this.model = 'moonshotai/kimi-k3'; // This will be our default model
    this.rl = readline.createInterface({ input, output });
    this.instructions = readFileSync('test.txt' , {encoding:'utf-8'});
    this.reasoningEffect = ReasoningEffort.none;
  }

  private async loop() {
    // The real question is how to take the response from user cli and put it in this ? 
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

      if (response.response?.data?.choices) {

        /*
        Right now the content is a stringified JSON make sure to take the 'context' feild out of it and add that to the message history.
        */
        messages.push({ role: Role.assistant, content: response.response.data.choices });
        this.messagesHistory = messages;
        //save to db

        //check for tool call

        // if tool called then we use the tool and push the message again in front of the message queue

        console.log(response.response.data.choices);

        //delete from message queue
      }

      //else response have some error we will retry
      //In the retry mechanism we will send the same message again until we get a response (at max lets say 5 times after than message will be aborted)
      this.messageQueue.splice(0, 1);
    }

    this.isRunning = false;
  }

  async message(msg: Message) {
    //push
    this.messageQueue.push(msg);

    if (this.isRunning) { // this mean the loop is already running we just push in message queue;
      return;
    }
    else{
      await this.loop();
    }
  }

}




