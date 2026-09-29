import { EventEmitter } from 'events';
import * as pty from 'node-pty'
import os from 'os'

export class Shell extends EventEmitter {
    private shell;
    private cwd;
    private env;
    private rows;
    private cols;
    private pseudoProcess;
    constructor() {
        super();
        this.shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        this.cwd = process.cwd()
        this.env = process.env;
        this.rows = process.stdout.rows;
        this.cols = process.stdout.columns;
        this.pseudoProcess = pty.spawn(this.shell , [] , {name: 'baby-panda-shell-tool-instance', rows:this.rows, cols:this.cols, cwd:this.cwd, env:this.env})

        // declare event listners here
        this.pseudoProcess.onData((data)=>{
            if(data.toLowerCase().includes("password")){
                this.emit('authorize' , data);
            }
            else{
                this.emit('data' , data);
            }
        })
    }
    write(script: string){
        this.pseudoProcess.write(script);
    }
    kill(){
        this.pseudoProcess.kill();
    }
    
}