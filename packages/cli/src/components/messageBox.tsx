import React from 'react';
import { Box } from "ink";
import { Role } from '@baby-panda/types';
import type { CleanedMessage } from '@baby-panda/types';

import { Markdown } from './markdown'
// interface MessageBoxProps{
//     content:string;
//     sended:boolean;
//     role:Role;

// }

export function MessageBox(prop: CleanedMessage) {
    const color = prop.role === Role.user ? '#f6eeee' : prop.role === Role.tool ? '#4d3838' : prop.isThougt ? '#291b1b' : '#7e7474';
    return (
        <Box width="100%" flexDirection='column' borderLeftColor={color}
            justifyContent={"center"}
            borderTop={false}
            borderBottom={false}
            borderRight={false}
            padding={1}
            marginTop={2}
            borderStyle={'bold'} gap={1}>
            <Markdown>{prop.content}</Markdown>
        </Box>
    );
}