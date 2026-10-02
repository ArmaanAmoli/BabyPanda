import { upgradeWebSocket } from "@hono/bun";
import z from "zod";
import { agentStore, wsCollection } from "./index";
import type { Context, Next } from "hono";
import {writeLogs} from "@baby-panda/utils"
import { LogType } from "@baby-panda/types";

export const WsEventTypeSchema = z.enum([
  "permission",
  "open",
  "ask_permission",
]);

const WsEventTypes = WsEventTypeSchema.enum;

const BaseSchema = z.object({});

export const WsEventMessageSchema = z.discriminatedUnion("eventType", [
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
]);

const websocketHandler = (c: Context, next: Next) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.text("session id not provided");
  }
  const handler = upgradeWebSocket((c) => {
    return {
      onOpen(event, ws) {
        wsCollection.set(sessionId, ws);
        writeLogs(LogType.server , process.cwd().replaceAll('/','-').replace('-' , '') , sessionId , "[WS]: CONNECTED");
      },
      onMessage(event) {
        const payload = JSON.parse(event.data.toString());
        const parse = WsEventMessageSchema.parse(payload);
        switch (parse.eventType) {
          case WsEventTypes.permission: {
            const { permissionGranted, toolCallId } = parse;
            const agent = agentStore.get(sessionId); // here is the agent object
            agent?.setPermission(toolCallId, permissionGranted);
            break;
          }

          case WsEventTypes.ask_permission: {
            const { toolCallId, toolCallContent } = parse;
            const ws = wsCollection.get(sessionId);
            ws?.send(JSON.stringify({ toolCallContent, toolCallId }));
            break;
          }
        }
      },
      onClose(event, ws) {
        ws.send("closed");
        wsCollection.delete(sessionId);
      },
    };
  });

  return handler(c, next);
};

export { websocketHandler };
