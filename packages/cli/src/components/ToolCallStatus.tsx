import React from 'react';
import {Text} from 'ink';
import {useToolCalls} from '../hooks/useToolCalls';

export function ToolCallStatus() {
	const {toolCalls} = useToolCalls();

	if (toolCalls.length === 0) {
		return null;
	}

	const toolCall = toolCalls.at(-1);
	return (
		<Text color="#4d3838" wrap="truncate-end">
			{toolCalls.length > 1 ? `(${toolCalls.length}) ` : ''}
			{toolCall?.name}
			{toolCall?.content ? `: ${toolCall.content}` : ''}
		</Text>
	);
}
