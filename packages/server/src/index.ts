import { Hono } from 'hono'
import { getMessages, createSession , createMessage} from '@baby-panda/db';
import { streamSSE } from 'hono/streaming';
const app = new Hono()

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

app.post('/store-message' , async(c)=>{
  const body = await c.req.json()
  if(!body.sessionId || !body.role || !body.content){
    return new Response("missing data {sessionId , content , role}", { status: 400, statusText: "Bad Request" });
  }
  try{
    await createMessage(body.sessionId , body.content , body.role);
    return new Response("message created", { status: 201, statusText: "Created" });
  }
  catch(e){
    return new Response("message creatation failed", { status: 500, statusText: "Internal Server Error" });
  }
})

app.post('/message-sse' , async(c)=>{
  return streamSSE(c , async(stream)=>{
    // here we will send the llm response
  })
})

export default app
