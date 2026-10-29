"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Crown, Smartphone } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import type { SeatStatus } from "@/lib/protocol";
import { identity, savedSeats, seatStatus } from "@/lib/room";

type Active = Extract<SeatStatus, { active: true }> & { code: string };

/** The last answer, so the bar is there at once when the page remounts (switching language). */
let known: Active[] = [];

/**
 * Outside a room, a way back to the rooms this device still has a seat in:
 * after closing the tab, or a detour through the stats. Only on the device's
 * own saved seats, checked with each room first.
 */
export function ResumeRooms() {
  // usePathname is request-time on dynamic routes: the static shell shows nothing.
  return (
    <Suspense fallback={null}>
      <ResumeRoomsForPath />
    </Suspense>
  );
}

function ResumeRoomsForPath() {
  const pathname = usePathname();
  // Inside a room page, that room is the page itself.
  const inRoom = /^\/[a-z]{2}\/(host|play)\/[A-Z]{4}/.test(pathname);
  const [rooms, setRooms] = useState<Active[]>(known);
  // Only a bar that wasn't there already slides in.
  const [slideIn] = useState(known.length === 0);

  useEffect(() => {
    if (inRoom) return;
    let cancelled = false;
    void (async () => {
      const seats = savedSeats();
      const answers = await Promise.all(seats.map((seat) => seatStatus(seat)));
      const active: Active[] = [];
      answers.forEach((answer, i) => {
        const seat = seats[i];
        if (answer?.active) active.push({ ...answer, code: seat.code });
        // The room forgot this seat (closed, expired, removed): so can the device.
        else if (answer) (seat.as === "host" ? identity.setHost : identity.setPlayer)(seat.code, null);
      });
      known = active;
      if (!cancelled) setRooms(active);
    })();
    return () => {
      cancelled = true;
    };
  }, [inRoom, pathname]);

  if (inRoom || rooms.length === 0) return null;
  return (
    // Slides in rather than shoving the page down in one frame.
    <div
      className={`mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pb-4 sm:px-6 ${slideIn ? "animate-in duration-300 fade-in slide-in-from-top-2" : ""}`}
    >
      {rooms.map((room) => (
        <RoomLink key={`${room.role}:${room.code}`} room={room} />
      ))}
    </div>
  );
}

function RoomLink({ room }: { room: Active }) {
  const { dict, locale } = useI18n();
  const t = dict.resume;
  const Icon = room.role === "host" ? Crown : Smartphone;
  const label =
    room.role === "host"
      ? format(room.inGame ? t.hostGame : t.host, { code: room.code })
      : format(room.inGame ? t.playerGame : t.player, { code: room.code, name: room.name });
  return (
    <div role="status" className="card flex items-center gap-3 px-4 py-3">
      <Icon aria-hidden className="size-5 shrink-0 text-moon" />
      <p className="min-w-0 flex-1 text-sm">{label}</p>
      <Button asChild size="sm" className="shrink-0">
        <Link href={`/${locale}/${room.role === "host" ? "host" : "play"}/${room.code}`}>
          <span className="max-sm:sr-only">{t.back}</span>
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
