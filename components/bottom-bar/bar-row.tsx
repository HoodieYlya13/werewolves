"use client";

import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/ui/spinner";
import { format } from "@/lib/i18n/config";

const EASE_OUT_EXPO = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/** On phones, the tile's corners next to the bar's own round corners: they follow its curve. */
export type TileRoundCorner = "all" | "bottom-left" | "top-left";

const ROUND_CORNER: Record<TileRoundCorner, string> = {
  all: "max-sm:rounded-4xl",
  "bottom-left": "max-sm:rounded-bl-4xl",
  "top-left": "max-sm:rounded-tl-4xl",
};

/** The tile on the left of every row of the bar, holding an icon or a face. */
export function BarTile({ children, roundCorner }: { children: React.ReactNode; roundCorner?: TileRoundCorner }) {
  return (
    <span
      data-bar-tile
      className={`grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-fg text-bg transition-[border-radius] duration-500 md:size-20 md:rounded-xl ${roundCorner ? ROUND_CORNER[roundCorner] : ""}`}
    >
      {children}
    </span>
  );
}

/** An icon that shrinks a little while its row is hovered. */
export function BarIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden className={`size-8 transition-all duration-500 group-hover:size-7 md:size-10 md:group-hover:size-9 ${EASE_OUT_EXPO}`} />;
}

/** In the tile while what goes there is on its way: the session, or the auth server. */
export function BarSpinner() {
  return <Spinner className="size-8 md:size-10" />;
}

/** A label that rolls up to a copy of itself while its row is hovered. */
export function RollingText({ text }: { text: string }) {
  return (
    <span className="relative block h-[1.4em] overflow-hidden text-xl leading-[1.4] font-medium">
      <span className={`block transition-transform duration-500 group-hover:-translate-y-full ${EASE_OUT_EXPO}`}>{text}</span>
      <span aria-hidden className={`absolute inset-0 block translate-y-full transition-transform duration-500 group-hover:translate-y-0 ${EASE_OUT_EXPO}`}>
        {text}
      </span>
    </span>
  );
}

/** A tile and what goes beside it. */
export function BarRow({ tile, children, className = "" }: { tile: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={`group flex items-center gap-4 ${className}`}>
      <BarTile>{tile}</BarTile>
      <span className="flex min-w-0 flex-1 flex-col justify-center">{children}</span>
    </span>
  );
}

const MAX_SHOWN_COUNT = 9;

/** A red count of things waiting to be done; nothing when there are none. */
export function NotificationBadge({ count, className = "" }: { count: number; className?: string }) {
  const { dict } = useI18n();
  if (count <= 0) return null;
  return (
    <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground ${className}`}>
      <span aria-hidden>{count > MAX_SHOWN_COUNT ? `${MAX_SHOWN_COUNT}+` : count}</span>
      <span className="sr-only">{format(dict.bar.pending, { count })}</span>
    </span>
  );
}

/** A row with an icon in its tile (a spinner while what it opens is on its way), a label, and a count of what waits there. */
export function IconRow({ icon, label, badge = 0, isLoading = false }: { icon: LucideIcon; label: string; badge?: number; isLoading?: boolean }) {
  return (
    <BarRow tile={isLoading ? <BarSpinner /> : <BarIcon icon={icon} />}>
      <span className="flex items-center justify-between gap-2 pr-2">
        <RollingText text={label} />
        <NotificationBadge count={badge} />
      </span>
    </BarRow>
  );
}
