import { Hono } from 'hono'
import { getMessages, createSession, createMessage, addProvider, getSessions } from '@baby-panda/db';
import { stream, streamText } from 'hono/streaming';
import { BabyPandaAgent, type Message } from '@baby-panda/agent'
import { create } from 'axios';
const app = new Hono()

const agentStore = new Map<string, BabyPandaAgent>(); // sessionID - agent

app.post('/get-messages', async (c) => {
  const body = await c.req.json()
  if (!body.sessionId) {
    const res = new Response("Session id not attached", { status: 400, statusText: "Bad Request" });
    return res;
  }
  const messages = await getMessages(body.sessionId)
  return new Response(JSON.stringify(messages), { status: 200, statusText: "OK" });
})

app.post('/start-session', async (c) => {
  const session = await createSession();
  return new Response(session, { status: 201, statusText: "Created" })
})

app.post('/get-session', async (c) => {
  const sessions = await getSessions();
  return new Response(JSON.stringify(sessions), { status: 201, statusText: "Created" })
})

app.post('/message', async (c) => {
  const body = await c.req.json()
  if (!body.sessionId || !body.role || !body.content) {
    return new Response("missing data {sessionId , content , role}", { status: 400, statusText: "Bad Request" });
  }
  try {
    await createMessage(body.sessionId, body.content, body.role); // store message to db
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
    return streamText(c, async (stream) => {
      let isDone = false;
      const queue:string[] = [];
        const onData = (data: string) => {
          queue.push(data);
        };
        const onEnd = () => {
          isDone = true;
        }
        const onError = (err: Error) => {
          isDone = true;
        }
        const cleanup = () => {
          babyPanda.off('data', onData);
          babyPanda.off('end', onEnd);
          babyPanda.off('error', onError);
        }
        babyPanda.on('data', onData);
        babyPanda.on('end', onEnd);
        babyPanda.on('error', onError);

        babyPanda.message(body as Message).catch((err) => {
          onError(err);
        })
      let i = 1;
      while(!isDone || queue.length>0){
        const chunk = queue.shift()
        if(chunk === undefined){
          await stream.sleep(10);
          continue;
        }
        await stream.write(chunk);
      }
      cleanup();
    }, async (err, stream) => {
      console.log("stream error", err);
      stream.write("An error occured during streaming");
      throw err;
    });
  }
  catch (e) {
    console.log(e);
    return new Response(`message creatation failed ${e}`, { status: 500, statusText: "Internal Server Error" });
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
    return new Response("Unable to add provider", { status: 500, statusText: "Internal Server Error" });
  }
})

export default {
  port: 3000,
  fetch(request: Request) {
    return app.fetch(request)
  },
}