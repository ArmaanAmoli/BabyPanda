import {McpServer} from "@modelcontextprotocol/server";
import {StdioServerTransport} from "@modelcontextprotocol/server/stdio";
import {read} from './tools/filesystem'
import {z} from "zod";

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
        }),
    },
    async (args)=>{
        console.log("in the read tool" , args.path)
        const text:string = await read(args.path);
        return {content:[{
            type:'text',
            text: text
        }]}
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