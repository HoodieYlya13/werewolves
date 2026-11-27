import { shownCard } from "./helpers";
import { roles } from "./roles";
import type { GameState, RoleId, Step } from "./types";

/**
 * Whether a turn nobody can play is still called, so skipping it doesn't tell
 * the village who is gone or out of power. It is, while the card is in the
 * game: held by a living player, dead with roles kept hidden, or left over by
 * the Thief. Only what the village already knows ends it: a death with roles
 * revealed, or the announced loss of the villagers' powers.
 */
export function callsAnyway(state: GameState, role: RoleId): boolean {
  if (state.villagePowersLost && roles[role].team === "village") return false;
  const cards = state.players.filter((p) => p.role === role);
  if (cards.some((p) => p.alive)) return true;
  if (cards.length > 0) return !state.setup.settings.revealRoleOnDeath;
  return state.extraCards.includes(role);
}

/** The turn called word for word with nobody to play it, while the village can't know it's gone. */
export const bluff = (state: GameState, turn: string, role: RoleId): Step | null =>
  callsAnyway(state, role) ? { kind: "bluff", turn, role } : null;

/** A wolf's card was shown on a dead player: the village knows the pack lost one. */
export const wolfCardShown = (state: GameState) =>
  state.setup.settings.revealRoleOnDeath && state.players.some((p) => !p.alive && (roles[shownCard(p)].team === "wolves" || shownCard(p) === "white-werewolf"));
