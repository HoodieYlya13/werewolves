/**
 * Game engine types. The engine is pure: the same setup + action log always
 * produces the same state, which is what makes undo a simple replay.
 */

export type RoleId =
  // Base game
  | "villager"
  | "werewolf"
  | "seer"
  | "witch"
  | "hunter"
  | "cupid"
  | "little-girl"
  | "thief"
  // Nouvelle Lune
  | "elder"
  | "village-idiot"
  | "scapegoat"
  | "pied-piper"
  | "defender"
  // Personnages
  | "angel"
  | "knight"
  | "wolf-hound"
  | "actor"
  | "two-sisters"
  | "three-brothers"
  | "wild-child"
  | "big-bad-wolf"
  | "accursed-wolf-father"
  | "stuttering-judge"
  | "white-werewolf"
  | "bear-tamer"
  | "fox"
  | "devoted-servant"
  | "abominable-sectarian"
  | "villager-villager"
  // Le Village
  | "raven";

/** Who a player wins with. Mixed lovers (wolf + non-wolf) leave their team. */
export type Team = "village" | "wolves" | "lovers" | "piper" | "white-werewolf" | "sectarian" | "angel";

export type Settings = {
  /** Elect a Sheriff on day 1: double vote, names a successor on death. */
  sheriff: boolean;
  /** Show the dead player's role when they die. */
  revealRoleOnDeath: boolean;
  witchCanSelfHeal: boolean;
  /** Wolves win as soon as they match the others in number (common house rule). */
  wolvesWinAtParity: boolean;
  /**
   * Players the Pied Piper charms each night. The official rule is 2;
   * "choice" lets the game master decide 1 or 2 each night (house rule).
   */
  piperCharms: 1 | 2 | "choice";
  /** Names and narration only (see lib/themes); the rules never read it. */
  theme: string;
};

export const defaultSettings: Settings = {
  sheriff: true,
  revealRoleOnDeath: true,
  witchCanSelfHeal: true,
  wolvesWinAtParity: false,
  piperCharms: 2,
  theme: "werewolves",
};

export type SetupPlayer = { id: string; name: string; seat: number };

/** Everything decided before night 1. Dealing (randomness) happens before this. */
export type GameSetup = {
  players: SetupPlayer[];
  roles: Record<string, RoleId>;
  /** Face-down cards left over for the Thief (2 when the Thief is in play). */
  extraCards: RoleId[];
  /** Face-up powers the Actor can borrow (3 when the Actor is in play). */
  actorCards?: RoleId[];
  /** Abominable Sectarian: which half of the village each player belongs to. */
  groups?: Record<string, "a" | "b">;
  settings: Settings;
};

export type PhaseRef = { kind: "night" | "day"; number: number };

export type DeathCause =
  | "wolves"
  | "poison"
  | "vote"
  | "hunter"
  | "grief"
  | "rust"
  | "white-werewolf"
  | "scapegoat";

export type Death = { playerId: string; cause: DeathCause };

/** Yes/no facts about a player that change during the game. */
export type FlagKey =
  | "charmed"
  | "infected"
  /** Wild Child whose model died, or Wolf-Hound who chose the wolves. */
  | "turned-wolf"
  | "idiot-revealed"
  | "fox-powerless";

/** Player ids a role remembers (Wild Child's model, Defender's last pick). */
export type MemoKey = "model" | "last-protected";

export type Player = SetupPlayer & {
  role: RoleId;
  alive: boolean;
  death: (Death & { phase: PhaseRef }) | null;
  /** Remaining one-shot powers, e.g. the Witch's potions. */
  uses: Partial<Record<UseKey, number>>;
  flags: Partial<Record<FlagKey, boolean>>;
  memo: Partial<Record<MemoKey, string>>;
};

export type UseKey = "heal" | "poison" | "lives" | "infect" | "second-vote";

/** What the game master has to do next. One step at a time. */
export type Step =
  | { kind: "actor"; playerId: string; cards: RoleId[] }
  | { kind: "thief"; playerId: string; cards: RoleId[]; mustTakeWolf: boolean }
  | { kind: "wolf-hound"; playerId: string }
  | { kind: "cupid"; playerId: string }
  | { kind: "wild-child"; playerId: string }
  | { kind: "lovers"; lovers: [string, string] }
  | { kind: "siblings"; role: "two-sisters" | "three-brothers"; playerIds: string[] }
  | { kind: "defender"; playerId: string; lastProtectedId: string | null }
  | { kind: "seer"; playerId: string }
  | { kind: "seer-result"; playerId: string; targetId: string; role: RoleId }
  | { kind: "fox"; playerId: string }
  | { kind: "fox-result"; playerId: string; playerIds: string[]; hasWolf: boolean }
  | { kind: "wolves"; playerIds: string[]; littleGirlIds: string[] }
  | { kind: "infect"; playerId: string; victimId: string }
  | { kind: "big-bad-wolf"; playerId: string; wolvesTargetId: string | null }
  | { kind: "white-werewolf"; playerId: string }
  | { kind: "witch"; playerId: string; victimId: string | null; canHeal: boolean; canPoison: boolean }
  /** Charm between `min` and `count` players. */
  | { kind: "piper"; playerId: string; count: number; min: number }
  | { kind: "charmed"; playerIds: string[]; newIds: string[] }
  | { kind: "raven"; playerId: string }
  | { kind: "deaths"; context: "dawn" | "vote" | "hunter"; deaths: Death[] }
  | { kind: "hunter"; playerId: string }
  | { kind: "bear"; playerId: string; growls: boolean }
  | { kind: "sheriff-election" }
  | { kind: "sheriff-succession"; playerId: string }
  | {
      kind: "vote";
      sheriffId: string | null;
      /** Starts with 2 votes against them (the Raven's mark). */
      ravenTargetId: string | null;
      /** Players who may not vote today (revealed Idiot, Scapegoat's choice). */
      cannotVote: string[];
      /** A tie kills the Scapegoat. */
      scapegoatId: string | null;
      /** The Stuttering Judge's extra vote. */
      second: boolean;
    }
  | { kind: "idiot"; playerId: string }
  | { kind: "servant"; playerId: string; victimId: string; roleTriggers: Step[] }
  | { kind: "scapegoat"; playerId: string }
  | { kind: "judge"; playerId: string }
  | { kind: "game-over"; winner: Winner };

