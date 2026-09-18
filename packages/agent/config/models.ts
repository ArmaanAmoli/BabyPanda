import {z} from 'zod';


const ModelDetailSchema = z.object({
    contextLength:z.number(),
});

type ModelDetails = z.infer<typeof ModelDetailSchema>;

const ProviderDetailsSchema = z.object({
    url: z.string(),
    models:z.record(z.string() , ModelDetailSchema)
});

type ProviderDetails = z.infer<typeof ProviderDetailsSchema>;

const ModelSchema = z.record(z.string() , ProviderDetailsSchema)
type ModelsType = z.infer<typeof ModelSchema>

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
      }
    }
  }
}