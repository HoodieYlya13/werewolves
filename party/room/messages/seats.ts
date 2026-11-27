import { type ConnState, PHOTO_PREFIX, type StoredRequest } from "../state";
import { refuse, type MessageHandlers } from "./handler";
import { cleanName, validateName, claimAccountName, untangleNames, renamePlayer } from "../names";
import { addPlayer, storePhoto, bringBack, leaveSeat, answerNewPhone, undoHandover, reseat, isFull, tooManyRequests, dropSeat } from "../seats";
import { verifyAccount, linkSeat, findAccount, applyAccount, tellAccount, checkOtherRoom } from "../accounts";
import { isInvited } from "../friends";

export const seatsMessages: MessageHandlers = {
  join: async ({ room, sender, state }, msg) => {
    // Someone who left may also join again as a new player, leaving their old seat behind.
    const canJoin = () => ["guest", "returning", "locked"].includes(sender.state?.kind ?? "");
    if (!canJoin()) return "unchanged";
    const account = msg.ticket === undefined ? null : await verifyAccount(room, sender, msg.ticket);
    if (msg.ticket !== undefined && !account) return "unchanged";
    // Checking the account went to the network: the autoGame may have changed meanwhile.
    if (!room.state || !canJoin()) return "unchanged";

    // Already in this autoGame under that account (another phone, or after leaving).
    const known = account && findAccount(room, account.sub);
    if (known) {
      if (known.left || !state.players.includes(known)) {
        sender.setState({ kind: "returning", playerId: known.id });
      } else {
        applyAccount(room, known, account);
        known.connected = true;
        // One device per account: the seat moves to this phone, and the
        // old one loses it (its token no longer works).
        known.token = crypto.randomUUID();
        for (const c of room.getConnections<ConnState>()) {
          if (c.id !== sender.id && c.state?.kind === "player" && c.state.playerId === known.id) {
            room.send(c, { type: "error", code: "signed-in-elsewhere" });
            c.setState({ kind: "guest" });
          }
        }
        sender.setState({ kind: "player", playerId: known.id });
        await tellAccount(room, known.sub, true);
      }
      room.send(sender, { type: "joined", playerId: known.id, token: known.token! });
      return "changed";
    }

    if (account) {
      // The game master's own account can't also play.
      if (account.sub === state.hostSub) return refuse(room, sender, "account-is-host");
      if (!(await checkOtherRoom(room, sender, account.sub, msg.leaveOther))) return "unchanged";
      if (!room.state || !canJoin()) return "unchanged";
    }
    const showUsername = !!msg.showUsername && !!account?.username;
    // A game, or a locked autoGame it wasn't invited to: a new phone asks the game master instead.
    if (state.game || (state.locked && !(account && isInvited(room, account.sub)))) {
      const name = account ? (showUsername ? account.username! : account.name) : cleanName(room, sender, msg.name);
      if (!name) return "unchanged";
      const device: { deviceId?: string; token?: string } = sender.state?.kind === "guest" ? sender.state : {};
      const id = device.deviceId ?? crypto.randomUUID();
      if (tooManyRequests(room, sender, id)) return "unchanged";
      const request: StoredRequest = { id, name, kind: "new", account: !!account, token: device.token };
      if (account) Object.assign(request, { signedIn: account, showUsername });
      state.requests = [...(state.requests ?? []).filter((r) => r.id !== id), request];
      state.deniedIds = (state.deniedIds ?? []).filter((d) => d !== id);
      sender.setState({ kind: "guest", deviceId: id, token: device.token });
      return "changed";
    }
    const name = account
      ? claimAccountName(room, { accountName: account.name, username: account.username, showUsername })
      : validateName(room, sender, msg.name);
    if (!name) return "unchanged";
    if (isFull(room, sender)) return "unchanged";
    const { deviceId, token } = sender.state?.kind === "guest" ? sender.state : {};
    const taken = [...state.players, ...(state.formerPlayers ?? [])].some((p) => p.id === deviceId);
    const player = addPlayer(room, name, false, deviceId && token && !taken ? { id: deviceId, token } : undefined);
    if (account) {
      player.sub = account.sub;
      player.picture = account.picture;
      player.accountName = account.name;
      player.username = account.username;
      player.showUsername = showUsername;
      await tellAccount(room, account.sub, true);
    } else if (msg.photo) {
      await storePhoto(room, player, msg.photo);
    }
    sender.setState({ kind: "player", playerId: player.id });
    room.send(sender, { type: "joined", playerId: player.id, token: player.token! });
    return "changed";
  },
  "link-account": async ({ room, sender, state }, msg) => {
    if (sender.state?.kind !== "player") return "unchanged";
    const account = await verifyAccount(room, sender, msg.ticket);
    if (!account || !room.state || sender.state?.kind !== "player") return "unchanged";
    const playerId = sender.state.playerId;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return "unchanged";
    // Already this account's seat: the name or photo changed on the account page.
    if (player.sub === account.sub) {
      applyAccount(room, player, account);
      return "changed";
    }
    const other = findAccount(room, account.sub);
    if (player.sub || other) return refuse(room, sender, "account-in-use");
    if (!(await checkOtherRoom(room, sender, account.sub, msg.leaveOther))) return "unchanged";
    if (!room.state || sender.state?.kind !== "player" || player.sub) return "unchanged";
    if (account.sub === state.hostSub) {
      // Signing in here signs the account out on the game master's screen
      // (one device per account); the seat becomes the account's then.
      sender.setState({ kind: "player", playerId, pendingLink: account });
      return refuse(room, sender, "account-is-host");
    }
    await linkSeat(room, player, account);
    return "changed";
  },
  unlock: async ({ room, sender, state }, msg) => {
    if (sender.state?.kind !== "locked") return "unchanged";
    const playerId = sender.state.playerId;
    const account = await verifyAccount(room, sender, msg.ticket);
    if (!account || !room.state || sender.state?.kind !== "locked") return "unchanged";
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return "unchanged";
    if (player.sub !== account.sub) return refuse(room, sender, "wrong-account");
    if (player.left) {
      sender.setState({ kind: "returning", playerId });
      return "changed";
    }
    applyAccount(room, player, account);
    player.connected = true;
    sender.setState({ kind: "player", playerId });
    await tellAccount(room, player.sub, true);
    return "changed";
  },
  "show-username": async ({ room, sender, isHost, state }, msg) => {
    // A player's own seat, or the creator's without a game master.
    const playerId = isHost ? state.hostSeatId : sender.state?.kind === "player" ? sender.state.playerId : null;
    if (!playerId) return "unchanged";
    const player = state.players.find((p) => p.id === playerId);
    if (!player?.sub || !player.accountName) return "unchanged";
    player.showUsername = msg.value === true && !!player.username;
    const name = claimAccountName(room, { ...player, accountName: player.accountName }, player.id);
    if (name !== player.name) renamePlayer(room, player, name);
    untangleNames(room, player.accountName);
    return "changed";
  },
  "rename-self": async ({ room, sender, state }, msg) => {
    if (sender.state?.kind !== "player") return "unchanged";
    const playerId = sender.state.playerId;
    const player = state.players.find((p) => p.id === playerId);
    if (!player || player.sub) return "unchanged";
    const name = validateName(room, sender, msg.name, player.id);
    if (!name) return "unchanged";
    renamePlayer(room, player, name);
    player.renamed = false;
    return "changed";
  },
  leave: async ({ room, sender, state }) => {
    if (sender.state?.kind !== "player") return "unchanged";
    const playerId = sender.state.playerId;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return "unchanged";
    leaveSeat(room, player);
    await tellAccount(room, player.sub, false);
    return "changed";
  },
  "request-rejoin": async ({ room, sender, state }, msg) => {
    if (sender.state?.kind !== "returning") return "unchanged";
    const playerId = sender.state.playerId;
    const known = [...state.players, ...(state.formerPlayers ?? [])].find((p) => p.id === playerId);
    if (known?.sub) {
      // An account's seat only goes back to that account, signed in on this phone.
      const account = await verifyAccount(room, sender, msg.ticket);
      if (!account || !room.state || sender.state?.kind !== "returning") return "unchanged";
      if (account.sub !== known.sub) return refuse(room, sender, "wrong-account");
      if (!(await checkOtherRoom(room, sender, account.sub, msg.leaveOther))) return "unchanged";
      if (!room.state || sender.state?.kind !== "returning") return "unchanged";
    }
    // An account keeps its name; anyone else may come back under a new one.
    const name = known?.sub ? known.name : validateName(room, sender, msg.name, playerId);
    if (!name) return "unchanged";
    // An open lobby lets anyone in: no need to ask the game master.
    if (!state.locked && !state.game) {
      if (isFull(room, sender)) return "unchanged";
      state.requests = state.requests?.filter((r) => r.id !== playerId);
      await bringBack(room, playerId, name);
      return "changed";
    }
    if (tooManyRequests(room, sender, playerId)) return "unchanged";
    state.requests = [
      ...(state.requests ?? []).filter((r) => r.id !== playerId),
      { id: playerId, name, kind: "rejoin", account: !!known?.sub },
    ];
    state.deniedIds = (state.deniedIds ?? []).filter((id) => id !== playerId);
    return "changed";
  },
  "undo-handover": async ({ room, sender, isHost }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    await undoHandover(room);
    return "changed";
  },
  "keep-handover": async ({ room, sender, isHost, state }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    state.handover = null;
    return "changed";
  },
  "cancel-request": async ({ sender, state }) => {
    const id = sender.state?.kind === "guest" ? sender.state.deviceId : sender.state?.kind === "returning" ? sender.state.playerId : undefined;
    if (!id) return "unchanged";
    state.requests = state.requests?.filter((r) => r.id !== id);
    return "changed";
  },
  "answer-request": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    const request = state.requests?.find((r) => r.id === msg.requestId);
    if (!request) return "unchanged";
    if (request.kind === "new") {
      await answerNewPhone(room, sender, request, msg.allow, msg.seatId);
      return "changed";
    }
    // A former player takes a seat again.
    if (msg.allow && !state.players.some((p) => p.id === request.id) && isFull(room, sender)) return "unchanged";
    state.requests = state.requests!.filter((r) => r.id !== request.id);
    if (!msg.allow) {
      state.deniedIds = [...(state.deniedIds ?? []), request.id];
      return "changed";
    }
    await bringBack(room, request.id, request.name);
    return "changed";
  },
  "add-player": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    // Without a game master everyone needs a phone.
    if (state.mode === "auto") return "unchanged";
    // The ended game no longer matches the table.
    state.endedGame = null;
    const name = validateName(room, sender, msg.name);
    if (!name || isFull(room, sender)) return "unchanged";
    addPlayer(room, name, true);
    return "changed";
  },
  "remove-player": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    // The creator's own seat goes with the game master's mode.
    if (msg.playerId === state.hostSeatId) return "unchanged";
    state.endedGame = null;
    await dropSeat(room, msg.playerId, true);
    return "changed";
  },
  "move-player": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    state.endedGame = null;
    const players = [...state.players].sort((a, b) => a.seat - b.seat);
    const from = players.findIndex((p) => p.id === msg.playerId);
    if (from === -1) return "unchanged";
    const to = Math.max(0, Math.min(players.length - 1, msg.seat));
    const [moved] = players.splice(from, 1);
    players.splice(to, 0, moved);
    state.players = players;
    reseat(room);
    return "changed";
  },
  "set-locked": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    state.locked = msg.locked;
    return "changed";
  },
  "rename-player": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    const player = state.players.find((p) => p.id === msg.playerId);
    // An account's name is the account's to change.
    if (!player || player.sub) return "unchanged";
    const name = validateName(room, sender, msg.name, player.id);
    if (!name) return "unchanged";
    renamePlayer(room, player, name);
    return "changed";
  },
  "set-photo": async ({ room, sender, isHost, state }, msg) => {
    const ownId = sender.state?.kind === "player" ? sender.state.playerId : null;
    const playerId = isHost ? msg.playerId : ownId;
    const player = state.players.find((p) => p.id === playerId);
    // Account players use their account's photo.
    if (!player || player.sub) return "unchanged";
    if (msg.data === null) {
      player.photo = null;
      await room.storage.delete(PHOTO_PREFIX + player.id);
      return "changed";
    }
    if (!(await storePhoto(room, player, msg.data))) return "unchanged";
    return "changed";
  },
};
