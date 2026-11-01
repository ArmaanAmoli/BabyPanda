import { z } from 'zod';

export enum ProvidersEnum {
  Nvidia = 'Nvidia',
}

const ProvidersEnumSchema = z.enum(ProvidersEnum);

const ModelDetailSchema = z.object({
  contextLength: z.number(),
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
    url: 'https://integrate.api.nvidia.com/v1',
    models: {
      'z-ai/glm-5.3-flash': {
        contextLength: 1000000,
      },
      'z-ai/glm-5.3': {
        contextLength: 1000000,
      },
      'nvidia/nemotron-3-ultra-550b-a55b': {
        contextLength: 1000000,
      },
      'moonshotai/kimi-k3': {
        contextLength: 1000000,
      },
      'nvidia/nemotron-3.5-lightning-30b-a3b': {
        contextLength: 1000000,
      },
      'nvidia/nemotron-3.5-super-vl-120b-a12b': {
        contextLength: 262000,
      },
      'mistralai/mistral-large-4-1t-a52b': {
        contextLength: 262000,
      },
      'minimaxai/minimax-m3.1-flash': {
        contextLength: 262000,
      },
      'deepseek-ai/deepseek-v4.1-flash': {
        contextLength: 1000000,
      },
      'meta/muse-glimmer-30b': {
        contextLength: 131000,
      },
    },
  },
};

export type ProviderModel = keyof (typeof Models)[ProvidersEnum]['models'];

export function getProviderModels(provider: ProvidersEnum) {
  return Object.keys(Models[provider].models);
}
