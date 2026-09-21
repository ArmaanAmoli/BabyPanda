import {Models , ModelsSchema , ProvidersEnum , ModelsEnum } from "@/config/models";
import type {  ModelDetails} from "@/config/models";

import { z } from "zod";

export default function getModelDetails(provider:ProvidersEnum , modelName:ModelsEnum):ModelDetails{
    const parsed = ModelsSchema.parse(Models);
    const modelDetails = parsed[provider].models[modelName]
    return modelDetails;
}