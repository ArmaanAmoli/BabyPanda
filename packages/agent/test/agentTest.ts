import {BabyPandaAgent} from '../agent.ts'
import type {Message } from '../types.ts'
import {Role} from '../types.ts'

const sessionId = '471582a1-8894-4a58-9800-882f40f86fc2';
const agent = new BabyPandaAgent({url:'https://integrate.api.nvidia.com/v1/chat/completions' , apikey:process.env['NVIDIA_API_KEY']!} , sessionId);
await agent.init()
agent.model="nvidia/nemotron-3-ultra-550b-a55b";
const content1 = "try to create a new server file server2.js in the server folder and write a simple hono server inside it (just the boiler plate code)";
const message1:Message = {role:Role.user , content:content1 , sessionId: sessionId};
await agent.message(message1);