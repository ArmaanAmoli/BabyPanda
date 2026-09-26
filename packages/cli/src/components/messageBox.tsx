import React from 'react';
import { Box} from "ink";
import {Role} from '@baby-panda/types';
import {Markdown} from './markdown'
interface MessageBoxProps{
    content:string;
    sended:boolean;
    role:Role;
}

export function MessageBox({content , role}: MessageBoxProps) {
    return (
        <Box width="100%" flexDirection='column' borderLeftColor={role===Role.user ? 'white':'#82994C'} 
        justifyContent={"center"}
        borderTop={false} 
        borderBottom={false}
        borderRight={false}
        padding={1}
        marginTop={2}
        borderStyle={'bold'} gap={1}>
            <Markdown>{content}</Markdown>
        </Box>
    );
}