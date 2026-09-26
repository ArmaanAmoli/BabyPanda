import app from '@baby-panda/server';
import type  {APIProvider, Session } from '../types';
import type { Message, CleanedMessage } from '@baby-panda/types';
import {CleanedMessageArraySchema} from '@baby-panda/types'

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

export async function startSession() {
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

export async function sendMessage(msg: Message) {
    const req = new Request('http://localhost:3000/message', {
        method: "POST",
        body: JSON.stringify(msg)
    })
    const res = await app.fetch(req);
    const stream = res.body;
    if(!stream){throw new Error('Got null response from server')}
    const reader = stream.getReader();
    return reader;
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

export async function getMessages(sessionId:string): Promise<CleanedMessage[]> {
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
    const messagesList = JSON.parse(messages)
    const parsed = CleanedMessageArraySchema.parse(messagesList);
    return parsed;
}
