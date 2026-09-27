import { Hono } from 'hono'
import { getMessages, createSession, addProvider, getSessionsByProjectDirectory } from '@baby-panda/db';
import { streamText } from 'hono/streaming';
import { BabyPandaAgent } from '@baby-panda/agent';
import type { Message } from '@baby-panda/types';
import { ContentType, LogType, Role } from '@baby-panda/types';
import {cleanMessageHistroy , type MessageHistory} from './utils/cleanMessageHistory'
import {writeLogs} from '@baby-panda/utils'

const app = new Hono()

const agentStore = new Map<string, BabyPandaAgent>(); // sessionID - agent
const cwd = process.cwd().replaceAll('/' , '-').replace('-','');


app.post('/get-messages', async (c) => {
  const body = await c.req.json()
  if (!body.sessionId) {
    const res = new Response("Session id not attached", { status: 400, statusText: "Bad Request" });
    return res;
  }
  const messages = await getMessages(body.sessionId)
  const result = cleanMessageHistroy(messages);
  return new Response(JSON.stringify(result), { status: 200, statusText: "OK" });
});

app.post('/start-session', async () => {
  const session = await createSession();
  return new Response(session, { status: 201, statusText: "Created" })
});

app.post('/get-session', async () => {
  const sessions = await getSessionsByProjectDirectory(cwd);
  return new Response(JSON.stringify(sessions), { status: 201, statusText: "Created" })
});

app.post('/message', async (c) => {
  // console.log("[SERVER]: /message")
  const body = await c.req.json()
  writeLogs(LogType.server , cwd , body.sessionId , "/message")
  
  if (!body.sessionId || !body.role || !body.content) {
    return new Response("missing data {sessionId , content , role}", { status: 400, statusText: "Bad Request" });
  }

  try {
    let agent: BabyPandaAgent | undefined;
    if (agentStore.get(body.sessionId)) {
      //session already exist
      agent = agentStore.get(body.sessionId)
    }
    else {
      /*
      Fetch apikey and url from db or else return
      */
      const { url, apikey } = { url: "https://integrate.api.nvidia.com/v1/chat/completions", apikey: process.env['NVIDIA_API_KEY']! };
      agent = new BabyPandaAgent({ url, apikey }, body.sessionId);
      await agent.init()
      agentStore.set(body.sessionId, agent);
    }

    const babyPanda = agent!;
    writeLogs(LogType.server , cwd , body.sessionId , "[/message]: about to start stream")
    return streamText(c, async (stream) => {
      let isDone = false;
      const queue: string[] = [];
      const onToolData = (data:MessageHistory) =>{
        writeLogs(LogType.server , cwd , body.sessionId , `[/message]: Received a tool chunk`);
        writeLogs(LogType.server , cwd , body.sessionId , `[/message]: Raw tool chunk ${data}`);
        const cleaned = cleanMessageHistroy(data);
        const content = "";
        cleaned.forEach((msg)=>{
          if(msg.role === Role.tool){
            content.concat(content?'\n':'',msg.content);
          }
        })
        writeLogs(LogType.server , cwd , body.sessionId , `[/message]: Final tool content ${content}`);
        queue.push(content)
      }
      const onData = (data: string) => {
        // console.log("[SERVER]:received data", data)
        writeLogs(LogType.server , cwd , body.sessionId , "[/message]: Received a data chunk")
        queue.push(data);
      };
      const onEnd = () => {
        // console.log("[SERVER]:stream ended...")
        writeLogs(LogType.server , cwd , body.sessionId , "[/message]: Ended stream");
        // isDone = true;
      }

      const onError = (err: Error) => {
        isDone = true;
        console.error("[AGENT:STREAM ERROR] ", err);
        writeLogs(LogType.server , cwd , body.sessionId , `[/message]: Stream error ${err}`);
      }
      const cleanup = () => {
        writeLogs(LogType.server , cwd , body.sessionId , "Cleanup started");

        [ContentType.answer, ContentType.thought].forEach((eventName) => babyPanda.off(eventName, onData));
        babyPanda.off(ContentType.tool_call , onToolData);
        babyPanda.off('end', onEnd);
        babyPanda.off('error', onError);
        writeLogs(LogType.server , cwd , body.sessionId , "[/message]: Aborting stream...");
        stream.abort();
      }

      [ContentType.answer, ContentType.thought].forEach((eventName) => babyPanda.on(eventName, onData));

      babyPanda.on(ContentType.tool_call , onToolData)

      babyPanda.on('end', onEnd);
      babyPanda.on('error', onError);
      babyPanda.on('abort' , ()=>{isDone=true})

      babyPanda.message(body as Message).catch((err) => {
        onError(err);
      })
      while (!isDone || queue.length > 0) {
        const chunk = queue.shift()
        if (chunk === undefined) {
          await stream.sleep(100);
          continue;
        }
        writeLogs(LogType.server , cwd , body.sessionId , `[/message]: Wrote to stream, ${chunk}`);
        await stream.write(chunk);
      }
      stream.onAbort(() => { writeLogs(LogType.server , cwd , body.sessionId , "[/message]: Stream aborted");})

      if(isDone) cleanup();
    }, async (err, stream) => {
      console.log("stream error", err);
      stream.write("An error occured during streaming");
      throw err;
    });
  }
  catch (e) {
    console.log(e);
    writeLogs(LogType.server , cwd , body.sessionId , `[/message]: Stream error: ${e}`)
    return new Response(`message creatation failed ${e}`, { status: 500, statusText: `Internal Server Error ${e}` });
  }
});

app.post('/add-provider', async (c) => {
  const body = await c.req.json();
  if (!(body.key && body.provider && body.endpoint)) {
    return new Response("missing data {provider , endpoint , key}", { status: 400, statusText: "Bad Request" });
  }
  try {
    await addProvider({ key: body.key, provider: body.provider, endpoint: body.endpoint })
    return new Response("Provider Added", { status: 201, statusText: "Created" })
  }
  catch (err) {
    return new Response(`Unable to add provider ${err}`, { status: 500, statusText: "Internal Server Error" });
  }
});

export default {
  port: 3000,
  fetch(request: Request) {
    return app.fetch(request)
  },
}