import type * as Party from "partykit/server";
import {
  applyAction,
  assignRoles,
  dealRoles,
  EngineError,
  playerInfo,
  publicGame,
  replay,
  type Action,
  type GameSetup,
  type GameState,
} from "../lib/engine";
import {
  MAX_NAME_LENGTH,
  type ClientMessage,
  type ErrorCode,
  type PublicPlayer,
  type RoomView,
  type ServerMessage,
  type StartGame,
} from "../lib/protocol";

/** Rooms with nobody connected are wiped after this, freeing the code. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "room";

type StoredPlayer = PublicPlayer & { token: string | null };

/**
 * Everything the room persists. Secrets (tokens) never leave the server.
 * The game is stored as setup + action log; its state is rebuilt by replaying.
 */
type RoomState = {
  code: string;
  hostToken: string;
  locked: boolean;
  players: StoredPlayer[];
  game: { setup: GameSetup; log: Action[] } | null;
  /** The game "End game" closed, so a misclick can be taken back. */
  endedGame?: { setup: GameSetup; log: Action[] } | null;
};

/** Who a socket belongs to. Kept on the connection so it survives restarts. */
type ConnState = { kind: "host" } | { kind: "player"; playerId: string } | { kind: "guest" };

type Conn = Party.Connection<ConnState>;

