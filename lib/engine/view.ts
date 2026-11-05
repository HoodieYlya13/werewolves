import { baseTeam, isWolf, shownCard } from "./helpers";
import { teamOf } from "./win";
import type { GameState, PhaseRef, RoleId, Team, Winner } from "./types";

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
  return {
    role: player.role,
    alive: player.alive,
    team: step.kind === "lovers" && team === "lovers" ? baseTeam(player) : team,
    wakesWithWolves: isWolf(player),
    loverId: step.kind !== "lovers" && state.lovers?.includes(playerId) ? (state.lovers.find((id) => id !== playerId) ?? null) : null,
    charmed: !!player.flags.charmed && !newlyCharmed,
    isMayor: state.mayorId === playerId,
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
  return {
    phase: state.phase,
    prologue: state.step.kind === "prologue",
    mayorId: state.mayorId,
    // Not while the Devoted Servant may still take the card: it's shown once she has chosen.
    dead: state.players
      .filter((p) => !p.alive)
      .map((p) => ({ playerId: p.id, role: reveal && !(state.step.kind === "servant" && state.step.victimId === p.id) ? shownCard(p) : null })),
    winner: state.winner,
    roles: state.winner ? Object.fromEntries(state.players.map((p) => [p.id, p.role])) : null,
    known: Object.fromEntries(state.players.filter((p) => p.role === "villager-villager").map((p) => [p.id, p.role])),
    groups: state.setup.groups ?? null,
    theme: state.setup.settings.theme ?? "werewolves",
  };
}
