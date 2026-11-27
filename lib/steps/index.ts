import type { Step, StepKind } from "../engine/types";
import { accursedWolfFatherSteps } from "../roles/accursed-wolf-father/steps";
import { actorSteps } from "../roles/actor/steps";
import { bearTamerSteps } from "../roles/bear-tamer/steps";
import { bigBadWolfSteps } from "../roles/big-bad-wolf/steps";
import { cupidSteps } from "../roles/cupid/steps";
import { defenderSteps } from "../roles/defender/steps";
import { devotedServantSteps } from "../roles/devoted-servant/steps";
import { foxSteps } from "../roles/fox/steps";
import { hunterSteps } from "../roles/hunter/steps";
import { piedPiperSteps } from "../roles/pied-piper/steps";
import { ravenSteps } from "../roles/raven/steps";
import { scapegoatSteps } from "../roles/scapegoat/steps";
import { seerSteps } from "../roles/seer/steps";
import { siblingsSteps } from "../roles/siblings/steps";
import { stutteringJudgeSteps } from "../roles/stuttering-judge/steps";
import { thiefSteps } from "../roles/thief/steps";
import { villageIdiotSteps } from "../roles/village-idiot/steps";
import { werewolfSteps } from "../roles/werewolf/steps";
import { whiteWerewolfSteps } from "../roles/white-werewolf/steps";
import { wildChildSteps } from "../roles/wild-child/steps";
import { witchSteps } from "../roles/witch/steps";
import { wolfHoundSteps } from "../roles/wolf-hound/steps";
import { bluffSteps } from "./bluff/steps";
import { deathsSteps } from "./deaths/steps";
import { gameOverSteps } from "./game-over/steps";
import { mayorElectionCall, mayorSteps } from "./mayor/steps";
import { phaseEndCalls, phaseEndSteps } from "./phase-end/steps";
import { prologueSteps } from "./prologue/steps";
import { voteCall, voteSteps } from "./vote/steps";
import type { Call, StepModule, StepModules, StepOf } from "./step-module";

export type { BeatContext, Call, StepModule, StepOf, TurnContext } from "./step-module";

/** Every step of the game, from its role's folder or the table's: a step without one doesn't compile. */
const stepModules: StepModules<StepKind> = {
  ...prologueSteps,
  ...phaseEndSteps,
  ...actorSteps,
  ...thiefSteps,
  ...wolfHoundSteps,
  ...cupidSteps,
  ...wildChildSteps,
  ...siblingsSteps,
  ...defenderSteps,
  ...seerSteps,
  ...foxSteps,
  ...werewolfSteps,
  ...accursedWolfFatherSteps,
  ...bigBadWolfSteps,
  ...whiteWerewolfSteps,
  ...witchSteps,
  ...piedPiperSteps,
  ...ravenSteps,
  ...bluffSteps,
  ...deathsSteps,
  ...hunterSteps,
  ...bearTamerSteps,
  ...mayorSteps,
  ...voteSteps,
  ...villageIdiotSteps,
  ...devotedServantSteps,
  ...scapegoatSteps,
  ...stutteringJudgeSteps,
  ...gameOverSteps,
};

/** The module of a step, typed for that step. */
export const moduleOf = <K extends StepKind>(step: StepOf<K>): StepModule<K> => stepModules[step.kind] as unknown as StepModule<K>;

/** Calls that belong to no role: the Mayor's election, the vote, the end of each night and day. */
export const tableCalls: Call[] = [mayorElectionCall, voteCall, ...phaseEndCalls];

/** Who answers a step on their phone. */
export const actorsOf = (step: Step): string[] => moduleOf(step).actors?.(step) ?? [];