export default class RoomServer implements Party.Server {
  private state: RoomState | null = null;
  /** Cached result of replaying the game log. */
  private game: GameState | null = null;

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.state = (await this.room.storage.get<RoomState>(STORAGE_KEY)) ?? null;
    if (this.state?.game) this.game = replay(this.state.game.setup, this.state.game.log);
  }

  async onConnect(conn: Conn, ctx: Party.ConnectionContext) {
    const params = new URL(ctx.request.url).searchParams;
    const as = params.get("as");
    const token = params.get("token");

    if (as === "host") {
      if (!token) return this.reject(conn, "not-host");
      if (!this.state) {
        if (params.get("create") !== "1") return this.reject(conn, "room-not-found");
        this.state = {
          code: this.room.id,
          hostToken: token,
          locked: false,
          players: [],
          game: null,
        };
        await this.persist();
      } else if (this.state.hostToken !== token) {
        return this.reject(conn, params.get("create") === "1" ? "room-taken" : "not-host");
      }
      conn.setState({ kind: "host" });
      return this.send(conn, { type: "view", view: this.viewFor(conn) });
    }

    if (!this.state) return this.reject(conn, "room-not-found");

    // A returning phone: same id + token puts it back on its player.
    const player = this.state.players.find((p) => p.id === params.get("id"));
    if (player && token && player.token === token) {
      conn.setState({ kind: "player", playerId: player.id });
      player.connected = true;
      await this.persist();
      return this.broadcast();
    }

    conn.setState({ kind: "guest" });
    this.send(conn, { type: "view", view: this.viewFor(conn) });
  }

  async onClose(conn: Conn) {
    // Players stay in the game when their phone disconnects; they're just shown offline.
    if (!this.state || conn.state?.kind !== "player") return;
    const { playerId } = conn.state;
    const stillOnline = [...this.room.getConnections<ConnState>()].some(
      (c) => c.id !== conn.id && c.state?.kind === "player" && c.state.playerId === playerId,
    );
    const player = this.state.players.find((p) => p.id === playerId);
    if (player && !stillOnline) {
      player.connected = false;
      await this.persist();
      this.broadcast();
    }
  }

  async onMessage(raw: string | ArrayBuffer, sender: Conn) {
    if (typeof raw !== "string" || !this.state) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const isHost = sender.state?.kind === "host";
    const lobbyOnly = ["add-player", "remove-player", "move-player", "start-game", "resume-game"];
    if (lobbyOnly.includes(msg.type) && this.state.game) {
      return this.send(sender, { type: "error", code: "game-in-progress" });
    }

    switch (msg.type) {
      case "join": {
        if (sender.state?.kind !== "guest") return;
        if (this.state.locked) return this.send(sender, { type: "error", code: "room-locked" });
        const name = this.validateName(sender, msg.name);
        if (!name) return;
        const player = this.addPlayer(name, false);
        sender.setState({ kind: "player", playerId: player.id });
        this.send(sender, { type: "joined", playerId: player.id, token: player.token! });
        break;
      }
      case "add-player": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        // The ended game no longer matches the table.
        this.state.endedGame = null;
        const name = this.validateName(sender, msg.name);
        if (!name) return;
        this.addPlayer(name, true);
        break;
      }
      case "remove-player": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        this.state.endedGame = null;
        this.state.players = this.state.players.filter((p) => p.id !== msg.playerId);
        this.reseat();
        for (const c of this.room.getConnections<ConnState>()) {
          if (c.state?.kind === "player" && c.state.playerId === msg.playerId) {
            this.send(c, { type: "error", code: "removed" });
            c.setState({ kind: "guest" });
          }
        }
        break;
      }
      case "move-player": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        this.state.endedGame = null;
        const players = [...this.state.players].sort((a, b) => a.seat - b.seat);
        const from = players.findIndex((p) => p.id === msg.playerId);
        if (from === -1) return;
        const to = Math.max(0, Math.min(players.length - 1, msg.seat));
        const [moved] = players.splice(from, 1);
        players.splice(to, 0, moved);
        this.state.players = players;
        this.reseat();
        break;
      }
      case "set-locked": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        this.state.locked = msg.locked;
        break;
      }
      case "start-game": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        try {
          const setup = this.buildSetup(msg);
          this.game = replay(setup, []);
          this.state.game = { setup, log: [] };
          this.state.endedGame = null;
          this.state.locked = true;
        } catch (e) {
          return this.sendEngineError(sender, e, "invalid-setup");
        }
        break;
      }
      case "game-action": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        if (!this.state.game || !this.game) return;
        try {
          this.game = applyAction(this.game, msg.action);
          this.state.game.log.push(msg.action);
        } catch (e) {
          return this.sendEngineError(sender, e, "invalid-action");
        }
        break;
      }
      case "undo": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        if (!this.state.game || this.state.game.log.length === 0) return;
        this.state.game.log.pop();
        this.game = replay(this.state.game.setup, this.state.game.log);
        break;
      }
      case "end-game": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        this.state.endedGame = this.state.game;
        this.state.game = null;
        this.game = null;
        break;
      }
      case "resume-game": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        if (!this.state.endedGame) return;
        this.state.game = this.state.endedGame;
        this.state.endedGame = null;
        this.game = replay(this.state.game.setup, this.state.game.log);
        break;
      }
      default:
        return;
    }

    await this.persist();
    this.broadcast();
  }

  async onAlarm() {
    const anyoneHere = [...this.room.getConnections()].length > 0;
    if (anyoneHere) {
      await this.room.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }
    await this.room.storage.deleteAll();
    this.state = null;
  }

  // --- helpers ---

  private buildSetup(start: StartGame): GameSetup {
    const players = this.state!.players.map(({ id, name, seat }) => ({ id, name, seat }));
    const options = { actorCards: start.actorCards, groups: start.groups };
    return start.mode === "random"
      ? dealRoles(players, start.deck, start.settings, options, secureRandom)
      : assignRoles(players, start.assignment, start.extraCards, start.settings, options);
  }

  private sendEngineError(conn: Conn, error: unknown, code: ErrorCode) {
    if (!(error instanceof EngineError)) throw error;
    this.send(conn, { type: "error", code, detail: error.message });
  }

  private addPlayer(name: string, manual: boolean) {
    const player: StoredPlayer = {
      id: crypto.randomUUID(),
      token: manual ? null : crypto.randomUUID(),
      name,
      seat: this.state!.players.length,
      connected: !manual,
      manual,
    };
    this.state!.players.push(player);
    return player;
  }

  private validateName(conn: Conn, input: unknown): string | null {
    const name = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      this.send(conn, { type: "error", code: "invalid-name" });
      return null;
    }
    const taken = this.state!.players.some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) {
      this.send(conn, { type: "error", code: "name-taken" });
      return null;
    }
    return name;
  }

  private reseat() {
    this.state!.players.forEach((p, i) => (p.seat = i));
  }

  private viewFor(conn: Conn): RoomView {
    const s = this.state!;
    const players = s.players
      .map(({ id, name, seat, connected, manual }): PublicPlayer => ({ id, name, seat, connected, manual }))
      .sort((a, b) => a.seat - b.seat);
    const phase = !this.game ? "lobby" : this.game.winner ? "ended" : "playing";
    const base = { code: s.code, phase, locked: s.locked, players } as const;
    if (conn.state?.kind === "host") {
      return {
        ...base,
        kind: "host",
        game: this.game,
        actionCount: s.game?.log.length ?? 0,
        canResume: !!s.endedGame,
      };
    }
    const state = conn.state;
    const me = state?.kind === "player" ? players.find((p) => p.id === state.playerId) : undefined;
    const info = me && this.game ? playerInfo(this.game, me.id) : null;
    return { ...base, kind: "player", me: me ?? null, info, game: this.game ? publicGame(this.game) : null };
  }

  /** Every socket gets its own filtered view, so secrets never reach the wrong phone. */
  private broadcast() {
    for (const conn of this.room.getConnections<ConnState>()) {
      this.send(conn, { type: "view", view: this.viewFor(conn) });
    }
  }

  private send(conn: Conn, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private reject(conn: Conn, code: ErrorCode) {
    this.send(conn, { type: "error", code });
    conn.close();
  }

  private async persist() {
    await this.room.storage.put(STORAGE_KEY, this.state);
    await this.room.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }
}

/** Card dealing uses the platform's secure random source. */
function secureRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
