import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type { Tool, ToolResult } from '@/types';

export class MCPClient {
    private mcp: Client;
    private transport: StdioClientTransport | null = null;
    private tools: any = [];
    constructor() {
        this.mcp = new Client({ name: "baby-panda/mcp-client", version: "1.0.0" });
    }
    async connectToServer(serverScriptPath: string, cwd: string) {
        try {
            const isJs = serverScriptPath.endsWith(".ts");
            if (!isJs) {
                throw new Error("Server script must be a .ts file");
            }
            console.log("MCP:", cwd)
            this.transport = new StdioClientTransport({
                command: "npx",
                args: ["tsx", serverScriptPath],
                cwd: cwd,
                env: {
                    ...process.env,
                    CLIENT_CWD: cwd
                }
            });
            console.log("StdioClientTreansportCreated")
            await this.mcp.connect(this.transport);
            console.log("connected")
            const toolsResult = await this.mcp.listTools();
            console.log(toolsResult)
            this.tools = toolsResult.tools.map((tool) => {
                console.log(tool)
                return {
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.inputSchema
                };
            });
            console.log("Connected to server with tools: ", this.tools.map( ({ name }: any) => { name } ) )
        } catch (err) {
            console.log("[ERROR] packages/agent/mcp/client.ts Failed to connect to MCP server: ", err);
            throw err;
        }
    }
    async callTools(tools: Tool[]): Promise<ToolResult[]> {
        const finalResult: ToolResult[] = [];
        for (const tool of tools) {
            try {
                console.log("MCP client", tool);
                const result = await this.mcp.callTool(tool);

                finalResult.push({ id: tool.id, name: tool.name, arguments: tool.arguments, result: result });
            } catch (err) {
                finalResult.push({ id: tool.id, name: tool.name, arguments: tool.arguments, error: String(err) });
                console.error(`An error occured while calling ${tool} \n ${err}`);
            }
        }
        return finalResult;
    }
}