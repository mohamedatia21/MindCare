-- Migration 005: Add bibliographic metadata to knowledge_chunks
-- Supports structured book citations with author, edition, chapter, and book_title.
-- Uses IF NOT EXISTS to be idempotent and safe for re-runs.
-- Never destroys existing data — additive only.
--
-- Required for Section 3 (Internal Book Citation System):
--   source_type: internal_book | external_web
--   book_title: exact title
--   author: author name
--   edition: edition string
--   chapter: chapter identifier

ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'internal_book';
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS book_title TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS edition TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chapter TEXT;

-- Backfill existing WHO mhGAP rows with known metadata
UPDATE knowledge_chunks 
SET 
    source_type = 'internal_book',
    book_title = 'mhGAP Intervention Guide',
    author = 'World Health Organization',
    edition = 'Version 2.0 (2016)'
WHERE source_document = 'WHO_mhGAP' 
  AND book_title IS NULL;

COMMENT ON COLUMN knowledge_chunks.source_type IS 'internal_book or external_web';
COMMENT ON COLUMN knowledge_chunks.book_title IS 'Exact book title for structured citations';
COMMENT ON COLUMN knowledge_chunks.author IS 'Book/document author';
COMMENT ON COLUMN knowledge_chunks.edition IS 'Edition or version string';
COMMENT ON COLUMN knowledge_chunks.chapter IS 'Chapter identifier';
