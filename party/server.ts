import { getServerByName, routePartykitRequest, Server, type Connection, type ConnectionContext } from "partyserver";
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
import { DEFAULT_ISSUER, verifyIdToken, type Account } from "../lib/account";
import type { Ballot, Timer } from "../lib/ballot";
import {
  MAX_NAME_LENGTH,
  MAX_PHOTO_LENGTH,
  type ClientMessage,
  type ErrorCode,
  type PlayerView,
  type PublicPlayer,
  type RejoinRequest,
  type RoomView,
  type ServerMessage,
  type StartGame,
} from "../lib/protocol";

/** Rooms with nobody connected are wiped after this, freeing the code. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "room";

type StoredPlayer = Omit<PublicPlayer, "account" | "picture"> & {
  token: string | null;
  /** The account's id, for players who signed in. */
  sub?: string;
  picture?: string | null;
  /** Lost their name to someone who signed in with it. */
  renamed?: boolean;
};

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
  /** Votes cast on phones; closed by any game action. */
  ballot?: Ballot | null;
  timer?: Timer | null;
  /** Players who left the lobby, remembered so they can ask to come back. */
  formerPlayers?: StoredPlayer[];
  requests?: RejoinRequest[];
  /** Players whose last request the game master refused, so their phone can say so. */
  deniedIds?: string[];
};

const PHOTO_PREFIX = "photo:";
const MAX_TIMER_SECONDS = 60 * 60;

/** Who a socket belongs to. Kept on the connection so it survives restarts. */
type ConnState =
  | { kind: "host" }
  | { kind: "player"; playerId: string }
  /** Someone who left: they see the room but need the game master's OK to come back. */
  | { kind: "returning"; playerId: string }
  /** Not a player yet. Keeps the device's id, used as the player id if they join. */
  | { kind: "guest"; deviceId?: string; token?: string };

const isDeviceId = (value: string | null): value is string => !!value && /^[\w-]{16,64}$/.test(value);

type Conn = Connection<ConnState>;

/**
 * One Durable Object per room code. It hibernates between messages, so all
 * state lives in storage and `onStart` reloads it on every wake-up.
 */
export class RoomServer extends Server<Env> {
  static options = { hibernate: true };

  private state: RoomState | null = null;
  /** Cached result of replaying the game log. */
  private game: GameState | null = null;

  async onStart() {
    this.state = (await this.ctx.storage.get<RoomState>(STORAGE_KEY)) ?? null;
    if (this.state?.game) this.game = replay(this.state.game.setup, this.state.game.log);
  }

  async onConnect(conn: Conn, ctx: ConnectionContext) {
    const params = new URL(ctx.request.url).searchParams;
    const as = params.get("as");
    const token = params.get("token");

    if (as === "host") {
      if (!token) return this.reject(conn, "not-host");
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
        return this.reject(conn, params.get("create") === "1" ? "room-taken" : "not-host");
      }
      conn.setState({ kind: "host" });
      return this.send(conn, { type: "view", view: this.viewFor(conn) });
    }

    if (!this.state) return this.reject(conn, "room-not-found");

    // A returning phone: same id + token puts it back on its player.
    const id = params.get("id");
    const player = this.state.players.find((p) => p.id === id);
    if (player && token && player.token === token) {
      // Someone who left needs the game master's permission first.
      if (player.left) {
        conn.setState({ kind: "returning", playerId: player.id });
        return this.send(conn, { type: "view", view: this.viewFor(conn) });
      }
      conn.setState({ kind: "player", playerId: player.id });
      player.connected = true;
      await this.persist();
      return this.broadcastViews();
    }
    const former = this.state.formerPlayers?.find((p) => p.id === id);
    if (former && token && former.token === token) {
      conn.setState({ kind: "returning", playerId: former.id });
      return this.send(conn, { type: "view", view: this.viewFor(conn) });
    }

