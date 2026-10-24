import type { GameState, RoleId } from "./types";

/** What a phone may know about its own player. Nothing about anyone else's role. */
export type PlayerInfo = {
  role: RoleId;
  alive: boolean;
  /** Set once Cupid has linked the lovers. */
  loverId: string | null;
  isSheriff: boolean;
};

export function playerInfo(state: GameState, playerId: string): PlayerInfo | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  return {
    role: player.role,
    alive: player.alive,
    loverId: state.lovers?.includes(playerId) ? (state.lovers.find((id) => id !== playerId) ?? null) : null,
    isSheriff: state.sheriffId === playerId,
  };
}
