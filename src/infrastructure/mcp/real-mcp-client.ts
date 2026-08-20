import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPClient } from '../../mcp/mcp-client.js';
import { MCPRequest, MCPResponse } from '../../mcp/types.js';
import { MCPRegistry } from '../../mcp/mcp-registry.js';

export class RealMCPClient implements MCPClient {
  private activeClients = new Map<string, Client>();
  private activeTransports = new Map<string, StdioClientTransport>();

  constructor(private registry: MCPRegistry) {}

  async connect(serverId: string): Promise<void> {
    if (this.activeClients.has(serverId)) return;

    const serverRes = this.registry.getServer(serverId);
    if (!serverRes.ok) throw new Error(serverRes.error.message);
    const server = serverRes.value;

    if (server.transport !== 'stdio' || !server.command) {
       throw new Error(`Only STDIO transport is currently supported by RealMCPClient. Server: ${serverId}`);
    }

    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args || [],
    });

    const client = new Client(
      { name: 'MindCare-Runtime', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    
    this.activeClients.set(serverId, client);
    this.activeTransports.set(serverId, transport);
  }

  async disconnect(serverId: string): Promise<void> {
    const transport = this.activeTransports.get(serverId);
    if (transport) {
       await transport.close();
       this.activeTransports.delete(serverId);
       this.activeClients.delete(serverId);
    }
  }

  async executeTool(request: MCPRequest): Promise<MCPResponse> {
    const start = Date.now();
    let client = this.activeClients.get(request.serverId);
    
    if (!client) {
       await this.connect(request.serverId);
       const newClient = this.activeClients.get(request.serverId);
       if (!newClient) throw new Error("Failed to connect client");
       client = newClient;
    }

    const timeout = request.timeoutMs || 10000;

    try {
       const toolPromise = client.callTool({
         name: request.toolName,
         arguments: request.arguments
       });

       const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => { reject(new Error('Timeout: MCP Server took too long to respond')); }, timeout)
       );

       const result = await Promise.race([toolPromise, timeoutPromise]) as Record<string, unknown>;

       // If it throws an error in the result block
       if (result.isError) {
          const contentArray = result.content as Array<{ text: string }> | undefined;
          return {
             ok: false,
             error: `MCP Tool Error: ${contentArray?.[0]?.text || 'Unknown Error'}`,
             metadata: { truncated: false, provenance: request.serverId, executionTimeMs: Date.now() - start }
          };
       }

       const contentArray = result.content as Array<{ text: string }>;
       return {
         ok: true,
         data: contentArray.map((c) => c.text).join('\\n'),
         metadata: { truncated: false, provenance: request.serverId, executionTimeMs: Date.now() - start }
       };

    } catch (e: unknown) {
       const errorMessage = e instanceof Error ? e.message : String(e);
       if (errorMessage.includes('Timeout')) {
          throw e; // Caught by policy gate
       }
       return {
          ok: false,
          error: `Provider Error: ${errorMessage}`,
          metadata: { truncated: false, provenance: request.serverId, executionTimeMs: Date.now() - start }
       };
    }
  }
}
