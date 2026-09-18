import Exa from "exa-js";
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
//to be removed
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({path:path.resolve(__dirname , '../../../.env')})
//

const exa = new Exa();

export async function getWebPage(url:string[]) {
    const result = await exa.getContents(
        url, {
        text: true,
        extras: {
            links: 20
        },
    }
    );
    return result.results;
}

await getWebPage(["https://nextjs.org/docs" ,"https://github.com/searxng/searxng/" ])