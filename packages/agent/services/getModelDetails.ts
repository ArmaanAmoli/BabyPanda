import {
  Models,
  ModelsSchema,
  ProvidersEnum,
  ModelsEnum,
  type ModelDetails,
} from '@baby-panda/types';

export default function getModelDetails(
  provider: ProvidersEnum,
  modelName: ModelsEnum,
): ModelDetails {
  const parsed = ModelsSchema.parse(Models);
  const modelDetails = parsed[provider].models[modelName];
  return modelDetails;
}
