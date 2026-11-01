import { BabyPandaAgent } from '../agent.ts';
import type { Message } from '@baby-panda/types';
import { Role } from '@baby-panda/types';
import { ProvidersEnum } from '@agent/config/models';
import { createSession, getProviders } from '@baby-panda/db';

// const sessionId = await createSession();
const sessionId = 'fb7fca74-88e2-4750-9386-57ace052de46';
const provider = (await getProviders()).find(
  (configuredProvider) => configuredProvider.provider === ProvidersEnum.Nvidia,
);
if (!provider?.hasKey) {
  throw new Error('Configure the Nvidia provider through the CLI before running this test');
}

const agent = new BabyPandaAgent(
  {
    url: provider.endpoint ?? 'https://integrate.api.nvidia.com/v1/chat/completions',
    apikey: provider.hasKey,
  },
  sessionId,
);
await agent.init();
agent.setModel('nvidia/nemotron-3-ultra-550b-a55b', ProvidersEnum.Nvidia);
const prompt = `continue`;
const message1: Message = {
  role: Role.user,
  content: prompt,
  sessionId: sessionId,
};
await agent.message(message1);
