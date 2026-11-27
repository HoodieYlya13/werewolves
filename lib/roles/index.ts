import type { RoleId } from "../engine/types";
import type { RoleDefinition } from "./role-definition";
import { villager } from "./villager/role";
import { werewolf } from "./werewolf/role";
import { seer } from "./seer/role";
import { witch } from "./witch/role";
import { hunter } from "./hunter/role";
import { cupid } from "./cupid/role";
import { littleGirl } from "./little-girl/role";
import { thief } from "./thief/role";
import { elder } from "./elder/role";
import { villageIdiot } from "./village-idiot/role";
import { scapegoat } from "./scapegoat/role";
import { piedPiper } from "./pied-piper/role";
import { defender } from "./defender/role";
import { angel } from "./angel/role";
import { knight } from "./knight/role";
import { wolfHound } from "./wolf-hound/role";
import { actor } from "./actor/role";
import { twoSisters } from "./two-sisters/role";
import { threeBrothers } from "./three-brothers/role";
import { wildChild } from "./wild-child/role";
import { bigBadWolf } from "./big-bad-wolf/role";
import { accursedWolfFather } from "./accursed-wolf-father/role";
import { stutteringJudge } from "./stuttering-judge/role";
import { whiteWerewolf } from "./white-werewolf/role";
import { bearTamer } from "./bear-tamer/role";
import { fox } from "./fox/role";
import { devotedServant } from "./devoted-servant/role";
import { abominableSectarian } from "./abominable-sectarian/role";
import { villagerVillager } from "./villager-villager/role";
import { raven } from "./raven/role";

export type { RoleDefinition, NightTurn } from "./role-definition";

/**
 * Les Loups-Garous de Thiercelieux: base game, Nouvelle Lune, Personnages and
 * the Raven from Le Village, one folder each. Night order follows the official rules.
 */
export const roleDefinitions: Record<RoleId, RoleDefinition> = {
  villager,
  werewolf,
  seer,
  witch,
  hunter,
  cupid,
  "little-girl": littleGirl,
  thief,
  elder,
  "village-idiot": villageIdiot,
  scapegoat,
  "pied-piper": piedPiper,
  defender,
  angel,
  knight,
  "wolf-hound": wolfHound,
  actor,
  "two-sisters": twoSisters,
  "three-brothers": threeBrothers,
  "wild-child": wildChild,
  "big-bad-wolf": bigBadWolf,
  "accursed-wolf-father": accursedWolfFather,
  "stuttering-judge": stutteringJudge,
  "white-werewolf": whiteWerewolf,
  "bear-tamer": bearTamer,
  fox,
  "devoted-servant": devotedServant,
  "abominable-sectarian": abominableSectarian,
  "villager-villager": villagerVillager,
  raven,
};
