import type { ClientMessage, ErrorCode } from "../../../lib/protocol";
import type { RoomServer } from "../../server";
import type { Conn, RoomState } from "../state";

/** "changed": the room is saved and every phone gets its new view. "unchanged": nothing more to do. */
export type Outcome = "changed" | "unchanged";

export type MessageContext = {
  room: RoomServer;
  sender: Conn;
  isHost: boolean;
  /** The room as the message found it (a handler that closes it sets `room.state` to null). */
  state: RoomState;
};

type MessageOf<T extends ClientMessage["type"]> = Extract<ClientMessage, { type: T }>;

export type MessageHandlers = {
  [T in ClientMessage["type"]]?: (context: MessageContext, message: MessageOf<T>) => Promise<Outcome>;
};

/** Tells the sender why their message did nothing. */
export function refuse(room: RoomServer, conn: Conn, code: ErrorCode): Outcome {
  room.send(conn, { type: "error", code });
  return "unchanged";
}
