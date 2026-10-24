import { isWolf } from "./helpers";
import { teamOf } from "./win";
import type { GameState, RoleId, Team } from "./types";

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
