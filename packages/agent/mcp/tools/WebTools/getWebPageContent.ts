import Exa from 'exa-js';
import { z } from 'zod';
import { getWebApiKeys } from '@baby-panda/db';
import { EXA_PROVIDER } from '@baby-panda/types';

const WebPageResultsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string().nullable().catch(null),
    url: z.string(),
    author: z.string().nullable().catch(null),
    text: z.string(),
    extras: z.object({
      links: z.array(z.string()).default([]),
    }),
    entities: z.object().nullable().catch(null),
  }),
);

type WebPageResults = z.infer<typeof WebPageResultsSchema>;

/**
 * Builds an Exa client from the stored `web` credential, per call. A
 * module-level `new Exa()` throws when no key is saved, which took the whole
 * process down at import time.
 */
async function getExaClient(): Promise<Exa> {
  const configured = await getWebApiKeys();
  const credential = configured.find(
    (item) => item.provider?.toLowerCase() === EXA_PROVIDER.toLowerCase(),
  );
  if (!credential?.hasKey) {
    throw new Error(
      'get_web_page is not configured: no Exa API key has been saved. ' +
        'The user can add one with the /web-api-keys command.',
    );
  }
  return new Exa(credential.hasKey);
}

export async function getWebPage(url: string[]): Promise<WebPageResults> {
  const exa = await getExaClient();
  const result = await exa.getContents(url, {
    text: true,
    extras: {
      links: 20,
    },
  });
  const results = result.results;
  try {
    const parsed = WebPageResultsSchema.parse(results);
    return parsed;
  } catch (err) {
    throw new Error(`Error occured while parsing results from WebPage: ${err}`, { cause: err });
  }
}
