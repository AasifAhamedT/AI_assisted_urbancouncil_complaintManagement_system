# Phase 16 RAG Design

## Decision

Phase 16 follows the approved independent-service architecture: Express owns public authentication and role authorization, while FastAPI owns extraction, versioned authorized files, chunking, Gemini embeddings and generation, ChromaDB, retrieval, citations, and abstention.

No MySQL table or cross-database foreign key is introduced. The service-owned `authorized_documents` directory contains generated document/version paths plus an atomic manifest. ChromaDB contains only authorized document chunks, embeddings, and source metadata—not complaint records.

## Ingestion lifecycle

1. Express confirms the caller is an Administrator and validates the bounded file metadata, size, extension, media type, and signature.
2. FastAPI repeats authoritative validation, records a `PROCESSING` version, and stores the file under a generated document/version path.
3. Text is extracted from PDF pages, DOCX paragraphs, or UTF-8 text and split into overlapping source-labelled chunks.
4. Gemini creates retrieval-document embeddings.
5. ChromaDB upserts the new version before obsolete chunk IDs are removed, preserving the previous active vectors if extraction or embedding fails.
6. The manifest records `READY`, chunk count, checksum, actor, timestamps, and the current version. Failures record `FAILED` plus a bounded failure code without leaking provider details.

## Query lifecycle

1. Express accepts only a bounded `question` field from an authenticated Citizen or Administrator.
2. Gemini creates a retrieval-query embedding and ChromaDB returns the nearest active chunks.
3. Results outside the configured maximum cosine distance are discarded.
4. Gemini receives only the question and retrieved authorized chunks under an instruction to use no outside knowledge.
5. The service accepts a grounded answer only when `supported=true` and every cited chunk ID belongs to the retrieved set. Otherwise it returns the fixed abstention.

## Privacy and failure boundaries

- The service has no complaint repository or MySQL credentials.
- No chat-history persistence is introduced in this phase.
- RAG configuration/provider failures return a scoped chatbot error and never affect complaint submission or processing.
- Deactivation removes chunks from retrieval but retains source/version evidence. Hard deletion remains outside Phase 16 because it would be destructive and requires a separate retention decision.
