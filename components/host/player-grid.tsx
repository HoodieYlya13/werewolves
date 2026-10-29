"use client";

import { Crown, Heart, Music } from "lucide-react";
import { RoleName } from "@/components/host/role-chip";
import { Avatar } from "@/components/room-context";
import type { GameState, Player } from "@/lib/engine";

/**
 * Big tap targets for picking players. Shows each player's role, since only
 * the game master sees this screen and it helps avoid misclicks.
 */
export function PlayerGrid({
  game,
  players,
  selected,
  onToggle,
  isDisabled = () => false,
}: {
  game: GameState;
  players: Player[];
  selected: string[];
  onToggle: (id: string) => void;
  isDisabled?: (player: Player) => boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {players.map((p) => {
        const isSelected = selected.includes(p.id);
        const disabled = isDisabled(p);
        return (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onToggle(p.id)}
              className={`flex h-full min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-colors disabled:opacity-35 ${
                isSelected ? "border-primary bg-primary/10" : "border-line bg-surface-2 hover:border-fg/30"
              }`}
            >
              <span className="flex w-full items-center gap-1.5">
                <Avatar playerId={p.id} name={p.name} className="size-7" />
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</span>
                {game.lovers?.includes(p.id) && <Heart aria-hidden className="secret-role size-3.5 shrink-0 fill-pink-500 text-pink-500" />}
                {game.mayorId === p.id && <Crown aria-hidden className="size-3.5 shrink-0 text-moon" />}
                {p.flags.charmed && <Music aria-hidden className="secret-role size-3.5 shrink-0 text-emerald-500" />}
              </span>
              <RoleName role={p.role} className="pl-8.5 text-xs" secret />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Toggle helper: single choice replaces, multi-choice adds up to `max`. */
export function toggle(selected: string[], id: string, max: number) {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  return max === 1 ? [id] : selected.length < max ? [...selected, id] : selected;
}
