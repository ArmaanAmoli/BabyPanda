import { Models, ModelsSchema, ProvidersEnum } from '@agent/config/models';
import type { ModelDetails } from '@agent/config/models';

export default function getModelDetails(provider: ProvidersEnum, modelName: string): ModelDetails {
  const parsed = ModelsSchema.parse(Models);
  const modelDetails = parsed[provider].models[modelName];
  if (!modelDetails) {
    throw new Error(`Unknown model "${modelName}" for provider "${provider}"`);
  }
  return modelDetails;
}
