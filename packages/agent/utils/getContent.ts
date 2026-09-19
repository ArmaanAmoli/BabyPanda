// Get content from raw json of llm
export const getContent = (encoded: string , contextWindowUsed:number) => {
      try {
        if (encoded) {
          const json = JSON.parse(encoded);
          if (!json.choices || json.choices.length === 0) return '';
          if (!json.choices[0].delta.content) return '';
          if(json.usage){
            console.log("Toke Usage: ", json.usage )//temporary;
            contextWindowUsed = json.usage.total_tokens;
          }
          return String(json.choices[0].delta.content);
        }
        return '';
      }
      catch (err) {
        console.error('Failed to parse SSE chunk:', encoded, err)
        return '';
      }
    }