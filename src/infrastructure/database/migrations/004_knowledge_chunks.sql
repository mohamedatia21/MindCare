-- Migration 004: WHO mhGAP Knowledge Chunks table
-- This table stores the static, read-only reference corpus (WHO mhGAP document chunks).
-- It is NOT user data and is NOT subject to GDPR per-user erasure.
-- Embeddings are generated with text-embedding-3-small (1536 dimensions) to match the
-- existing vector(1536) schema convention in this project.

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text        TEXT NOT NULL,
    pdf_page    INTEGER,
    topic       TEXT,
    section     TEXT,
    source_document TEXT NOT NULL DEFAULT 'WHO_mhGAP',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector embeddings are now stored in Qdrant Cloud.

-- Text search index for debuggability / admin queries
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_topic
    ON knowledge_chunks (topic)
    WHERE topic IS NOT NULL;

-- Enable and FORCE Row Level Security
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;

-- Allow SELECT only to authenticated tenants (identified by having a current_user_id)
-- INSERT/UPDATE/DELETE are implicitly denied
CREATE POLICY auth_read_knowledge_chunks ON knowledge_chunks
    FOR SELECT
    USING (current_setting('app.current_user_id', true) IS NOT NULL);

-- Track chunk count for migration verification
COMMENT ON TABLE knowledge_chunks IS
    'Static WHO mhGAP reference corpus. Not user PII. Populated once via scripts/one-time-qdrant-export.ts.';
