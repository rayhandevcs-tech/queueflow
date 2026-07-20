import type { Database, Tables, Json } from "./database.types";

export type Profile = Tables<"profiles">;
export type Shop = Tables<"shops">;
export type Service = Tables<"services">;
export type Chair = Tables<"chairs">;
export type ChairServiceStat = Tables<"chair_service_stats">;
export type Serial = Tables<"serials">;
export type QueuePublicRow = Tables<"queue_public">;

export type UserRole = Database["public"]["Enums"]["user_role"];
export type SerialStatus = Database["public"]["Enums"]["serial_status"];
export type AssignmentMode = Database["public"]["Enums"]["assignment_mode"];

export type BusinessType = Database["public"]["Enums"]["business_type"];
export type { TablesInsert, TablesUpdate } from "./database.types";

/** Shape of one element inside serials.services_snapshot (frozen at booking). */
export type ServiceSnapshotItem = {
  service_id: string;
  name: string;
  rate: number;
  estimated_duration_min: number;
};

/** Safe accessor for the jsonb snapshot column. */
export function parseServicesSnapshot(snapshot: Json): ServiceSnapshotItem[] {
  return Array.isArray(snapshot)
    ? (snapshot as unknown as ServiceSnapshotItem[])
    : [];
}