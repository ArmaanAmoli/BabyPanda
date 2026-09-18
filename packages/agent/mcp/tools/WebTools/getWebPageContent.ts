import Exa from "exa-js";
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { z } from "zod";
//to be removed
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
//

const exa = new Exa();
const WebPageResultsSchema = z.array(z.object({
    id: z.string(),
    title: z.string().nullable().catch(null),
    url: z.string(),
    author: z.string().nullable().catch(null),
    text: z.string(),
    extras: z.object({
        links: z.array(z.string()).default([])
    }),
    entities: z.object().nullable().catch(null)

}));

type WebPageResults = z.infer<typeof WebPageResultsSchema>;

export async function getWebPage(url: string[]): Promise<WebPageResults> {
    const result = await exa.getContents(
        url, {
        text: true,
        extras: {
            links: 20
        },
    }
    );
    const results = result.results;
    try {
        const parsed = WebPageResultsSchema.parse(results)
        return parsed;
    } catch (err) {
        throw new Error(`Error occured while parsing results from WebPage: ${err}`)
    }
}
