import { randomUUID } from "node:crypto";

import { AppError } from "../../common/app-error.js";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { ComplaintService } from "../complaint/complaint.service.js";
import type { MarkerQuery, UpsertComplaintLocationInput } from "./gis.schemas.js";
import { GisRepository } from "./gis.repository.js";
import type { ComplaintLocation, ComplaintMapMarker } from "./gis.types.js";

export class GisService {
  constructor(
    private readonly repository = new GisRepository(),
    private readonly complaints = new ComplaintService()
  ) {}

  async getComplaintLocation(complaintId: string, principal: AuthPrincipal): Promise<ComplaintLocation> {
    await this.complaints.getComplaint(complaintId, principal);
    const location = await this.repository.findByComplaintId(complaintId);
    if (!location) {
      throw new AppError(404, "LOCATION_NOT_FOUND", "A location has not been saved for this complaint.");
    }
    return location;
  }

  async saveComplaintLocation(
    complaintId: string,
    input: UpsertComplaintLocationInput,
    principal: AuthPrincipal
  ): Promise<ComplaintLocation> {
    if (principal.role === "DEPARTMENT") {
      throw new AppError(403, "FORBIDDEN", "Department Accounts cannot change complaint locations.");
    }
    const complaint = await this.complaints.getComplaint(complaintId, principal);
    if (principal.role === "CITIZEN" && complaint.status !== "SUBMITTED") {
      throw new AppError(409, "LOCATION_NOT_EDITABLE", "A Citizen can change location only while the complaint is submitted.");
    }
    const existing = await this.repository.findByComplaintId(complaintId);
    await this.repository.upsert({
      id: existing?.id ?? randomUUID(),
      complaintId,
      latitude: input.latitude,
      longitude: input.longitude,
      addressText: input.addressText ?? null,
      locationDescription: input.locationDescription ?? null,
      accuracyMeters: input.accuracyMeters ?? null,
      source: principal.role === "ADMINISTRATOR" ? "ADMIN_CORRECTION" : "MAP_SELECTION",
      createdByUserId: principal.userId
    });
    return (await this.repository.findByComplaintId(complaintId))!;
  }

  async listMarkers(principal: AuthPrincipal, query: MarkerQuery): Promise<ComplaintMapMarker[]> {
    const complaints = await this.complaints.listAccessibleMapComplaints(principal, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {})
    });
    const locations = await this.repository.listForComplaintIds(complaints.map((item) => item.id), {
      ...(query.north !== undefined ? { north: query.north } : {}),
      ...(query.south !== undefined ? { south: query.south } : {}),
      ...(query.east !== undefined ? { east: query.east } : {}),
      ...(query.west !== undefined ? { west: query.west } : {}),
      ...(query.latitude !== undefined ? { latitude: query.latitude } : {}),
      ...(query.longitude !== undefined ? { longitude: query.longitude } : {}),
      ...(query.radiusMeters !== undefined ? { radiusMeters: query.radiusMeters } : {})
    });
    const byId = new Map(complaints.map((item) => [item.id, item]));
    return locations.flatMap((location) => {
      const complaint = byId.get(location.complaintId);
      return complaint ? [{ ...location, ...complaint, id: location.id, complaintId: complaint.id }] : [];
    });
  }
}
