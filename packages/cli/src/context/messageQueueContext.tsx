import React, {createContext , useState} from 'react';
import type { ReactChildPropInterface , MessageQueueElement , MessageQueueState } from '../types';

export const GlobalMessageQueueContext = createContext<MessageQueueState>({queue:[] , setQueue:(value:MessageQueueElement)=>{}});
export function GlobalMessageQueueContextProvider({children}:ReactChildPropInterface){
    const [queue , setqueue] = useState<MessageQueueElement[]>([]);
    const setQueue = (value:MessageQueueElement)=>{
        setqueue((prev)=>[...prev,value]);
    }
    return(
        <GlobalMessageQueueContext.Provider value={{queue , setQueue}}>
            {children}
        </GlobalMessageQueueContext.Provider>
    );
}