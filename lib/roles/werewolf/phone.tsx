"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Avatar, useName } from "@/components/room-context";
import { PlayButton, type PhoneTurnProps, type PhoneTurnScreens } from "@/components/phone/turn-parts";

/** The pack's turn: each wolf points at a victim, and sees where the others point. */
function WolvesTurn({ view, turn, send }: PhoneTurnProps<"wolves">) {
  const me = view.me!.id;
  const { dict } = useI18n();
  const name = useName();
  const mine = turn.picks[me] ?? null;
  // The pick only reaches the pack once confirmed.
  const [draft, setDraft] = useState<string | null>(mine);
  return (
    <>
      <p className="text-sm text-muted-foreground">{dict.auto.wolvesHint}</p>
      <ul className="grid grid-cols-2 gap-2">
        {turn.targets.map((id) => {
          const pickers = turn.wolves.filter((w) => turn.picks[w] === id);
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={draft === id}
                onClick={() => setDraft(draft === id ? null : id)}
                className={`flex min-h-14 w-full flex-col items-start gap-1 rounded-xl border-2 px-2 py-2 text-left font-semibold ${draft === id ? "border-primary bg-primary/10" : mine === id ? "border-dashed border-primary/60" : "border-line bg-surface-2"}`}
              >
                <span className="flex w-full items-center gap-2">
                  <Avatar playerId={id} name={name(id)} className="size-8" />
                  <span className="min-w-0 flex-1 wrap-anywhere">{name(id)}</span>
                </span>
                {pickers.length > 0 && (
                  <span className="flex -space-x-1">
                    {pickers.map((w) => (
                      <Avatar key={w} playerId={w} name={name(w)} className="size-5 ring-2 ring-surface" />
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <PlayButton ready={draft !== mine} onClick={() => send({ type: "wolf-pick", targetId: draft })} label={draft === null && mine ? dict.auto.withdrawPick : undefined} />
      {turn.wolves.length > 1 && (
        <div className="text-sm">
          <p className="mb-1 font-medium">{dict.auto.wolvesPicks}</p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {turn.wolves.map((w) => (
              <li key={w}>
                {name(w)} → {turn.picks[w] ? name(turn.picks[w]) : dict.auto.noPick}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export const werewolfPhoneTurns: PhoneTurnScreens<"wolves"> = {
  wolves: { Screen: WolvesTurn, title: (dict) => dict.auto.wolvesName },
};
