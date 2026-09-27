import {writeFileSync , readFileSync , existsSync , lstatSync , mkdirSync} from "fs";
import path from 'path';
import {LogType} from '@baby-panda/types'
import os from 'os'

export function writeLogs(type:LogType , projectName:string , sessionId:string , content:string ){
    const timestamp = Date.now();
    //write to file
    const homeDir = os.homedir()
    const logDirectoryLocation = path.join(homeDir ,'.babypanda' , 'logs' , projectName , sessionId);
    const mcpLogFile = path.join(logDirectoryLocation , 'mcp.log');
    const agentLogFile = path.join(logDirectoryLocation , 'agent.log');
    const dbLogFile = path.join(logDirectoryLocation , 'db.log');
    const cliLogFile = path.join(logDirectoryLocation , 'cli.log');

    if(!(existsSync(logDirectoryLocation) && lstatSync(logDirectoryLocation).isDirectory())){
        mkdirSync(logDirectoryLocation , {recursive:true});
        writeFileSync(mcpLogFile , "MCP LOGS");
        writeFileSync(agentLogFile , "AGENT LOGS");
        writeFileSync(dbLogFile , "DB LOGS");
        writeFileSync(cliLogFile , "CLI LOGS");
    }

    const writePath = path.join(logDirectoryLocation , type);
    content = readFileSync(writePath).toString() + '\n' + `[${type}: ${timestamp}]: ${content}`;
    writeFileSync(writePath , content);
}