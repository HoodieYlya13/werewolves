import type { Action, GameState, PlayerInfo, RoleId, SetupOptions, Settings } from "./engine";

/**
 * Messages between the Next.js app and the PartyKit room server.
 * Shared by `party/server.ts` and the client so both sides stay in sync.
 */

export type RoomPhase = "lobby" | "playing" | "ended";

/** What everyone in the room may see about a player. */
export type PublicPlayer = {
  id: string;
  name: string;
  /** Position around the table, clockwise. Neighbour-based roles depend on it. */
  seat: number;
  connected: boolean;
  /** Added by the game master for someone without a phone. */
  manual: boolean;
};

type BaseView = {
  code: string;
  phase: RoomPhase;
  locked: boolean;
  players: PublicPlayer[];
};

/** The game master sees everything, including every role and the full game state. */
export type HostView = BaseView & {
  kind: "host";
  game: GameState | null;
  /** Number of actions in the log; undo is possible when > 0. */
  actionCount: number;
  /** A game ended with "End game" that can still be picked up again. */
  canResume: boolean;
};

/**
 * A phone only sees public info plus its own private data. `me` is null until
 * it joins; `info` (its role, lover…) is null until a game starts.
 */
export type PlayerView = BaseView & { kind: "player"; me: PublicPlayer | null; info: PlayerInfo | null };

export type RoomView = HostView | PlayerView;

export type ErrorCode =
  | "room-not-found"
  | "room-taken"
  | "room-locked"
  | "name-taken"
  | "invalid-name"
  | "not-host"
  | "removed"
  | "game-in-progress"
  | "invalid-setup"
  | "invalid-action";

export type ServerMessage =
  | { type: "view"; view: RoomView }
  | { type: "joined"; playerId: string; token: string }
  /** `detail` carries the engine's explanation for invalid setups and actions. */
  | { type: "error"; code: ErrorCode; detail?: string };

export type StartGame = SetupOptions &
  (
    | { mode: "random"; deck: RoleId[]; settings: Settings }
    | { mode: "manual"; assignment: Record<string, RoleId>; extraCards: RoleId[]; settings: Settings }
  );

export type ClientMessage =
  // Phone
  | { type: "join"; name: string }
  // Game master
  | { type: "add-player"; name: string }
  | { type: "remove-player"; playerId: string }
  | { type: "move-player"; playerId: string; seat: number }
  | { type: "set-locked"; locked: boolean }
  | ({ type: "start-game" } & StartGame)
  | { type: "game-action"; action: Action }
  | { type: "undo" }
  /** Back to the lobby with the same players. The game is kept until the lineup changes. */
  | { type: "end-game" }
  | { type: "resume-game" };

/** Query params sent when opening the socket. */
export type ConnectQuery =
  | { as: "host"; token: string; create?: "1" }
  | { as: "player"; id?: string; token?: string };

export const MAX_NAME_LENGTH = 24;
