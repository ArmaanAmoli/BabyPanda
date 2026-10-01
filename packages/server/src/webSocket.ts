import { upgradeWebSocket } from 'hono/bun';
import z from 'zod'
import { agentStore } from './index'
import type { WSContext } from 'hono/ws'

export const WsEventTypeSchema = z.enum(['permission', 'open', 'ask_permission', 'register_session']);

const WsEventTypes = WsEventTypeSchema.enum;

const BaseSchema = z.object({
    sessionId: z.string(),
});

export const WsEventMessageSchema = z.discriminatedUnion('eventType', [
    BaseSchema.extend({
        eventType: z.literal(WsEventTypeSchema.enum.permission),
        permissionGranted: z.boolean(),
        toolCallId: z.string(),
    }),
    BaseSchema.extend({
        eventType: z.literal(WsEventTypeSchema.enum.open),
    }),
    BaseSchema.extend({
        eventType: z.literal(WsEventTypeSchema.enum.ask_permission),
        toolCallId: z.string(),
        toolCallContent: z.string(),
    }),
    BaseSchema.extend({
        eventType: z.literal(WsEventTypeSchema.enum.register_session),
    }),
]);

const websocketHandler = upgradeWebSocket((c) => {
    const wsCollection = new Map<string, WSContext>();
    return {
        onOpen(event, ws) {
            // here we will save the ws with sessionID in a map for later access when we need to send message server->cli
            const payload = JSON.parse(event.data.toString())
            const parse = WsEventMessageSchema.parse(payload);
            const { sessionId } = parse;
            wsCollection.set(sessionId, ws);
        },
        onMessage(event , ws) {
            const payload = JSON.parse(event.data.toString())
            const parse = WsEventMessageSchema.parse(payload);
            const { sessionId } = parse;
            switch (parse.eventType) {

                case (WsEventTypes.permission):
                    {
                        const { permissionGranted, toolCallId } = parse;
                        // how do i pass this result to agent ?
                        const agent = agentStore.get(sessionId) // here is the agent object 
                        agent?.setPermission(toolCallId, permissionGranted);
                        break;
                    }

                case (WsEventTypes.ask_permission): {
                    const { toolCallId, toolCallContent } = parse
                    const ws = wsCollection.get(sessionId);
                    ws?.send(JSON.stringify({ toolCallContent, toolCallId }));
                    break;
                }

                case (WsEventTypes.register_session): {
                    const payload = JSON.parse(event.data.toString())
                    const parse = WsEventMessageSchema.parse(payload);
                    const { sessionId } = parse;
                    wsCollection.set(sessionId, ws);
                }
            }
        }
    }
})

export { websocketHandler }