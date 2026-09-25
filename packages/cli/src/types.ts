import type {Message} from "@baby-panda/types";
export interface PromptBoxArgs{
    placeholder:string,
    value:string,
    onSubmit:()=>void,
    onChange:(value:string)=>void,
}

export interface APIProvider {
    provider: string;
    endpoint: string;
    key: string;
}
export interface Session{
    id: string;
    createdAt: Date | null;
    parentSessionId: string | null;
    messagesCount: number | null;
}
export interface ReactChildPropInterface{
    children: React.ReactNode
}
export type MessageStatusElement = Message & {sended:boolean};
