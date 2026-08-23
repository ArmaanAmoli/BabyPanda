export interface PromptBoxArgs{
    placeholder:string,
    onSave: (x:any)=> void | any // feed the text input into this function in case of saving/entering the output
}