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
    async connectToServer(serverScriptPath: string) {
        try {
            const isJs = serverScriptPath.endsWith(".ts");
            if (!isJs) {
                throw new Error("Server script must be a .ts file");
            }
            this.transport = new StdioClientTransport({
                command: "npx",
                args: ["tsx", serverScriptPath],
            });
            await this.mcp.connect(this.transport);
            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.inputSchema
                };
            });
            console.log("Connected to server with tools: ", this.tools.map(({ name }: any) => { name }))
        } catch (err) {
            console.log("Failed to connect to MCP server: ", err);
            throw err;
        }
    }
    async callTools(tools: Tool[]): Promise<ToolResult[]> {
        const finalResult: ToolResult[] = [];
        for (const tool of tools) {
            try {
                const result = await this.mcp.callTool(tool);

                finalResult.push({ id: tool.id, name: tool.name, args: tool.args, result: result });
            } catch (err) {
                finalResult.push({ id: tool.id, name: tool.name, args: tool.args, error: String(err) });
                console.error(`An error occured while calling ${tool} \n ${err}`);
            }
        }
        return finalResult;
    }
}