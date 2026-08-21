import axios from 'axios'
import type { Message , ReasoningEffort} from './types' // verbatimModuleSyntax
class BabyPandaClient {
    /*
    we want user's
        api key
        url
    */
    url: string;
    api_key: string;
    token: string;
    constructor(url: string, api_key: string) {
        this.url = url;
        this.api_key = api_key;
        this.token = 'Bearer ' + api_key;
    }

    // write a member function to send a chat message.
    async chatCompletion(messages: Message[] , model:string , reasoning_effort? :ReasoningEffort) {
        const options = {
            method: 'POST',
            url: 'https://integrate.api.nvidia.com/v1/chat/completions',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: this.token
            },
            data: {
                model: model,
                temperature: 1,
                top_p: 0.95,
                max_tokens: 16384,
                reasoning_effort: reasoning_effort ? reasoning_effort : 'none',
                seed: null,
                stream: false,
                messages: messages
            }
        };
        try{
            const response = await axios.request(options);
            return {response , systemError:false};
        }
        catch(error){
            return {systemError:true , error}
        }
    }

}

export {BabyPandaClient}