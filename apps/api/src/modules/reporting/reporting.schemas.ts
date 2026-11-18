import { z } from "zod";

import { complaintStatuses } from "../complaint/complaint.types.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD date format.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date.");

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const addUtcDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
};

export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  bucket: z.enum(["day", "week", "month"]).default("day"),
  status: z.enum(complaintStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional()
}).strict().transform((value) => {
  const today = formatDate(new Date());
  const to = value.to ?? today;
  const from = value.from ?? addUtcDays(to, -29);
  return { ...value, from, to };
}).superRefine((value, context) => {
  const from = new Date(`${value.from}T00:00:00.000Z`);
  const to = new Date(`${value.to}T00:00:00.000Z`);
  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (to < from) {
    context.addIssue({ code: "custom", path: ["to"], message: "The end date cannot be before the start date." });
  } else if (days > 366) {
    context.addIssue({ code: "custom", path: ["to"], message: "The reporting period cannot exceed 366 days." });
  }
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