    conn.setState({
      kind: "guest",
      deviceId: isDeviceId(id) ? id : undefined,
      token: isDeviceId(token) ? token : undefined,
    });
    this.send(conn, { type: "view", view: this.viewFor(conn) });
  }

  async onClose(conn: Conn) {
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
      this.broadcastViews();
    }
  }

  async onMessage(sender: Conn, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || !this.state) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const isHost = sender.state?.kind === "host";
    const logLength = this.state.game?.log.length;
    const lobbyOnly = ["add-player", "remove-player", "move-player", "start-game", "resume-game"];
    if (lobbyOnly.includes(msg.type) && this.state.game) {
      return this.send(sender, { type: "error", code: "game-in-progress" });
    }

    switch (msg.type) {
      case "join": {
        // Someone who left may also join again as a new player, leaving their old seat behind.
        const canJoin = () => sender.state?.kind === "guest" || sender.state?.kind === "returning";
        if (!canJoin()) return;
        const account = msg.idToken === undefined ? null : await this.verifyAccount(sender, msg.idToken);
        if (msg.idToken !== undefined && !account) return;
        // Checking the account went to the network: the room may have changed meanwhile.
        if (!this.state || !canJoin()) return;

        // Already in this room under that account (another phone, or after leaving).
        const known = account && this.findAccount(account.sub);
        if (known) {
          if (known.left || !this.state.players.includes(known)) {
            sender.setState({ kind: "returning", playerId: known.id });
          } else {
            this.applyAccount(known, account);
            known.connected = true;
            // One device per account: the seat moves to this phone, and the
            // old one loses it (its token no longer works).
            known.token = crypto.randomUUID();
            for (const c of this.getConnections<ConnState>()) {
              if (c.id !== sender.id && c.state?.kind === "player" && c.state.playerId === known.id) {
                this.send(c, { type: "error", code: "signed-in-elsewhere" });
                c.setState({ kind: "guest" });
              }
            }
            sender.setState({ kind: "player", playerId: known.id });
            await this.tellAccount(known.sub, true);
          }
          this.send(sender, { type: "joined", playerId: known.id, token: known.token! });
          break;
        }

        if (this.state.locked) return this.send(sender, { type: "error", code: "room-locked" });
        const name = account ? this.claimName(account.name) : this.validateName(sender, msg.name);
        if (!name) return;
        const { deviceId, token } = sender.state?.kind === "guest" ? sender.state : {};
        const taken = [...this.state.players, ...(this.state.formerPlayers ?? [])].some((p) => p.id === deviceId);
        const player = this.addPlayer(name, false, deviceId && token && !taken ? { id: deviceId, token } : undefined);
        if (account) {
          player.sub = account.sub;
          player.picture = account.picture;
          await this.tellAccount(account.sub, true);
        } else if (msg.photo) {
          await this.storePhoto(player, msg.photo);
        }
        sender.setState({ kind: "player", playerId: player.id });
        this.send(sender, { type: "joined", playerId: player.id, token: player.token! });
        break;
      }
      case "link-account": {
        if (sender.state?.kind !== "player") return;
        const account = await this.verifyAccount(sender, msg.idToken);
        if (!account || !this.state || sender.state?.kind !== "player") return;
        const playerId = sender.state.playerId;
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player || player.sub === account.sub) return;
        const other = this.findAccount(account.sub);
        if (player.sub || other) return this.send(sender, { type: "error", code: "account-in-use" });
        player.sub = account.sub;
        // The account's photo replaces the one set in the room.
        player.photo = null;
        await this.ctx.storage.delete(PHOTO_PREFIX + player.id);
        this.applyAccount(player, account);
        await this.tellAccount(account.sub, true);
        break;
      }
      case "rename-self": {
        if (sender.state?.kind !== "player") return;
        const playerId = sender.state.playerId;
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player || player.sub) return;
        const name = this.validateName(sender, msg.name, player.id);
        if (!name) return;
        this.renamePlayer(player, name);
        player.renamed = false;
        break;
      }
      case "leave": {
        if (sender.state?.kind !== "player") return;
        const playerId = sender.state.playerId;
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) return;
        this.leaveSeat(player);
        await this.tellAccount(player.sub, false);
        break;
      }
      case "request-rejoin": {
        if (sender.state?.kind !== "returning") return;
        const playerId = sender.state.playerId;
        const known = [...this.state.players, ...(this.state.formerPlayers ?? [])].find((p) => p.id === playerId);
        if (known?.sub) {
          // An account's seat only goes back to that account, signed in on this phone.
          const account = await this.verifyAccount(sender, msg.idToken);
          if (!account || !this.state || sender.state?.kind !== "returning") return;
          if (account.sub !== known.sub) return this.send(sender, { type: "error", code: "wrong-account" });
        }
        // An account keeps its name; anyone else may come back under a new one.
        const name = known?.sub ? known.name : this.validateName(sender, msg.name, playerId);
        if (!name) return;
        this.state.requests = [...(this.state.requests ?? []).filter((r) => r.id !== playerId), { id: playerId, name }];
        this.state.deniedIds = (this.state.deniedIds ?? []).filter((id) => id !== playerId);
        break;
      }
      case "answer-rejoin": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        const request = this.state.requests?.find((r) => r.id === msg.playerId);
        if (!request) return;
        this.state.requests = this.state.requests!.filter((r) => r.id !== request.id);
        if (!msg.allow) {
          this.state.deniedIds = [...(this.state.deniedIds ?? []), request.id];
          break;
        }
        let player = this.state.players.find((p) => p.id === request.id);
        if (player) {
          player.left = false;
        } else {
          const former = this.state.formerPlayers?.find((p) => p.id === request.id);
          if (!former) break;
          this.state.formerPlayers = this.state.formerPlayers!.filter((p) => p.id !== former.id);
          // Back at the end of the table. Mid-game they sit out until the next one.
          player = { ...former, seat: this.state.players.length, left: false };
          this.state.players.push(player);
          this.state.endedGame = null;
        }
        // The name may have been taken while they were away.
        const name = player.sub
          ? this.claimName(request.name, player.id)
          : this.isNameFree(request.name, player.id)
            ? request.name
            : this.uniqueName(request.name, player.id);
        if (player.name !== name) this.renamePlayer(player, name);
        await this.tellAccount(player.sub, true);
        for (const c of this.getConnections<ConnState>()) {
          if (c.state?.kind === "returning" && c.state.playerId === player.id) {
            c.setState({ kind: "player", playerId: player.id });
            player.connected = true;
          }
        }
        break;
      }
      case "close-room": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        await this.releaseAccounts();
        this.state = null;
        this.game = null;
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        for (const conn of this.getConnections<ConnState>()) {
          this.send(conn, { type: "error", code: "room-closed" });
          conn.close(1000, "room-closed");
        }
        return;
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
        await this.tellAccount(this.state.players.find((p) => p.id === msg.playerId)?.sub, false);
        this.state.players = this.state.players.filter((p) => p.id !== msg.playerId);
        this.state.requests = this.state.requests?.filter((r) => r.id !== msg.playerId);
        await this.ctx.storage.delete(PHOTO_PREFIX + msg.playerId);
        this.reseat();
        for (const c of this.getConnections<ConnState>()) {
          if ((c.state?.kind === "player" || c.state?.kind === "returning") && c.state.playerId === msg.playerId) {
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
      case "rename-player": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        const player = this.state.players.find((p) => p.id === msg.playerId);
        // An account's name is the account's to change.
        if (!player || player.sub) return;
        const name = this.validateName(sender, msg.name, player.id);
        if (!name) return;
        this.renamePlayer(player, name);
        break;
      }
      case "set-photo": {
        const ownId = sender.state?.kind === "player" ? sender.state.playerId : null;
        const playerId = isHost ? msg.playerId : ownId;
        const player = this.state.players.find((p) => p.id === playerId);
        // Account players use their account's photo.
        if (!player || player.sub) return;
        if (msg.data === null) {
          player.photo = null;
          await this.ctx.storage.delete(PHOTO_PREFIX + player.id);
          break;
        }
        if (!(await this.storePhoto(player, msg.data))) return;
        break;
      }
      case "open-ballot": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        const step = this.game?.step;
        if (!this.game || step?.kind !== "vote") return;
        const living = this.game.players.filter((p) => p.alive).map((p) => p.id);
        this.state.ballot = {
          voterIds: living.filter((id) => !step.cannotVote.includes(id)),
          candidateIds: living,
          votes: {},
        };
        break;
      }
      case "close-ballot": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        this.state.ballot = null;
        break;
      }
      case "cast-vote":
      case "set-vote": {
        const ballot = this.state.ballot;
        if (!ballot) return;
        let voterId: string;
        if (msg.type === "set-vote") {
          if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
          voterId = msg.voterId;
        } else {
          if (sender.state?.kind !== "player") return;
          voterId = sender.state.playerId;
        }
        if (!ballot.voterIds.includes(voterId)) return;
        if (msg.type === "set-vote" && msg.clear) {
          delete ballot.votes[voterId];
          break;
        }
        if (msg.targetId !== null && !ballot.candidateIds.includes(msg.targetId)) return;
        ballot.votes[voterId] = msg.targetId;
        break;
      }
      case "set-timer": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        if (msg.seconds === null) {
          this.state.timer = null;
          break;
        }
        const seconds = Math.round(msg.seconds);
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_TIMER_SECONDS) return;
        this.state.timer = { endsAt: Date.now() + seconds * 1000, remainingMs: seconds * 1000, durationMs: seconds * 1000 };
        break;
      }
      case "pause-timer": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        const timer = this.state.timer;
        if (!timer || timer.endsAt === null) return;
        this.state.timer = { ...timer, endsAt: null, remainingMs: Math.max(0, timer.endsAt - Date.now()) };
        break;
      }
      case "resume-timer": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        const timer = this.state.timer;
        if (!timer || timer.endsAt !== null) return;
        this.state.timer = { ...timer, endsAt: Date.now() + timer.remainingMs };
        break;
      }
      default:
        return;
    }

    // A ballot and its countdown belong to one vote: any change to the game ends them.
    if (this.state.game?.log.length !== logLength) {
      this.state.ballot = null;
      this.state.timer = null;
    }

    await this.persist();
    this.broadcastViews();
  }

  /** Serves player photos at /parties/main/:room/photo/:playerId. */
  async onRequest(request: Request) {
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

  async onAlarm() {
    const anyoneHere = [...this.getConnections()].length > 0;
    if (anyoneHere) {
      await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }
    await this.releaseAccounts();
    await this.ctx.storage.deleteAll();
    this.state = null;
  }

  // --- called by AccountServer (party/account.ts) ---

  /** Whether this account has a seat here, and whether a game is on. */
  async accountSeat(sub: string) {
    const player = this.state?.players.find((p) => p.sub === sub && !p.left);
    return player ? { inGame: !!this.state!.game } : null;
  }

  /**
   * The account signed in on another device and chose not to play from it:
   * the old device leaves (mid-game the game master plays their part).
   */
  async releaseAccount(sub: string) {
    const player = this.state?.players.find((p) => p.sub === sub && !p.left);
    if (!player) return;
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.kind === "player" && c.state.playerId === player.id) {
        this.send(c, { type: "error", code: "left-elsewhere" });
        c.setState({ kind: "guest" });
      }
    }
    this.leaveSeat(player);
    await this.persist();
    this.broadcastViews();
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

  private addPlayer(name: string, manual: boolean, device?: { id: string; token: string }) {
    const player: StoredPlayer = {
      id: device?.id ?? crypto.randomUUID(),
      token: manual ? null : (device?.token ?? crypto.randomUUID()),
      name,
      seat: this.state!.players.length,
      connected: !manual,
      manual,
      photo: null,
      left: false,
    };
    this.state!.players.push(player);
    return player;
  }

  private validateName(conn: Conn, input: unknown, selfId?: string): string | null {
    const name = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      this.send(conn, { type: "error", code: "invalid-name" });
      return null;
    }
    if (!this.isNameFree(name, selfId)) {
      this.send(conn, { type: "error", code: "name-taken" });
      return null;
    }
    return name;
  }

  private isNameFree(name: string, selfId?: string) {
    return !this.state!.players.some((p) => p.id !== selfId && p.name.toLowerCase() === name.toLowerCase());
  }

  /** "Name 2", "Name 3"… the first one nobody else uses. */
  private uniqueName(base: string, selfId?: string) {
    for (let n = 2; ; n++) {
      const suffix = ` ${n}`;
      const name = base.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix;
      if (this.isNameFree(name, selfId)) return name;
    }
  }

  /**
   * The name an account gets. Accounts have priority: a player without one
   * who uses that name is renamed (and can pick another). If another account
   * already has it, this one gets a number instead.
   */
  private claimName(wanted: string, selfId?: string) {
    const holder = this.state!.players.find((p) => p.id !== selfId && p.name.toLowerCase() === wanted.toLowerCase());
    if (!holder) return wanted;
    if (holder.sub) return this.uniqueName(wanted, selfId);
    this.renamePlayer(holder, this.uniqueName(wanted, holder.id));
    holder.renamed = true;
    return wanted;
  }

  /** Checks an ID token from the auth server. Accounts are off when no client id is set. */
  private async verifyAccount(conn: Conn, idToken: unknown) {
    const clientId = this.env.AUTH_CLIENT_ID;
    const account = clientId ? await verifyIdToken(idToken, { issuer: this.env.AUTH_ISSUER || DEFAULT_ISSUER, clientId }) : null;
    if (!account) this.send(conn, { type: "error", code: "invalid-account" });
    return account;
  }

  /** A player (current or former) signed in with this account. */
  private findAccount(sub: string) {
    return [...this.state!.players, ...(this.state!.formerPlayers ?? [])].find((p) => p.sub === sub);
  }

  /** Keeps a player's name and photo in step with their account. */
  private applyAccount(player: StoredPlayer, account: Account) {
    player.picture = account.picture;
    const name = this.claimName(account.name, player.id);
    if (name !== player.name) this.renamePlayer(player, name);
  }

  /** Saves a photo sent as a data URL. Returns false when it isn't a valid, small image. */
  private async storePhoto(player: StoredPlayer, data: unknown) {
    const valid =
      typeof data === "string" &&
      data.length <= MAX_PHOTO_LENGTH &&
      /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(data);
    if (!valid) return false;
    await this.ctx.storage.put(PHOTO_PREFIX + player.id, data);
    player.photo = Date.now();
    return true;
  }

  /** Names are part of the game setup too, so the game screen follows. */
  private renamePlayer(player: StoredPlayer, name: string) {
    player.name = name;
    for (const game of [this.state!.game, this.state!.endedGame]) {
      const entry = game?.setup.players.find((p) => p.id === player.id);
      if (entry) entry.name = name;
    }
    if (this.state!.game) this.game = replay(this.state!.game.setup, this.state!.game.log);
  }

  /** A player leaves: mid-game they stay in it for the game master to play; in the lobby they're remembered. */
  private leaveSeat(player: StoredPlayer) {
    const s = this.state!;
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.kind === "player" && c.state.playerId === player.id) c.setState({ kind: "returning", playerId: player.id });
    }
    player.connected = false;
    if (s.game) {
      // The game needs everyone it was dealt with: the game master plays their part.
      player.left = true;
    } else {
      // Remembered (photo included) so they can ask to come back.
      s.endedGame = null;
      s.players = s.players.filter((p) => p.id !== player.id);
      s.formerPlayers = [...(s.formerPlayers ?? []).filter((p) => p.id !== player.id), player];
      this.reseat();
    }
  }

  /** Tells an account's server whether it has a seat in this room (see party/account.ts). */
  private async tellAccount(sub: string | undefined, seated: boolean) {
    if (!sub) return;
    try {
      const account = await getServerByName(this.env.Account, sub);
      await (seated ? account.addRoom(this.name) : account.removeRoom(this.name));
    } catch {
      // Only used to warn a new device; the room works without it.
    }
  }

  /** The room is going away: its accounts no longer have a seat here. */
  private async releaseAccounts() {
    for (const p of this.state?.players ?? []) await this.tellAccount(p.sub, false);
  }

  private reseat() {
    this.state!.players.forEach((p, i) => (p.seat = i));
  }

  private viewFor(conn: Conn): RoomView {
    const s = this.state!;
    const players = s.players
      .map(
        ({ id, name, seat, connected, manual, photo, left, sub, picture }): PublicPlayer => ({
          id,
          name,
          seat,
          connected,
          manual,
          photo: photo ?? null,
          left: !!left,
          account: !!sub,
          picture: sub ? (picture ?? null) : null,
        }),
      )
      .sort((a, b) => a.seat - b.seat);
    const phase = !this.game ? "lobby" : this.game.winner ? "ended" : "playing";
    const base = { code: s.code, phase, locked: s.locked, players, timer: s.timer ?? null, serverNow: Date.now() } as const;
    if (conn.state?.kind === "host") {
      return {
        ...base,
        kind: "host",
        game: this.game,
        actionCount: s.game?.log.length ?? 0,
        canResume: !!s.endedGame,
        ballot: s.ballot ?? null,
        requests: s.requests ?? [],
      };
    }
    const state = conn.state;
    const me = state?.kind === "player" ? players.find((p) => p.id === state.playerId) : undefined;
    const info = me && this.game ? playerInfo(this.game, me.id) : null;
    const ballot = s.ballot;
    const phoneBallot =
      ballot && me
        ? {
            candidateIds: ballot.candidateIds,
            canVote: ballot.voterIds.includes(me.id),
            voted: me.id in ballot.votes,
            targetId: ballot.votes[me.id] ?? null,
            answered: ballot.voterIds.filter((id) => id in ballot.votes).length,
            voters: ballot.voterIds.length,
          }
        : null;
    let rejoin: PlayerView["rejoin"] = null;
    if (state?.kind === "returning") {
      const request = s.requests?.find((r) => r.id === state.playerId);
      const known = [...s.players, ...(s.formerPlayers ?? [])].find((p) => p.id === state.playerId);
      rejoin = {
        name: request?.name ?? known?.name ?? "",
        account: !!known?.sub,
        status: request ? "pending" : s.deniedIds?.includes(state.playerId) ? "denied" : "idle",
      };
    }
    return {
      ...base,
      kind: "player",
      me: me ?? null,
      info,
      game: this.game ? publicGame(this.game) : null,
      ballot: phoneBallot,
      rejoin,
      renamed: !!(me && s.players.find((p) => p.id === me.id)?.renamed),
    };
  }

  /** Every socket gets its own filtered view, so secrets never reach the wrong phone. */
  private broadcastViews() {
    for (const conn of this.getConnections<ConnState>()) {
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
    await this.ctx.storage.put(STORAGE_KEY, this.state);
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }
}

export { AccountServer } from "./account";

/** Routes /parties/main/:room to that room's RoomServer, /parties/account/:sub to an AccountServer. */
export default {
  async fetch(request: Request, env: Env) {
    return (await routePartykitRequest(request, env)) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/** Card dealing uses the platform's secure random source. */
function secureRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
