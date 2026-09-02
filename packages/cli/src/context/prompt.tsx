import React, {createContext, useState} from 'react';
const [userPrompt , setPrompt] = useState('')
export const PromptContext = createContext([userPrompt , setPrompt]);

interface ReactChildPropInterface{
    children: React.ReactNode
}

export function PromptContextProvider({children}:ReactChildPropInterface){
    return( 
    <PromptContext.Provider value={[userPrompt , setPrompt]}>
        {children}
    </PromptContext.Provider>)
}