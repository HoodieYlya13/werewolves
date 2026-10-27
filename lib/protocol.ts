import type { Ballot, Timer } from "./ballot";
import type { Action, GameState, PlayerInfo, PublicGame, RoleId, SetupOptions, Settings } from "./engine";

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
  /** Version of the player's photo (see `photoUrl`), or null without one. */
  photo: number | null;
  /** Left the room during a game; still in it, played by the game master. */
  left: boolean;
  /**
   * Signed in with an account: the name and photo come from it, and only the
   * account can change them (not the player in the room, nor the game master).
   */
  account: boolean;
  /** The account's photo URL, shown instead of a room photo. */
  picture: string | null;
};

/** Someone who left and asks the game master to let them back in. */
export type RejoinRequest = { id: string; name: string };

type BaseView = {
  code: string;
  phase: RoomPhase;
  locked: boolean;
  players: PublicPlayer[];
  /** The countdown the game master started, if any. */
  timer: Timer | null;
  /** Server clock when the view was sent, to show the timer accurately. */
  serverNow: number;
};

/** The game master sees everything, including every role and the full game state. */
export type HostView = BaseView & {
  kind: "host";
  game: GameState | null;
  /** Number of actions in the log; undo is possible when > 0. */
  actionCount: number;
  /** A game ended with "End game" that can still be picked up again. */
  canResume: boolean;
  /** Votes cast on phones, while the game master has a ballot open. */
  ballot: Ballot | null;
  requests: RejoinRequest[];
};

/** The open ballot as a phone sees it: only its own vote. */
export type PhoneBallot = {
  candidateIds: string[];
  canVote: boolean;
  /** Whether this phone has voted, and for whom (null = no one). */
  voted: boolean;
  targetId: string | null;
  answered: number;
  voters: number;
};

/**
 * A phone only sees public info plus its own private data. `me` is null until
 * it joins; `info` (its role, lover…) and `game` are null until a game starts.
 */
export type PlayerView = BaseView & {
  kind: "player";
  me: PublicPlayer | null;
  info: PlayerInfo | null;
  game: PublicGame | null;
  ballot: PhoneBallot | null;
  /**
   * Set when this phone belongs to someone who left: they need the game
   * master's permission to come back.
   */
  rejoin: { name: string; account: boolean; status: "idle" | "pending" | "denied" } | null;
  /** This player's name was given to someone who signed in with it; they can pick another. */
  renamed: boolean;
};

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
  | "invalid-action"
  | "room-closed"
  /** The account couldn't be checked (expired sign-in, accounts off): sign in again. */
  | "invalid-account"
  /** That account is already another player in this room. */
  | "account-in-use"
  /** This seat's account joined the room from another device, which took it over. */
  | "signed-in-elsewhere";

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
  /**
   * `photo`: the photo this phone used last time, to start with (a JPEG data URL).
   * `idToken`: joins with an account, whose name and photo replace `name` and `photo`.
   */
  | { type: "join"; name: string; photo?: string | null; idToken?: string }
  /** A player who signed in after joining links their seat to the account. */
  | { type: "link-account"; idToken: string }
  /** A player without an account changes their own name, at any time. */
  | { type: "rename-self"; name: string }
  /** Leaves the room. Mid-game the player stays in the game for the game master to play. */
  | { type: "leave" }
  /** Someone who left asks to come back, possibly under a new name. */
  | { type: "request-rejoin"; name: string }
  /** null = vote for no one. */
  | { type: "cast-vote"; targetId: string | null }
  // Phone (its own photo) or game master (anyone's), except for account players.
  // `data` is a JPEG data URL; null removes it.
  | { type: "set-photo"; playerId?: string; data: string | null }
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
  | { type: "resume-game" }
  /** Not for account players: their name comes from the account. */
  | { type: "rename-player"; playerId: string; name: string }
  /** Disconnects everyone and deletes the room. */
  | { type: "close-room" }
  | { type: "answer-rejoin"; playerId: string; allow: boolean }
  | { type: "open-ballot" }
  | { type: "close-ballot" }
  /** Sets (or with `clear`, removes) someone's vote: misclicks and players without a phone. */
  | { type: "set-vote"; voterId: string; targetId: string | null; clear?: boolean }
  /** Starts a countdown of `seconds`, or removes it with null. */
  | { type: "set-timer"; seconds: number | null }
  | { type: "pause-timer" }
  | { type: "resume-timer" };

/** Query params sent when opening the socket. */
export type ConnectQuery =
  | { as: "host"; token: string; create?: "1" }
  | { as: "player"; id?: string; token?: string };

/**
 * Each sign-in gets an id that starts with its time, so the account server
 * can tell which device signed in last.
 */
export const newSessionId = () => `${Date.now().toString(36)}.${crypto.randomUUID()}`;
export const sessionTime = (sessionId: string) => parseInt(sessionId.split(".")[0], 36) || 0;

/** A signed-in page's socket to its account (see party/account.ts). */
export type AccountClientMessage = { type: "hello"; idToken: string; sessionId: string };
/** Sent to a device whose account signed in somewhere else since. */
export type AccountServerMessage = { type: "signed-out" };

export const MAX_NAME_LENGTH = 24;
/** Photos are resized on the device; this caps the data URL sent to the server. */
export const MAX_PHOTO_LENGTH = 200_000;
export const PHOTO_SIZE = 256;
