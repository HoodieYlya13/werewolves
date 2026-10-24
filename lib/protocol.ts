/**
 * Messages between the Next.js app and the PartyKit room server.
 * Shared by `party/server.ts` and the client so both sides stay in sync.
 */

export type RoomPhase = "lobby" | "setup" | "playing" | "ended";

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

/** The game master sees everything. Game state (roles, log…) gets added here. */
export type HostView = BaseView & { kind: "host" };

/** A phone only sees public info plus its own private data (its role, later). `me` is null until it joins. */
export type PlayerView = BaseView & { kind: "player"; me: PublicPlayer | null };

export type RoomView = HostView | PlayerView;

export type ErrorCode =
  | "room-not-found"
  | "room-taken"
  | "room-locked"
  | "name-taken"
  | "invalid-name"
  | "not-host"
  | "removed";

export type ServerMessage =
  | { type: "view"; view: RoomView }
  | { type: "joined"; playerId: string; token: string }
  | { type: "error"; code: ErrorCode };

export type ClientMessage =
  // Phone
  | { type: "join"; name: string }
  // Game master
  | { type: "add-player"; name: string }
  | { type: "remove-player"; playerId: string }
  | { type: "move-player"; playerId: string; seat: number }
  | { type: "set-locked"; locked: boolean };

/** Query params sent when opening the socket. */
export type ConnectQuery =
  | { as: "host"; token: string; create?: "1" }
  | { as: "player"; id?: string; token?: string };

export const MAX_NAME_LENGTH = 24;
