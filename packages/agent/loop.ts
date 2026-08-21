import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {BabyPandaClient} from './apiCall'
import type {Message} from './types'
import {ReasoningEffort, Role} from './types'


// If no api key then abort
if(!process.env['NVIDIA_API_KEY']){
  process.abort();
}

const client = new BabyPandaClient('https://integrate.api.nvidia.com/v1', process.env['NVIDIA_API_KEY']);
const instructions = `
You are Baby Panda a coding agent
`
const model = 'minimaxai/minimax-m3';
const rl = readline.createInterface({ input, output });//always create this outside the loop

while (true) {

  const messages:Message[] = // this array will store message history for context building
  [
    { role: Role.system, content: instructions },
  ]
  const userInput = await rl.question('');

  messages.push({ role: Role.user, content: userInput })

  const response = await client.chatCompletion(messages , model , ReasoningEffort.high);
  // if( response.response && response.response.data && response.response.data.choices){
  //   console.log(response.response.data.choices);
  // }
  if(response.response?.data?.choices){
    console.log(response.response.data.choices);
  }
}


// class BabyPandaAgent{
//   constructor(){
    
//   }
// }