import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { Tool, ToolResult } from '@agent/types';
import { getProjectName, writeLogs } from '@baby-panda/utils';
import { LogType, Role, type ToolMessage } from '@baby-panda/types';

export class MCPClient {
  private mcp: Client;
  private transport: StdioClientTransport | null = null;
  private sessionId: string;
  private tools: unknown[] = [];
  constructor(sessionId: string) {
    this.mcp = new Client({ name: 'baby-panda/mcp-client', version: '1.0.0' });
    this.sessionId = sessionId;
  }
  async connectToServer(serverScriptPath: string, cwd: string) {
    try {
      const isJs = serverScriptPath.endsWith('.ts');
      if (!isJs) {
        throw new Error('Server script must be a .ts file');
      }
      console.log('MCP:', cwd);
      this.transport = new StdioClientTransport({
        command: 'bun',
        args: [serverScriptPath],
        cwd: cwd,
        env: {
          ...process.env,
          CLIENT_CWD: cwd,
        },
      });
      console.log('StdioClientTreansportCreated');
      await this.mcp.connect(this.transport);
      console.log('[MCP CLIENT]: connected');
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        console.log(tool);
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
    } catch (err) {
      console.log('[ERROR] packages/agent/mcp/client.ts Failed to connect to MCP server: ', err);
      throw err;
    }
  }
  async callTools(tools: Tool[]): Promise<ToolMessage[]> {
    const mcpResult: ToolResult[] = [];
    for (const tool of tools) {
      try {
        // console.log("[MCP CLIENT]:", tool);
        const result = await this.mcp.callTool(tool);
        await writeLogs(LogType.mcp, getProjectName(), this.sessionId, `[TOOL RESULT]: ${result}`);
        mcpResult.push({
          id: tool.id,
          name: tool.name,
          arguments: tool.arguments,
          result: result,
        });
      } catch (err) {
        mcpResult.push({
          id: tool.id,
          name: tool.name,
          arguments: tool.arguments,
          error: String(err),
        });
        console.error(`An error occured while calling ${tool} \n ${err}`);
      }
    }
    const result: ToolMessage[] = mcpResult.map((result) => {
      return {
        role: Role.tool,
        tool_call_id: result.id,
        content: JSON.stringify(`${result.result} \n ${result.error ?? ''}`),
      };
    });
    return result;
  }
}
