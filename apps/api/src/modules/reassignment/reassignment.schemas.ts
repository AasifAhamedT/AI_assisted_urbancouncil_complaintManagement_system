import { z } from "zod";

import { reassignmentStatuses } from "./reassignment.types.js";

export const reassignmentIdentifierParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const createReassignmentSchema = z.object({
  complaintId: z.string().uuid(),
  reason: z.string().trim().min(10).max(1000)
}).strict();

const decisionReason = z.string().trim().min(5).max(1000);

export const decideReassignmentSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("APPROVED"),
    targetDepartmentId: z.string().uuid(),
    decisionReason
  }).strict(),
  z.object({
    decision: z.literal("REJECTED"),
    decisionReason
  }).strict()
]);

export const reassignmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(reassignmentStatuses).optional()
}).strict();

export type CreateReassignmentInput = z.infer<typeof createReassignmentSchema>;
export type DecideReassignmentInput = z.infer<typeof decideReassignmentSchema>;
export type ReassignmentListQuery = z.infer<typeof reassignmentListQuerySchema>;
