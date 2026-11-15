import { z } from "zod";

const code = z.string().trim().min(2).max(60).regex(/^[A-Z][A-Z0-9_]*$/);
const description = z.string().trim().max(5000).nullable();

export const identifierParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const createDepartmentSchema = z.object({
  code,
  name: z.string().trim().min(2).max(150),
  description: description.optional()
}).strict();

export const updateDepartmentSchema = z.object({
  code: code.optional(),
  name: z.string().trim().min(2).max(150).optional(),
  description: description.optional(),
  isActive: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const createCategorySchema = z.object({
  code,
  name: z.string().trim().min(2).max(120),
  description: description.optional()
}).strict();

export const updateCategorySchema = z.object({
  code: code.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: description.optional(),
  isActive: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const mappingSchema = z.object({ departmentId: z.string().uuid() }).strict();

export const createDepartmentAccountSchema = z.object({
  departmentId: z.string().uuid(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  displayName: z.string().trim().min(2).max(150),
  phoneNumber: z.string().trim().max(30).optional()
}).strict();

export const updateDepartmentAccountStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"])
}).strict();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateDepartmentAccountInput = z.infer<typeof createDepartmentAccountSchema>;

