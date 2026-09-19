import {BabyPandaAgent} from '../agent.ts'
import type {Message } from '../types.ts'
import {Role } from '../types.ts'
import {ModelsEnum , Models , ProvidersEnum} from '@/config/models'


const sessionId = '471582a1-8894-4a58-9800-882f40f86fc2';
const agent = new BabyPandaAgent({url:'https://integrate.api.nvidia.com/v1/chat/completions' , apikey:process.env['NVIDIA_API_KEY']!} , sessionId);
await agent.init()
agent.model=ModelsEnum["meta/muse-glimmer-30b"];
agent.setModel(ModelsEnum["meta/muse-glimmer-30b"] , ProvidersEnum["Nvidia"])
const prompt = "continue your work find more bugs and DONT SEND EMPTY REPLY"
const message1:Message = {role:Role.user , content:prompt , sessionId: sessionId};
await agent.message(message1);