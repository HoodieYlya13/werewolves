/** The soundtrack's names, apart from the audio code: the room server picks them too. */

/** "howl" is the wolves' turn in the Werewolves theme; other themes' wolves keep "wolves". */
export type Scene = "prologue" | "day" | "night" | "wolves" | "howl" | "witch" | "seer" | "love" | "piper" | "vote";
export type Stinger =
  | { kind: "deaths"; count: number }
  /** A new day: the theme's dawn sound, then the night's deaths. */
  | { kind: "dawn"; theme: string; count: number }
  /** The debate timer ran out. */
  | { kind: "timer" }
  | { kind: "win"; team: "village" | "wolves" | "other"; howl?: boolean };
