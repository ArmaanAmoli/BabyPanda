import Exa from "exa-js";
import * as dotenv from 'dotenv';
dotenv.config({ path: "../../../.env" });

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