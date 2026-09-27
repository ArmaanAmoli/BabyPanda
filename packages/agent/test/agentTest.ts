import {BabyPandaAgent} from '../agent.ts'
import type {Message } from '@baby-panda/types'
import {Role } from '@baby-panda/types'
import {ModelsEnum , ProvidersEnum} from '@agent/config/models'
import {createSession} from '@baby-panda/db'


// const sessionId = await createSession();
const sessionId = 'fb7fca74-88e2-4750-9386-57ace052de46';

const agent = new BabyPandaAgent({url:'https://integrate.api.nvidia.com/v1/chat/completions' , apikey:process.env['NVIDIA_API_KEY']!} , sessionId);
await agent.init()
// agent.model=ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"];
agent.setModel(ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"] , ProvidersEnum["Nvidia"])
const prompt = `continue`
const message1:Message = {role:Role.user, content:prompt , sessionId: sessionId};
await agent.message(message1);