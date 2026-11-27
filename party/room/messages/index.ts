import type { MessageHandlers } from "./handler";
import { friendMessages } from "./friends";
import { gameMessages } from "./game";
import { leadMessages } from "./lead";
import { phoneTurnMessages } from "./phone-turns";
import { roomMessages } from "./room";
import { seatsMessages } from "./seats";

export type { MessageHandlers } from "./handler";

/** Every message a phone or the game master's screen may send, by type. */
export const messageHandlers: MessageHandlers = {
  ...seatsMessages,
  ...roomMessages,
  ...leadMessages,
  ...gameMessages,
  ...phoneTurnMessages,
  ...friendMessages,
};
