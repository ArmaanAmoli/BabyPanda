import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { Tool, ToolResult } from '@agent/types';
import { Role, type ToolMessage, LogType } from '@baby-panda/types';
import type { McpServer } from '@modelcontextprotocol/server';
import { logError } from '@baby-panda/utils';

export class MCPClient {
  private mcp: Client;
  private sessionId: string;
  private projectName: string;
  private tools: unknown[] = [];

  constructor(sessionId: string, projectName: string) {
    this.mcp = new Client({ name: 'baby-panda/mcp-client', version: '1.0.0' });
    this.sessionId = sessionId;
    this.projectName = projectName;
  }

  /**
   * Connects the client to an already-constructed MCP server over an
   * in-memory transport pair.
   *
   * The server must be connected first: the client sends `initialize` as
   * soon as it connects, and if the server's transport is not yet
   * listening that request is written into a pipe with no reader and the
   * call times out.
   */
  async connectToServer(server: McpServer) {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await this.mcp.connect(clientTransport, { timeout: 5000 });
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
    } catch (err) {
      await logError(
        LogType.mcp,
        this.projectName,
        this.sessionId,
        'failed to connect to the MCP server',
        err,
      );
      throw err;
    }
  }

  /**
   * Executes a single tool and returns the raw result (with `result` or
   * `error`), so the caller can derive stats / before-snapshots and emit
   * per-call events.
   */
  async callToolRaw(tool: Tool): Promise<ToolResult> {
    try {
      const result = await this.mcp.callTool(tool);
      return {
        id: tool.id,
        name: tool.name,
        arguments: tool.arguments,
        result: result,
      };
    } catch (err) {
      await logError(
        LogType.mcp,
        this.projectName,
        this.sessionId,
        `MCP tool call failed: ${tool.name}`,
        err,
      );
      return {
        id: tool.id,
        name: tool.name,
        arguments: tool.arguments,
        error: String(err),
      };
    }
  }

  async callTools(tools: Tool[]): Promise<ToolMessage[]> {
    const mcpResult: ToolResult[] = [];
    for (const tool of tools) {
      mcpResult.push(await this.callToolRaw(tool));
    }
    const result: ToolMessage[] = mcpResult.map((result) => {
      return {
        role: Role.tool,
        tool_call_id: result.id,
        content: JSON.stringify(result),
      };
    });
    return result;
  }
}
