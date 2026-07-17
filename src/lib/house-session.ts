export type HouseSession = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string | null;
  checkin_opens_at: string;
  checkin_closes_at: string;
  chat_opens_at: string;
  chat_closes_at: string;
  checkin_enabled: boolean;
  chat_enabled: boolean;
  geolocation_checkin_enabled: boolean;
  geofence_radius_m: number;
  max_location_accuracy_m: number;
  venue_address: string | null;
  checked_in: boolean;
  checkin_open: boolean;
  chat_open: boolean;
  status: string;
};

export function parseHouseSession(value: unknown): HouseSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string") return null;

  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : "Sessão da Casa",
    starts_at: typeof row.starts_at === "string" ? row.starts_at : new Date().toISOString(),
    ends_at: typeof row.ends_at === "string" ? row.ends_at : null,
    checkin_opens_at:
      typeof row.checkin_opens_at === "string" ? row.checkin_opens_at : new Date().toISOString(),
    checkin_closes_at:
      typeof row.checkin_closes_at === "string" ? row.checkin_closes_at : new Date().toISOString(),
    chat_opens_at:
      typeof row.chat_opens_at === "string" ? row.chat_opens_at : new Date().toISOString(),
    chat_closes_at:
      typeof row.chat_closes_at === "string" ? row.chat_closes_at : new Date().toISOString(),
    checkin_enabled: Boolean(row.checkin_enabled),
    chat_enabled: Boolean(row.chat_enabled),
    geolocation_checkin_enabled: Boolean(row.geolocation_checkin_enabled),
    geofence_radius_m: Number(row.geofence_radius_m ?? 180),
    max_location_accuracy_m: Number(row.max_location_accuracy_m ?? 250),
    venue_address:
      typeof row.venue_address === "string" && row.venue_address.trim() ? row.venue_address : null,
    checked_in: Boolean(row.checked_in),
    checkin_open: Boolean(row.checkin_open),
    chat_open: Boolean(row.chat_open),
    status: typeof row.status === "string" ? row.status : "scheduled",
  };
}
