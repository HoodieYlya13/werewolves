"use client";

import { createContext, use, useEffect, useState } from "react";
import type { Ballot, Timer } from "@/lib/ballot";
import { timerRemaining } from "@/lib/ballot";
import type { ClientMessage, PublicPlayer, RejoinRequest } from "@/lib/protocol";
import { photoUrl } from "@/lib/room";

type RoomContextValue = {
  code: string;
  players: PublicPlayer[];
  timer: Timer | null;
  /** Server clock minus this device's clock. */
  clockOffset: number;
  /** Game master only. */
  ballot?: Ballot | null;
  requests?: RejoinRequest[];
  send?: (message: ClientMessage) => void;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export const RoomProvider = RoomContext.Provider;

export function useRoomContext() {
  const value = use(RoomContext);
  if (!value) throw new Error("useRoomContext must be used inside RoomProvider");
  return value;
}

const AVATAR_COLORS = ["bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-fuchsia-500", "bg-teal-500", "bg-orange-500"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

/** A player's photo, or their initials on a colour picked from their name. */
export function Avatar({ playerId, name, className = "size-8" }: { playerId: string; name: string; className?: string }) {
  const { code, players } = useRoomContext();
  const photo = players.find((p) => p.id === playerId)?.photo ?? null;
  if (photo !== null) {
    return (
      // A plain img: photos come from the room server, not from Next's image pipeline.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl(code, playerId, photo)} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
    );
  }
  const hue = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span
      aria-hidden
      className={`${className} grid shrink-0 place-items-center rounded-full text-[0.7em] font-semibold text-white ${AVATAR_COLORS[hue]}`}
    >
      {initials(name)}
    </span>
  );
}

/** Milliseconds left on the room's countdown, ticking while it runs. */
export function useCountdown() {
  const { timer, clockOffset } = useRoomContext();
  const [now, setNow] = useState(() => Date.now());
  const running = timer?.endsAt != null;
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [running]);
  return timer ? timerRemaining(timer, now + clockOffset) : null;
}

export function formatDuration(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
