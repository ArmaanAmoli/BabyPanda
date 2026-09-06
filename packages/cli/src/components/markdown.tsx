import React from 'react';
import { Text, Box } from 'ink';
import { marked } from 'marked';

interface MarkdownProps {
	children: string;
}

// Helper to fix literal "\n" string escapes and clean up token texts
const formatText = (text: string): string => {
	if (!text) return '';
	return text
		.replace(/\\n/g, '\n')       // Fix literal "\n" strings from stream data
		.replace(/\*\*(.*?)\*\*/g, '$1') // Strip raw unhandled bold indicators
		.replace(/`(.*?)`/g, '$1');    // Strip raw inline code accents
};

export const Markdown: React.FC<MarkdownProps> = ({ children }) => {
	// Clean up raw literal newlines from the input payload before parsing
	const cleanInput = children.replace(/\\n/g, '\n');
	const tokens = marked.lexer(cleanInput);

	return (
		<Box flexDirection="column">
			{tokens.map((token, index) => {
				switch (token.type) {
					case 'heading':
						return (
							<Box key={index} marginY={1}>
								<Text bold color="cyan">
									{'#'.repeat(token.depth)} {formatText(token.text)}
								</Text>
							</Box>
						);

					case 'paragraph':
						return (
							<Box key={index} marginBottom={1}>
								<Text>{formatText(token.text)}</Text>
							</Box>
						);

					case 'code':
						return (
							<Box key={index} paddingLeft={2} flexDirection="column">
								<Box borderStyle="round" borderColor="gray" paddingX={1}>
									<Text color="yellow">{token.text}</Text>
								</Box>
							</Box>
						);

					case 'list':
						return (
							<Box key={index} flexDirection="column" marginBottom={1}>
								{token.items.map((item: any, i: number) => (
									<Text key={i}>
										<Text color="magenta">  • </Text>
										{formatText(item.text)}
									</Text>
								))}
							</Box>
						);

					case 'space':
						return null;

					default:
						return (
							<Box key={index} marginBottom={1}>
								<Text>{formatText(token.raw)}</Text>
							</Box>
						);
				}
			})}
		</Box>
	);
};
