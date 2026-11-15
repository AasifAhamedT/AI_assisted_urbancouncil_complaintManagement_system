import { z } from "zod";

export const classificationIdentifierParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const classificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

export const reviewClassificationSchema = z.object({
  categoryId: z.string().uuid(),
  reason: z.string().trim().min(5).max(1000).optional(),
  version: z.number().int().nonnegative()
}).strict();

export type ClassificationListQuery = z.infer<typeof classificationListQuerySchema>;
export type ReviewClassificationInput = z.infer<typeof reviewClassificationSchema>;
