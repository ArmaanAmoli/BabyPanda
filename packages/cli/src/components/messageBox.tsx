import { Box, Text } from "ink";
import {useState} from "react";
import React from "react";

interface MessageBoxProps{
    content:string
}

export function MessageBox({content}: MessageBoxProps) {
    const [message , setMessage] = useState<string>(content);
    return (
        <Box width="100%">
            <Text>{message}</Text>
        </Box>
    );
}