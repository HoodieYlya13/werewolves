import { baseTeam, isWolf, shownCard } from "./helpers";
import { teamOf } from "./win";
import type { GameState, PhaseRef, RoleId, Step, Team, Winner } from "./types";

/** The step on screen, then the queued ones. */
const stepsAhead = (state: GameState): Step[] => [state.step, ...state.pending];

/** Dead, but not announced yet: phones show them alive until the narrator has said it. */
export function unannouncedDeadIds(state: GameState): Set<string> {
  return new Set(stepsAhead(state).flatMap((step) => (step.kind === "deaths" ? step.deaths.map((death) => death.playerId) : [])));
}

/** The Mayor as the table knows them: one whose death isn't announced yet still holds the office. */
function shownMayorId(state: GameState, unannounced: Set<string>): string | null {
  if (state.mayorId) return state.mayorId;
  const succession = stepsAhead(state).find((step) => step.kind === "mayor-succession" && unannounced.has(step.playerId));
  return succession?.kind === "mayor-succession" ? succession.playerId : null;
}

/** What a phone may know about its own player. Nothing about anyone else's role. */
export type PlayerInfo = {
  role: RoleId;
  alive: boolean;
  /** Who they win with right now (changes when infected, in a mixed couple…). */
  team: Team;
  /** Wakes with the wolves (infected, Wild Child who turned, Wolf-Hound who chose them). */
  wakesWithWolves: boolean;
  /** Set once Cupid has linked the lovers. */
  loverId: string | null;
  charmed: boolean;
  isMayor: boolean;
};

export function playerInfo(state: GameState, playerId: string): PlayerInfo | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  // Not before their call: while Cupid or the Piper is being put back to sleep,
  // a phone lighting up with the news would be out of step with the narrator.
  const step = state.step;
  const newlyCharmed = step.kind === "charmed" && step.newIds.includes(playerId);
  const team = teamOf(state, player);
  const unannounced = unannouncedDeadIds(state);
  return {
    role: player.role,
    alive: player.alive || unannounced.has(playerId),
    team: step.kind === "lovers" && team === "lovers" ? baseTeam(player) : team,
    wakesWithWolves: isWolf(player),
    loverId: step.kind !== "lovers" && state.lovers?.includes(playerId) ? (state.lovers.find((id) => id !== playerId) ?? null) : null,
    charmed: !!player.flags.charmed && !newlyCharmed,
    isMayor: shownMayorId(state, unannounced) === playerId,
  };
}

/** What everyone at the table already knows: phase, deaths, the Mayor, the result. */
export type PublicGame = {
  phase: PhaseRef;
  /** The game master is telling the opening story, before the first night. */
  prologue: boolean;
  mayorId: string | null;
  /** Roles stay hidden when the game is set not to reveal them on death. */
  dead: { playerId: string; role: RoleId | null }[];
  winner: Winner | null;
  /** Everyone's card, once the game is over. */
  roles: Record<string, RoleId> | null;
  /** Cards everyone knows anyway: the Villager-Villager's is a villager on both sides. */
  known: Record<string, RoleId>;
  /** The Abominable Sectarian's two groups, announced to the whole village. */
  groups: Record<string, "a" | "b"> | null;
  theme: string;
};

export function publicGame(state: GameState): PublicGame {
  const reveal = state.setup.settings.revealRoleOnDeath || !!state.winner;
  const unannounced = unannouncedDeadIds(state);
  return {
    phase: state.phase,
    prologue: state.step.kind === "prologue",
    mayorId: shownMayorId(state, unannounced),
    // The Devoted Servant chooses before the death is announced: the card shown is the one she left.
    dead: state.players.filter((p) => !p.alive && !unannounced.has(p.id)).map((p) => ({ playerId: p.id, role: reveal ? shownCard(p) : null })),
    winner: state.winner,
    roles: state.winner ? Object.fromEntries(state.players.map((p) => [p.id, p.role])) : null,
    known: Object.fromEntries(state.players.filter((p) => p.role === "villager-villager").map((p) => [p.id, p.role])),
    groups: state.setup.groups ?? null,
    theme: state.setup.settings.theme ?? "werewolves",
  };
}
