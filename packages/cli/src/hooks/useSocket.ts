import {useContext} from 'react';
import {SocketContext} from '../context/webSocket';
import {writeLogs} from '@baby-panda/utils'
import { LogType } from '@baby-panda/types';

export default function useSocket(sessionId:string){
    const socket = useContext<WebSocket|null>(SocketContext);
    if(!socket){
        writeLogs(LogType.cli , process.cwd().replaceAll('/' , '-').replace('-','') , sessionId , `[ERROR]: useSocket Hook not provided with SocketContext`);
        return;
    }
    return socket;
}