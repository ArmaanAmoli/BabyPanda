import app from '@baby-panda/server';
async function startSession() {
    let sessionId = '';
    const req = new Request('/start-session', { method: "POST" });
    console.log("request sended")
    const res = await app.fetch(req);
    if (!res.ok) {
        return '';
    }
    console.log("Response" , res)
    const body = res.body;
    if (!body) return '';
    const decoder = new TextDecoder();
    const reader = body.getReader();
    let streaming = true;
    while (streaming) {
        reader.read().then(({ done, value }) => {
            if (done) {
                streaming = false;
                return;
            }
            const chunk = decoder.decode(value);
            sessionId += chunk;
        });
    }
    return sessionId;
}

const session_test = await startSession();
console.log(session_test)