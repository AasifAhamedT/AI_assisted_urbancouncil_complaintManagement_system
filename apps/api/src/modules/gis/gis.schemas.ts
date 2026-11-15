import { z } from "zod";

import { complaintStatuses } from "../complaint/complaint.types.js";

const latitude = z.coerce.number().finite().min(-90).max(90);
const longitude = z.coerce.number().finite().min(-180).max(180);
const nullableText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable().optional();

export const gisComplaintParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const upsertComplaintLocationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  addressText: nullableText(500),
  locationDescription: nullableText(500),
  accuracyMeters: z.number().finite().nonnegative().max(100_000).nullable().optional()
}).strict();

export const markerQuerySchema = z.object({
  status: z.enum(complaintStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  north: latitude.optional(),
  south: latitude.optional(),
  east: longitude.optional(),
  west: longitude.optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  radiusMeters: z.coerce.number().finite().positive().max(100_000).optional()
}).strict().superRefine((value, context) => {
  const bounds = [value.north, value.south, value.east, value.west];
  if (bounds.some((item) => item !== undefined) && bounds.some((item) => item === undefined)) {
    context.addIssue({ code: "custom", message: "north, south, east, and west must be provided together.", path: ["north"] });
  } else if (value.north !== undefined && value.south !== undefined && value.north <= value.south) {
    context.addIssue({ code: "custom", message: "north must be greater than south.", path: ["north"] });
  } else if (value.east !== undefined && value.west !== undefined && value.east <= value.west) {
    context.addIssue({ code: "custom", message: "east must be greater than west.", path: ["east"] });
  }

  const nearby = [value.latitude, value.longitude, value.radiusMeters];
  if (nearby.some((item) => item !== undefined) && nearby.some((item) => item === undefined)) {
    context.addIssue({ code: "custom", message: "latitude, longitude, and radiusMeters must be provided together.", path: ["latitude"] });
  }
});

export type UpsertComplaintLocationInput = z.infer<typeof upsertComplaintLocationSchema>;
export type MarkerQuery = z.infer<typeof markerQuerySchema>;
