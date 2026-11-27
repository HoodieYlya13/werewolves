import type { Answer } from "../engine/answer";
import type { Action, GameState, PhaseRef, Player, Step, StepKind } from "../engine/types";
import type { Beat, Caller, Group, Show } from "../auto/beats";
import type { PhoneTurn } from "../auto/phone";
import type { Dictionary } from "../i18n/dictionaries/en";

export type StepOf<K extends StepKind> = Extract<Step, { kind: K }>;

/** Who closes their eyes once a step is played: a role, the whole pack, or nobody. */
export type Sleeper = GameState["backToSleep"];

/** What the narrator needs to word a step without a game master. */
export type BeatContext = {
  game: GameState;
  dict: Dictionary;
  /** The same for the same moment of the same game: picks among lines, and how long a bluff drags on. */
  seed: string;
  /** How long the day's debate lasts, in minutes. */
  debateMinutes: (second: boolean) => number;
};

/** What a phone needs to show a player their turn. */
export type TurnContext = {
  game: GameState;
  me: Player;
  /** Living players' ids, those the filter keeps. */
  ids: (keep?: (player: Player) => boolean) => string[];
  wolfPicks: Record<string, string>;
};

/**
 * Everything about one step, with or without a game master: how its answer
 * changes the game, who plays it on their phone, what the narrator reads,
 * and what happens when nobody answers. The game master's screen for it
 * lives beside it (screens.tsx).
 */
export type StepModule<K extends StepKind> = {
  /** Applies the answer to the game; throws an EngineError when it doesn't fit the step. */
  resolve: (state: GameState, step: StepOf<K>, answer: Answer) => void;
  /** Who goes back to sleep once it's played. Unset: nobody, or the step's own closing line said it. */
  sleeper?: (step: StepOf<K>, next: Step) => Sleeper;
  /** Players who answer it on their phone (always without a game master, by choice with one). */
  actors?: (step: StepOf<K>) => string[];
  /** Whom reminders call. Unset: the role named like the step. */
  caller?: (step: StepOf<K>) => Caller;
  /** What its player's phone asks. */
  turn?: (step: StepOf<K>, context: TurnContext) => PhoneTurn | null;
  /** What the phone of a player who isn't playing it shows instead of nothing (a wolf the rust keeps asleep). */
  bystander?: (step: StepOf<K>, context: TurnContext) => PhoneTurn | null;
  /** An answer the players reached together, without one of them sending it (the pack agreeing on a victim). */
  jointAnswer?: (step: StepOf<K>, wolfPicks: Record<string, string>) => Action | null;
  /** Nobody answered in time: nothing happens when the rules allow it, chance decides when they don't. Unset: nobody picked. */
  timeout?: (step: StepOf<K>, game: GameState, random: () => number) => Action;
  /** Without a game master: what the narrator reads, and what the game waits for. */
  beats: (step: StepOf<K>, context: BeatContext) => Beat[];
  /** Players it wakes to recognise each other on their phones. */
  group?: (step: StepOf<K>) => { group: Group; ids: string[] };
  /** The secret answer it shows one player. */
  result?: (step: StepOf<K>) => { playerId: string; turn: PhoneTurn };
  /** What a living player reads when everyone is told to look at their phone. Unset: nothing for them. */
  check?: (step: StepOf<K>, playerId: string) => PhoneTurn | null;
  /** With a game master, what phones show for it. Unset: worked out from its actors, result and group. */
  masterShow?: (step: StepOf<K>) => Show | undefined;
};

export type StepModules<K extends StepKind> = { [P in K]: StepModule<P> };

/** The answer to a step the narrator only reads out: on to the next one. */
export const playOn = (_state: GameState, _step: Step, answer: Answer) => void answer.expect("continue");

/** A night or day call in the phase's order: lower comes first. */
export type Call = {
  id: string;
  phase: PhaseRef["kind"];
  order: number;
  firstNightOnly?: boolean;
  evenNightsOnly?: boolean;
  /** The step for tonight or today, or null when there's nothing to call. */
  build: (state: GameState) => Step | null;
};
