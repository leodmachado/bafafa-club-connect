export function formatEventDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatEventTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function campaignBenefitLabel(campaign: {
  benefit_type: string;
  discount_percent?: number | null;
  fixed_off_cents?: number | null;
  product_name?: string | null;
}) {
  const product = campaign.product_name ? ` em ${campaign.product_name}` : "";
  if (campaign.benefit_type === "percent_off" && campaign.discount_percent) {
    return `${Number(campaign.discount_percent).toLocaleString("pt-BR")}% de desconto${product}`;
  }
  if (campaign.benefit_type === "fixed_off" && campaign.fixed_off_cents) {
    return `${(campaign.fixed_off_cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })} de desconto${product}`;
  }
  if (campaign.benefit_type === "freebie") return `Mimo grátis${product}`;
  if (campaign.benefit_type === "bogo") return `Compre um e leve outro${product}`;
  return campaign.product_name ? `Benefício em ${campaign.product_name}` : "Mimo exclusivo";
}

export function rewardStatusLabel(status: string, expiresAt?: string | null) {
  if (status === "redeemed") return "Utilizado";
  if (status === "revoked") return "Cancelado";
  if (status === "expired" || (expiresAt && new Date(expiresAt).getTime() < Date.now())) {
    return "Expirado";
  }
  return "Disponível";
}
