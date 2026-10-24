import { alive, firstWolfToLeft, hasPower, holders, isWolf, log } from "./helpers";
import type { DeathCause, GameState, Player, RoleId, Step, Team, UseKey } from "./types";

/** A role's night turn, played by each living holder who still has the power. */
export type NightTurn = {
  /** Lower wakes first. Gaps leave room for roles added later. */
  order: number;
  firstNightOnly?: boolean;
  evenNightsOnly?: boolean;
  /** The step for this player tonight, or null when there's nothing to do. */
  act: (state: GameState, player: Player) => Step | null;
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
  /** Steps triggered when this player dies (after the death is announced). May also update state. */
  onDeath?: (state: GameState, player: Player, cause: DeathCause) => Step[];
};

/**
 * Les Loups-Garous de Thiercelieux: base game, Nouvelle Lune, Personnages and
 * the Raven from Le Village. Night order follows the official rules.
 */
export const roles: Record<RoleId, RoleDefinition> = {
  // --- Base game ---

  villager: { id: "villager", team: "village" },

  // Wakes as part of the pack (see the "wolves" entry in nightSequence).
  werewolf: { id: "werewolf", team: "wolves" },

  seer: {
    id: "seer",
    team: "village",
    max: 1,
    actorCanBorrow: true,
    night: { order: 40, act: (_, p) => ({ kind: "seer", playerId: p.id }) },
  },

  witch: {
    id: "witch",
    team: "village",
    max: 1,
    uses: { heal: 1, poison: 1 },
    actorCanBorrow: true,
    night: {
      order: 60,
      act: (state, witch) => {
        // An infected victim doesn't die, so there's nothing to heal.
        const victimId = state.night.infected ? null : state.night.wolvesTargetId;
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
      hasPower(state, player) && alive(state).length > 0 ? [{ kind: "hunter", playerId: player.id }] : [],
  },

  cupid: {
    id: "cupid",
    team: "village",
    max: 1,
    night: { order: 20, firstNightOnly: true, act: (_, p) => ({ kind: "cupid", playerId: p.id }) },
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
      act: (state, thief) => {
        if (state.extraCards.length === 0) return null;
        return {
          kind: "thief",
          playerId: thief.id,
          cards: [...state.extraCards],
          mustTakeWolf: state.extraCards.every((r) => roles[r].team === "wolves"),
        };
      },
    },
  },

  // --- Nouvelle Lune ---

  elder: {
    id: "elder",
    team: "village",
    max: 1,
    uses: { lives: 1 },
    // Killed by his own village: every villager loses their power.
    onDeath: (state, _, cause) => {
      if ((cause === "vote" || cause === "poison" || cause === "hunter") && !state.villagePowersLost) {
        state.villagePowersLost = true;
        log(state, { type: "powers-lost" });
      }
      return [];
    },
  },

  // Survives being voted out once (see vote resolution in flow.ts).
  "village-idiot": { id: "village-idiot", team: "village", max: 1 },

  scapegoat: {
    id: "scapegoat",
    team: "village",
    max: 1,
    onDeath: (state, player, cause) => (cause === "scapegoat" ? [{ kind: "scapegoat", playerId: player.id }] : []),
  },

  "pied-piper": {
    id: "pied-piper",
    team: "piper",
    max: 1,
    night: {
      order: 70,
      act: (state, piper) => {
        const charmable = alive(state).filter((p) => p.id !== piper.id && !p.flags.charmed).length;
        const count = Math.min(state.setup.settings.piperCharms, charmable);
        return count > 0 ? { kind: "piper", playerId: piper.id, count } : null;
      },
    },
  },

  defender: {
    id: "defender",
    team: "village",
    max: 1,
    actorCanBorrow: true,
    night: {
      order: 38,
      act: (_, p) => ({ kind: "defender", playerId: p.id, lastProtectedId: p.memo["last-protected"] ?? null }),
    },
  },

  // --- Personnages ---

  // Wins alone if voted out at the very first vote (see win.ts). The game then
  // opens with a day 0 vote, before night 1.
  angel: { id: "angel", team: "village", max: 1 },

  knight: {
    id: "knight",
    team: "village",
    max: 1,
    // Eaten by the wolves: the first wolf to his left dies of rust next dawn.
    onDeath: (state, knight, cause) => {
      if (cause === "wolves" && hasPower(state, knight)) {
        state.rustTargetId = firstWolfToLeft(state, knight)?.id ?? null;
      }
      return [];
    },
  },

  "wolf-hound": {
    id: "wolf-hound",
    team: "village",
    max: 1,
    night: { order: 14, firstNightOnly: true, act: (_, p) => ({ kind: "wolf-hound", playerId: p.id }) },
  },

  actor: {
    id: "actor",
    team: "village",
    max: 1,
    night: {
      order: 5,
      act: (state, p) => (state.actorCards.length > 0 ? { kind: "actor", playerId: p.id, cards: [...state.actorCards] } : null),
    },
  },

  // Woken together on night 1 (see nightSequence).
  "two-sisters": { id: "two-sisters", team: "village", max: 2, copies: 2 },
  "three-brothers": { id: "three-brothers", team: "village", max: 3, copies: 3 },

  "wild-child": {
    id: "wild-child",
    team: "village",
    max: 1,
    night: { order: 22, firstNightOnly: true, act: (_, p) => ({ kind: "wild-child", playerId: p.id }) },
  },

  "big-bad-wolf": {
    id: "big-bad-wolf",
    team: "wolves",
    max: 1,
    night: {
      order: 54,
      act: (state, p) =>
        state.wolfDied ? null : { kind: "big-bad-wolf", playerId: p.id, wolvesTargetId: state.night.wolvesTargetId },
    },
  },

  "accursed-wolf-father": {
    id: "accursed-wolf-father",
    team: "wolves",
    max: 1,
    uses: { infect: 1 },
    night: {
      order: 52,
      act: (state, p) => {
        const victimId = state.night.wolvesTargetId;
        if ((p.uses.infect ?? 0) === 0 || !victimId) return null;
        return { kind: "infect", playerId: p.id, victimId };
      },
    },
  },

  // Asked after each vote whether he signalled for a second one.
  "stuttering-judge": { id: "stuttering-judge", team: "village", max: 1, uses: { "second-vote": 1 } },

  "white-werewolf": {
    id: "white-werewolf",
    team: "white-werewolf",
    max: 1,
    night: {
      order: 56,
      evenNightsOnly: true,
      act: (state, p) =>
        alive(state).some((o) => o.id !== p.id && isWolf(o)) ? { kind: "white-werewolf", playerId: p.id } : null,
    },
  },

  // Growls at dawn (see the day sequence in flow.ts).
  "bear-tamer": { id: "bear-tamer", team: "village", max: 1 },

  fox: {
    id: "fox",
    team: "village",
    max: 1,
    actorCanBorrow: true,
    night: { order: 44, act: (_, p) => ({ kind: "fox", playerId: p.id }) },
  },

  // Offered the voted-out player's role (see kill() in flow.ts).
  "devoted-servant": { id: "devoted-servant", team: "village", max: 1 },

  "abominable-sectarian": { id: "abominable-sectarian", team: "sectarian", max: 1 },

  "villager-villager": { id: "villager-villager", team: "village", max: 1 },

  // --- Le Village ---

  raven: {
    id: "raven",
    team: "village",
    max: 1,
    actorCanBorrow: true,
    night: { order: 80, act: (_, p) => ({ kind: "raven", playerId: p.id }) },
  },
};

export const roleIds = Object.keys(roles) as RoleId[];

/** Powers the Actor can borrow: one-night powers with a step of their own. */
export const actorRoles = roleIds.filter((r) => roles[r].actorCanBorrow);

export type SequenceEntry = {
  id: string;
  order: number;
  firstNightOnly?: boolean;
  evenNightsOnly?: boolean;
  build: (state: GameState) => Step | null;
};

const roleTurns: SequenceEntry[] = roleIds.flatMap((id) => {
  const night = roles[id].night;
  if (!night) return [];
  const own: SequenceEntry = {
    id,
    order: night.order,
    firstNightOnly: night.firstNightOnly,
    evenNightsOnly: night.evenNightsOnly,
    build: (state) => {
      const holder = holders(state, id)[0];
      return holder ? night.act(state, holder) : null;
    },
  };
  if (!roles[id].actorCanBorrow) return [own];
  // The Actor plays a borrowed power right after the real holder would.
  const borrowed: SequenceEntry = {
    id: `actor:${id}`,
    order: night.order + 0.5,
    build: (state) => {
      if (state.night.actorRole !== id) return null;
      const actor = holders(state, "actor")[0];
      return actor ? night.act(state, actor) : null;
    },
  };
  return [own, borrowed];
});

const siblingsTurn = (role: "two-sisters" | "three-brothers", order: number): SequenceEntry => ({
  id: role,
  order,
  firstNightOnly: true,
  build: (state) => {
    const ids = state.players.filter((p) => p.alive && p.role === role).map((p) => p.id);
    return ids.length > 1 ? { kind: "siblings", role, playerIds: ids } : null;
  },
});

/** Every night turn in wake-up order, including group turns that aren't one role. */
const groupTurns: SequenceEntry[] = [
  {
    id: "lovers",
    order: 30,
    firstNightOnly: true,
    build: (state) => (state.lovers ? { kind: "lovers", lovers: state.lovers } : null),
  },
  siblingsTurn("two-sisters", 32),
  siblingsTurn("three-brothers", 34),
  {
    id: "wolves",
    order: 50,
    build: (state) => {
      const wolves = alive(state).filter(isWolf);
      if (wolves.length === 0) return null;
      return {
        kind: "wolves",
        playerIds: wolves.map((p) => p.id),
        littleGirlIds: holders(state, "little-girl").map((p) => p.id),
      };
    },
  },
  {
    id: "charmed",
    order: 72,
    build: (state) => {
      const charmed = alive(state).filter((p) => p.flags.charmed);
      const newIds = state.events
        .filter((e) => e.type === "charmed" && e.phase.kind === "night" && e.phase.number === state.phase.number)
        .flatMap((e) => (e.type === "charmed" ? e.targetIds : []));
      return newIds.length > 0 ? { kind: "charmed", playerIds: charmed.map((p) => p.id), newIds } : null;
    },
  },
];

export const nightSequence: SequenceEntry[] = [...roleTurns, ...groupTurns].sort((a, b) => a.order - b.order);
