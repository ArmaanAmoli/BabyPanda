import {read , edit} from '@/mcp/tools/FileSystem/filesystem';
import { memoryFile } from '../constants'

//write memory
export async function addToMemory( content:string ){
    try{
        const oldMemory = await readFromMemory();
        const newMemory = content + '\n' + oldMemory;
        await edit({path:memoryFile , old_str:oldMemory , new_str:newMemory});
        return true;
    }catch(err){
        throw err;
    }
}
//read memory (200 lines)
export async function readFromMemory(){
    try{
        const content = await read({path:memoryFile});
        return content;
    }catch(err){
        throw err;
    }
}