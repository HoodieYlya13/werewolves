"use client";

import { foxPhoneTurns } from "@/lib/roles/fox/phone";
import { seerPhoneTurns } from "@/lib/roles/seer/phone";
import { werewolfPhoneTurns } from "@/lib/roles/werewolf/phone";
import { witchPhoneTurns } from "@/lib/roles/witch/phone";
import { sharedPhoneTurns } from "./turns";
import type { PhoneTurnKind, PhoneTurnScreen, PhoneTurnScreens } from "./turn-parts";

/** How a phone shows every kind of turn: a kind without its screen doesn't compile. */
const phoneTurnScreens: PhoneTurnScreens<PhoneTurnKind> = {
  ...sharedPhoneTurns,
  ...werewolfPhoneTurns,
  ...witchPhoneTurns,
  ...seerPhoneTurns,
  ...foxPhoneTurns,
};

export const phoneTurnOf = <K extends PhoneTurnKind>(kind: K) => phoneTurnScreens[kind] as PhoneTurnScreen<K>;
