import type { GameState, Player, RoleId, Step, Team, UseKey } from "./types";

/** A role's night turn. `build` returns null when the role has nothing to do tonight. */
export type NightTurn = {
  /** Lower wakes first. Gaps leave room for roles added later. */
  order: number;
  firstNightOnly?: boolean;
  build: (state: GameState) => Step | null;
};

export type RoleDefinition = {
  id: RoleId;
  team: Team;
  /** Max copies in a deck. Unset = as many as you like. */
  max?: number;
  /** One-shot powers the player starts with. */
  uses?: Partial<Record<UseKey, number>>;
  night?: NightTurn;
  /** Steps triggered when this player dies (after the death is announced). */
  onDeath?: (state: GameState, player: Player) => Step[];
};

export const alive = (state: GameState) => state.players.filter((p) => p.alive);
const firstAlive = (state: GameState, role: RoleId) => state.players.find((p) => p.alive && p.role === role);

/**
 * Base game of Les Loups-Garous de Thiercelieux. Night order follows the
 * official rules: Thief, Cupid, Lovers, Seer, Werewolves, Witch.
 */
export const roles: Record<RoleId, RoleDefinition> = {
  villager: { id: "villager", team: "village" },

  werewolf: {
    id: "werewolf",
    team: "wolves",
    night: {
      order: 50,
      build: (state) => {
        const wolves = alive(state).filter((p) => p.role === "werewolf");
        if (wolves.length === 0) return null;
        return {
          kind: "wolves",
          playerIds: wolves.map((p) => p.id),
          littleGirlIds: alive(state)
            .filter((p) => p.role === "little-girl")
            .map((p) => p.id),
        };
      },
    },
  },

  seer: {
    id: "seer",
    team: "village",
    max: 1,
    night: {
      order: 40,
      build: (state) => {
        const seer = firstAlive(state, "seer");
        return seer ? { kind: "seer", playerId: seer.id } : null;
      },
    },
  },

  witch: {
    id: "witch",
    team: "village",
    max: 1,
    uses: { heal: 1, poison: 1 },
    night: {
      order: 60,
      build: (state) => {
        const witch = firstAlive(state, "witch");
        if (!witch) return null;
        const victimId = state.night.wolvesTargetId;
        const canHeal =
          (witch.uses.heal ?? 0) > 0 &&
          victimId !== null &&
          (victimId !== witch.id || state.setup.settings.witchCanSelfHeal);
        const canPoison = (witch.uses.poison ?? 0) > 0;
        if (!canHeal && !canPoison) return null;
        return { kind: "witch", playerId: witch.id, victimId, canHeal, canPoison };
      },
    },
  },

  hunter: {
    id: "hunter",
    team: "village",
    max: 1,
    onDeath: (state, player) =>
      alive(state).length > 0 ? [{ kind: "hunter", playerId: player.id }] : [],
  },

  cupid: {
    id: "cupid",
    team: "village",
    max: 1,
    night: {
      order: 20,
      firstNightOnly: true,
      build: (state) => {
        const cupid = firstAlive(state, "cupid");
        return cupid ? { kind: "cupid", playerId: cupid.id } : null;
      },
    },
  },

  // Peeks during the wolves' turn in real life. If caught, the master simply
  // picks her as the wolves' victim, so she needs no step of her own.
  "little-girl": { id: "little-girl", team: "village", max: 1 },

  thief: {
    id: "thief",
    team: "village",
    max: 1,
    night: {
      order: 10,
      firstNightOnly: true,
      build: (state) => {
        const thief = firstAlive(state, "thief");
        if (!thief || state.extraCards.length === 0) return null;
        return {
          kind: "thief",
          playerId: thief.id,
          cards: [...state.extraCards],
          mustTakeWolf: state.extraCards.every((r) => roles[r].team === "wolves"),
        };
      },
    },
  },
};

export const roleIds = Object.keys(roles) as RoleId[];

export type SequenceEntry = { id: string } & NightTurn;

const loversTurn: SequenceEntry = {
  id: "lovers",
  order: 30,
  firstNightOnly: true,
  build: (state) => (state.lovers ? { kind: "lovers", lovers: state.lovers } : null),
};

/** Every night turn in wake-up order, including steps that aren't a role. */
export const nightSequence: SequenceEntry[] = [
  ...roleIds.flatMap((id): SequenceEntry[] => (roles[id].night ? [{ id, ...roles[id].night }] : [])),
  loversTurn,
].sort((a, b) => a.order - b.order);
