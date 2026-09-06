import React, {createContext, useState} from 'react';
import type {ReactChildPropInterface} from '../types';


export const PromptContext = createContext({
    userPrompt:'',
    setUserPrompt: (newPrompt:string)=>{}
});

export function PromptContextProvider({children}:ReactChildPropInterface){
    const [userPrompt , setPrompt] = useState('')
    const setUserPrompt = (newPrompt:string)=>{
        setPrompt((prev)=>newPrompt)
    }
    return( 
    <PromptContext.Provider value={{userPrompt , setUserPrompt}}>
        {children}
    </PromptContext.Provider>)
}   