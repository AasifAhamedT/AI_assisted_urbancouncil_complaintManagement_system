import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(12, "Password must contain at least 12 characters.")
  .max(128, "Password must contain at most 128 characters.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(2).max(150),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 -]{6,28}[0-9]$/, "Invalid phone number.")
    .max(30)
    .optional()
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128)
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(4096)
}).strict();

export const logoutSchema = refreshSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

