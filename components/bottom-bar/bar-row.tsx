import type { LucideIcon } from "lucide-react";

const EASE_OUT_EXPO = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/** The square on the left of every row of the bar: a light tile holding an icon or a face. */
export function BarTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-fg text-bg md:size-20 md:rounded-xl">
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
