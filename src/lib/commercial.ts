export function formatMoneyFromCents(value: number | bigint | null | undefined) {
  const cents = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPhoneBR(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizePhoneE164BR(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return value.startsWith("+") ? value : `+${digits}`;
}

export const CRM_SEGMENT_LABELS: Record<string, string> = {
  bafafa_novo: "Bafafã novo",
  bafafa_recorrente: "Bafafã recorrente",
  sumido_da_resenha: "Sumido da resenha",
  aniversariante: "Aniversariante",
  presenca_garantida: "Presença garantida",
  cacador_de_fofoquinha: "Caçador de Fofoquinha",
  fofoqueiro_oficial: "Fofoqueiro oficial",
};
