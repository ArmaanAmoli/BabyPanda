import {BabyPandaAgent} from '../agent.ts'
import type {Message } from '../types.ts'
import {Role } from '../types.ts'
import {ModelsEnum , Models , ProvidersEnum} from '@/config/models'
import {createSession} from '@baby-panda/db'


// const sessionId = await createSession();
const sessionId = 'be01028b-8ea3-49cc-ae5c-d92cf2e59375';

const agent = new BabyPandaAgent({url:'https://integrate.api.nvidia.com/v1/chat/completions' , apikey:process.env['NVIDIA_API_KEY']!} , sessionId);
await agent.init()
// agent.model=ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"];
agent.setModel(ModelsEnum["nvidia/nemotron-3-ultra-550b-a55b"] , ProvidersEnum["Nvidia"])
const prompt = `I am unable to create message theri is a problem in chat end point.
 Hey

⨯ Error [PrismaClientKnownRequestError]: 
Invalid \`prisma.$executeRaw()\` invocation:


Raw query failed. Code: \`23503\`. Message: \`insert or update on table "Message" violates foreign key constraint "Message_chatId_fkey"\`
    at async POST (src/app/api/chat/route.ts:37:23)
  35 |     }
  36 |
> 37 |     if(!isDuplicate) {await createNewMessage(message);}
     |                       ^
  38 |     
  39 |     // start with enbedding the quetion
  40 |     const questionArr: string[] = [question]; {
  code: 'P2010',
  meta: {
    driverAdapterError: Error [DriverAdapterError]: ForeignKeyConstraintViolation
        at ignore-listed frames {
      [cause]: [Object]
    }
  },
  clientVersion: '7.8.0'
}
 POST /api/chat 500 in 105ms `
const message1:Message = {role:Role.user , content:prompt , sessionId: sessionId};
await agent.message(message1);