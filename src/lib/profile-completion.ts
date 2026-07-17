export type ProfileCompletionItem = {
  key: string;
  label: string;
  weight: number;
  complete: boolean;
};

export type ProfileCompletionDetails = {
  percentage: number;
  items: ProfileCompletionItem[];
  next_key: string | null;
};

export const EMPTY_PROFILE_COMPLETION: ProfileCompletionDetails = {
  percentage: 0,
  items: [],
  next_key: null,
};

export function parseProfileCompletion(value: unknown): ProfileCompletionDetails {
  if (!value || typeof value !== "object") return EMPTY_PROFILE_COMPLETION;
  const record = value as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .map((item): ProfileCompletionItem | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.key !== "string" || typeof row.label !== "string") return null;
      return {
        key: row.key,
        label: row.label,
        weight: typeof row.weight === "number" ? row.weight : Number(row.weight ?? 0),
        complete: row.complete === true || row.complete === "true",
      };
    })
    .filter((item): item is ProfileCompletionItem => Boolean(item));

  return {
    percentage:
      typeof record.percentage === "number"
        ? Math.max(0, Math.min(100, record.percentage))
        : Math.max(0, Math.min(100, Number(record.percentage ?? 0))),
    items,
    next_key: typeof record.next_key === "string" ? record.next_key : null,
  };
}

export function nextProfileTask(details: ProfileCompletionDetails) {
  return details.items.find((item) => !item.complete) ?? null;
}
