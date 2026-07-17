export type EventStatusSource = {
  status: string;
  starts_at: string;
  ends_at?: string | null;
};

const DEFAULT_EVENT_DURATION_MS = 8 * 60 * 60 * 1000;

export function effectiveEventStatus(event: EventStatusSource, referenceTime = Date.now()): string {
  if (event.status === "draft" || event.status === "cancelled") return event.status;

  const startsAt = new Date(event.starts_at).getTime();
  if (!Number.isFinite(startsAt)) return event.status;

  const explicitEnd = event.ends_at ? new Date(event.ends_at).getTime() : Number.NaN;
  const endsAt = Number.isFinite(explicitEnd) ? explicitEnd : startsAt + DEFAULT_EVENT_DURATION_MS;

  if (referenceTime < startsAt) return "scheduled";
  if (referenceTime <= endsAt) return "ongoing";
  return "ended";
}

export function withEffectiveEventStatus<T extends EventStatusSource>(
  event: T,
  referenceTime = Date.now(),
): T {
  return { ...event, status: effectiveEventStatus(event, referenceTime) };
}
