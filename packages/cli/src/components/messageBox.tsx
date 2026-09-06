import { Box, Spacer, Text } from "ink";
import {Role, type Message} from '../types';
import {Markdown} from './markdown'
interface MessageBoxProps{
    content:string;
    sended:boolean;
    role:Role;
}

export function MessageBox({content , role}: MessageBoxProps) {
    return (
        <Box width="100%" flexDirection='column' borderColor={role===Role.user ? '#82994C':'white'} borderStyle={'classic'} gap={1}>
            <Markdown>{content}</Markdown>
        </Box>
    );
}