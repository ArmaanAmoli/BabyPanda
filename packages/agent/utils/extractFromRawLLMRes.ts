// Get content from raw json of llm
import { BabyPandaAgent } from '@agent/agent';
import type { AgentToolCallUncertain } from '../config/tools';

export const getContent = (encoded: string, agent?: BabyPandaAgent) => {
  try {
    if (encoded) {
      const json = JSON.parse(encoded);
      if (json.usage) {
        // console.log("Toke Usage: ", json.usage )//temporary;
        if (agent) {
          agent.contextWindowUsed = json.usage.total_tokens;
          agent.emit('context-update', agent.getModelState());
        }
      }
      if (!json.choices || json.choices.length === 0) return '';
      const delta = json.choices[0].delta ?? {};
      const tool_calls = delta.tool_calls;

      if (tool_calls != undefined && Array.isArray(tool_calls)) {
        const calls = tool_calls as AgentToolCallUncertain[];
        return calls;
      }
      return typeof delta.content === 'string' ? delta.content : '';
    }
    return '';
  } catch (err) {
    console.error('Failed to parse SSE chunk:', encoded, err);
    return '';
  }
};

export function appendToolCallArray(
  initial: AgentToolCallUncertain[],
  calls: AgentToolCallUncertain[],
) {
  calls.forEach((call) => {
    // no gurantee for tool call array to be sorted acc to index property;
    const targetToolCall = initial[call.index] ?? { index: call.index };
    if (call.id !== undefined) targetToolCall.id = call.id;
    if (call.type !== undefined) targetToolCall.type = call.type;
    if (call.function !== undefined) {
      targetToolCall.function ??= {};
      if (call.function.name !== undefined) targetToolCall.function.name = call.function.name;
      if (call.function.arguments !== undefined) {
        targetToolCall.function.arguments =
          (targetToolCall.function.arguments ?? '') + call.function.arguments;
      }
    }
    initial[call.index] = targetToolCall;
  });
}
