import { routePartykitRequest, Server, type ConnectionContext } from "partyserver";
import { replay, type GameState } from "../lib/engine";
import { workerTicketKey } from "./keys";
import * as auto from "../lib/auto";
import type { ClientMessage, ErrorCode, SeatStatus, ServerMessage } from "../lib/protocol";
import { type Conn, type ConnState, LEADER_GRACE_MS, MASTER_GRACE_MS, MESSAGES_PER_SECOND, PHOTO_PREFIX, ROOM_TTL_MS, type RoomState, SPEAKER_GRACE_MS, STORAGE_KEY, isDeviceId, upgradeGame } from "./room/state";
import { leaveSeat, hostSeat } from "./room/seats";
import { takeHost, closeHosts, releaseAccounts } from "./room/accounts";
import { recordResult } from "./room/stats";
import { viewFor, broadcastViews } from "./room/views";
import { autoRoom, runAuto, narration } from "./room/auto-runner";
import { welcomeBack } from "./room/lead";
import { messageHandlers, type MessageHandlers } from "./room/messages";

/**
 * One Durable Object per room code. It hibernates between messages, so all
 * state lives in storage and `onStart` reloads it on every wake-up.
 */
export class RoomServer extends Server<Env> {
  static options = { hibernate: true };

  state: RoomState | null = null;
  /** Each connection's message count this second (forgotten when the room hibernates, which is fine). */
  rates = new Map<string, { since: number; count: number }>();
  /** Cached result of replaying the game log. */
  game: GameState | null = null;
  /**
   * Tickets already used here, until they expire. In memory: a room that
   * hibernates forgets them, and their one-minute expiry still applies.
   */
  usedTickets = new Map<string, number>();
  /** Writes to the stats database, one at a time and in order. */
  recording: Promise<void> = Promise.resolve();
  /** Friends and invites reach the database and other accounts: a few a minute per connection. */
  friendCalls = new Map<string, number[]>();
  /** Profiles opened: a database read each, a few more allowed than friend calls. */
  profileCalls = new Map<string, number[]>();

  /** The worker's bindings, for the room's modules. */
  get bindings(): Env {
    return this.env;
  }

  get storage() {
    return this.ctx.storage;
  }

  waitUntil(promise: Promise<unknown>) {
    this.ctx.waitUntil(promise);
  }

  async onStart() {
    this.state = (await this.ctx.storage.get<RoomState>(STORAGE_KEY)) ?? null;
    if (this.state) {
      this.state.game = upgradeGame(this.state.game);
      // A game that no longer fits is dropped: the room goes back to the lobby.
      this.state.endedGame = upgradeGame(this.state.endedGame);
    }
    if (this.state?.game) {
      try {
        this.game = replay(this.state.game.setup, this.state.game.log);
      } catch {
        // A saved game this engine can't replay: back to the lobby rather than a room that never starts.
        this.state.game = null;
      }
    }
  }

