import { describe, expect, it, vi } from "vitest";

import type { AuthPrincipal } from "../auth/auth.types.js";
import type { ComplaintService } from "../complaint/complaint.service.js";
import type { GisRepository } from "./gis.repository.js";
import { GisService } from "./gis.service.js";

const citizen: AuthPrincipal = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "citizen@example.com",
  role: "CITIZEN",
  tokenVersion: 0
};

describe("GIS authorization", () => {
  it("uses complaint access policy before returning a stored location", async () => {
    const getComplaint = vi.fn(async () => ({ id: "30000000-0000-4000-8000-000000000001" }));
    const repository = {
      findByComplaintId: vi.fn(async () => ({ complaintId: "30000000-0000-4000-8000-000000000001" }))
    } as unknown as GisRepository;
    const service = new GisService(repository, { getComplaint } as unknown as ComplaintService);

    await service.getComplaintLocation("30000000-0000-4000-8000-000000000001", citizen);

    expect(getComplaint).toHaveBeenCalledWith("30000000-0000-4000-8000-000000000001", citizen);
  });

  it("rejects Department Account location changes", async () => {
    const getComplaint = vi.fn();
    const service = new GisService({} as GisRepository, { getComplaint } as unknown as ComplaintService);

    await expect(service.saveComplaintLocation(
      "30000000-0000-4000-8000-000000000001",
      { latitude: 8.49, longitude: 81.18 },
      { ...citizen, role: "DEPARTMENT" }
    )).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(getComplaint).not.toHaveBeenCalled();
  });

  it("passes only policy-approved complaint IDs to the GIS repository", async () => {
    const listAccessibleMapComplaints = vi.fn(async () => [{
      id: "30000000-0000-4000-8000-000000000001",
      referenceNumber: "KUC-2026-000001",
      title: "Blocked drain",
      status: "SUBMITTED" as const,
      categoryId: null,
      assignedDepartmentId: null
    }]);
    const listForComplaintIds = vi.fn(async () => []);
    const service = new GisService(
      { listForComplaintIds } as unknown as GisRepository,
      { listAccessibleMapComplaints } as unknown as ComplaintService
    );

    await service.listMarkers(citizen, {});

    expect(listForComplaintIds).toHaveBeenCalledWith(
      ["30000000-0000-4000-8000-000000000001"],
      {}
    );
  });
});
