import { isLocale } from "../../../lib/i18n/config";
import type { ConnState } from "../state";
import { refuse, type MessageHandlerGroup } from "./handler";
import { storePhoto, dropSeat, hostSeat, addHostSeat, removeHostSeat, syncHostSeat } from "../seats";
import { verifyAccount, completePendingLinks, tellAccount, releaseAccounts } from "../accounts";

export const roomMessages = {
  "close-room": async ({ room, sender, isHost }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    await releaseAccounts(room);
    room.state = null;
    room.game = null;
    await room.storage.deleteAll();
    await room.storage.deleteAlarm();
    for (const conn of room.getConnections<ConnState>()) {
      room.send(conn, { type: "error", code: "room-closed" });
      conn.close(1000, "room-closed");
    }
    return "unchanged";
  },
  "host-account": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    const previous = state.hostSub;
    if (msg.ticket === null) {
      delete state.hostSub;
      delete state.hostFace;
      syncHostSeat(room);
      await tellAccount(room, previous, false);
      await completePendingLinks(room);
      return "changed";
    }
    const account = await verifyAccount(room, sender, msg.ticket);
    if (!account || !room.state) return "unchanged";
    // Playing in this autoGame already: one role per account.
    if (state.players.some((p) => p.sub === account.sub && !p.left && p.id !== state.hostSeatId && p.id !== state.masterSeatId)) {
      return refuse(room, sender, "account-in-use");
    }
    state.hostSub = account.sub;
    state.hostFace = { name: account.name, picture: account.picture, username: account.username };
    syncHostSeat(room);
    if (previous !== account.sub) await tellAccount(room, previous, false);
    // The account server knows the master's autoGame too, to ask a new device about it.
    await tellAccount(room, account.sub, true);
    await completePendingLinks(room);
    return "changed";
  },
  "set-mode": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    if (isLocale(msg.locale)) state.locale = msg.locale;
    if (msg.mode === "auto") {
      if (!hostSeat(room)) {
        if (!addHostSeat(room, sender, msg.name)) return "unchanged";
        const seat = hostSeat(room)!;
        if (!seat.sub && msg.photo) await storePhoto(room, seat, msg.photo);
      }
      // Everyone plays on their own phone: no seats without one.
      for (const p of state.players.filter((p) => p.manual)) await dropSeat(room, p.id);
      state.mode = "auto";
    } else {
      await removeHostSeat(room);
      delete state.mode;
    }
    // The ended game was played the other way.
    state.endedGame = null;
    return "changed";
  },
} satisfies MessageHandlerGroup;
