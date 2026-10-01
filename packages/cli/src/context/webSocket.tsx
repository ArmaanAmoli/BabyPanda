import React, { useEffect, createContext, useState } from 'react';
import {ReactChildPropInterface} from '../types';
import useSession from '../hooks/useSession'

export const SocketContext = createContext<WebSocket | null>(null);

// interface SocketProviderArguments {
//     children: React.ReactNode,
//     sessionId: string
// };

export function SocketProvider({ children }: ReactChildPropInterface) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    useEffect(() => {
        const url = new URL('ws://localhost:3000/ws');
        const session = useSession();
        if(!session) return;
        url.searchParams.set('sessionId', session.sessionId);
        const socketInstance: WebSocket = new WebSocket(url.toString());
        setSocket(socketInstance);
        return () => {
            socketInstance.close();
        }
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
}

// permission pending array
// on message for permission => push in pending permission array => if pending Permission array not empty => show the permission pannel