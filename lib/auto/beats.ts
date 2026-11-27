import type { GameState, RoleId } from "../engine/types";
import { format } from "../i18n/config";
import type { Dictionary } from "../i18n/dictionaries/en";
import type { Stinger } from "../sound-types";
import { TIMING } from "./timing";

export type Wait =
  | { kind: "hold"; ms: number }
  | { kind: "input"; secret?: boolean }
  | { kind: "debate" }
  | { kind: "ballot" }
  | { kind: "end" };

/** What phones show during a beat, besides the sleeping screen. */
export type Show = "turn" | "check" | "group" | "result" | "candidacy" | "card";

/** Lines the narrator phone reads out, then what the game waits for. */
export type Beat = { say: string[]; sound?: Stinger; wait: Wait; show?: Show };

/** Players woken together to recognise each other. */
export type Group = "lovers" | "charmed" | "two-sisters" | "three-brothers";

/** Whom the narrator addresses on a turn: a role, the pack or the Mayor. */
export type Caller = RoleId | "wolves" | "mayor";

export const nameOf = (game: GameState, id: string) => game.players.find((p) => p.id === id)?.name ?? "?";
export const namesOf = (game: GameState, ids: string[]) => ids.map((id) => nameOf(game, id)).join(", ");

export function hash(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** One of a few lines, the same one for the same moment (undo, reload, another device). */
export const pickLine = (lines: string[], seed: string, offset = 0) => lines[(hash(seed) + offset) % lines.length];

/** A player's choice on their phone, once the lines are read. `secret`: the same short wait whatever happens. */
export const input = (say: string[], secret = false): Beat => ({ say, show: "turn", wait: { kind: "input", secret } });

export function callerName(dict: Dictionary, caller: Caller) {
  if (caller === "wolves") return dict.auto.wolvesName;
  if (caller === "mayor") return dict.game.mayor;
  return dict.roles[caller].name;
}

/**
 * The Actor playing a borrowed power on this step, if they are: the role's
 * real holder has their own turn just before, so the call must say who it is.
 */
export function actorTurn(game: GameState): RoleId | null {
  const step = game.step;
  const role = game.night.actorRole;
  if (!role || game.phase.kind !== "night" || step.kind === "actor" || !("playerId" in step)) return null;
  return game.players.find((p) => p.id === step.playerId)?.role === "actor" ? role : null;
}

/** A line calling the borrowed role by name ("Seer, wake up…") calls the Actor instead. */
export function actorCall(dict: Dictionary, game: GameState, line: string) {
  const role = actorTurn(game);
  const called = role && `${dict.roles[role].name},`;
  return called && line.startsWith(called) ? `${dict.roles.actor.name},${line.slice(called.length)}` : line;
}

/** How many players the Pied Piper charms tonight, as the narrator says it. */
export const piperCount = (dict: Dictionary, game: GameState) => {
  const charms = game.setup.settings.piperCharms;
  return charms === "choice" ? dict.auto.oneOrTwo : charms;
};

/** The line that wakes a night turn up without a game master, by the turn it calls (bluffs included). */
export function wakeLine(dict: Dictionary, game: GameState, turn: string) {
  const lines = dict.auto.wake as Record<string, string>;
  const fallback = (dict.game.steps as Record<string, { say?: string }>)[turn]?.say ?? "";
  return actorCall(dict, game, format(lines[turn] ?? fallback, { count: piperCount(dict, game) }));
}

/** A night turn played on a phone: the call, then the player's answer. */
export const nightCall =
  (turn: string) =>
  (_step: unknown, { dict, game }: { dict: Dictionary; game: GameState }): Beat[] => [input([wakeLine(dict, game, turn)])];

/**
 * `phantom`: a bluffed group, with nobody to tap OK. Its look lasts a made-up
 * time, as a real group's would once its members are done.
 */
export function groupBeats(dict: Dictionary, group: Group, check: boolean, phantom?: string): Beat[] {
  const t = dict.auto;
  return [
    ...(check
      ? [
          { say: [t.everyoneCheck], show: "check", wait: { kind: "hold", ms: TIMING.check } } satisfies Beat,
          { say: [t.everyoneSleep], wait: { kind: "hold", ms: TIMING.sleep } } satisfies Beat,
        ]
      : []),
    { say: [t.groupWake[group]], show: "group", wait: { kind: "hold", ms: phantom ? 3_000 + (hash(phantom) % (TIMING.look - 3_000)) : TIMING.look } },
    { say: [t.groupSleep[group]], wait: { kind: "hold", ms: TIMING.sleep } },
  ];
}

/** Everyone reads their phone at once, so nobody can tell who was just infected. */
export function infectedBeats(dict: Dictionary): Beat[] {
  return [
    { say: [dict.auto.infectedCheck], show: "check", wait: { kind: "hold", ms: TIMING.check } },
    { say: [dict.auto.everyoneSleep], wait: { kind: "hold", ms: TIMING.sleep } },
  ];
}
