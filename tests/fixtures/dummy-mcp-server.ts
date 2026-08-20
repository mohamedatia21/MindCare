import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// eslint-disable-next-line @typescript-eslint/no-deprecated
const server = new Server(
  { name: 'dummy-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, () => Promise.resolve({
  tools: [
    { name: 'test_tool', description: 'Echoes data', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
    { name: 'delay_tool', description: 'Delays', inputSchema: { type: 'object', properties: { ms: { type: 'number' } } } }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'test_tool') {
    const textArg = String((request.params.arguments as Record<string, unknown>).text);
    return {
      content: [{ type: 'text', text: `Echo: ${textArg}` }]
    };
  }
  if (request.params.name === 'delay_tool') {
    const msArg = Number((request.params.arguments as Record<string, unknown>).ms) || 1000;
    await new Promise(r => setTimeout(r, msArg));
    return { content: [{ type: 'text', text: 'Delayed' }] };
  }
  throw new Error('Tool not found');
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
