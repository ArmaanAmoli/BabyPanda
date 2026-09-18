import Exa from "exa-js";
import * as dotenv from 'dotenv';
import { z } from "zod";
dotenv.config({ path: "../../../.env" });

const exa = new Exa();

const WebSearchResultsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string().nullable().catch(null),
    url: z.string(),
    highlights: z.array(z.string()).optional(),
  })
);
export type WebSearchResults = z.infer<typeof WebSearchResultsSchema>

export async function webSearch(query: string): Promise<WebSearchResults> {
  const { results } = await exa.search(
    query,
    { contents: { highlights: true } },
  );
  try {
    const parsed = WebSearchResultsSchema.parse(results);
    return parsed ?? [];
  } catch (err) {
    console.log(results)
    throw new Error(`Error occured while parsing WebSearchResults in webSearch.ts, ${err}`)
  }
}
