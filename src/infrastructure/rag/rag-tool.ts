import { KnowledgeRetriever } from './knowledge-retriever.js';
import { ToolResult } from '../../tools/types.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';
import { Result, ok, err } from '../../core/result.js';
import { ToolExecutionError } from '../../core/errors.js';

/**
 * KNOWLEDGE_BASE_SEARCH tool implementation.
 *
 * This is what the LLM calls (via AdvancedToolGate) when it decides to retrieve
 * WHO mhGAP knowledge. Returns an assembled, structured context block back to the
 * LLM runtime via [TOOL_RESULT: ...] in currentContextData.
 *
 * Routing architecture ported from CleanRAG2 notebook Cells 32/39:
 *   - Tool name: KNOWLEDGE_BASE_SEARCH  (vs. EXTERNAL_KNOWLEDGE_SEARCH = MCP/web)
 *   - The LLM decides which tool to call based on the tool description in buildClinicalPolicy
 */
export class RAGTool {
    private logger = new RuntimeLogger();

    constructor(private retriever: KnowledgeRetriever) {}

    public async execute(
        query: string,
        requestId: string
    ): Promise<Result<ToolResult, ToolExecutionError>> {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return err(new ToolExecutionError('KNOWLEDGE_BASE_SEARCH requires a non-empty query argument'));
        }

        const startMs = Date.now();
        try {
            const retrieval = await this.retriever.retrieve(query.trim());
            const assembled = this.retriever.assembleContext(retrieval);

            this.logger.info('RAGToolExecuted', {
                requestId,
                grounded: assembled.grounded,
                chunkCount: assembled.chunkCount,
                retrievalMs: retrieval.retrievalMs,
                totalMs: Date.now() - startMs,
                timestamp: new Date()
            });

            return ok({
                ok: assembled.grounded,
                data: {
                    contextBlock: assembled.contextBlock,
                    grounded: assembled.grounded,
                    sources: assembled.sources,
                    chunkCount: assembled.chunkCount
                },
                metadata: {
                    semanticBoundary: 'TOOL_RESULT' as const,
                    truncated: false
                }
            });
        } catch (error: any) {
            this.logger.error('RAGToolFailed', {
                requestId,
                error: error.message,
                totalMs: Date.now() - startMs,
                timestamp: new Date()
            });
            return err(new ToolExecutionError(`Knowledge base search failed: ${error.message}`));
        }
    }
}
