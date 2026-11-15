import { z } from "zod";

export const knowledgeIdentifierParamsSchema = z.object({
  id: z.string().uuid()
}).strict();

export const knowledgeUploadQuerySchema = z.object({
  title: z.string().trim().min(3).max(200),
  versionNote: z.string().trim().min(3).max(500).optional()
}).strict();

export const knowledgeQuerySchema = z.object({
  question: z.string().trim().min(3).max(1000)
}).strict();

export type KnowledgeUploadQuery = z.infer<typeof knowledgeUploadQuerySchema>;
export type KnowledgeQueryInput = z.infer<typeof knowledgeQuerySchema>;
