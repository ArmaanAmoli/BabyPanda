import React, { ReactNode } from 'react';
import {createContext , useState} from 'react';

interface SessionState{
    sessionId:string,
    setSessionId: React.Dispatch<React.SetStateAction<string>>
};

interface SessionProvider{
    id:string,
    children:ReactNode
}
export const SessionContext = createContext<SessionState|null>(null);

export function SessionProvider({id , children}:SessionProvider){
    const [sessionId , setSessionId] = useState(id);

    return(
        <SessionContext.Provider value={{sessionId , setSessionId}}>
            {children}
        </SessionContext.Provider>
    )
}