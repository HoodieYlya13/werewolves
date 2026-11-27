"use client";

import { useI18n } from "@/components/i18n-provider";
import { useName } from "@/components/room-context";
import type { PhoneTurnProps, PhoneTurnScreens } from "@/components/phone/turn-parts";

/** Whether the Fox smelled a wolf among the three players. */
function FoxResult({ turn }: PhoneTurnProps<"fox-result">) {
  const { dict } = useI18n();
  const name = useName();
  const f = dict.game.steps["fox-result"];
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {/* Laid out like the Seer's: the sentence, then the answer in the card's big type. */}
      <p className="text-2xl">{turn.hasWolf ? f.yes : f.no}</p>
      <ul className={`flex flex-col gap-1 font-display text-4xl font-bold wrap-anywhere ${turn.hasWolf ? "text-primary" : "text-ok"}`}>
        {turn.playerIds.map((id) => (
          <li key={id}>{name(id)}</li>
        ))}
      </ul>
    </div>
  );
}

export const foxPhoneTurns: PhoneTurnScreens<"fox-result"> = {
  "fox-result": { Screen: FoxResult, isSecret: true },
};
