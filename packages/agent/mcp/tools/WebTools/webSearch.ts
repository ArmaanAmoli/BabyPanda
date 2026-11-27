import Exa from 'exa-js';
import { z } from 'zod';
import { getWebApiKeys } from '@baby-panda/db';
import { EXA_PROVIDER } from '@baby-panda/types';
import { LogType } from '@baby-panda/types';
import { logError, getProjectName } from '@baby-panda/utils';

const WebSearchResultsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string().nullable().catch(null),
    url: z.string(),
    highlights: z.array(z.string()).optional(),
  }),
);

export type WebSearchResults = z.infer<typeof WebSearchResultsSchema>;

/**
 * Builds an Exa client from the stored `web` credential.
 *
 * The client is created per call rather than at module scope: `new Exa()`
 * throws when no key is available, and a module-level throw took the whole
 * process down at import time — including in a compiled binary, where the
 * old `__dirname`-relative dotenv lookup resolved inside Bun's virtual
 * filesystem and found nothing.
 */
async function getExaClient(): Promise<Exa> {
  const configured = await getWebApiKeys();
  const credential = configured.find(
    (item) => item.provider?.toLowerCase() === EXA_PROVIDER.toLowerCase(),
  );
  if (!credential?.hasKey) {
    throw new Error(
      'web_search is not configured: no Exa API key has been saved. ' +
        'The user can add one with the /web-api-keys command.',
    );
  }
  return new Exa(credential.hasKey);
}

export async function webSearch(query: string): Promise<WebSearchResults> {
  const exa = await getExaClient();
  const { results } = await exa.search(query, {
    contents: { highlights: true },
  });
  try {
    const parsed = WebSearchResultsSchema.parse(results);
    return parsed ?? [];
  } catch (err) {
    void logError(
      LogType.agent,
      getProjectName(),
      'web-search',
      'failed to parse Exa search results',
      err,
    );
    throw new Error(`Error occured while parsing WebSearchResults in webSearch.ts, ${err}`, {
      cause: err,
    });
  }
}
