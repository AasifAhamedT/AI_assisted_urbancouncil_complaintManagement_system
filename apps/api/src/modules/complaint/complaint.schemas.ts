import { z } from "zod";

import { complaintPriorities, complaintStatuses } from "./complaint.types.js";

const optionalTrimmed = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();

export const complaintIdentifierParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const attachmentIdentifierParamsSchema = z.object({
  id: z.string().uuid(),
  attachmentId: z.string().uuid()
}).strict();

export const createComplaintSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20).max(20_000),
  categoryId: z.string().uuid().optional()
}).strict();

export const updateComplaintSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(20).max(20_000).optional(),
  version: z.number().int().nonnegative()
}).strict().refine(
  (value) => value.title !== undefined || value.description !== undefined,
  "At least one editable field is required."
);

export const updateComplaintStatusSchema = z.object({
  status: z.enum(complaintStatuses),
  reason: optionalTrimmed(1000),
  version: z.number().int().nonnegative()
}).strict();

export const complaintListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalTrimmed(100),
  status: z.enum(complaintStatuses).optional(),
  priority: z.enum(complaintPriorities).optional(),
  categoryId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "referenceNumber", "status", "priority"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
}).strict();

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
