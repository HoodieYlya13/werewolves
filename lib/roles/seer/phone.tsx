"use client";

import { useI18n } from "@/components/i18n-provider";
import { useName } from "@/components/room-context";
import { RoleName } from "@/components/game/role-chip";
import type { PhoneTurnProps, PhoneTurnScreens } from "@/components/phone/turn-parts";
import { format } from "@/lib/i18n/config";

/** The card the Seer looked at. */
function SeerResult({ turn }: PhoneTurnProps<"seer-result">) {
  const { dict } = useI18n();
  const name = useName();
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-2xl">{format(dict.game.steps["seer-result"].reveal, { target: name(turn.targetId) })}</p>
      <RoleName role={turn.role} className="font-display text-5xl font-bold" />
    </div>
  );
}

export const seerPhoneTurns: PhoneTurnScreens<"seer-result"> = {
  "seer-result": { Screen: SeerResult, isSecret: true },
};
