import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePools } from "../../config/databases.js";
import type { ComplaintLocation, LocationSearch, StoredLocationMarker } from "./gis.types.js";

interface LocationRow extends RowDataPacket {
  id: string;
  complaintId: string;
  latitude: number | string;
  longitude: number | string;
  addressText: string | null;
  locationDescription: string | null;
  accuracyMeters: number | string | null;
  source: ComplaintLocation["source"];
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  distanceMeters?: number | string | null;
}

const locationColumns = `
  id, complaint_id AS complaintId,
  ST_Latitude(location) AS latitude, ST_Longitude(location) AS longitude,
  address_text AS addressText, location_description AS locationDescription,
  accuracy_meters AS accuracyMeters, source, created_by_user_id AS createdByUserId,
  created_at AS createdAt, updated_at AS updatedAt`;

const mapLocation = (row: LocationRow): ComplaintLocation => ({
  ...row,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  accuracyMeters: row.accuracyMeters === null ? null : Number(row.accuracyMeters)
});

export class GisRepository {
  private readonly pool = databasePools.gis;

  async findByComplaintId(complaintId: string): Promise<ComplaintLocation | null> {
    const [rows] = await this.pool.execute<LocationRow[]>(
      `SELECT ${locationColumns} FROM complaint_locations WHERE complaint_id = ? LIMIT 1`,
      [complaintId]
    );
    return rows[0] ? mapLocation(rows[0]) : null;
  }

  async upsert(input: Omit<ComplaintLocation, "createdAt" | "updatedAt">): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO complaint_locations
        (id, complaint_id, location, address_text, location_description,
         accuracy_meters, source, created_by_user_id)
       VALUES (?, ?, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326, 'axis-order=long-lat'), ?, ?, ?, ?, ?) AS incoming
       ON DUPLICATE KEY UPDATE
         location = incoming.location,
         address_text = incoming.address_text,
         location_description = incoming.location_description,
         accuracy_meters = incoming.accuracy_meters,
         source = incoming.source,
         created_by_user_id = incoming.created_by_user_id`,
      [
        input.id,
        input.complaintId,
        input.longitude,
        input.latitude,
        input.addressText,
        input.locationDescription,
        input.accuracyMeters,
        input.source,
        input.createdByUserId
      ]
    );
  }

  async listForComplaintIds(
    complaintIds: string[],
    search: LocationSearch
  ): Promise<StoredLocationMarker[]> {
    if (complaintIds.length === 0) return [];
    const conditions = [`complaint_id IN (${complaintIds.map(() => "?").join(", ")})`];
    const values: Array<string | number> = [...complaintIds];
    if (search.north !== undefined) {
      conditions.push("ST_Latitude(location) BETWEEN ? AND ? AND ST_Longitude(location) BETWEEN ? AND ?");
      values.push(search.south!, search.north, search.west!, search.east!);
    }
    const distanceExpression = search.latitude === undefined
      ? "NULL"
      : "ST_Distance_Sphere(location, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326, 'axis-order=long-lat'))";
    const selectValues: number[] = [];
    if (search.latitude !== undefined) {
      selectValues.push(search.longitude!, search.latitude);
      conditions.push(`${distanceExpression} <= ?`);
      values.push(search.longitude!, search.latitude, search.radiusMeters!);
    }
    const [rows] = await this.pool.execute<LocationRow[]>(
      `SELECT ${locationColumns}, ${distanceExpression} AS distanceMeters
       FROM complaint_locations
       WHERE ${conditions.join(" AND ")}
       ORDER BY updated_at DESC
       LIMIT 500`,
      [...selectValues, ...values]
    );
    return rows.map((row) => ({
      ...mapLocation(row),
      distanceMeters: row.distanceMeters === null || row.distanceMeters === undefined
        ? null
        : Number(row.distanceMeters)
    }));
  }
}
