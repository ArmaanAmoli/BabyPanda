import { Box, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useState, useRef } from 'react'
import { PromptBoxArgs } from '../types.js'
import { ScrollView, ScrollViewRef } from "ink-scroll-view";
import {BabyPandaAgent} from '@baby-panda/agent';

export default function PromptBox({ placeholder, onSave }: PromptBoxArgs) {

    const agent:BabyPandaAgent = new BabyPandaAgent({url:'https://integrate.api.nvidia.com/v1' , apikey:process.env['NVIDIA_API_KEY']!});

    const scrollRef = useRef<ScrollViewRef>(null);
    const [prompt, setPrompt] = useState<string>('');
    const onChangeOfPrompt = (value: string) => {
        setPrompt(value)
        console.log(prompt);
    }

    // 2. Handle Keyboard Input
    useInput((input, key) => {
        if (key.upArrow) {
            scrollRef.current?.scrollBy(-1); // Scroll up 1 line
        }
        if (key.downArrow) {
            scrollRef.current?.scrollBy(1); // Scroll down 1 line
        }
        if (key.pageUp) {
            // Scroll up by viewport height
            const height = scrollRef.current?.getViewportHeight() || 1;
            scrollRef.current?.scrollBy(-height);
        }
        if (key.pageDown) {
            const height = scrollRef.current?.getViewportHeight() || 1;
            scrollRef.current?.scrollBy(height);
        }

        // If key.enter then send the prompt to agent.
        if(key.return){
            //call the agent
        }
        
    });

    return (
        <Box borderStyle={'single'} borderColor={'#FFAF87'} width="100%" height="100%">
            {/* convert this into a placeholder. */}
            <ScrollView ref={scrollRef}>
                <TextInput placeholder={placeholder} defaultValue={prompt} onChange={onChangeOfPrompt} />
            </ScrollView>
        </Box>

    );
}