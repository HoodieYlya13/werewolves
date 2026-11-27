import type { Call } from "../steps/step-module";
import type { DeathCause, GameState, Player, RoleId, Step, Team, UseKey } from "../engine/types";

/** A role's night turn, played by its first living holder who still has the power. */
export type NightTurn = {
  /** Lower wakes first. Gaps leave room for roles added later. */
  order: number;
  firstNightOnly?: boolean;
  evenNightsOnly?: boolean;
  /** The step for this player tonight, or null when there's nothing to do. */
  act: (state: GameState, player: Player) => Step | null;
  /** Whether the turn is still called when nobody can play it. Unset: while the village can't know (see callsAnyway). */
  isBluffed?: (state: GameState) => boolean;
};

export type RoleDefinition = {
  id: RoleId;
  team: Team;
  /** Max copies in a deck. Unset = as many as you like. */
  max?: number;
  /** Cards that only come as a set (Two Sisters, Three Brothers). */
  copies?: number;
  /** One-shot powers the player starts with. */
  uses?: Partial<Record<UseKey, number>>;
  night?: NightTurn;
  /** The Actor may borrow this power for one night. */
  actorCanBorrow?: boolean;
  /** Calls the role brings besides its own turn: the pack, the lovers after Cupid… */
  calls?: Call[];
  /** Steps triggered when this player dies (after the death is announced). May also update state. */
  onDeath?: (state: GameState, player: Player, cause: DeathCause) => Step[];
};
