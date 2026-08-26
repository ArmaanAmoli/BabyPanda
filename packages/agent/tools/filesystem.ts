import * as fs from 'node:fs/promises';
import {exec} from 'node:child_process';
import { promisify } from 'node:util';

const execPromis = promisify(exec);

export async function read(path: string) {
    try {
        const data = await fs.readFile('./test.txt', { encoding: 'utf8' });
        return data;
    } catch (err) {
        throw new Error(`An error occured while reading file: ${err}`);
    }
}

export async function write(path:string , content:string) { //create new file
    try{
       await fs.writeFile(path , content);
    }catch(err){
        throw new Error(`An error occured while writing file: ${err}`);
    }
}

export function grep(path:string , pattern:string) {
    const output = {
        stdout:'',
        stderr:'',
        error:'',
    }
    exec(`grep -n "${pattern} ${path}` , (error , stdout , stderr)=>{
        if(error){
            if(error.code === 1){
                output.error = 'No match found.';
            }
            else{
                output.error = `Execution error: ${error.message}`;
            }
        }
        else{
            if(stderr){
                output.stderr = stderr;
            }
            output.stdout = stdout;
        }
    })
    return output;
}

export async function list() {
    const { stdout, stderr } = await execPromis('ls');
    return {stdout , stderr}
}

export async function edit() {

}

export async function create() {

}

export async function del() {

}