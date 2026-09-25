import {Models , ModelsSchema , ProvidersEnum , ModelsEnum } from "@agent/config/models";
import type {  ModelDetails} from "@agent/config/models";

import { z } from "zod";

export default function getModelDetails(provider:ProvidersEnum , modelName:ModelsEnum):ModelDetails{
    const parsed = ModelsSchema.parse(Models);
    const modelDetails = parsed[provider].models[modelName]
    return modelDetails;
}