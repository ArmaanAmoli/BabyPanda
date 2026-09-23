import {BabyPandaAgent} from '../agent.ts'
import type {Message } from '../types.ts'
import {Role } from '../types.ts'
import {ModelsEnum , Models , ProvidersEnum} from '@/config/models'
import {createSession} from '@baby-panda/db'


const sessionId = await createSession();
// const sessionId = 'be01028b-8ea3-49cc-ae5c-d92cf2e59375';

const agent = new BabyPandaAgent({url:'https://integrate.api.nvidia.com/v1/chat/completions' , apikey:process.env['NVIDIA_API_KEY']!} , sessionId);
await agent.init()
// agent.model=ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"];
agent.setModel(ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"] , ProvidersEnum["Nvidia"])
const prompt = `Find bugs in the code and list them (Remember to think before writing to the codebase and make no mistake)`
const message1:Message = {role:Role.user , content:prompt , sessionId: sessionId};
await agent.message(message1);