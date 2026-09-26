import React from 'react';
import { Box } from "ink";
import { Role } from '@baby-panda/types';
import type { CleanedMessage } from '@baby-panda/types';

import { Markdown } from './markdown'

function getColor(prop: CleanedMessage){
    if(prop.isThought){
        return '#4d3838';
    }
    else if(prop.role === Role.assistant){
        return '#7e7474';
    }
    else if (prop.role === Role.tool){
        return '#4d3838';
    }
    else{
        return '#f6eeee';
    }
}

export function MessageBox(prop: CleanedMessage) {
    const color = getColor(prop);
    return (
        <Box width="100%" flexDirection='column' borderLeftColor={color}
            justifyContent={"center"}
            borderTop={false}
            borderBottom={false}
            borderRight={false}
            padding={1}
            marginTop={2}
            borderStyle={'bold'} gap={1}>
            <Markdown isThought={prop.isThought ?? false}>{`${prop.content} + ${prop.isThought} + ${color}`}</Markdown>
        </Box>
    );
}