  async onConnect(conn: Conn, ctx: ConnectionContext) {
    const params = new URL(ctx.request.url).searchParams;
    const as = params.get("as");
    const token = params.get("token");

    if (as === "host") {
      const ticket = params.get("ticket");
      if (ticket && this.state) return takeHost(this, conn, ticket);
      if (!token) return this.reject(conn, "not-host");
      if (!this.state && params.get("create") === "1" && !(await this.mayCreateRoom(ctx))) {
        return this.reject(conn, "too-many-rooms");
      }
      if (!this.state) {
        if (params.get("create") !== "1") return this.reject(conn, "room-not-found");
        this.state = {
          code: this.name,
          hostToken: token,
          locked: false,
          players: [],
          game: null,
        };
        await this.persist();
      } else if (this.state.hostToken !== token) {
        // A key that moved on while its device was gone: it gets its part back.
        if (this.state.formerHosts && token in this.state.formerHosts) return welcomeBack(this, conn, token);
        return this.reject(conn, params.get("create") === "1" ? "room-taken" : "not-host");
      }
      conn.setState({ kind: "host" });
      this.state.masterLostAt = null;
      this.state.masterGone = false;
      // Without a game master the creator's seat is online again, and their device may read the game out loud.
      const seat = hostSeat(this);
      if (seat) {
        seat.connected = true;
        await runAuto(this);
        await this.persist();
        return broadcastViews(this);
      }
      if (this.state.game) {
        await this.persist();
        broadcastViews(this);
      }
      return this.send(conn, { type: "view", view: viewFor(this, conn) });
    }

    if (!this.state) return this.reject(conn, "room-not-found");

    // A returning phone: same id + token puts it back on its player.
    const id = params.get("id");
    const player = this.state.players.find((p) => p.id === id || (!!id && p.deviceId === id));
    if (player && token && player.token === token) {
      // Someone who left needs the game master's permission first.
      if (player.left) {
        conn.setState({ kind: "returning", playerId: player.id });
        return this.send(conn, { type: "view", view: viewFor(this, conn) });
      }
      // An account's seat needs the account too: the phone's saved token alone
      // would outlive signing out, an expired sign-in or cleared cookies.
      if (player.sub && (await workerTicketKey(this.env))) {
        conn.setState({ kind: "locked", playerId: player.id });
        return this.send(conn, { type: "view", view: viewFor(this, conn) });
      }
      conn.setState({ kind: "player", playerId: player.id });
      player.connected = true;
      // A phone back may be the one to take over a game whose leader or game master is gone.
      if (this.game) await runAuto(this);
      await this.persist();
      return broadcastViews(this);
    }
    // A game master who handed the game over watches it.
    const spectator = this.state.spectators?.find((x) => x.id === id && x.token === token);
    if (spectator) {
      conn.setState({ kind: "guest", deviceId: spectator.id, token: spectator.token, spectator: true });
      return this.send(conn, { type: "view", view: viewFor(this, conn) });
    }
    const former = this.state.formerPlayers?.find((p) => p.id === id);
    if (former && token && former.token === token) {
      conn.setState({ kind: "returning", playerId: former.id });
      return this.send(conn, { type: "view", view: viewFor(this, conn) });
    }

    conn.setState({
      kind: "guest",
      deviceId: isDeviceId(id) ? id : undefined,
      token: isDeviceId(token) ? token : undefined,
    });
    this.send(conn, { type: "view", view: viewFor(this, conn) });
  }

  async onClose(conn: Conn) {
    this.rates.delete(conn.id);
    const masterGone =
      conn.state?.kind === "host" &&
      !this.state?.auto &&
      !!this.game &&
      !this.game.winner &&
      ![...this.getConnections<ConnState>()].some((c) => c.id !== conn.id && c.state?.kind === "host");
    if (masterGone && this.state) {
      // A dead player takes the game over if the screen doesn't come back (see checkMaster).
      this.state.masterLostAt = Date.now();
      await this.persist(false);
    }
    const seat = conn.state?.kind === "host" ? hostSeat(this) : null;
    if (seat && ![...this.getConnections<ConnState>()].some((c) => c.id !== conn.id && c.state?.kind === "host")) {
      seat.connected = false;
      if (this.state?.auto && this.game) this.state.leaderLostAt = Date.now();
      await this.persist();
      // Another device takes over reading the game out loud.
      return broadcastViews(this);
    }
    // Players stay in the game when their phone disconnects; they're just shown offline.
    if (!this.state || conn.state?.kind !== "player") return;
    const { playerId } = conn.state;
    const stillOnline = [...this.getConnections<ConnState>()].some(
      (c) => c.id !== conn.id && c.state?.kind === "player" && c.state.playerId === playerId,
    );
    const player = this.state.players.find((p) => p.id === playerId);
    if (player && !stillOnline) {
      player.connected = false;
      await this.persist();
      broadcastViews(this);
    }
  }

