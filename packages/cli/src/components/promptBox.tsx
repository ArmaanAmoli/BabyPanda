import { Box, useInput , Text} from 'ink'
import { TextInput } from '@inkjs/ui'
import { useState, useRef , useContext} from 'react'
import { type PromptBoxArgs , type MessageStatusElement, Role } from '../types'
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import {PromptContext} from "../context/prompt"
import {GlobalMessageQueueContext} from '../context/messageQueueContext'

export default function PromptBox({ placeholder, onSave }: PromptBoxArgs) {
    const scrollRef = useRef<ScrollViewRef>(null);
    const {userPrompt , setUserPrompt} = useContext(PromptContext);
    const {queue , setQueue} = useContext(GlobalMessageQueueContext);
    const [userMessageState , setUserMessageState] = useState<MessageStatusElement>({
                sessionId:'',
                content:userPrompt,
                role:Role.user,
                sended:false
            })
    const onChangeOfPrompt = (value: string) => {
        setUserPrompt(value);
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
            setQueue({message: userMessageState , setMessage:(newMessage:MessageStatusElement)=>setUserMessageState(newMessage)});
            setUserPrompt('');
        }
    });
    return (
        <Box borderStyle={'single'} borderColor={'white'} width="100%" height="100%" backgroundColor={'black'}>
            {/* convert this into a placeholder. */}
            <ScrollView ref={scrollRef} height="100%" width="100%">
                <TextInput placeholder={placeholder} onChange={onChangeOfPrompt} />
            </ScrollView>
        </Box>
    );
}