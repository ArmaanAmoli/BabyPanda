import React, { useEffect, createContext, useRef } from 'react';
import { ReactChildPropInterface } from '../types';
import useSession from '../hooks/useSession';
import { writeLogs } from '@baby-panda/utils'
import { LogType } from '@baby-panda/types';
import { UserPermissionSchema } from '@baby-panda/types';
import usePendingPermissionMessages from '../hooks/usePendingPermissionMessages';
import { setTimeout } from 'node:timers';

export const SocketContext = createContext<WebSocket | null>(null);

// interface SocketProviderArguments {
//     children: React.ReactNode,
//     sessionId: string
// };

export function SocketProvider({ children }: ReactChildPropInterface) {
    const socket = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelayRef = useRef(1000);
    useEffect(() => {
        let isMounted = true;
        const permissions = usePendingPermissionMessages();
        const url = new URL('ws://localhost:3000/ws');

        function connect() {
            const session = useSession();
            if (!session) return;
            url.searchParams.set('sessionId', session.sessionId);
            const socketInstance: WebSocket = new WebSocket(url.toString(),);
            socket.current = socketInstance;

            socketInstance.onopen = () => {
                writeLogs(LogType.cli, process.cwd().replaceAll('/', '-').replace('-', ''), session.sessionId, `[SOCKET]: opened`);
            };

            socketInstance.onmessage = (event) => {
                const data = event.data;
                const parsed = UserPermissionSchema.parse(data);
                permissions?.setPendingPermissionMessages((prev) => [...prev, parsed]);
            }

            socketInstance.onerror = (event) => {
                writeLogs(LogType.cli, process.cwd().replaceAll('/', '-').replace('-', ''), session.sessionId, `[SOCKET]: error ${event.type}`);
                socketInstance.close()
            };

            socketInstance.onclose = () => {
                if (isMounted) {
                    socketInstance.close();
                    writeLogs(LogType.cli, process.cwd().replaceAll('/', '-').replace('-', ''), session.sessionId, `[SOCKET]: closed`);
                    reconnectTimeoutRef.current = setTimeout(() => { 
                        connect();
                     }, reconnectDelayRef.current)
                    isMounted = false;
                }
            }
        }
        
        connect();

        return () => {
            isMounted = false;
            if(reconnectTimeoutRef.current){
                clearTimeout(reconnectTimeoutRef.current);
            }
            if(socket.current){
                socket.current.close();
            }
        }
    }, []);

    return (
        <SocketContext.Provider value={socket.current}>
            {children}
        </SocketContext.Provider>
    );
}

// permission pending array
// on message for permission => push in pending permission array => if pending Permission array not empty => show the permission pannel