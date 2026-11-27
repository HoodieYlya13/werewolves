import { addFriend, friendsHere, invite, profile } from "../friends";
import type { MessageHandlerGroup } from "./handler";

/** Friend calls answer the sender only: the room itself doesn't change. */
export const friendMessages = {
  "add-friend": async ({ room, sender, isHost }, msg) => {
    await addFriend(room, sender, isHost, msg.playerId);
    return "unchanged";
  },
  invite: async ({ room, sender, isHost }, msg) => {
    await invite(room, sender, isHost, msg.subs);
    return "unchanged";
  },
  "friends-here": async ({ room, sender, isHost }) => {
    await friendsHere(room, sender, isHost);
    return "unchanged";
  },
  profile: async ({ room, sender, isHost }, msg) => {
    await profile(room, sender, isHost, msg.playerId);
    return "unchanged";
  },
} satisfies MessageHandlerGroup;
