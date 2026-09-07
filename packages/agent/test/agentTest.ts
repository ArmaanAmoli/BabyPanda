import {BabyPandaAgent} from '../agent.ts'
import type {Message } from '../types.ts'
import {Role} from '../types.ts'

const sessionId = '471582a1-8894-4a58-9800-882f40f86fc2';
const agent = new BabyPandaAgent({url:'https://openrouter.ai/api/v1/chat/completions' , apikey:process.env['AI_KEY']!} , sessionId);
await agent.init()
agent.model="nvidia/nemotron-3.5-lightning:free";
const content1 = "call the read tool to reat agentTest.ts file in the cwd and paste its content in the chat (give tool call in form of json)";
const message1:Message = {role:Role.user , content:content1 , sessionId: sessionId};
await agent.message(message1);