import type { ComplaintStatus } from "../complaint/complaint.types.js";

export const locationSources = ["MAP_SELECTION", "DEVICE_GPS", "ADMIN_CORRECTION"] as const;
export type LocationSource = (typeof locationSources)[number];

export interface ComplaintLocation {
  id: string;
  complaintId: string;
  latitude: number;
  longitude: number;
  addressText: string | null;
  locationDescription: string | null;
  accuracyMeters: number | null;
  source: LocationSource;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationSearch {
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
}

export interface StoredLocationMarker extends ComplaintLocation {
  distanceMeters: number | null;
}

export interface ComplaintMapMarker extends StoredLocationMarker {
  referenceNumber: string;
  title: string;
  status: ComplaintStatus;
  categoryId: string | null;
  assignedDepartmentId: string | null;
}
