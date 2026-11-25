"use client";

import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";

const EASE_OUT_EXPO = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/** The tile on the left of every row of the bar, holding an icon or a face: round on phones, following the bar's corners. */
export function BarTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-fg text-bg sm:rounded-lg md:size-20 md:rounded-xl">
      {children}
    </span>
  );
}

/** An icon that shrinks a little while its row is hovered. */
export function BarIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden className={`size-8 transition-all duration-500 group-hover:size-7 md:size-10 md:group-hover:size-9 ${EASE_OUT_EXPO}`} />;
}

/** A label that rolls up to a copy of itself while its row is hovered. */
export function RollingText({ text }: { text: string }) {
  return (
    <span className="relative block h-[1.2em] overflow-hidden text-xl font-medium">
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

/** A row with an icon in its tile, a label, and a count of what waits there. */
export function IconRow({ icon, label, badge = 0 }: { icon: LucideIcon; label: string; badge?: number }) {
  return (
    <BarRow tile={<BarIcon icon={icon} />}>
      <span className="flex items-center justify-between gap-2 pr-2">
        <RollingText text={label} />
        <NotificationBadge count={badge} />
      </span>
    </BarRow>
  );
}
