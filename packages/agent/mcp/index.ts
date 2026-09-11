import {McpServer} from "@modelcontextprotocol/server";
import {StdioServerTransport} from "@modelcontextprotocol/server/stdio";
import {read , grep , edit , glob , del} from './tools/filesystem'
import {array, string, z} from "zod";

const cwd = process.env.CLIENT_CWD || process.cwd();
const server = new McpServer({
    name:"baby-panda/mcp",
    version:"1.0.0",
})

server.registerTool(
    "read",
    {
        description:"Read content of a file",
        inputSchema: z.object({
            path:z.string().describe("Location of file"),
            offset:z.number().optional().describe("Starting line number"),
            limit:z.number().optional().describe("Number of lines coming after offset (including offset)")
        }),
    },
    async (args)=>{
        console.log("in the read tool" , args.path)
        const text:string = await read(args);
        return {content:[{
            type:'text',
            text: text
        }]}
    }
);

server.registerTool(
    "grep",
    {
        description:"Search content across files",
        inputSchema:z.object({
            path:z.string().describe("Location of file"),
            pattern:z.string().describe("Regular expression for searching"),
            flag:z.string().describe("flags to use (spawn process of nodeJs) [flag , pattern , path]").optional()
        }),
    },
    async (args)=>{
        const searchResult = await grep(args.path , args.pattern , args.flag)
        return {
            content:[
                {
                    type:"text",
                    text:JSON.stringify(searchResult)
                }
            ]
        }}
);

server.registerTool(
    "edit",
    {
        description:"edit content of a pre existing file",
        inputSchema:z.object({
            path:z.string().describe("Location of file"),
            old_str:string().describe("String that will be replaced"),
            new_str:string().describe("The string that will replace")
        }),
    },
    async (args)=>{
        const edited = await edit(args);
        return{
            content:[
                {type:"text" , text:`${edited}`}
            ]
        }
    }
)

server.registerTool(
    "glob",
    {
        description:"search for files",
        inputSchema:z.object({
            pattern:string().describe("String that will be replaced"),
            ignorePatterns:array(z.string()).describe("The string that will replace").optional()
        }),
    },
    async (args)=>{
        const edited = await glob(args.pattern , args.ignorePatterns);
        return{
            content:[
                {type:"text" , text:`${edited}`}
            ]
        }
    }
)

server.registerTool(
    "delete",
    {
        description:"deletes a file",
        inputSchema:z.object({
            path:string().describe("path of the file"),
            options:z.object({
                force:z.boolean().or(z.undefined()).optional().default(false),
                maxRetries:z.number().or(z.undefined()).optional().default(0),
                recursive:z.boolean().or(z.undefined()).optional().default(false),
                retryDelay:z.number().or(z.undefined()).default(100),
            }).optional()
        }),
    },
    async (args)=>{
        await del(args.path , args.options);
        return{
            content:[
                {type:"text" , text:``}
            ]
        }
    }
)

async function main(){
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Baby panda MCP server is now live')
}

main().catch((error)=>{
    console.error("Fatal error in main():" , error);
    process.exit(1);
});