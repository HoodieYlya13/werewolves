"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, Plus, Timer as TimerIcon, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { formatDuration, useCountdown, useRoomContext } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { playStinger } from "@/lib/sound";

const PRESETS = [60, 120, 180, 300];

/** The countdown itself, as the phones show it. */
export function TimerDisplay({ className = "" }: { className?: string }) {
  const { dict } = useI18n();
  const remaining = useCountdown();
  if (remaining === null) return null;
  const done = remaining === 0;
  return (
    <p
      role="timer"
      // "Time's up!" in the sans font and a size smaller: it's words, not digits, and fits beside the buttons.
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2 font-bold ${
        done ? "animate-pulse bg-primary text-lg text-primary-foreground" : "bg-surface-2 font-mono text-2xl tabular-nums"
      } ${className}`}
    >
      <TimerIcon aria-hidden className="size-5" />
      {done ? dict.timer.done : formatDuration(remaining)}
    </p>
  );
}

/** The game master starts, pauses, extends or removes the debate countdown. */
export function TimerControls() {
  const { dict } = useI18n();
  const { timer, send } = useRoomContext();
  const remaining = useCountdown();
  // Time's up: an alarm on the game master's device (phones stay silent). Only
  // when it runs out here, not when the screen opens on a finished countdown.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (!send) return;
    if (remaining === 0 && wasRunning.current) playStinger({ kind: "timer" });
    wasRunning.current = remaining !== null && remaining > 0;
  }, [remaining, send]);
  if (!send) return null;

  if (!timer || remaining === null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* The icon says it's a countdown; the label stays for screen readers. */}
        <span className="text-muted-foreground" title={dict.timer.start}>
          <TimerIcon aria-hidden className="size-5" />
          <span className="sr-only">{dict.timer.start}</span>
        </span>
        {PRESETS.map((seconds) => (
          <Button
            key={seconds}
            type="button"
            variant="outline" className="h-9 px-3 font-mono"
            onClick={() => send({ type: "set-timer", seconds })}
          >
            {formatDuration(seconds * 1000)}
          </Button>
        ))}
      </div>
    );
  }

  const running = timer.endsAt !== null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimerDisplay className="min-w-36" />
      {remaining > 0 && (
        <Button
          type="button"
          variant="outline"
          className="size-10 p-0"
          title={running ? dict.timer.pause : dict.timer.resume}
          onClick={() => send({ type: running ? "pause-timer" : "resume-timer" })}
        >
          {running ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          <span className="sr-only">{running ? dict.timer.pause : dict.timer.resume}</span>
        </Button>
      )}
      <Button
        type="button"
        variant="outline" className="h-10 px-3"
        onClick={() => send({ type: "set-timer", seconds: Math.ceil(remaining / 1000) + 30 })}
      >
        <Plus aria-hidden className="size-4" />
        {dict.timer.add30}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="size-10 p-0"
        title={dict.timer.clear}
        onClick={() => send({ type: "set-timer", seconds: null })}
      >
        <X aria-hidden className="size-4" />
        <span className="sr-only">{dict.timer.clear}</span>
      </Button>
    </div>
  );
}
