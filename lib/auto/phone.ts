import type { Action, RoleId } from "../engine/types";
import type { Group } from "./beats";

/** The Witch's questions, one at a time: the victim shown, then the healing potion, then the poison. */
export type WitchAsk = "show" | "heal" | "poison";
export const WITCH_ASKS: WitchAsk[] = ["show", "heal", "poison"];

/** Steps a phone answers by picking players. */
export type PickStep =
  | "cupid"
  | "wild-child"
  | "defender"
  | "seer"
  | "fox"
  | "big-bad-wolf"
  | "white-werewolf"
  | "piper"
  | "raven"
  | "hunter"
  | "mayor-succession"
  | "scapegoat"
  | "tie-break";

export type CheckMessage = "lover" | "charmed" | "infected" | "nothing" | "sick";

export type PhoneTurn =
  | {
      kind: "pick";
      step: PickStep;
      min: number;
      max: number;
      targets: string[];
      /** May confirm with nobody. */
      skip: boolean;
      /** Defender: protected last night. */
      lastId?: string | null;
    }
  | { kind: "wolves"; targets: string[]; wolves: string[]; picks: Record<string, string> }
  | {
      kind: "witch";
      victimId: string | null;
      canHeal: boolean;
      hasHealingPotion: boolean;
      canPoison: boolean;
      targets: string[];
      /** With a game master: the question they're on, which the phone asks too. Without: the phone asks both. */
      ask?: WitchAsk;
      /** Her answer to the healing question, once given (with a game master). */
      healed?: boolean | null;
    }
  | { kind: "cards"; step: "thief" | "actor"; cards: RoleId[]; canKeep: boolean }
  | { kind: "choice"; step: "wolf-hound" | "infect" | "servant" | "judge"; victimId?: string }
  | { kind: "seer-result"; targetId: string; role: RoleId }
  | { kind: "fox-result"; playerIds: string[]; hasWolf: boolean }
  | { kind: "check"; message: CheckMessage; partnerId?: string }
  | { kind: "group"; group: Group; ids: string[] };

/** The action a phone's "pick" turn sends: the base game's steps have their own, the others a plain pick. */
export function pickAction(turn: Extract<PhoneTurn, { kind: "pick" }>, targetIds: string[]): Action {
  switch (turn.step) {
    case "cupid":
      return { type: "cupid", lovers: [targetIds[0], targetIds[1]] };
    case "seer":
      return { type: "seer", targetId: targetIds[0] ?? null };
    case "hunter":
      return { type: "hunter", targetId: targetIds[0] ?? null };
    case "mayor-succession":
      return { type: "mayor", targetId: targetIds[0] };
    default:
      return { type: "pick", targetIds };
  }
}
