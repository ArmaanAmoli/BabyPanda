import OpenAI from 'openai';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { ChatCompletionMessageParam } from 'openai/resources';

const client = new OpenAI({
  apiKey: process.env['NVIDIA_API_KEY'],
  baseURL: 'https://nvidia.com',
});
const instructions = `
You are Baby Panda a coding agent
`
const model = 'mistralai/mistral-nemotrons';

while (true) {
  const rl = readline.createInterface({ input, output });

  const messages: ChatCompletionMessageParam[] = // this array will store message history for context building
  [
    { role: 'system', content: instructions },
  ]

  const userInput = await rl.question('');

  messages.push({ role: 'user', content: userInput })

  const response = await client.chat.completions.create({
    model: model,
    messages: messages,
    store:false
  });

  if (typeof response._request_id !== null) {
    console.log(response.choices[0]);
  }

}
