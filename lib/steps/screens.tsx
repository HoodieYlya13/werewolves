"use client";

import type { StepKind } from "../engine/types";
import type { StepScreen, StepScreens } from "@/components/host/step-parts";
import type { StepOf } from "./step-module";
import { accursedWolfFatherScreens } from "../roles/accursed-wolf-father/screens";
import { actorScreens } from "../roles/actor/screens";
import { bearTamerScreens } from "../roles/bear-tamer/screens";
import { bigBadWolfScreens } from "../roles/big-bad-wolf/screens";
import { cupidScreens } from "../roles/cupid/screens";
import { defenderScreens } from "../roles/defender/screens";
import { devotedServantScreens } from "../roles/devoted-servant/screens";
import { foxScreens } from "../roles/fox/screens";
import { hunterScreens } from "../roles/hunter/screens";
import { piedPiperScreens } from "../roles/pied-piper/screens";
import { ravenScreens } from "../roles/raven/screens";
import { scapegoatScreens } from "../roles/scapegoat/screens";
import { seerScreens } from "../roles/seer/screens";
import { siblingsScreens } from "../roles/siblings/screens";
import { stutteringJudgeScreens } from "../roles/stuttering-judge/screens";
import { thiefScreens } from "../roles/thief/screens";
import { villageIdiotScreens } from "../roles/village-idiot/screens";
import { werewolfScreens } from "../roles/werewolf/screens";
import { whiteWerewolfScreens } from "../roles/white-werewolf/screens";
import { wildChildScreens } from "../roles/wild-child/screens";
import { witchScreens } from "../roles/witch/screens";
import { wolfHoundScreens } from "../roles/wolf-hound/screens";
import { bluffScreens } from "./bluff/screens";
import { deathsScreens } from "./deaths/screens";
import { gameOverScreens } from "./game-over/screens";
import { mayorScreens } from "./mayor/screens";
import { phaseEndScreens } from "./phase-end/screens";
import { prologueScreens } from "./prologue/screens";
import { voteScreens } from "./vote/screens";

/** The game master's screen for every step, from its role's folder or the table's: a step without one doesn't compile. */
const screens: StepScreens<StepKind> = {
  ...accursedWolfFatherScreens,
  ...actorScreens,
  ...bearTamerScreens,
  ...bigBadWolfScreens,
  ...cupidScreens,
  ...defenderScreens,
  ...devotedServantScreens,
  ...foxScreens,
  ...hunterScreens,
  ...piedPiperScreens,
  ...ravenScreens,
  ...scapegoatScreens,
  ...seerScreens,
  ...siblingsScreens,
  ...stutteringJudgeScreens,
  ...thiefScreens,
  ...villageIdiotScreens,
  ...werewolfScreens,
  ...whiteWerewolfScreens,
  ...wildChildScreens,
  ...witchScreens,
  ...wolfHoundScreens,
  ...bluffScreens,
  ...deathsScreens,
  ...gameOverScreens,
  ...mayorScreens,
  ...phaseEndScreens,
  ...prologueScreens,
  ...voteScreens,
};

export const screenOf = <K extends StepKind>(step: StepOf<K>): StepScreen<K> => screens[step.kind] as unknown as StepScreen<K>;
