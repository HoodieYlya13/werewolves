"use client";

import { Pause, Play, Plus, Timer as TimerIcon, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { formatDuration, useCountdown, useRoomContext } from "@/components/room-context";

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
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-mono text-2xl font-bold tabular-nums ${
        done ? "animate-pulse bg-accent text-accent-fg" : "bg-surface-2"
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
  if (!send) return null;

  if (!timer || remaining === null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <TimerIcon aria-hidden className="size-4" />
          {dict.timer.start}
        </span>
        {PRESETS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            className="btn btn-ghost h-9 px-3 font-mono"
            onClick={() => send({ type: "set-timer", seconds })}
          >
            {formatDuration(seconds * 1000)}
          </button>
        ))}
      </div>
    );
  }

  const running = timer.endsAt !== null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimerDisplay className="min-w-36" />
      {remaining > 0 && (
        <button
          type="button"
          className="btn btn-ghost h-10 px-3"
          onClick={() => send({ type: running ? "pause-timer" : "resume-timer" })}
        >
          {running ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          {running ? dict.timer.pause : dict.timer.resume}
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost h-10 px-3"
        onClick={() => send({ type: "set-timer", seconds: Math.ceil(remaining / 1000) + 30 })}
      >
        <Plus aria-hidden className="size-4" />
        {dict.timer.add30}
      </button>
      <button type="button" className="btn btn-ghost h-10 px-3" onClick={() => send({ type: "set-timer", seconds: null })}>
        <X aria-hidden className="size-4" />
        {dict.timer.clear}
      </button>
    </div>
  );
}
