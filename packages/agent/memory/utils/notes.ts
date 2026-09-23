import { projectDir } from '../constants'
import {read , edit , write , list} from '../../mcp/tools/FileSystem/filesystem';
import path from 'path';

export async function listNotes(){
    const notes = await list(projectDir);
    return notes;
}

export async function readNotes(fileName:string , offset?:number , limit?:number){
    const notesPath = path.join(projectDir , fileName);
    const content = await read ({path:notesPath , offset:offset , limit:limit});
    return content;
}

export async function writeNotes(fileName:string , content:string){
    const notesPath = path.join(projectDir , fileName);
    await write(notesPath , content);
}

export async function editNotes(fileName:string , old_str:string , new_str:string){
    const notesPath = path.join(projectDir , fileName);
    await edit({path:notesPath , old_str  , new_str});
}