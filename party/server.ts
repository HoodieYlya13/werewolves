import { getServerByName, routePartykitRequest, Server, type Connection, type ConnectionContext } from "partyserver";
import {
  applyAction,
  assignRoles,
  dealRoles,
  ENGINE_VERSION,
  EngineError,
  playerInfo,
  publicGame,
  replay,
  teamOf,
  upgradeLog,
  type Action,
  type GameSetup,
  type GameState,
} from "../lib/engine";
import type { Account } from "../lib/account";
import { verifyTicket } from "../lib/ticket";
import { workerTicketKey } from "./keys";
import type { Ballot, Timer } from "../lib/ballot";
import { deleteResult, saveResult, type GameResult } from "../lib/stats";
import {
  MAX_NAME_LENGTH,
  MAX_PHOTO_LENGTH,
  type ClientMessage,
  type ErrorCode,
  type PlayerView,
  type PublicPlayer,
  type RejoinRequest,
  type RoomView,
  type SeatStatus,
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
  /** The account's first name and username: the seat's name is built from them. */
  accountName?: string;
  username?: string | null;
  /** Plays under the username rather than the first name (the player's choice). */
  showUsername?: boolean;
  /** Lost their name to someone who signed in with it. */
  renamed?: boolean;
};

type StoredGame = {
  setup: GameSetup;
  log: Action[];
  /** Missing on games started before stats were recorded. */
  id?: string;
  startedAt?: number;
  /** What was last saved to the stats database ("" or missing: nothing). */
  recorded?: string;
  /** The engine the log was written for (missing: 1). See upgradeLog. */
  engine?: number;
};

/** A game saved by an older engine, rewritten for this one; null if it no longer fits. */
function upgradeGame(game: StoredGame | null | undefined): StoredGame | null {
  if (!game || (game.engine ?? 1) >= ENGINE_VERSION) return game ?? null;
  // Before version 2, the Mayor was called the Sheriff.
  const { sheriff, ...settings } = game.setup.settings as typeof game.setup.settings & { sheriff?: boolean };
  const setup = sheriff === undefined ? game.setup : { ...game.setup, settings: { ...settings, mayor: sheriff } };
  const log = upgradeLog(setup, game.log);
  return log ? { ...game, setup, log, engine: ENGINE_VERSION } : null;
}

/**
 * Everything the room persists. Secrets (tokens) never leave the server.
 * The game is stored as setup + action log; its state is rebuilt by replaying.
 */
