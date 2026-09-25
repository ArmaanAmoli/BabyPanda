import {z} from 'zod';
/*
{
provider: provider_details : url , models: model:model_details
}
*/
export enum ProvidersEnum{
  Nvidia = "Nvidia",
}

const ProvidersEnumSchema = z.enum(ProvidersEnum);

export enum ModelsEnum {
  "z-ai/glm-5.3-flash" = "z-ai/glm-5.3-flash",
  "z-ai/glm-5.3" = "z-ai/glm-5.3",
  "nvidia/nemotron-3-ultra-550b-a55b" = "nvidia/nemotron-3-ultra-550b-a55b",
  "moonshotai/kimi-k3" = "moonshotai/kimi-k3",
  "nvidia/nemotron-3.5-lightning-30b-a3b" = "nvidia/nemotron-3.5-lightning-30b-a3b" ,
  "meta/muse-glimmer-30b" = "meta/muse-glimmer-30b"
}


const ModelsEnumSchema = z.enum(ModelsEnum);

const ModelDetailSchema = z.object({
    contextLength:z.number(),
});

export type ModelDetails = z.infer<typeof ModelDetailSchema>;

const ProviderDetailsSchema = z.object({
    url: z.string(),
    models:z.record(ModelsEnumSchema , ModelDetailSchema)
});

export const ModelsSchema = z.record(ProvidersEnumSchema , ProviderDetailsSchema);

type ModelsType = z.infer<typeof ModelsSchema>

export const Models:ModelsType = {
  "Nvidia":{
    url:'https://integrate.api.nvidia.com/v1',
    models:{
      "z-ai/glm-5.3-flash":{
        contextLength:1000000,
      },
      "z-ai/glm-5.3":{
        contextLength:1000000,
      },
      "nvidia/nemotron-3-ultra-550b-a55b":{
        contextLength:1000000,
      },
      "moonshotai/kimi-k3":{
        contextLength:1000000,
      },
      "nvidia/nemotron-3.5-lightning-30b-a3b":{
        contextLength:1000000,
      },
      "meta/muse-glimmer-30b":{
        contextLength:131000
      }
    }
  }
}