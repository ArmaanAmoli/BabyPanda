import app from '@baby-panda/server';

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
    const decoder = new TextDecoder();
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

interface APIProvider {
    provider: string;
    endpoint: string;
    key: string;
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