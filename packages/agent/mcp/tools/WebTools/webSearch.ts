import Exa from "exa-js";
import * as dotenv from 'dotenv';
dotenv.config({ path: "../../../.env" });

const exa = new Exa();

export async function webSearch(query: string) {
  const { results } = await exa.search(
    "best blog posts about vector databases",
    { contents: { highlights: true } },
  );
  return results;
}