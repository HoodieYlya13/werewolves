"use client";

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, Eye } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { RoleCard } from "@/components/play/role-card";
import { Avatar, useRoomContext } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import { playerInfo, type GameState, type PlayerInfo } from "@/lib/engine";

/**
 * Players who can only see their card on the game master's device: added
 * without a phone, or whose phone left the room during the game.
 */
export function usePhonelessPlayers(game: GameState) {
  const { players } = useRoomContext();
  const without = new Set(players.filter((p) => p.manual || p.left).map((p) => p.id));
  return game.players.filter((p) => without.has(p.id));
}

// --- what each player last saw, per game, kept for the session ---

const listeners = new Set<() => void>();
const cache = new Map<string, Record<string, string>>();
const NONE_SEEN: Record<string, string> = {};

function storageKey(code: string, game: GameState) {
  // One game from another: same room, different deal.
  let hash = 0;
  for (const c of JSON.stringify(game.setup.roles)) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return `ww:cards:${code}:${hash}`;
}

function readSeen(key: string): Record<string, string> {
  if (!cache.has(key)) {
    let value: Record<string, string> = {};
    try {
      value = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    } catch {}
    cache.set(key, value);
  }
  return cache.get(key)!;
}

/**
 * The private part of a card: what a phone would show and the table doesn't
 * know. Being Mayor is public, and a death is announced, so neither counts.
 */
const privatePart = (info: PlayerInfo) =>
  JSON.stringify([info.role, info.team, info.wakesWithWolves, info.loverId, info.charmed]);

type CardStatus = "unseen" | "changed" | "seen";

function useCards(game: GameState) {
  const { code } = useRoomContext();
  const key = storageKey(code, game);
  const seen = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => readSeen(key),
    () => NONE_SEEN,
  );
  const status = (playerId: string): CardStatus => {
    const info = playerInfo(game, playerId);
    if (!info || !seen[playerId]) return "unseen";
    return seen[playerId] === privatePart(info) ? "seen" : "changed";
  };
  const markSeen = (playerId: string) => {
    const info = playerInfo(game, playerId);
    if (!info) return;
    const next = { ...readSeen(key), [playerId]: privatePart(info) };
    cache.set(key, next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {}
    listeners.forEach((l) => l());
  };
  return { status, markSeen };
}

// --- showing a card ---

/**
 * Opens a full-screen cover with the player's card face down, the same card
 * their phone would show. The cover is up before the device turns around, so
 * nothing else on the screen can be read; the player holds the card to see it.
 */
function ShowCard({
  game,
  playerId,
  onSeen,
  compact,
}: {
  game: GameState;
  playerId: string;
  onSeen: () => void;
  /** Icon only, for the narrow side panel. */
  compact?: boolean;
}) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const player = game.players.find((p) => p.id === playerId)!;
  const info = playerInfo(game, playerId)!;
  const lover = info.loverId ? game.players.find((p) => p.id === info.loverId)?.name ?? null : null;

  function close() {
    if (held) onSeen();
    setOpen(false);
    setHeld(false);
  }

  const onEscape = useEffectEvent(close);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={`h-9 shrink-0 text-sm ${compact ? "w-9 px-0" : "px-3"}`}
        title={dict.game.cards.show}
        onClick={() => setOpen(true)}
      >
        <Eye aria-hidden className="size-4" />
        <span className={compact ? "sr-only" : ""}>{dict.game.cards.show}</span>
      </Button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={format(dict.game.cards.yourCard, { name: player.name })}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-bg p-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-center"
          >
            <div className="flex flex-col items-center gap-3">
              <Avatar playerId={player.id} name={player.name} className="size-16 text-xl" />
              <p className="font-display text-2xl font-bold">{format(dict.game.cards.yourCard, { name: player.name })}</p>
            </div>
            <div className="w-full max-w-xs">
              <RoleCard info={info} loverName={lover} onShow={() => setHeld(true)} />
            </div>
            <Button type="button" variant="outline" className="h-12 px-6" onClick={close}>
              {dict.game.cards.done}
            </Button>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Each player without a phone, whether they've seen their card, and the button to show it. */
export function PhonelessCards({ game, compact }: { game: GameState; compact?: boolean }) {
  const { dict } = useI18n();
  const players = usePhonelessPlayers(game);
  const { status, markSeen } = useCards(game);
  if (players.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {players.map((p) => {
        const s = status(p.id);
        return (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar playerId={p.id} name={p.name} className="size-7" />
            <span className={`min-w-0 flex-1 truncate font-medium ${p.alive ? "" : "line-through opacity-60"}`}>{p.name}</span>
            {/* Hidden with the roles: "card changed" would tell onlookers something happened to them. */}
            {s === "seen" ? (
              <Check aria-label={dict.game.cards.seen} className="secret-role size-4 shrink-0 text-ok" />
            ) : (
              <span className={`secret-role shrink-0 text-xs ${s === "changed" ? "text-primary" : "text-muted-foreground"}`}>
                {s === "changed" ? dict.game.cards.changed : dict.game.cards.unseen}
              </span>
            )}
            <ShowCard game={game} playerId={p.id} onSeen={() => markSeen(p.id)} compact={compact} />
          </li>
        );
      })}
    </ul>
  );
}

/** Before the story: everyone sees their card first, phone or not. */
export function PhonelessIntro({ game }: { game: GameState }) {
  const { dict } = useI18n();
  if (usePhonelessPlayers(game).length === 0) return null;
  return (
    <section className="card flex flex-col gap-3 p-4">
      <p className="text-muted-foreground">{dict.game.cards.prologue}</p>
      <PhonelessCards game={game} />
    </section>
  );
}

/** The side panel on the game screen. */
export function PhonelessPanel({ game }: { game: GameState }) {
  const { dict } = useI18n();
  if (usePhonelessPlayers(game).length === 0) return null;
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">{dict.game.cards.title}</h2>
      <PhonelessCards game={game} compact />
    </section>
  );
}
