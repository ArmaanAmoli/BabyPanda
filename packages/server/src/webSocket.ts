import { upgradeWebSocket } from '@hono/bun';
import { agentStore, wsCollection } from './index';
import type { Context, Next } from 'hono';
import { writeLogs } from '@baby-panda/utils';
import { LogType, PermissionsEnums, WsEventMessageSchema, WsEventTypes } from '@baby-panda/types';
import { BabyPandaAgent } from '@baby-panda/agent';
import { ContentType, Role } from '@baby-panda/types';
import type {
  UserPermission,
  WsCommonMessage,
  ServerStreamChunkSchemaType,
} from '@baby-panda/types';

const cwd = process.cwd().replaceAll('/', '-').replace('-', '');
const websocketHandler = (c: Context, next: Next) => {
  const sessionId = c.req.query('sessionId');
  if (!sessionId) {
    return c.text('session id not provided');
  }
  const handler = upgradeWebSocket(() => {
    let cleanup: () => void;
    return {
      async onOpen(_event, ws) {
        wsCollection.set(sessionId, ws);
        if (agentStore.get(sessionId) == undefined) {
          const { url, apikey } = {
            url: 'https://integrate.api.nvidia.com/v1/chat/completions',
            apikey: process.env['NVIDIA_API_KEY']!,
          };
          const agent = new BabyPandaAgent({ url, apikey }, sessionId);
          const initAgent = async () => await agent.init();
          initAgent();
          agentStore.set(sessionId, agent);
        }
        //attach event listners
        const babyPanda = agentStore.get(sessionId)!;

        const onAskForPermission = (permissionObject: UserPermission) => {
          const ws = wsCollection.get(sessionId);

          /*
          just keep the permission event within that event payload define if ts a alwas , deny , allow once
          send all objects with eventType labels to prepare a clean switch case in frontend ws handler
          */

          ws?.send(
            JSON.stringify({
              eventType: WsEventTypes.permission,
              payload: permissionObject,
            } as WsCommonMessage),
          );
        };

        const onToolData = async (data: { role: Role; sessionId: string; content: string }[]) => {
          // await writeLogs(LogType.server, cwd, sessionId, `[/message]: Received a tool chunk`);
          // await writeLogs(LogType.server, cwd, sessionId, `[/message]: Raw tool chunk ${data}`);
          // const cleaned = await cleanMessageHistroy(data);
          // let content = '';
          // cleaned.forEach((msg) => {
          //   if (msg.role === Role.tool) {
          //     content = content.concat(content ? '\n' : '', msg.content);
          //   }
          // });
          // const chunk: ServerStreamChunkSchemaType = {
          //   role: Role.tool,
          //   content,
          // };
          // await writeLogs(
          //   LogType.server,
          //   cwd,
          //   sessionId,
          //   `[/message]: Final tool content ${content}`,
          // );
          const msg: WsCommonMessage = { eventType: WsEventTypes.tool, payload: data };
          // ws.send(JSON.stringify(msg));

          ws.send(JSON.stringify(msg));
        };

        const handlers: Record<string, (data: string) => void> = {};
        const onData = async (eventName: ContentType, data: string) => {
          await writeLogs(LogType.server, cwd, sessionId, '[/message]: Received a data chunk');
          const chunk: ServerStreamChunkSchemaType = {
            role: eventName === ContentType.answer ? Role.assistant : Role.thought,
            content: data,
          };
          const msg: WsCommonMessage = { eventType: WsEventTypes.message, payload: chunk };
          ws.send(JSON.stringify(msg));
        };

        const onError = async (err: Error) => {
          console.error('[AGENT:STREAM ERROR] ', err);
          await writeLogs(LogType.server, cwd, sessionId, `[/message]: Stream error ${err}`);
        };

        const onLoopEnd = () => {
          ws.send(JSON.stringify({ eventType: WsEventTypes.setting, payload: { end: true } }));
        };

        cleanup = async () => {
          await writeLogs(LogType.server, cwd, sessionId, 'Cleanup started');

          Object.entries(handlers).forEach(([eventName, handler]) => {
            babyPanda.off(eventName, handler);
          });
          babyPanda.off(ContentType.permission, onAskForPermission);
          babyPanda.off(ContentType.tool_call, onToolData);
          babyPanda.off('end', onLoopEnd);
          babyPanda.off('error', onError);
          await writeLogs(LogType.server, cwd, sessionId, '[/message]: Aborting stream...');
        };

        [ContentType.answer, ContentType.thought].forEach((eventName) => {
          handlers[eventName] = (data: string) => {
            void onData(eventName, data);
          };
          babyPanda.on(eventName, handlers[eventName]);
        });
        babyPanda.on(ContentType.tool_call, onToolData);
        babyPanda.on(ContentType.permission, onAskForPermission);
        babyPanda.on('end', onLoopEnd);
        babyPanda.on('error', onError);

        await writeLogs(
          LogType.server,
          process.cwd().replaceAll('/', '-').replace('-', ''),
          sessionId,
          '[WS]: CONNECTED',
        );
      },
      async onMessage(event) {
        const agent = agentStore.get(sessionId);
        const payload = JSON.parse(event.data.toString());
        await writeLogs(
          LogType.server,
          process.cwd().replaceAll('/', '-').replace('-', ''),
          sessionId,
          `[WS]: ${JSON.stringify(payload)}`,
        );
        const parse = WsEventMessageSchema.parse(payload);
        switch (parse.eventType) {
          case WsEventTypes.permission: {
            switch (parse.permission) {
              case PermissionsEnums.allowAlways: {
                agent?.setAllowAlwaysTrue();
                break;
              }
              case PermissionsEnums.allowOnce: {
                const { permissionGranted, toolCallId } = parse;
                agent?.setPermission(toolCallId, permissionGranted);
                break;
              }
            }
            break;
          }
          case WsEventTypes.message: {
            const agent = agentStore.get(sessionId);
            agent?.message({ content: parse.content, role: parse.role });
            break;
          }
          case WsEventTypes.setting: {
            const agent = agentStore.get(sessionId);
            const setting = parse.setting;
            if (setting.sandbox != undefined) {
              agent?.setSandbox(setting.sandbox);
            }
          }
        }
      },

      onClose(_event, ws) {
        ws.send('closed');
        cleanup();
        wsCollection.delete(sessionId);
      },
    };
  });
  return handler(c, next);
};

export { websocketHandler };
