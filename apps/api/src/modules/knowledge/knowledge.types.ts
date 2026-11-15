export type KnowledgeIngestionStatus = "PROCESSING" | "READY" | "FAILED";

export interface KnowledgeDocumentVersion {
  version: number;
  originalFilename: string;
  mediaType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: KnowledgeIngestionStatus;
  chunkCount: number;
  versionNote: string | null;
  failureCode: string | null;
  createdByUserId: string;
  createdAt: string;
  completedAt: string | null;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  isActive: boolean;
  currentVersion: number | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  versions: KnowledgeDocumentVersion[];
}

export interface KnowledgeCitation {
  documentId: string;
  documentTitle: string;
  version: number;
  location: string;
  excerpt: string;
}

export interface KnowledgeAnswer {
  answer: string;
  abstained: boolean;
  citations: KnowledgeCitation[];
  provider: string;
  modelName: string;
}
