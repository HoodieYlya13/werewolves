"use client";

import { useEffect, useState } from "react";
import { Crown, Heart, Moon, Music, PawPrint, Skull } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { teamColor } from "@/components/host/role-chip";
import { format } from "@/lib/i18n/config";
import { roles, type PlayerInfo } from "@/lib/engine";

/**
 * The player's card, face down. It only shows while held (touch, mouse or
 * keyboard), and hides again the moment the finger lifts, the page loses
 * focus or the phone locks, so nobody can read it over a shoulder.
 */
export function RoleCard({
  info,
  loverName,
  alwaysShown = false,
}: {
  info: PlayerInfo;
  loverName: string | null;
  /** Once the game is over there's nothing left to hide. */
  alwaysShown?: boolean;
}) {
  const { dict } = useI18n();
  const [held, setHeld] = useState(false);
  const shown = held || alwaysShown;

  useEffect(() => {
    const hide = () => setHeld(false);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  const t = dict.play.card;
  const notes: { icon: React.ReactNode; text: string }[] = [];
  if (info.wakesWithWolves && roles[info.role].team !== "wolves") {
    notes.push({ icon: <PawPrint aria-hidden className="size-4 text-primary" />, text: t.wolves });
  }
  if (loverName) {
    notes.push({ icon: <Heart aria-hidden className="size-4 fill-pink-500 text-pink-500" />, text: format(t.lover, { name: loverName }) });
  }
  if (info.charmed) notes.push({ icon: <Music aria-hidden className="size-4 text-emerald-500" />, text: t.charmed });
  if (info.isSheriff) notes.push({ icon: <Crown aria-hidden className="size-4 text-moon" />, text: t.sheriff });

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        aria-label={shown ? t.release : t.hold}
        className="relative aspect-[5/7] w-full max-w-[18rem] touch-none rounded-3xl select-none [-webkit-touch-callout:none] focus-visible:outline-offset-4"
        onPointerDown={(e) => {
          setHeld(true);
          // Keeps the card shown if the finger slides off it while held.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        }}
        onPointerUp={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onLostPointerCapture={() => setHeld(false)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setHeld(true);
          }
        }}
        onKeyUp={() => setHeld(false)}
        onBlur={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {shown ? (
          <span className="card absolute inset-0 flex flex-col items-center justify-center gap-4 border-2 p-6 text-center">
            <span className={`font-display text-3xl leading-tight font-bold text-balance ${teamColor[roles[info.role].team]}`}>
              {dict.roles[info.role].name}
            </span>
            <span className="text-sm text-balance text-muted-foreground">{dict.roles[info.role].power}</span>
            <span className={`text-sm font-semibold ${teamColor[info.team]}`}>
              {format(t.team, { team: dict.teams[info.team] })}
            </span>
            {notes.length > 0 && (
              <span className="flex flex-col gap-1.5 text-left text-sm">
                {notes.map((n, i) => (
                  <span key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">{n.icon}</span>
                    {n.text}
                  </span>
                ))}
              </span>
            )}
          </span>
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-line bg-[repeating-linear-gradient(45deg,var(--surface)_0_12px,var(--surface-2)_12px_24px)] p-6 text-center">
            <span className="grid size-20 place-items-center rounded-full border-2 border-moon/60 bg-bg">
              <Moon aria-hidden className="size-9 text-moon" />
            </span>
            <span className="rounded-full bg-bg px-4 py-1.5 font-medium">{t.hold}</span>
          </span>
        )}
        {!info.alive && (
          <span className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-bg/80">
            <Skull aria-label={t.dead} className="size-5" />
          </span>
        )}
      </button>
      {!alwaysShown && <p className="text-center text-sm text-muted-foreground">{t.hint}</p>}
    </div>
  );
}
