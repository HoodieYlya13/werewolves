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

/** One handler per message type: a new message the room doesn't handle doesn't compile. */
export type MessageHandlers = {
  [T in ClientMessage["type"]]: (context: MessageContext, message: MessageOf<T>) => Promise<Outcome>;
};

/** The handlers of one concern; together they make every message's. */
export type MessageHandlerGroup = Partial<MessageHandlers>;

/** Tells the sender why their message did nothing. */
export function refuse(room: RoomServer, conn: Conn, code: ErrorCode): Outcome {
  room.send(conn, { type: "error", code });
  return "unchanged";
}
