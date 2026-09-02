import * as dotenv from 'dotenv'
import * as path from 'path';
import {drizzle} from 'drizzle-orm/libsql'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __rootdirname = path.dirname(__dirname);
dotenv.config({path:path.resolve(__dirname , '../.env')})
if(!process.env['DB_FILE_NAME']){
    console.log("Database file path not given")
    process.exit(1);
}
const dbFile ='file://' + __rootdirname + '/' + process.env['DB_FILE_NAME']?.substring(5)
console.log(dbFile)
const db = drizzle(dbFile);
export {db};