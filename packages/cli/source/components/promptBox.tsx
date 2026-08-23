import { Box, Text } from 'ink'
import { TextInput } from '@inkjs/ui'
import React from 'react'
import { useState } from 'react'
import { PromptBoxArgs } from '../types.js'

export default function PromptBox({ placeholder, onSave }: PromptBoxArgs) {

    const [prompt, setPrompt] = useState<string>('');
    const onChangeOfPrompt = (value: string) => {
        setPrompt(value)
        console.log(prompt);
    }

    return (
            <Box borderStyle={'single'} borderColor={'#FFAF87'} minHeight={2}>
                {/* convert this into a placeholder. */}
                <TextInput placeholder={placeholder} defaultValue={prompt} onChange={onChangeOfPrompt} />
            </Box>

    );
}