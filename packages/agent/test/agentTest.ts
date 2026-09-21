import {BabyPandaAgent} from '../agent.ts'
import type {Message } from '../types.ts'
import {Role } from '../types.ts'
import {ModelsEnum , Models , ProvidersEnum} from '@/config/models'
import {createSession} from '@baby-panda/db'


// const sessionId = await createSession();
const sessionId = '621fa163-49e7-475b-9f83-add5a1ccbfff';

const agent = new BabyPandaAgent({url:'https://integrate.api.nvidia.com/v1/chat/completions' , apikey:process.env['NVIDIA_API_KEY']!} , sessionId);
await agent.init()
// agent.model=ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"];
agent.setModel(ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"] , ProvidersEnum["Nvidia"])
const prompt = ` return types are conflicting in the fuctions at line 148 , 221 , 237 , 251 , 266 , 305 , 316`
const message1:Message = {role:Role.user , content:prompt , sessionId: sessionId};
await agent.message(message1);