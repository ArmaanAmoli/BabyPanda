import { Box, useInput , Text} from 'ink'
// import { TextInput } from '@inkjs/ui'
import TextInput from 'ink-text-input';
import { useState, useRef , useContext} from 'react'
import { type PromptBoxArgs , type MessageStatusElement, Role } from '../types'
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import {PromptContext} from "../context/prompt"
import {GlobalMessageQueueContext} from '../context/messageQueueContext'

export default function PromptBox({ placeholder, value , onChange , onSubmit}: PromptBoxArgs) {
    const scrollRef = useRef<ScrollViewRef>(null);
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
    });
    return (
        <Box borderStyle={'single'} borderColor={'white'} width="100%" height="100%" backgroundColor={'black'}>
            <ScrollView ref={scrollRef} height="100%" width="100%">
                <TextInput value={value} placeholder={placeholder} onChange={onChange} onSubmit={onSubmit}/>
            </ScrollView>
        </Box>
    );
}