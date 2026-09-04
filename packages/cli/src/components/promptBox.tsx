import { Box, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import React, { useState, useRef , useContext} from 'react'
import type { PromptBoxArgs } from '../types'
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import {PromptContext} from "../context/prompt"

export default function PromptBox({ placeholder, onSave }: PromptBoxArgs) {
    const scrollRef = useRef<ScrollViewRef>(null);
    const [prompt, setPrompt] = useContext(PromptContext) as [string , React.Dispatch<React.SetStateAction<string>>];
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
        if(key.return){
            
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