import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4H: Architecture Boundary Enforcement', () => {
  const srcDir = path.join(process.cwd(), 'src');

  function getFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFilesRecursively(fullPath));
      } else if (fullPath.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allTsFiles = getFilesRecursively(srcDir);

  it('Ensures Clinical skills do NOT bypass the ToolGate by importing MemoryRepository directly', () => {
    const memoryRepoImports = allTsFiles.filter(f => {
      const content = fs.readFileSync(f, 'utf8');
      // Only policy, repo interfaces, DB implementations, and DI root (server) can import it
      if (f.includes('memory-policy.ts') || 
          f.includes('memory-repository.ts') || 
          f.includes('pg-memory-repository.ts') ||
          f.includes('repository.ts') ||
          f.includes('realtime-server.ts') ||
          f.includes('valkey-state-coordinator.ts')) return false;
      return content.includes('MemoryRepository');
    });

    if (memoryRepoImports.length > 0) {
      console.error('Violations:', memoryRepoImports);
    }
    expect(memoryRepoImports).toHaveLength(0);
  });

  it('Ensures Clinical skills do NOT bypass MCP Policy by importing RealMCPClient directly', () => {
    const mcpClientImports = allTsFiles.filter(f => {
      const content = fs.readFileSync(f, 'utf8');
      // Only mcp-policy-gate.ts and real-mcp-client.ts are allowed to import/instantiate it
      if (f.includes('mcp-policy-gate.ts') || f.includes('real-mcp-client.ts')) return false;
      return content.includes('RealMCPClient');
    });

    expect(mcpClientImports).toHaveLength(0);
  });

  it('Ensures the Orchestrator does NOT bypass any policy gates', () => {
    const orchestratorContent = fs.readFileSync(path.join(srcDir, 'core', 'orchestrator.ts'), 'utf8');
    
    // Orchestrator MUST use Policy Gates, not direct underlying Repositories
    expect(orchestratorContent).not.toContain('MemoryRepository');
    expect(orchestratorContent).not.toContain('RealMCPClient');
    expect(orchestratorContent).not.toContain('HandoffRepository');

    // Orchestrator MUST use SkillPolicyGate, not directly invoke skill execution
    expect(orchestratorContent).toContain('SkillPolicyGate');
  });

  it('Ensures LLMRuntime does NOT bypass AdvancedToolGate', () => {
    const llmRuntimeContent = fs.readFileSync(path.join(srcDir, 'clinical', 'llm-runtime.ts'), 'utf8');
    
    // LLM Runtime MUST route through AdvancedToolGate
    expect(llmRuntimeContent).toContain('AdvancedToolGate');
    expect(llmRuntimeContent).toContain('this.toolGate.authorizeAndExecute');
    
    // LLM Runtime MUST NOT import direct policies or repositories
    expect(llmRuntimeContent).not.toContain('MemoryPolicyGate');
    expect(llmRuntimeContent).not.toContain('MCPPolicyGate');
  });

  it('Ensures Voice Infrastructure does NOT bypass the Orchestrator/SafetyPipeline', () => {
    const voiceDir = path.join(srcDir, 'infrastructure', 'voice');
    if (fs.existsSync(voiceDir)) {
      const voiceFiles = getFilesRecursively(voiceDir);
      
      for (const file of voiceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        // Voice infrastructure (STT/TTS providers) MUST NOT make security decisions
        expect(content).not.toContain('SafetyPipeline');
        expect(content).not.toContain('OutputSafetyFilter');
      }
    }
  });
});
