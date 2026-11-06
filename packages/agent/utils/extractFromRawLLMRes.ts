// Get content from raw json of llm
import { BabyPandaAgent } from '@agent/agent';
import type { AgentToolCallUncertain } from '../config/tools';

export interface RawReplyChunkFromLLM {
  tool_calls: AgentToolCallUncertain[];
  reasoning_content: string;
  content: string;
  finish_reason: string | null;
}

export const getContent = (encoded: string, agent?: BabyPandaAgent): RawReplyChunkFromLLM => {
  try {
    const json = JSON.parse(encoded);
    if (json.usage) {
      // console.log("Toke Usage: ", json.usage )//temporary;
      if (agent) {
        agent.contextWindowUsed = json.usage.total_tokens;
        agent.emit('context-update', agent.getModelState());
      }
    }
    // Usage-only terminator chunks arrive with an empty choices array, so the
    // choices must be optional instead of fatal.
    const firstChoice = json.choices?.[0] ?? null;
    const delta = firstChoice?.delta ?? {};
    const tool_calls_raw = delta.tool_calls;
    const reasoning_content =
      delta.reasoning_content !== undefined ? `${delta.reasoning_content}` : '';

    const content = delta.content !== undefined ? `${delta.content}` : '';
    const finish_reason = (firstChoice?.finish_reason ?? null) as string | null;

    let tool_calls: AgentToolCallUncertain[] = [];
    if (tool_calls_raw != undefined && Array.isArray(tool_calls_raw)) {
      tool_calls = [...tool_calls_raw] as AgentToolCallUncertain[];
    }

    return { tool_calls, content, reasoning_content, finish_reason };
  } catch (err) {
    throw new Error(`Failed to parse SSE chunk: ${encoded}  ${err}`, { cause: err });
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
  return initial;
}

export function appendResponse(
  initial: RawReplyChunkFromLLM,
  newChunk: RawReplyChunkFromLLM,
): RawReplyChunkFromLLM {
  return {
    reasoning_content: initial.reasoning_content + newChunk.reasoning_content,
    content: initial.content + newChunk.content,
    tool_calls: appendToolCallArray(initial.tool_calls, newChunk.tool_calls),
    finish_reason: newChunk.finish_reason ?? initial.finish_reason,
  };
}