  async onMessage(sender: Conn, raw: string | ArrayBuffer) {
    if (this.flooding(sender)) return;
    if (typeof raw !== "string" || !this.state) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const isHost = sender.state?.kind === "host";
    const logLength = this.state.game?.log.length;
    const lobbyOnly = ["add-player", "remove-player", "move-player", "start-game", "resume-game", "set-mode"];
    if (lobbyOnly.includes(msg.type) && this.state.game) {
      return this.send(sender, { type: "error", code: "game-in-progress" });
    }
    // Without a game master, nobody runs the game by hand.
    const masterOnly = ["game-action", "undo", "open-ballot", "close-ballot", "set-vote", "set-timer", "pause-timer", "resume-timer"];
    if (masterOnly.includes(msg.type) && this.state.game && this.state.auto) {
      return this.send(sender, { type: "error", code: "invalid-action" });
    }

    // Own keys only: a made-up type such as "toString" finds nothing.
    if (!Object.hasOwn(messageHandlers, msg.type)) return;
    const handle = messageHandlers[msg.type] as MessageHandlers[ClientMessage["type"]];
    const outcome = await handle({ room: this, sender, isHost, state: this.state }, msg as never);
    if (outcome === "unchanged" || !this.state) return;

    if (this.state.auto && this.game) {
      // The room plays the game on, as far as it can go now.
      await runAuto(this);
    } else if (this.state.game?.log.length !== logLength) {
      // A ballot and its countdown belong to one vote: any change to the game ends them.
      this.state.ballot = null;
      this.state.timer = null;
    }

    await this.persist();
    broadcastViews(this);
    recordResult(this);
  }

