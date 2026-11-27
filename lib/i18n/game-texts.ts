import type { Locale } from "./config";
import { deepMerge } from "../deep-merge";
import { villagerTexts } from "../roles/villager/texts";
import { werewolfTexts } from "../roles/werewolf/texts";
import { seerTexts } from "../roles/seer/texts";
import { witchTexts } from "../roles/witch/texts";
import { hunterTexts } from "../roles/hunter/texts";
import { cupidTexts } from "../roles/cupid/texts";
import { littleGirlTexts } from "../roles/little-girl/texts";
import { thiefTexts } from "../roles/thief/texts";
import { elderTexts } from "../roles/elder/texts";
import { villageIdiotTexts } from "../roles/village-idiot/texts";
import { scapegoatTexts } from "../roles/scapegoat/texts";
import { piedPiperTexts } from "../roles/pied-piper/texts";
import { defenderTexts } from "../roles/defender/texts";
import { angelTexts } from "../roles/angel/texts";
import { knightTexts } from "../roles/knight/texts";
import { wolfHoundTexts } from "../roles/wolf-hound/texts";
import { actorTexts } from "../roles/actor/texts";
import { twoSistersTexts } from "../roles/two-sisters/texts";
import { threeBrothersTexts } from "../roles/three-brothers/texts";
import { siblingsTexts } from "../roles/siblings/texts";
import { wildChildTexts } from "../roles/wild-child/texts";
import { bigBadWolfTexts } from "../roles/big-bad-wolf/texts";
import { accursedWolfFatherTexts } from "../roles/accursed-wolf-father/texts";
import { stutteringJudgeTexts } from "../roles/stuttering-judge/texts";
import { whiteWerewolfTexts } from "../roles/white-werewolf/texts";
import { bearTamerTexts } from "../roles/bear-tamer/texts";
import { foxTexts } from "../roles/fox/texts";
import { devotedServantTexts } from "../roles/devoted-servant/texts";
import { abominableSectarianTexts } from "../roles/abominable-sectarian/texts";
import { villagerVillagerTexts } from "../roles/villager-villager/texts";
import { ravenTexts } from "../roles/raven/texts";
import { prologueTexts } from "../steps/prologue/texts";
import { bluffTexts } from "../steps/bluff/texts";
import { deathsTexts } from "../steps/deaths/texts";
import { mayorTexts } from "../steps/mayor/texts";
import { voteTexts } from "../steps/vote/texts";
import { phaseEndTexts } from "../steps/phase-end/texts";
import { gameOverTexts } from "../steps/game-over/texts";

const gameTexts = [
  villagerTexts,
  werewolfTexts,
  seerTexts,
  witchTexts,
  hunterTexts,
  cupidTexts,
  littleGirlTexts,
  thiefTexts,
  elderTexts,
  villageIdiotTexts,
  scapegoatTexts,
  piedPiperTexts,
  defenderTexts,
  angelTexts,
  knightTexts,
  wolfHoundTexts,
  actorTexts,
  twoSistersTexts,
  threeBrothersTexts,
  siblingsTexts,
  wildChildTexts,
  bigBadWolfTexts,
  accursedWolfFatherTexts,
  stutteringJudgeTexts,
  whiteWerewolfTexts,
  bearTamerTexts,
  foxTexts,
  devotedServantTexts,
  abominableSectarianTexts,
  villagerVillagerTexts,
  ravenTexts,
  prologueTexts,
  bluffTexts,
  deathsTexts,
  mayorTexts,
  voteTexts,
  phaseEndTexts,
  gameOverTexts,
] as const;

type Intersection<Union> = (Union extends unknown ? (part: Union) => void : never) extends (part: infer All) => void ? All : never;

/** The texts every role and table step keeps in its own folder. */
export type GameTexts = Intersection<(typeof gameTexts)[number]["en"]>;

/** The dictionary with every role's and step's texts added in. */
export function withGameTexts<Shared extends object>(shared: Shared, locale: Locale): Shared & GameTexts {
  return gameTexts.reduce<unknown>((dictionary, texts) => deepMerge(dictionary, texts[locale]), shared) as Shared & GameTexts;
}