type RoomState = {
  code: string;
  hostToken: string;
  /** The game master's account, when they're signed in. */
  hostSub?: string;
  locked: boolean;
  players: StoredPlayer[];
  game: StoredGame | null;
  /** The game "End game" closed, so a misclick can be taken back. */
  endedGame?: StoredGame | null;
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
  /**
   * `pendingLink`: signed in with the game master's account, which links to
   * this seat once the master's screen lets it go (see completePendingLinks).
   */
  | { kind: "player"; playerId: string; pendingLink?: Account }
  /** Someone who left: they see the room but need the game master's OK to come back. */
  | { kind: "returning"; playerId: string }
  /** An account's seat, on a phone that hasn't proved the account yet (see `unlock`). */
  | { kind: "locked"; playerId: string }
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
  /**
   * Tickets already used here, until they expire. In memory: a room that
   * hibernates forgets them, and their one-minute expiry still applies.
   */
  private usedTickets = new Map<string, number>();
  /** Writes to the stats database, one at a time and in order. */
  private recording: Promise<void> = Promise.resolve();

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
      if (ticket && this.state) return this.takeHost(conn, ticket);
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
      // An account's seat needs the account too: the phone's saved token alone
      // would outlive signing out, an expired sign-in or cleared cookies.
      if (player.sub && (await workerTicketKey(this.env))) {
        conn.setState({ kind: "locked", playerId: player.id });
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
        const canJoin = () => ["guest", "returning", "locked"].includes(sender.state?.kind ?? "");
        if (!canJoin()) return;
        const account = msg.ticket === undefined ? null : await this.verifyAccount(sender, msg.ticket);
        if (msg.ticket !== undefined && !account) return;
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
        if (account) {
          // The game master's own account can't also play.
          if (account.sub === this.state.hostSub) return this.send(sender, { type: "error", code: "account-is-host" });
          if (!(await this.checkOtherRoom(sender, account.sub, msg.leaveOther))) return;
          if (!this.state || !canJoin()) return;
        }
        const showUsername = !!msg.showUsername && !!account?.username;
        const name = account
          ? this.claimAccountName({ accountName: account.name, username: account.username, showUsername })
          : this.validateName(sender, msg.name);
        if (!name) return;
        const { deviceId, token } = sender.state?.kind === "guest" ? sender.state : {};
        const taken = [...this.state.players, ...(this.state.formerPlayers ?? [])].some((p) => p.id === deviceId);
        const player = this.addPlayer(name, false, deviceId && token && !taken ? { id: deviceId, token } : undefined);
        if (account) {
          player.sub = account.sub;
          player.picture = account.picture;
          player.accountName = account.name;
          player.username = account.username;
          player.showUsername = showUsername;
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
        const account = await this.verifyAccount(sender, msg.ticket);
        if (!account || !this.state || sender.state?.kind !== "player") return;
        const playerId = sender.state.playerId;
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) return;
        // Already this account's seat: the name or photo changed on the account page.
        if (player.sub === account.sub) {
          this.applyAccount(player, account);
          break;
        }
        const other = this.findAccount(account.sub);
        if (player.sub || other) return this.send(sender, { type: "error", code: "account-in-use" });
        if (!(await this.checkOtherRoom(sender, account.sub, msg.leaveOther))) return;
        if (!this.state || sender.state?.kind !== "player" || player.sub) return;
        if (account.sub === this.state.hostSub) {
          // Signing in here signs the account out on the game master's screen
          // (one device per account); the seat becomes the account's then.
          sender.setState({ kind: "player", playerId, pendingLink: account });
          return this.send(sender, { type: "error", code: "account-is-host" });
        }
        await this.linkSeat(player, account);
        break;
      }
      case "unlock": {
        if (sender.state?.kind !== "locked") return;
        const playerId = sender.state.playerId;
        const account = await this.verifyAccount(sender, msg.ticket);
        if (!account || !this.state || sender.state?.kind !== "locked") return;
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) return;
        if (player.sub !== account.sub) return this.send(sender, { type: "error", code: "wrong-account" });
        if (player.left) {
          sender.setState({ kind: "returning", playerId });
          break;
        }
        this.applyAccount(player, account);
        player.connected = true;
        sender.setState({ kind: "player", playerId });
        await this.tellAccount(player.sub, true);
        break;
      }
      case "show-username": {
        if (sender.state?.kind !== "player") return;
        const playerId = sender.state.playerId;
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player?.sub || !player.accountName) return;
        player.showUsername = msg.value === true && !!player.username;
        const name = this.claimAccountName({ ...player, accountName: player.accountName }, player.id);
        if (name !== player.name) this.renamePlayer(player, name);
        this.untangleNames(player.accountName);
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
          const account = await this.verifyAccount(sender, msg.ticket);
          if (!account || !this.state || sender.state?.kind !== "returning") return;
          if (account.sub !== known.sub) return this.send(sender, { type: "error", code: "wrong-account" });
          if (!(await this.checkOtherRoom(sender, account.sub, msg.leaveOther))) return;
          if (!this.state || sender.state?.kind !== "returning") return;
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
          ? this.claimAccountName({ ...player, accountName: player.accountName ?? request.name }, player.id)
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
      case "host-account": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        const previous = this.state.hostSub;
        if (msg.ticket === null) {
          delete this.state.hostSub;
          await this.tellAccount(previous, false);
          await this.completePendingLinks();
          break;
        }
        const account = await this.verifyAccount(sender, msg.ticket);
        if (!account || !this.state) return;
        // Playing in this room already: one role per account.
        if (this.state.players.some((p) => p.sub === account.sub && !p.left)) {
          return this.send(sender, { type: "error", code: "account-in-use" });
        }
        this.state.hostSub = account.sub;
        if (previous !== account.sub) await this.tellAccount(previous, false);
        // The account server knows the master's room too, to ask a new device about it.
        await this.tellAccount(account.sub, true);
        await this.completePendingLinks();
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
          this.state.game = { setup, log: [], id: crypto.randomUUID(), startedAt: Date.now(), engine: ENGINE_VERSION };
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
        if (!this.game) return;
        const living = this.game.players.filter((p) => p.alive).map((p) => p.id);
        if (step?.kind === "mayor-election") {
          const wanted = Array.isArray(msg.candidateIds) ? msg.candidateIds : [];
          const candidateIds = living.filter((id) => wanted.includes(id));
          if (candidateIds.length === 0) return;
          this.state.ballot = { kind: "mayor", voterIds: living, candidateIds, votes: {} };
          break;
        }
        if (step?.kind !== "vote") return;
        this.state.ballot = {
          kind: "vote",
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
        // A Mayor is always elected: "no one" is only for the day's vote.
        if (msg.targetId === null ? ballot.kind === "mayor" : !ballot.candidateIds.includes(msg.targetId)) return;
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
    this.recordResult();
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
  private async seatStatus(request: Request) {
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
    const anyoneHere = [...this.getConnections()].length > 0;
    if (anyoneHere) {
      await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }
    await this.releaseAccounts();
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
    this.closeHosts("host-moved");
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
      this.broadcastViews();
      return false;
    }
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.kind === "player" && c.state.playerId === player.id) {
        this.send(c, { type: "error", code: reason });
        c.setState({ kind: "guest" });
      }
    }
    this.leaveSeat(player);
    await this.persist();
    this.broadcastViews();
    return false;
  }

  // --- stats ---

  /**
   * Keeps the stats database in step with the game: saved once it has a
   * winner, rewritten if the ending is undone and replayed, deleted if it's
   * undone for good. Runs after every change; most of them write nothing.
   */
  private recordResult() {
    const url = this.env.POSTGRES_URL;
    if (!url) return;
    this.recording = this.recording
      .then(() => this.writeResult(url))
      .catch((error) => console.error("Saving the game's result failed:", error));
    this.ctx.waitUntil(this.recording);
  }

  private async writeResult(url: string) {
    const stored = this.state?.game;
    if (!stored || !this.game) return;
    stored.id ??= crypto.randomUUID();
    const result = this.game.winner ? this.resultOf(stored) : null;
    // A game with nobody signed in has no one's stats to count.
    const worth = result && (result.players.length > 0 || result.masterSub);
    const signature = worth ? JSON.stringify(result) : "";
    if (signature === (stored.recorded ?? "")) return;
    if (worth) await saveResult(url, result);
    else await deleteResult(url, stored.id);
    stored.recorded = signature;
    if (this.state) await this.ctx.storage.put(STORAGE_KEY, this.state);
  }

  private resultOf(stored: StoredGame): GameResult {
    const s = this.state!;
    const game = this.game!;
    const winners = new Set(game.winner!.playerIds);
    const seats = [...s.players, ...(s.formerPlayers ?? [])];
    const players = new Map<string, GameResult["players"][number]>();
    for (const p of game.players) {
      const seat = seats.find((x) => x.id === p.id);
      if (!seat?.sub || seat.sub === s.hostSub) continue;
      players.set(seat.sub, { sub: seat.sub, role: p.role, team: teamOf(game, p), won: winners.has(p.id), survived: p.alive, left: !!seat.left });
    }
    return {
      id: stored.id!,
      room: s.code,
      theme: stored.setup.settings.theme,
      startedAt: stored.startedAt ?? Date.now(),
      winnerTeam: game.winner!.team,
      playerCount: game.players.length,
      masterSub: s.hostSub ?? null,
      players: [...players.values()],
    };
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
  private claimName(wanted: string, selfId?: string, username?: string | null) {
    const same = (name: string | undefined) => name?.toLowerCase() === wanted.toLowerCase();
    const others = this.state!.players.filter((p) => p.id !== selfId);
    // Accounts with the same first name: each shows its username, "Ylya (hy13)".
    const namesakes = others.filter((p) => p.sub && !p.showUsername && (same(p.accountName) || same(p.name)));
    if (namesakes.length > 0) {
      for (const p of namesakes) {
        const named = p.username && this.withUsername(wanted, p.username, p.id);
        if (named && named !== p.name) this.renamePlayer(p, named);
      }
      return (username && this.withUsername(wanted, username, selfId)) || this.uniqueName(wanted, selfId);
    }
    // A guest using the name gives it up, and is told; an account (by its username) keeps it.
    const holder = others.find((p) => same(p.name));
    if (!holder) return wanted;
    if (holder.sub) return this.uniqueName(wanted, selfId);
    this.renamePlayer(holder, this.uniqueName(wanted, holder.id));
    holder.renamed = true;
    return wanted;
  }

  /**
   * The name an account plays under: its username when the player chose it
   * (unique, so nothing to tell apart), its first name otherwise.
   */
  private claimAccountName(
    { accountName, username, showUsername }: Pick<StoredPlayer, "username" | "showUsername"> & { accountName: string },
    selfId?: string,
  ) {
    if (showUsername && username) return this.claimName(username.slice(0, MAX_NAME_LENGTH), selfId);
    return this.claimName(accountName, selfId, username);
  }

  /** An account told apart from a namesake who now plays under their username gets its plain first name back. */
  private untangleNames(accountName: string) {
    const same = (name?: string) => name?.toLowerCase() === accountName.toLowerCase();
    const namesakes = this.state!.players.filter((p) => p.sub && !p.showUsername && same(p.accountName));
    const [only] = namesakes;
    if (namesakes.length === 1 && only.name !== accountName && this.isNameFree(accountName, only.id)) {
      this.renamePlayer(only, accountName);
    }
  }

  /** "Ylya (hy13)", if it fits and nobody else has it. */
  private withUsername(name: string, username: string, selfId?: string) {
    const named = `${name} (${username})`;
    return named.length <= MAX_NAME_LENGTH && this.isNameFree(named, selfId) ? named : null;
  }

  /** Checks an ID token from the auth server. Accounts are off when no client id is set. */
  /** The account a page's ticket stands for (lib/ticket.ts). Each ticket works once, in this room only. */
  private async verifyAccount(conn: Conn, token: unknown): Promise<Account | null> {
    const ticket = await verifyTicket(await workerTicketKey(this.env), token, { room: this.name });
    const now = Date.now() / 1000;
    for (const [jti, exp] of this.usedTickets) if (exp < now) this.usedTickets.delete(jti);
    if (!ticket || this.usedTickets.has(ticket.jti)) {
      this.send(conn, { type: "error", code: "invalid-account" });
      return null;
    }
    this.usedTickets.set(ticket.jti, ticket.exp);
    return { sub: ticket.sub, name: ticket.name, picture: ticket.picture, username: ticket.username };
  }

  /**
   * A device opens the room as its game master with a ticket from the
   * master's account (after "Run it from here" on that device). It gets a new
   * master key; any other master screen stops.
   */
  private async takeHost(conn: Conn, ticket: string) {
    const account = await this.verifyAccount(conn, ticket);
    const s = this.state;
    if (!account || !s || s.hostSub !== account.sub) return this.reject(conn, "not-host");
    s.hostToken = crypto.randomUUID();
    this.closeHosts("host-moved", conn);
    conn.setState({ kind: "host" });
    await this.persist();
    this.send(conn, { type: "host-token", token: s.hostToken });
    this.send(conn, { type: "view", view: this.viewFor(conn) });
  }

  /** Ends every master connection but `except`. */
  private closeHosts(code: ErrorCode, except?: Conn) {
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.kind === "host" && c.id !== except?.id) this.reject(c, code);
    }
  }

  /** A guest's seat becomes an account's: its name and photo from now on. */
  private async linkSeat(player: StoredPlayer, account: Account) {
    player.sub = account.sub;
    // The account's photo replaces the one set in the room.
    player.photo = null;
    await this.ctx.storage.delete(PHOTO_PREFIX + player.id);
    this.applyAccount(player, account);
    await this.tellAccount(account.sub, true);
  }

  /** The game master's account changed: seats waiting for it get linked now. */
  private async completePendingLinks() {
    for (const conn of this.getConnections<ConnState>()) {
      const state = conn.state;
      if (state?.kind !== "player" || !state.pendingLink) continue;
      const account = state.pendingLink;
      if (account.sub === this.state!.hostSub) continue;
      conn.setState({ kind: "player", playerId: state.playerId });
      const player = this.state!.players.find((p) => p.id === state.playerId);
      if (player && !player.sub && !this.findAccount(account.sub)) await this.linkSeat(player, account);
    }
  }

  /** A player (current or former) signed in with this account. */
  private findAccount(sub: string) {
    return [...this.state!.players, ...(this.state!.formerPlayers ?? [])].find((p) => p.sub === sub);
  }

  /** Keeps a player's name and photo in step with their account. */
  private applyAccount(player: StoredPlayer, account: Account) {
    player.picture = account.picture;
    player.accountName = account.name;
    player.username = account.username;
    const name = this.claimAccountName({ ...player, accountName: account.name }, player.id);
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

  /**
   * One room at a time per account: joining here while seated in another
   * room asks first (`other-room`), then leaves it once confirmed with
   * `leaveOther`. Returns false when it asked.
   */
  private async checkOtherRoom(conn: Conn, sub: string, leaveOther: boolean | undefined) {
    try {
      const account = await getServerByName(this.env.Account, sub);
      if (leaveOther) {
        await account.releaseOtherRooms(this.name);
        return true;
      }
      const other = await account.otherSeat(this.name);
      if (!other) return true;
      this.send(conn, { type: "other-room", room: other.room, inGame: other.inGame });
      return false;
    } catch {
      // The account's server is unreachable: don't block the game over it.
      return true;
    }
  }

  /** The room is going away: its accounts no longer have a seat here. */
  private async releaseAccounts() {
    for (const p of this.state?.players ?? []) await this.tellAccount(p.sub, false);
    await this.tellAccount(this.state?.hostSub, false);
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
            kind: ballot.kind ?? "vote",
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
    const seat = state?.kind === "locked" ? s.players.find((p) => p.id === state.playerId) : null;
    return {
      ...base,
      kind: "player",
      me: me ?? null,
      lockedSeat: seat ? { name: seat.name, picture: seat.picture ?? null } : null,
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
