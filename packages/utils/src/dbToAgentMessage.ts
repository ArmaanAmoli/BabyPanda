import type { DBMessage, MessagesArray } from '@baby-panda/types';

export function dbToAgentMessages(dbMessages: DBMessage[]): MessagesArray {
  return dbMessages.map((msg) => {
    return JSON.parse(msg.content);
  });
}
