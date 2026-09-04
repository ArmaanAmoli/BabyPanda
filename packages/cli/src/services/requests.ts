import app from '@baby-panda/server';
import { type APIProvider, type Message, type Session, type MessageDB, Role } from '../types'

const decoder = new TextDecoder();
function concatArrayBuffer(chunks: Uint8Array[]) {
    const result = new Uint8Array(chunks.reduce((accumulator, current) => { return accumulator + current.length }, 0));
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}
async function startSession() {
    const req = new Request('http://localhost:3000/start-session', { method: "POST" });
    const res = await app.fetch(req);
    if (!res.ok) { return ''; }
    const body = res.body;
    if (!body) return '';
    const chunks: Uint8Array[] = [];
    const reader = body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            console.log("stream ended")
            break;
        }
        else {
            chunks.push(value)
        }
    }
    const sessionIdUint = concatArrayBuffer(chunks);
    const sessionId = decoder.decode(sessionIdUint)
    return sessionId;
}
// const session_test = await startSession();
// console.log(session_test) -> 2d9dc32a-df6c-4685-8936-7be1598de04e
async function registerProvider(details: APIProvider) {
    const req = new Request('http://localhost:3000/add-provider', {
        method: "POST",
        body: JSON.stringify(details)
    })
    try {
        const res = await app.fetch(req);
        if (!res.ok) {
            throw new Error(`${res.status}: ${res.statusText}`);
        }
        console.log('created')
    } catch (err) {
        console.error(`Error in sendPrompt function: `, err)
    }
}
async function sendMessage(msg: Message) {
    const req = new Request('http://localhost:3000/message', {
        method: "POST",
        body: JSON.stringify(msg)
    })
    const res = await app.fetch(req);
    const stream = res.body;
    if(!stream){throw new Error('Got null response from server')}
    const reader = stream.getReader();
    const chunks:Uint8Array[] = []
    while(true){
        const {done , value} = await reader.read()
        if(done){
            console.log(`CLI got the complete streamed reply`)
            break;
        }
        else{
            if(value){
                chunks.push(value);
            }
        }
    }
    return decoder.decode(concatArrayBuffer(chunks));
}
async function getAllSessions(): Promise<Session[]> {
    const req = new Request('http://localhost:3000/get-session', { method: "POST" });
    const res = await app.fetch(req);
    if (!res.ok) { return []; }
    const body = res.body;
    if (!body) return [];
    const chunks: Uint8Array[] = [];
    const reader = body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            console.log("stream ended")
            break;
        }
        else {
            chunks.push(value)
        }
    }
    const sessionsUint = concatArrayBuffer(chunks);
    const sessions = decoder.decode(sessionsUint)
    const sessionsList = JSON.parse(sessions) as Session[]
    return sessionsList;
}
async function getMessages(sessionId:string): Promise<MessageDB[]> {
    const req = new Request('http://localhost:3000/get-messages', { method: "POST" , body:JSON.stringify({sessionId}) });
    const res = await app.fetch(req);
    if (!res.ok) { return []; }
    const body = res.body;
    if (!body) return [];
    const chunks: Uint8Array[] = [];
    const reader = body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            console.log("stream ended")
            break;
        }
        else {
            chunks.push(value)
        }
    }
    const messagesUint = concatArrayBuffer(chunks);
    const messages = decoder.decode(messagesUint)
    const messagesList = JSON.parse(messages) as MessageDB[]
    return messagesList;
}

const message:Message = {role:Role.user , content:"Hi baby panda how are you can plese tell me how to run a loop in javascript ?" , sessionId:'2d9dc32a-df6c-4685-8936-7be1598de04e'};
const reply = await sendMessage(message);
console.log("CLI:",reply);
