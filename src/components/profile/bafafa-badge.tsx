import type { ComponentType } from "react";
import {
  BadgeCheck,
  CalendarCheck2,
  Crown,
  Music2,
  PartyPopper,
  Sparkles,
  Star,
  UserCheck,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BafafaBadgeDefinition = {
  slug?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
};

const ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "badge-check": BadgeCheck,
  "user-check": UserCheck,
  "party-popper": PartyPopper,
  "calendar-check": CalendarCheck2,
  music: Music2,
  utensils: UtensilsCrossed,
  users: UsersRound,
  crown: Crown,
  sparkles: Sparkles,
};

const BADGE_STYLES: Record<string, string> = {
  "bafafa-fundador":
    "bg-mango text-foreground border-foreground shadow-[2px_2px_0_var(--foreground)]",
  "bafafã-verificado": "bg-lagoa text-lagoa-foreground border-foreground",
  "perfil-no-grau": "bg-primary text-primary-foreground border-foreground",
  "primeiro-bafafa": "bg-samba text-samba-foreground border-foreground",
  "presenca-confirmada": "bg-secondary text-secondary-foreground border-foreground",
  "nao-perde-um-pagode": "bg-electric text-white border-foreground",
  "sobreviveu-feijoada": "bg-brick text-white border-foreground",
  "trouxe-resenha": "bg-mint text-foreground border-foreground",
};

function iconFor(definition: BafafaBadgeDefinition) {
  return ICONS[definition.icon ?? ""] ?? Star;
}

function styleFor(definition: BafafaBadgeDefinition) {
  return BADGE_STYLES[definition.slug ?? ""] ?? "bg-card text-foreground border-foreground";
}

/**
 * Defensive de-duplication for badge definitions.
 * The database already prevents duplicate user_id/badge_id rows, but admin RLS
 * can expose badges from more than one user when a client query forgets a user_id filter.
 * Keeping this guard avoids repeated marks while the source query is being corrected.
 */
export function dedupeBadgeDefinitions(badges: BafafaBadgeDefinition[]) {
  const seen = new Set<string>();
  return badges.filter((badge) => {
    const key = badge.slug?.trim().toLowerCase() || badge.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function CompactBadgeMark({
  badge,
  className,
  showLabel = false,
}: {
  badge: BafafaBadgeDefinition;
  className?: string;
  showLabel?: boolean;
}) {
  const Icon = iconFor(badge);
  const founder = badge.slug === "bafafa-fundador";
  return (
    <span
      title={`${badge.name}${badge.description ? ` — ${badge.description}` : ""}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1 border-2 font-extrabold uppercase",
        showLabel ? "rounded-full px-2 py-1 text-xs tracking-[0.08em]" : "h-6 w-6 rounded-full",
        styleFor(badge),
        founder && "rotate-[-4deg]",
        className,
      )}
      aria-label={badge.name}
    >
      <Icon className={showLabel ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} strokeWidth={2.5} />
      {showLabel && <span>{badge.name}</span>}
    </span>
  );
}

export function BadgeSticker({
  badge,
  locked = false,
  className,
}: {
  badge: BafafaBadgeDefinition;
  locked?: boolean;
  className?: string;
}) {
  const Icon = iconFor(badge);
  const founder = badge.slug === "bafafa-fundador";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border-2 border-foreground/15 bg-background/70 p-3 text-left",
        founder && !locked && "border-mango/70 bg-mango/10",
        locked && "opacity-55 grayscale",
        className,
      )}
    >
      <div
        className={cn(
          "relative grid h-12 w-12 shrink-0 place-items-center rounded-full border-2",
          locked ? "border-border bg-muted text-muted-foreground" : styleFor(badge),
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={2.3} />
        {!locked && founder && (
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-foreground bg-background text-foreground">
            <Sparkles className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black leading-tight">{badge.name}</p>
        {badge.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {badge.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function NameWithBadges({
  name,
  badges,
  className,
  maxBadges = 3,
}: {
  name: string;
  badges: BafafaBadgeDefinition[];
  className?: string;
  maxBadges?: number;
}) {
  const sorted = dedupeBadgeDefinitions(badges).sort((a, b) => {
    if (a.slug === "bafafa-fundador") return -1;
    if (b.slug === "bafafa-fundador") return 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="min-w-0 truncate">{name}</span>
      <span className="inline-flex shrink-0 items-center -space-x-1">
        {sorted.slice(0, maxBadges).map((badge) => (
          <CompactBadgeMark key={badge.slug || badge.name} badge={badge} />
        ))}
      </span>
      {sorted.length > maxBadges && (
        <span className="shrink-0 rounded-full border border-foreground/15 bg-background px-1.5 py-0.5 text-xs font-black">
          +{sorted.length - maxBadges}
        </span>
      )}
    </div>
  );
}
