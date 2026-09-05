import { Box, Spacer, Text } from "ink";
import {useState , useEffect , useContext} from "react";
import {GlobalMessageQueueContext , GlobalMessageQueueContextProvider} from '../context/messageQueueContext';
import {Role, type Message} from '../types';
import {sendMessage} from '../services/requests'
import {Markdown} from './markdown'
interface MessageBoxProps{
    content:string;
    sended:boolean;
    role:Role;
}

export function MessageBox({content , sended , role}: MessageBoxProps) {
    const [userMessageString , setUserMessageString] = useState<string>(content);
    const [agentMessageString , setAgentMessageString] = useState<string>('');
	const { queue, setQueue } = useContext(GlobalMessageQueueContext);

	useEffect(() => {
			if (sended) {
				return;
			}
			const msg = {content,role:Role.user , sessionId:'2d9dc32a-df6c-4685-8936-7be1598de04e'} as Message;
			const readStream = async () => {
				const reader = await sendMessage(msg);
				if(typeof reader === 'string')return;
				const textDecoder = new TextDecoder();
				let reply = "";
				while (true) {
					const { done, value } = await reader.read()
					if (done) {
						reply += textDecoder.decode();
						console.log(`CLI got the complete streamed reply`);
						break;
					}
					else {
						if (value) {
							const decodedText = textDecoder.decode(value, { stream: true });
                            setAgentMessageString((prev)=>prev+decodedText);
						}
					}
				}
                readStream
                queue.shift();
			}
	}, [])
    return (
        <Box width="100%" flexDirection='column' borderColor={role===Role.user ? '#82994C':'white'} borderStyle={'classic'} gap={1}>
            <Markdown>{userMessageString}</Markdown>
            <Markdown>{agentMessageString}</Markdown>
        </Box>
    );
}