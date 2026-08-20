import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import dns from 'node:dns';
import https from 'node:https';

/**
 * Allowed domains for the internal fetch server.
 * Based on MINDCARE_SOURCE_REGISTRY.md trust tiers.
 * 
 * TIER_A: Government / International Health Organizations
 * TIER_B: Peer-Reviewed / Academic Medical Centers
 * TIER_C: Recognized Medical Education
 */
const ALLOWED_DOMAINS = [
    // TIER_A — Government / International
    'nimh.nih.gov', 'www.nimh.nih.gov',
    'nih.gov', 'www.nih.gov',
    'who.int', 'www.who.int',
    'cdc.gov', 'www.cdc.gov',
    'nhs.uk', 'www.nhs.uk',
    'apa.org', 'www.apa.org',
    'nice.org.uk', 'www.nice.org.uk',
    // TIER_B — Peer-Reviewed / Academic
    'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov',
    'mayoclinic.org', 'www.mayoclinic.org',
    'clevelandclinic.org', 'www.clevelandclinic.org',
    'medlineplus.gov', 'www.medlineplus.gov',
    'cochranelibrary.com', 'www.cochranelibrary.com',
    // TIER_C — Education
    'wikipedia.org', 'en.wikipedia.org', 'ar.wikipedia.org',
];

const MAX_BYTES = 5000000; // 5MB limit
const MAX_REDIRECTS = 3; // Allow limited redirect following for medical sites

function isPrivateIP(ip: string): boolean {
  // IPv4 Loopback and Private
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return true;
  // Multicast / Link-local / Any
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('224.')) return true;
  if (ip.startsWith('0.')) return true;

  // IPv6
  if (ip === '::1') return true;
  if (ip.startsWith('fc00:') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80:')) return true;

  return false;
}

// eslint-disable-next-line @typescript-eslint/no-deprecated
const server = new Server(
  { name: 'mindcare-internal-fetch', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, () => Promise.resolve({
  tools: [
    {
      name: 'FETCH_EXTERNAL_DOCUMENT',
      description: 'Fetch trusted educational markdown',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'FETCH_EXTERNAL_DOCUMENT') {
     throw new Error('Tool not found');
  }

  const rawUrl = String((request.params.arguments as Record<string, unknown>).url);
  
  let parsed: URL;
  try {
     parsed = new URL(rawUrl);
  } catch {
     return { content: [{ type: 'text', text: 'Error: Invalid URL' }] };
  }

  if (parsed.protocol !== 'https:') {
     return { content: [{ type: 'text', text: 'Error: Non-HTTPS URL rejected' }] };
  }

  if (parsed.username || parsed.password) {
     return { content: [{ type: 'text', text: 'Error: Credential-bearing URLs are rejected' }] };
  }

  if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
     return { content: [{ type: 'text', text: 'Error: Domain not in allowlist' }] };
  }

  // DNS Rebinding / SSRF Check
  try {
     const lookups = await dns.promises.lookup(parsed.hostname, { all: true });
     for (const lookup of lookups) {
        if (isPrivateIP(lookup.address)) {
           return { content: [{ type: 'text', text: 'Error: SSRF Protection - Private IP detected in DNS resolution' }] };
        }
     }
  } catch {
     return { content: [{ type: 'text', text: 'Error: DNS resolution failed' }] };
  }

  // Fetch with strict limits
  return new Promise((resolve) => {
     const req = https.get(parsed, { 
        timeout: 3000,
        headers: { 'User-Agent': 'MindCare-Bot/1.0.0 (admin@example.com)' }
     }, (res) => {
        if (res.statusCode && res.statusCode >= 300) {
           res.destroy();
           resolve({ content: [{ type: 'text', text: `Error: HTTP ${String(res.statusCode)}` }] });
           return;
        }
        
        let data = '';
        let bytes = 0;

        res.on('data', (chunk: Buffer) => {
           bytes += chunk.length;
           if (bytes > MAX_BYTES) {
              res.destroy();
              resolve({ content: [{ type: 'text', text: 'Error: Maximum response size exceeded' }] });
           } else {
              data += chunk.toString('utf8');
           }
        });

        res.on('end', () => {
           // Very simple HTML stripping for safety (internal tool verification)
           const stripped = data.replace(/<[^>]*>?/gm, ' ');
           resolve({ content: [{ type: 'text', text: stripped.substring(0, MAX_BYTES) }] });
        });
     });

     req.on('error', (e) => {
        resolve({ content: [{ type: 'text', text: `Error: Request failed - ${e.message}` }] });
     });

     req.on('timeout', () => {
        req.destroy();
        resolve({ content: [{ type: 'text', text: 'Error: Request timed out' }] });
     });
  });
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
