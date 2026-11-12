import { z } from 'zod';
import { ReasoningEffort } from '@baby-panda/types';

export enum ProvidersEnum {
  Nvidia = 'Nvidia',
}

const ProvidersEnumSchema = z.enum(ProvidersEnum);

const ModelDetailSchema = z.object({
  contextLength: z.number(),
  reasoningEfforts: z.array(z.enum(ReasoningEffort)),
});

export type ModelDetails = z.infer<typeof ModelDetailSchema>;

const ProviderDetailsSchema = z.object({
  url: z.string(),
  models: z.record(z.string(), ModelDetailSchema),
});

export const ModelsSchema = z.record(ProvidersEnumSchema, ProviderDetailsSchema);

type ModelsType = z.infer<typeof ModelsSchema>;

export const Models: ModelsType = {
  Nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: {
      'z-ai/glm-5.3-flash': {
        contextLength: 1_000_000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'stepfun-ai/step-5-preview': {
        contextLength: 1_000_000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },

      'nvidia/nemotron-3-ultra-550b-a55b': {
        contextLength: 1_000_000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },

      'nvidia/nemotron-3.5-lightning-30b-a3b': {
        contextLength: 1000000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'nvidia/nemotron-3.5-super-vl-120b-a12b': {
        contextLength: 262000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'mistralai/mistral-large-4-1t-a52b': {
        contextLength: 262000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'minimaxai/minimax-m3.1-flash': {
        contextLength: 262000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'deepseek-ai/deepseek-v4.1-flash': {
        contextLength: 1000000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'meta/muse-glimmer-30b': {
        contextLength: 131000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
    },
  },
};

export type ProviderModel = keyof (typeof Models)[ProvidersEnum]['models'];

export function getProviderModels(provider: ProvidersEnum) {
  return Object.keys(Models[provider].models);
}
