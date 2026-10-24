/**
 * Game engine types. The engine is pure: the same setup + action log always
 * produces the same state, which is what makes undo a simple replay.
 */

export type RoleId =
  | "villager"
  | "werewolf"
  | "seer"
  | "witch"
  | "hunter"
  | "cupid"
  | "little-girl"
  | "thief";

/** Who a player wins with. Mixed lovers (wolf + non-wolf) leave their team. */
export type Team = "village" | "wolves" | "lovers";

export type Settings = {
  /** Elect a Sheriff on day 1: double vote, names a successor on death. */
  sheriff: boolean;
  /** Show the dead player's role when they die. */
  revealRoleOnDeath: boolean;
  witchCanSelfHeal: boolean;
  /** Wolves win as soon as they match the others in number (common house rule). */
  wolvesWinAtParity: boolean;
};

export const defaultSettings: Settings = {
  sheriff: true,
  revealRoleOnDeath: true,
  witchCanSelfHeal: true,
  wolvesWinAtParity: false,
};

export type SetupPlayer = { id: string; name: string; seat: number };

/** Everything decided before night 1. Dealing (randomness) happens before this. */
export type GameSetup = {
  players: SetupPlayer[];
  roles: Record<string, RoleId>;
  /** Face-down cards left over for the Thief (2 when the Thief is in play). */
  extraCards: RoleId[];
  settings: Settings;
};

export type PhaseRef = { kind: "night" | "day"; number: number };

export type DeathCause = "wolves" | "poison" | "vote" | "hunter" | "grief";

export type Death = { playerId: string; cause: DeathCause };

export type Player = SetupPlayer & {
  role: RoleId;
  alive: boolean;
  death: (Death & { phase: PhaseRef }) | null;
  /** Remaining one-shot powers, e.g. the Witch's potions. */
  uses: Partial<Record<UseKey, number>>;
};

export type UseKey = "heal" | "poison";

/** What the game master has to do next. One step at a time. */
export type Step =
  | { kind: "thief"; playerId: string; cards: RoleId[]; mustTakeWolf: boolean }
  | { kind: "cupid"; playerId: string }
  | { kind: "lovers"; lovers: [string, string] }
  | { kind: "seer"; playerId: string }
  | { kind: "seer-result"; playerId: string; targetId: string; role: RoleId }
  | { kind: "wolves"; playerIds: string[]; littleGirlIds: string[] }
  | { kind: "witch"; playerId: string; victimId: string | null; canHeal: boolean; canPoison: boolean }
  | { kind: "deaths"; context: "dawn" | "vote" | "hunter"; deaths: Death[] }
  | { kind: "hunter"; playerId: string }
  | { kind: "sheriff-election" }
  | { kind: "sheriff-succession"; playerId: string }
  | { kind: "vote"; sheriffId: string | null }
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
  | { type: "vote"; targetId: string | null };

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
  | { type: "vote"; targetId: string | null };

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
  lovers: [string, string] | null;
  sheriffId: string | null;
  sheriffElected: boolean;
  /** Choices made during the current night, resolved at dawn. */
  night: { wolvesTargetId: string | null; healed: boolean; poisonedId: string | null };
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
