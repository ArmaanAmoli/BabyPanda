// Get content from raw json of llm
import {BabyPandaAgent} from "@/agent";

export const getContent = (encoded: string , agent?:BabyPandaAgent) => {
      try {
        if (encoded) {
          const json = JSON.parse(encoded);
          if(json.usage){
            console.log("Toke Usage: ", json.usage )//temporary;
            if(agent)agent.contextWindowUsed = json.usage.total_tokens;
          }
          if (!json.choices || json.choices.length === 0) return '';
          if (!json.choices[0].delta.content) return '';
          
          return String(json.choices[0].delta.content);
        }
        return '';
      }
      catch (err) {
        console.error('Failed to parse SSE chunk:', encoded, err)
        return '';
      }
    }