const TECHNICAL_PATTERNS = [
  /\bPGRST\d+\b/i,
  /\bSQLSTATE\b/i,
  /schema cache/i,
  /postgres/i,
  /postgrest/i,
  /supabase/i,
  /permission denied/i,
  /row[- ]level security/i,
  /violates .* constraint/i,
  /duplicate key/i,
  /invalid input syntax/i,
  /relation ["']?.+["']? does not exist/i,
  /column ["']?.+["']? does not exist/i,
  /function (public\.)?/i,
  /operator does not exist/i,
  /stack trace/i,
  /at [A-Za-z0-9_$.<>]+ \(/,
  /JWT/i,
  /service[_ -]?role/i,
];

export function publicErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir essa ação. Tente novamente.",
) {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "";
  const message = raw.replace(/\s+/g, " ").trim();

  if (!message || message.length > 240) return fallback;
  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}