export type StepKind = Step["kind"];

/** The game master's inputs. The action log is a list of these. */
export type Action =
  | { type: "continue" }
  | { type: "thief"; pick: number | null }
  | { type: "cupid"; lovers: [string, string] }
  | { type: "seer"; targetId: string }
  | { type: "wolves"; targetId: string }
  | { type: "witch"; heal: boolean; poisonId: string | null }
  | { type: "hunter"; targetId: string }
  | { type: "sheriff"; targetId: string }
  /** `tie: true` = no majority (kills the Scapegoat if there is one). */
  | { type: "vote"; targetId: string | null; tie?: boolean }
  /** Players picked on steps added after the base game. Empty = skip. */
  | { type: "pick"; targetIds: string[] }
  /** A choice on steps added after the base game (index, side, yes/no). */
  | { type: "choose"; value: number | string | boolean | null };

export type Winner = {
  /** null when everyone is dead. */
  team: Team | null;
  /** Everyone who wins, dead or alive. */
  playerIds: string[];
};

/** Notable moments, for the game master's timeline and the end screen. */
export type GameEvent =
  | { type: "thief-swap"; playerId: string; from: RoleId; to: RoleId }
  | { type: "lovers"; lovers: [string, string] }
  | { type: "seer"; playerId: string; targetId: string; role: RoleId }
  | { type: "wolves-target"; targetId: string }
  | { type: "witch-heal"; targetId: string }
  | { type: "witch-poison"; targetId: string }
  | { type: "death"; playerId: string; cause: DeathCause }
  | { type: "sheriff"; playerId: string; previousId: string | null }
  | { type: "vote"; targetId: string | null }
  | { type: "actor"; playerId: string; role: RoleId }
  | { type: "wolf-hound"; playerId: string; side: "village" | "wolves" }
  | { type: "model"; playerId: string; modelId: string }
  | { type: "turned-wolf"; playerId: string }
  | { type: "protected"; targetId: string }
  | { type: "fox"; playerId: string; centerId: string; hasWolf: boolean }
  | { type: "infected"; targetId: string }
  | { type: "big-bad-wolf"; targetId: string }
  | { type: "white-werewolf"; targetId: string }
  | { type: "charmed"; targetIds: string[] }
  | { type: "raven"; targetId: string }
  | { type: "elder-survived"; playerId: string }
  | { type: "powers-lost" }
  | { type: "idiot-revealed"; playerId: string }
  | { type: "servant"; playerId: string; role: RoleId }
  | { type: "scapegoat"; voterIds: string[] }
  | { type: "second-vote" };

export type GameState = {
  setup: GameSetup;
  players: Player[];
  phase: PhaseRef;
  /** Index into the current phase's sequence (see flow.ts). */
  cursor: number;
  /** Steps that jump the queue: death triggers, info screens. */
  pending: Step[];
  /** The step the game master sees now. */
  step: Step;
  extraCards: RoleId[];
  actorCards: RoleId[];
  lovers: [string, string] | null;
  sheriffId: string | null;
  sheriffElected: boolean;
  /** The Elder was killed by the village: villagers lose their powers. */
  villagePowersLost: boolean;
  /** A wolf has died: the Big Bad Wolf no longer kills twice. */
  wolfDied: boolean;
  /** The wolf who dies of rust next dawn (Knight with the Rusty Sword). */
  rustTargetId: string | null;
  /** Players the Scapegoat allowed to vote, and on which day. */
  votersOnly: { day: number; ids: string[] } | null;
  /** Choices made during the current night, resolved at dawn. */
  night: {
    wolvesTargetId: string | null;
    healed: boolean;
    poisonedId: string | null;
    protectedId: string | null;
    infected: boolean;
    bigBadWolfTargetId: string | null;
    whiteWerewolfTargetId: string | null;
    actorRole: RoleId | null;
  };
  /** Kept through the day after the night it was cast. */
  ravenTargetId: string | null;
  votedToday: boolean;
  winner: Winner | null;
  events: (GameEvent & { phase: PhaseRef })[];
};

export class EngineError extends Error {
  constructor(
    readonly code: "wrong-step" | "invalid-target" | "invalid-action" | "game-over" | "invalid-setup",
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}