  /** Serves player photos at /parties/main/:room/photo/:playerId. */
  async onRequest(request: Request) {
    if (new URL(request.url).pathname.endsWith("/seat")) return this.seatStatus(request);
    const match = new URL(request.url).pathname.match(/\/photo\/([\w-]+)$/);
    const data = match && this.state ? await this.ctx.storage.get<string>(PHOTO_PREFIX + match[1]) : undefined;
    if (!data) return new Response("Not found", { status: 404 });
    const [header, base64] = data.split(",");
    const type = header.slice("data:".length, header.indexOf(";"));
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return new Response(bytes, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }

  /**
   * Whether a seat saved on a device is still this room's, so pages outside
   * the room can offer to go back (POST /parties/main/:room/seat with the
   * saved identity; plain text, so no CORS preflight).
   */
  async seatStatus(request: Request) {
    const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
    if (request.method !== "POST") return new Response(null, { status: 405, headers });
    let body: { as?: unknown; id?: unknown; token?: unknown } | null = null;
    try {
      body = JSON.parse(await request.text());
    } catch {}
    const s = this.state;
    const token = typeof body?.token === "string" && body.token ? body.token : null;
    let seat: SeatStatus = { active: false };
    if (s && token && body?.as === "host" && token === s.hostToken) {
      seat = { active: true, role: "host", inGame: !!s.game };
    } else if (s && token && body?.as === "player") {
      const player = [...s.players, ...(s.formerPlayers ?? [])].find((p) => p.id === body.id && p.token === token);
      if (player) seat = { active: true, role: "player", name: player.name, inGame: !!s.game };
    }
    return Response.json(seat, { headers });
  }

  async onAlarm() {
    // A game without a game master moves on by the clock too (and one with a game master checks they're back).
    if (this.state && this.game) {
      await runAuto(this);
      await this.persist(false);
      broadcastViews(this);
      recordResult(this);
    }
    if (this.state && Date.now() < (this.state.expiresAt ?? 0)) return this.scheduleAlarm();
    const anyoneHere = [...this.getConnections()].length > 0;
    if (anyoneHere) {
      if (this.state) await this.persist();
      else await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }
    await releaseAccounts(this);
    await this.ctx.storage.deleteAll();
    // All of it: a game left in memory would come back in the next room made with this code.
    this.state = null;
    this.game = null;
  }

  // --- called by AccountServer (party/account.ts) ---

  /** Whether this account has a seat here, and whether a game is on. */
  async accountSeat(sub: string) {
    const s = this.state;
    const player = s?.players.find((p) => p.sub === sub && !p.left);
    if (player) return { inGame: !!s!.game, role: "player" as const, playerId: player.id };
    if (s && s.hostSub === sub) return { inGame: !!s.game, role: "host" as const };
    return null;
  }

  /**
   * The master's account chose to run this room from a new device: the
   * current master screen stops now (its key no longer works), before signing
   * it out could drop the account from the room. The new device opens the
   * room with a ticket from that account (see takeHost).
   */
  async moveHost(sub: string) {
    const s = this.state;
    if (!s || s.hostSub !== sub) return false;
    s.hostToken = crypto.randomUUID();
    closeHosts(this, "host-moved");
    await this.persist();
    return true;
  }

  /**
   * The account signed in on another device and chose not to play from it,
   * or joined another room: it leaves this one (mid-game the game master
   * plays their part).
   */
  async releaseAccount(sub: string, reason: "left-elsewhere" | "moved-room" = "left-elsewhere") {
    const player = this.state?.players.find((p) => p.sub === sub && !p.left);
    if (!player) {
      // The master's device keeps running the room either way. "Leave it there"
      // means it does so signed out; joining another room as a player doesn't
      // change who runs this one.
      if (this.state?.hostSub !== sub) return false;
      if (reason === "moved-room") return true;
      delete this.state.hostSub;
      await this.persist();
      broadcastViews(this);
      return false;
    }
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.kind === "player" && c.state.playerId === player.id) {
        this.send(c, { type: "error", code: reason });
        c.setState({ kind: "guest" });
      }
    }
    leaveSeat(this, player);
    await this.persist();
    broadcastViews(this);
    return false;
  }

  send(conn: Conn, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  /** Counts each connection's messages per second, and drops (then cuts off) a flood. */
  flooding(conn: Conn) {
    const now = Date.now();
    let rate = this.rates.get(conn.id);
    if (!rate || now - rate.since >= 1000) this.rates.set(conn.id, (rate = { since: now, count: 0 }));
    rate.count++;
    if (rate.count > MESSAGES_PER_SECOND * 5) conn.close(1008, "Too many messages");
    return rate.count > MESSAGES_PER_SECOND;
  }

  /** One network can only open so many rooms a minute (the ROOM_CREATION rate limit). */
  async mayCreateRoom(ctx: ConnectionContext) {
    const ip = ctx.request.headers.get("CF-Connecting-IP");
    if (!ip || !this.env.ROOM_CREATION) return true;
    const { success } = await this.env.ROOM_CREATION.limit({ key: ip });
    return success;
  }

  reject(conn: Conn, code: ErrorCode) {
    this.send(conn, { type: "error", code });
    conn.close();
  }

  /** Saves the room. `active`: someone did something, so the room lives another day. */
  async persist(active = true) {
    if (this.state && active) this.state.expiresAt = Date.now() + ROOM_TTL_MS;
    await this.ctx.storage.put(STORAGE_KEY, this.state);
    await this.scheduleAlarm();
  }

  /** Wakes the room when it expires, or sooner when a game without a game master has to move on. */
  async scheduleAlarm() {
    const s = this.state;
    if (!s) return;
    const expires = s.expiresAt ?? Date.now() + ROOM_TTL_MS;
    const room = autoRoom(this);
    let next = room ? auto.nextWake(room, narration(this)) : null;
    // The leader's device away: check again when its grace runs out.
    if (room && s.leaderLostAt && !s.lostLeader) next = Math.min(next ?? Infinity, s.leaderLostAt + LEADER_GRACE_MS);
    // …and hand the narration to another phone once a short absence turns out longer.
    if (room && s.leaderLostAt && Date.now() < s.leaderLostAt + SPEAKER_GRACE_MS) next = Math.min(next ?? Infinity, s.leaderLostAt + SPEAKER_GRACE_MS);
    // The game master's screen away: a dead player takes over after a minute.
    if (!room && s.masterLostAt && !s.masterGone) next = Math.min(next ?? Infinity, s.masterLostAt + MASTER_GRACE_MS);
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, Math.min(expires, next ?? Infinity)));
  }

  /** Saves and tells everyone, for a message whose handler does so itself. */
  async done() {
    await this.persist();
    broadcastViews(this);
  }

}

export { AccountServer } from "./account";

/** Routes /parties/main/:room to that room's RoomServer, /parties/account/:sub to an AccountServer. */
export default {
  async fetch(request: Request, env: Env) {
    return (await routePartykitRequest(request, env)) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
