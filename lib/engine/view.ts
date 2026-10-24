import { isWolf } from "./helpers";
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
  isSheriff: boolean;
};

export function playerInfo(state: GameState, playerId: string): PlayerInfo | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  return {
    role: player.role,
    alive: player.alive,
    team: teamOf(state, player),
    wakesWithWolves: isWolf(player),
    loverId: state.lovers?.includes(playerId) ? (state.lovers.find((id) => id !== playerId) ?? null) : null,
    charmed: !!player.flags.charmed,
    isSheriff: state.sheriffId === playerId,
  };
}

/** What everyone at the table already knows: phase, deaths, the Sheriff, the result. */
export type PublicGame = {
  phase: PhaseRef;
  sheriffId: string | null;
  /** Roles stay hidden when the game is set not to reveal them on death. */
  dead: { playerId: string; role: RoleId | null }[];
  winner: Winner | null;
  /** Everyone's card, once the game is over. */
  roles: Record<string, RoleId> | null;
  theme: string;
};

export function publicGame(state: GameState): PublicGame {
  const reveal = state.setup.settings.revealRoleOnDeath || !!state.winner;
  return {
    phase: state.phase,
    sheriffId: state.sheriffId,
    dead: state.players.filter((p) => !p.alive).map((p) => ({ playerId: p.id, role: reveal ? p.role : null })),
    winner: state.winner,
    roles: state.winner ? Object.fromEntries(state.players.map((p) => [p.id, p.role])) : null,
    theme: state.setup.settings.theme ?? "werewolves",
  };
}
