"use client";

import { Check } from "lucide-react";
import { Avatar, useName } from "@/components/room-context";

/** Big buttons with faces, for picking players on a phone. */
export function PickList({ targets, selected, onToggle }: { targets: string[]; selected: string[]; onToggle: (id: string) => void }) {
  const name = useName();
  return (
    <ul className="grid grid-cols-2 gap-2">
      {targets.map((id) => {
        const on = selected.includes(id);
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(id)}
              className={`flex min-h-14 w-full items-center gap-2 rounded-xl border-2 px-2 py-2 text-left font-semibold ${on ? "border-primary bg-primary/10" : "border-line bg-surface-2"}`}
            >
              <Avatar playerId={id} name={name(id)} className="size-8" />
              <span className="min-w-0 flex-1 wrap-anywhere">{name(id)}</span>
              {on && <Check aria-hidden className="size-4 shrink-0 text-primary" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
