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
  daysBy,
  killersOf,
  suggestedDeck,
  upgradeLog,
  type Action,
  type GameSetup,
  type GameState,
} from "../lib/engine";
import type { Account } from "../lib/account";
import { verifyTicket } from "../lib/ticket";
import { workerTicketKey } from "./keys";
import type { Ballot, Timer } from "../lib/ballot";
import { deleteResult, hashClaimCode, saveResult, type GameResult } from "../lib/stats";
import { friendsAmong, profilePeek, recordInvites, requestFriend, saveAccount } from "../lib/friends";
import { sendPushes } from "./push";
import * as auto from "../lib/auto";
import { sceneFor } from "../lib/soundtrack";
import { themeDictionary } from "../lib/themes";
import en from "../lib/i18n/dictionaries/en";
import fr from "../lib/i18n/dictionaries/fr";
import { isLocale, type Locale } from "../lib/i18n/config";
import {
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_REQUESTS,
  MAX_PHOTO_LENGTH,
  type ClientMessage,
  type ErrorCode,
  type PlayerView,
  type PublicPlayer,
  type JoinRequest,
  type RoomView,
  type SeatStatus,
  type ServerMessage,
  type StartGame,
  type FriendFace,
  type RoomMode,
} from "../lib/protocol";

/** Rooms with nobody connected are wiped after this, freeing the code. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "room";
/** Friend requests and invite batches, per connection per minute. */
const FRIEND_CALLS_PER_MINUTE = 10;
/** Friends invited in one go. */
const MAX_INVITES = 30;

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
  /** The phone the game master gave this seat to: it connects with its own device id. */
  deviceId?: string;
};

/** A request as the room keeps it: a new phone's account and device token stay here. */
type StoredRequest = JoinRequest & { signedIn?: Account; showUsername?: boolean; token?: string };

type StoredGame = {
  setup: GameSetup;
  log: Action[];
  /** Missing on games started before stats were recorded. */
  id?: string;
  startedAt?: number;
  /** What was last saved to the stats database ("" or missing: nothing). */
  recorded?: string;
  /**
   * Guest seats' claim codes, by player id: sent only to that seat's phone,
   * to claim the seat after signing in (lib/stats.ts). Kept with the game so
   * an undone and replayed ending keeps the same codes.
   */
  claims?: Record<string, string>;
  /** The engine the log was written for (missing: 1). See upgradeLog. */
  engine?: number;
  /** Played without a game master. */
  auto?: auto.AutoConfig;
  /** Who started it (their account): the game master, or the leader without one. */
  organiser?: string | null;
  /** The game master handed the game over: nobody ran it from start to end. */
  masterChanged?: boolean;
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
  /** The game master's account name and photo, for their invites and friend requests. */
  hostFace?: { name: string; picture: string | null; username?: string | null };
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
  requests?: StoredRequest[];
  /** Players and phones whose last request the game master refused, so their phone can say so. */
  deniedIds?: string[];
  /**
   * The last seat handed to a new phone mid-game, kept so a misclick can be
   * undone: the seat as it was, the request, and the phones that lost it.
   */
  handover?: { before: StoredPlayer; request: StoredRequest; kicked: string[] } | null;
  /** Without a game master (missing: with one). */
  mode?: RoomMode;
  /** Without a game master: the creator's own seat. */
  hostSeatId?: string | null;
  /** The creator's language: the narrator reads the game in it. */
  locale?: Locale;
  /** The game run by the room, without a game master. */
  auto?: auto.AutoState | null;
  /** Players running for Mayor. */
  candidates?: string[];
  /** When the room is wiped if nobody is here (see onAlarm). */
  expiresAt?: number;
  /** Devices watching the game: game masters who handed it over. */
  spectators?: { id: string; token: string }[];
  /** Without a game master: paused by the leader, or because their device is gone. */
  paused?: "manual" | "leader" | null;
  /** When the leader's device went away (without a game master). */
  leaderLostAt?: number | null;
  /**
   * Without a game master: the leader whose device went silent, after the
   * lead moved to the next phone. They take it back if they return before
   * the new leader resumes the game or declares their sudden death (`settled`).
   */
  lostLeader?: { seatId: string; name: string; settled?: boolean } | null;
  /** Master keys that moved on while their device was gone, and the seat each one played (null: a game master). */
  formerHosts?: Record<string, string | null>;
  /** With a game master: when their screen went away (a dead player takes over after a minute). */
  masterLostAt?: number | null;
  /** …and nobody dead was there to take over: phones may leave. */
  masterGone?: boolean;
  /** With a game master: the dead player who took the game over, whose seat goes once it ends. */
  masterSeatId?: string | null;
  /** With a game master: what phones chose for the step at `at` (players may play on their phones). */
  phonePlays?: { at: number; actions: Record<string, Action>; wolfPicks: Record<string, string> } | null;
};

/** How long the leader's device may be away before the game pauses for it. */
const LEADER_GRACE_MS = 20_000;
/** How long the game master's screen may be away before a dead player takes over. */
const MASTER_GRACE_MS = 60_000;

const PHOTO_PREFIX = "photo:";
const MAX_TIMER_SECONDS = 60 * 60;
/** Past this, a connection's messages are dropped; past five times this, it's closed. */
const MESSAGES_PER_SECOND = 20;

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
  /** Not a player yet. Keeps the device's id, used as the player id if they join. `spectator`: watches the game. */
  | { kind: "guest"; deviceId?: string; token?: string; spectator?: boolean };

const isDeviceId = (value: string | null): value is string => !!value && /^[\w-]{16,64}$/.test(value);

type Conn = Connection<ConnState>;

/**
 * One Durable Object per room code. It hibernates between messages, so all
 * state lives in storage and `onStart` reloads it on every wake-up.
 */
export class RoomServer extends Server<Env> {
  static options = { hibernate: true };

  private state: RoomState | null = null;
  /** Each connection's message count this second (forgotten when the room hibernates, which is fine). */
  private rates = new Map<string, { since: number; count: number }>();
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
        if (this.state.formerHosts && token in this.state.formerHosts) return this.welcomeBack(conn, token);
        return this.reject(conn, params.get("create") === "1" ? "room-taken" : "not-host");
      }
      conn.setState({ kind: "host" });
      this.state.masterLostAt = null;
      this.state.masterGone = false;
      // Without a game master the creator's seat is online again, and their device may read the game out loud.
      const seat = this.hostSeat();
      if (seat) {
        seat.connected = true;
        await this.runAuto();
        await this.persist();
        return this.broadcastViews();
      }
      if (this.state.game) {
        await this.persist();
        this.broadcastViews();
      }
      return this.send(conn, { type: "view", view: this.viewFor(conn) });
    }

    if (!this.state) return this.reject(conn, "room-not-found");

    // A returning phone: same id + token puts it back on its player.
    const id = params.get("id");
    const player = this.state.players.find((p) => p.id === id || (!!id && p.deviceId === id));
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
      // A phone back may be the one to take over a game whose leader or game master is gone.
      if (this.game) await this.runAuto();
      await this.persist();
      return this.broadcastViews();
    }
    // A game master who handed the game over watches it.
    const spectator = this.state.spectators?.find((x) => x.id === id && x.token === token);
    if (spectator) {
      conn.setState({ kind: "guest", deviceId: spectator.id, token: spectator.token, spectator: true });
      return this.send(conn, { type: "view", view: this.viewFor(conn) });
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
    const seat = conn.state?.kind === "host" ? this.hostSeat() : null;
    if (seat && ![...this.getConnections<ConnState>()].some((c) => c.id !== conn.id && c.state?.kind === "host")) {
      seat.connected = false;
      if (this.state?.auto && this.game) this.state.leaderLostAt = Date.now();
      await this.persist();
      // Another device takes over reading the game out loud.
      return this.broadcastViews();
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
      this.broadcastViews();
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

        if (account) {
          // The game master's own account can't also play.
          if (account.sub === this.state.hostSub) return this.send(sender, { type: "error", code: "account-is-host" });
          if (!(await this.checkOtherRoom(sender, account.sub, msg.leaveOther))) return;
          if (!this.state || !canJoin()) return;
        }
        const showUsername = !!msg.showUsername && !!account?.username;
        // A locked room or a game: a new phone asks the game master instead.
        if (this.state.locked || this.state.game) {
          const name = account ? (showUsername ? account.username! : account.name) : this.cleanName(sender, msg.name);
          if (!name) return;
          const state: { deviceId?: string; token?: string } = sender.state?.kind === "guest" ? sender.state : {};
          const id = state.deviceId ?? crypto.randomUUID();
          if (this.tooManyRequests(sender, id)) return;
          const request: StoredRequest = { id, name, kind: "new", account: !!account, token: state.token };
          if (account) Object.assign(request, { signedIn: account, showUsername });
          this.state.requests = [...(this.state.requests ?? []).filter((r) => r.id !== id), request];
          this.state.deniedIds = (this.state.deniedIds ?? []).filter((d) => d !== id);
          sender.setState({ kind: "guest", deviceId: id, token: state.token });
          break;
        }
        const name = account
          ? this.claimAccountName({ accountName: account.name, username: account.username, showUsername })
          : this.validateName(sender, msg.name);
        if (!name) return;
        if (this.isFull(sender)) return;
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
        // A player's own seat, or the creator's without a game master.
        const playerId = isHost ? this.state.hostSeatId : sender.state?.kind === "player" ? sender.state.playerId : null;
        if (!playerId) return;
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
        if (!name || this.tooManyRequests(sender, playerId)) return;
        this.state.requests = [
          ...(this.state.requests ?? []).filter((r) => r.id !== playerId),
          { id: playerId, name, kind: "rejoin", account: !!known?.sub },
        ];
        this.state.deniedIds = (this.state.deniedIds ?? []).filter((id) => id !== playerId);
        break;
      }
      case "undo-handover": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        await this.undoHandover();
        break;
      }
      case "keep-handover": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        this.state.handover = null;
        break;
      }
      case "cancel-request": {
        const id = sender.state?.kind === "guest" ? sender.state.deviceId : sender.state?.kind === "returning" ? sender.state.playerId : undefined;
        if (!id) return;
        this.state.requests = this.state.requests?.filter((r) => r.id !== id);
        break;
      }
      case "answer-request": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        const request = this.state.requests?.find((r) => r.id === msg.requestId);
        if (!request) return;
        if (request.kind === "new") {
          await this.answerNewPhone(sender, request, msg.allow, msg.seatId);
          break;
        }
        // A former player takes a seat again.
        if (msg.allow && !this.state.players.some((p) => p.id === request.id) && this.isFull(sender)) return;
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
          player = { ...former, left: false };
          // Back in their seat. Mid-game they sit out until the next one, at the end of the table.
          if (this.state.game) this.state.players.push(player);
          else this.state.players.splice(Math.min(former.seat, this.state.players.length), 0, player);
          this.reseat();
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
          delete this.state.hostFace;
          this.syncHostSeat();
          await this.tellAccount(previous, false);
          await this.completePendingLinks();
          break;
        }
        const account = await this.verifyAccount(sender, msg.ticket);
        if (!account || !this.state) return;
        // Playing in this room already: one role per account.
        if (this.state.players.some((p) => p.sub === account.sub && !p.left && p.id !== this.state!.hostSeatId && p.id !== this.state!.masterSeatId)) {
          return this.send(sender, { type: "error", code: "account-in-use" });
        }
        this.state.hostSub = account.sub;
        this.state.hostFace = { name: account.name, picture: account.picture, username: account.username };
        this.syncHostSeat();
        if (previous !== account.sub) await this.tellAccount(previous, false);
        // The account server knows the master's room too, to ask a new device about it.
        await this.tellAccount(account.sub, true);
        await this.completePendingLinks();
        break;
      }
      case "set-mode": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        if (isLocale(msg.locale)) this.state.locale = msg.locale;
        if (msg.mode === "auto") {
          if (!this.hostSeat()) {
            if (!this.addHostSeat(sender, msg.name)) return;
            const seat = this.hostSeat()!;
            if (!seat.sub && msg.photo) await this.storePhoto(seat, msg.photo);
          }
          // Everyone plays on their own phone: no seats without one.
          for (const p of this.state.players.filter((p) => p.manual)) await this.dropSeat(p.id);
          this.state.mode = "auto";
        } else {
          await this.removeHostSeat();
          delete this.state.mode;
        }
        // The ended game was played the other way.
        this.state.endedGame = null;
        break;
      }
      case "stand": {
        const id = this.seatOf(sender);
        const game = this.game;
        if (!id || !this.mayorRaceOpen() || !game?.players.find((p) => p.id === id)?.alive) return;
        const others = (this.state.candidates ?? []).filter((c) => c !== id);
        this.state.candidates = msg.value ? [...others, id] : others;
        break;
      }
      case "give-lead": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        if (!(await this.transferLead(msg.playerId))) return this.send(sender, { type: "error", code: "invalid-action" });
        break;
      }
      case "pause": {
        const room = this.autoRoom();
        if (!isHost || !room || this.game!.winner) return;
        const now = Date.now();
        if (msg.value) {
          // By day only: a night stopped halfway would leave everyone with their eyes closed.
          if (this.state.paused || (this.game!.phase.kind === "night" && this.game!.step.kind !== "prologue")) return;
          auto.pause(room, now);
          this.state.paused = "manual";
        } else {
          if (!this.state.paused) return;
          // Resumed without them: the leader whose device went silent comes back as a player.
          if (this.state.lostLeader) this.state.lostLeader.settled = true;
          this.resumeAuto();
          return this.done();
        }
        this.keepAuto(room);
        break;
      }
      case "sudden-death": {
        if (!isHost || !this.autoRoom() || !this.game?.players.find((p) => p.id === msg.playerId)?.alive) return;
        this.suddenDeath(msg.playerId);
        break;
      }
      case "succession": {
        // The new leader's call about the one whose device went silent: out for good, announced like any sudden death.
        const lost = this.state.lostLeader;
        if (!isHost || !lost || lost.settled || !msg.dead) return;
        lost.settled = true;
        if (this.game?.players.find((p) => p.id === lost.seatId)?.alive) this.suddenDeath(lost.seatId);
        else this.resumeAuto();
        break;
      }
      case "set-locale": {
        // The leader or the narrator device picks the narration's language.
        if (!this.autoRoom() || !isLocale(msg.locale) || (!isHost && sender.id !== this.speakerId())) return;
        this.state.locale = msg.locale;
        break;
      }
      case "play":
      case "wolf-pick":
        // With a game master, phones may play too: the game master validates.
        if (!this.state.auto && this.game && this.state.game) {
          const id = this.seatOf(sender);
          const game = this.game;
          if (!id || !auto.actorsOf(game.step).includes(id)) return;
          const at = this.state.game.log.length;
          const plays = this.state.phonePlays?.at === at ? this.state.phonePlays : (this.state.phonePlays = { at, actions: {}, wolfPicks: {} });
          if (msg.type === "wolf-pick") {
            if (!auto.setWolfPick(game, plays.wolfPicks, id, msg.targetId)) return;
            break;
          }
          if (game.step.kind === "wolves" || msg.action.type === "continue") return;
          try {
            applyAction(game, msg.action);
          } catch {
            return this.send(sender, { type: "error", code: "invalid-action" });
          }
          plays.actions[id] = msg.action;
          break;
        }
      // falls through: without a game master, the room plays it.
      case "more-time":
      case "ready":
      case "cue-done": {
        const room = this.autoRoom();
        const id = this.seatOf(sender);
        if (!room) return;
        const ctx = this.autoContext();
        let done = false;
        if (msg.type === "cue-done") done = sender.id === this.speakerId() && auto.cueDone(room, msg.id, ctx);
        else if (!id) return;
        else if (msg.type === "play") done = auto.answer(room, id, msg.action, ctx);
        else if (msg.type === "wolf-pick") done = auto.wolfPick(room, id, msg.targetId, ctx);
        else if (msg.type === "more-time") done = auto.moreTime(room, id, ctx);
        else done = auto.setReady(room, id, msg.value === true, ctx);
        if (!done) return msg.type === "play" ? this.send(sender, { type: "error", code: "invalid-action" }) : undefined;
        break;
      }
      case "add-player": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        // Without a game master everyone needs a phone.
        if (this.state.mode === "auto") return;
        // The ended game no longer matches the table.
        this.state.endedGame = null;
        const name = this.validateName(sender, msg.name);
        if (!name || this.isFull(sender)) return;
        this.addPlayer(name, true);
        break;
      }
      case "remove-player": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        // The creator's own seat goes with the game master's mode.
        if (msg.playerId === this.state.hostSeatId) return;
        this.state.endedGame = null;
        await this.dropSeat(msg.playerId, true);
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
          const config = this.state.mode === "auto" ? auto.cleanAutoConfig(msg.auto) : undefined;
          const setup = this.buildSetup(msg, config);
          this.game = replay(setup, []);
          this.state.game = { setup, log: [], id: crypto.randomUUID(), startedAt: Date.now(), engine: ENGINE_VERSION, auto: config };
          this.state.endedGame = null;
          this.state.handover = null;
          this.state.locked = true;
          this.state.candidates = [];
          this.state.auto = config ? auto.startAuto(config, { random: secureRandom, now: Date.now() }) : null;
          this.state.game.organiser = this.state.hostSub ?? null;
          this.state.spectators = [];
          this.state.paused = null;
          this.state.leaderLostAt = null;
          this.state.lostLeader = null;
          this.state.formerHosts = {};
          this.state.masterLostAt = null;
          this.state.masterGone = false;
          this.state.masterSeatId = null;
          this.state.phonePlays = null;
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
        this.state.handover = null;
        this.state.auto = null;
        this.state.paused = null;
        this.state.spectators = [];
        // A dead player who took the game over runs the room now: they don't play the next one.
        if (this.state.masterSeatId) {
          await this.dropSeat(this.state.masterSeatId);
          this.state.masterSeatId = null;
          this.state.endedGame = null;
        }
        this.state.ballot = null;
        this.state.timer = null;
        this.game = null;
        break;
      }
      case "resume-game": {
        if (!isHost) return this.send(sender, { type: "error", code: "not-host" });
        if (!this.state.endedGame) return;
        this.state.game = this.state.endedGame;
        this.state.endedGame = null;
        this.game = replay(this.state.game.setup, this.state.game.log);
        // Picked up again at the start of the step it stopped on.
        const config = this.state.game.auto;
        this.state.auto = config ? auto.startAuto(config, { random: secureRandom, now: Date.now() }) : null;
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
          const seat = this.seatOf(sender);
          if (!seat) return;
          voterId = seat;
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
      case "add-friend":
        return this.addFriend(sender, isHost, msg.playerId);
      case "invite":
        return this.invite(sender, isHost, msg.subs);
      case "friends-here":
        return this.friendsHere(sender, isHost);
      case "profile":
        return this.profile(sender, isHost, msg.playerId);
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

    if (this.state.auto && this.game) {
      // The room plays the game on, as far as it can go now.
      await this.runAuto();
    } else if (this.state.game?.log.length !== logLength) {
      // A ballot and its countdown belong to one vote: any change to the game ends them.
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
    // A game without a game master moves on by the clock too (and one with a game master checks they're back).
    if (this.state && this.game) {
      await this.runAuto();
      await this.persist(false);
      this.broadcastViews();
      this.recordResult();
    }
    if (this.state && Date.now() < (this.state.expiresAt ?? 0)) return this.scheduleAlarm();
    const anyoneHere = [...this.getConnections()].length > 0;
    if (anyoneHere) {
      if (this.state) await this.persist();
      else await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
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

  // --- friends ---

  /** The account behind a connection: the master's, or the seat's. */
  private accountOf(conn: Conn, isHost: boolean): { sub: string; face: FriendFace } | null {
    const s = this.state!;
    if (isHost) return s.hostSub ? { sub: s.hostSub, face: s.hostFace ?? { name: "", picture: null } } : null;
    const seat = conn.state?.kind === "player" ? s.players.find((p) => p.id === (conn.state as { playerId: string }).playerId) : null;
    return seat?.sub ? { sub: seat.sub, face: { name: seat.accountName ?? seat.name, picture: seat.picture ?? null } } : null;
  }

  /** Friends and invites reach the database and other accounts: a few a minute per connection. */
  private friendCalls = new Map<string, number[]>();
  /** Profiles opened: a database read each, a few more allowed than friend calls. */
  private profileCalls = new Map<string, number[]>();
  private tooManyFriendCalls(conn: Conn) {
    return this.tooManyCalls(this.friendCalls, conn, FRIEND_CALLS_PER_MINUTE);
  }
  private tooManyCalls(calls: Map<string, number[]>, conn: Conn, max: number) {
    const now = Date.now();
    const recent = (calls.get(conn.id) ?? []).filter((t) => now - t < 60_000);
    calls.set(conn.id, [...recent, now]);
    return recent.length >= max;
  }

  /** Asks another signed-in seat, or the game master (null), to be friends. Account ids never reach the phones. */
  private async addFriend(conn: Conn, isHost: boolean, playerId: string | null) {
    const url = this.env.POSTGRES_URL;
    const me = this.accountOf(conn, isHost);
    if (!url || !me || this.tooManyFriendCalls(conn)) return;
    const s = this.state!;
    const target = playerId === null ? s.hostSub : [...s.players, ...(s.formerPlayers ?? [])].find((p) => p.id === playerId)?.sub;
    let result: Awaited<ReturnType<typeof requestFriend>> = "unknown";
    try {
      if (target) result = await requestFriend(url, me.sub, target);
    } catch (error) {
      console.error("Adding a friend failed:", error);
    }
    this.send(conn, { type: "friend-result", result });
    if (target && (result === "sent" || result === "accepted")) {
      try {
        await (await getServerByName(this.env.Account, target)).friendRequest(me.face, result === "accepted");
      } catch {}
    }
  }

  /** Which accounts in the room are already this one's friends, as seats: their "add friend" buttons say so instead. */
  private async friendsHere(conn: Conn, isHost: boolean) {
    const url = this.env.POSTGRES_URL;
    const me = this.accountOf(conn, isHost);
    if (!url || !me || this.tooManyFriendCalls(conn)) return;
    const s = this.state!;
    const seats = s.players.filter((p) => p.sub && p.sub !== me.sub);
    const subs = [...seats.map((p) => p.sub!), ...(s.hostSub && s.hostSub !== me.sub ? [s.hostSub] : [])];
    try {
      const friends = new Set(await friendsAmong(url, me.sub, subs));
      this.send(conn, {
        type: "friends-here",
        playerIds: seats.filter((p) => friends.has(p.sub!)).map((p) => p.id),
        host: !!s.hostSub && friends.has(s.hostSub),
      });
    } catch (error) {
      console.error("Looking up friends failed:", error);
    }
  }

  /** A signed-in seat's profile in brief (or the game master's: null), for anyone in the room; account ids stay here. */
  private async profile(conn: Conn, isHost: boolean, playerId: string | null) {
    const url = this.env.POSTGRES_URL;
    if (!url || this.tooManyCalls(this.profileCalls, conn, 2 * FRIEND_CALLS_PER_MINUTE)) return;
    const s = this.state!;
    const sub = playerId === null ? s.hostSub : [...s.players, ...(s.formerPlayers ?? [])].find((p) => p.id === playerId)?.sub;
    let profile = null;
    try {
      if (sub) profile = await profilePeek(url, this.accountOf(conn, isHost)?.sub ?? null, sub);
    } catch (error) {
      console.error("Looking up a profile failed:", error);
    }
    this.send(conn, { type: "profile", playerId, profile });
  }

  /** Invites friends to this room: on their open pages, and by push where they turned it on. */
  private async invite(conn: Conn, isHost: boolean, subs: unknown) {
    const url = this.env.POSTGRES_URL;
    const me = this.accountOf(conn, isHost);
    if (!url || !me || !Array.isArray(subs) || this.tooManyFriendCalls(conn)) return;
    const s = this.state!;
    const wanted = [...new Set(subs.filter((x): x is string => typeof x === "string"))]
      .slice(0, MAX_INVITES)
      // Already here (playing or running it): nothing to invite to.
      .filter((sub) => sub !== s.hostSub && !this.findAccount(sub));
    let invited: string[] = [];
    try {
      const friends = await friendsAmong(url, me.sub, wanted);
      if (friends.length) invited = await recordInvites(url, me.sub, friends, this.name);
    } catch (error) {
      console.error("Inviting friends failed:", error);
    }
    this.send(conn, { type: "invited", count: invited.length });
    for (const sub of invited) {
      try {
        await (await getServerByName(this.env.Account, sub)).invite(this.name, me.face);
      } catch {}
    }
    this.ctx.waitUntil(sendPushes(this.env, url, invited).catch((error) => console.error("Sending invites failed:", error)));
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
    const result = this.game.winner ? await this.resultOf(stored) : null;
    // A game with nobody signed in and no guest phone has no one's stats to count.
    const worth = result && (result.players.length > 0 || result.guests.length > 0 || result.masterSub || result.organiserSub);
    const signature = worth ? JSON.stringify(result) : "";
    if (signature === (stored.recorded ?? "")) return;
    if (worth) await saveResult(url, result);
    else await deleteResult(url, stored.id);
    stored.recorded = signature;
    if (this.state) await this.ctx.storage.put(STORAGE_KEY, this.state);
    // Guest phones get their claim code now that it can be claimed.
    if (result?.guests.length) this.broadcastViews();
  }

  /** A guest seat's claim code once the game's result is saved, for that seat's phone only. */
  private claimFor(playerId: string): PlayerView["claim"] {
    const stored = this.state?.game;
    const seat = this.state?.players.find((p) => p.id === playerId);
    const code = stored?.claims?.[playerId];
    if (!this.game?.winner || !stored?.recorded || !stored.id || !code || !seat || seat.sub || seat.manual) return null;
    return { gameId: stored.id, code };
  }

  private async resultOf(stored: StoredGame): Promise<GameResult> {
    const s = this.state!;
    const game = this.game!;
    const winners = new Set(game.winner!.playerIds);
    // Without a game master the creator plays, and nobody mastered the game. A
    // game master counts only if they ran it to the end; whoever started it organised it.
    const masterSub = stored.auto || stored.masterChanged ? null : (stored.organiser ?? s.hostSub ?? null);
    const organiserSub = stored.organiser ?? (stored.masterChanged ? null : (s.hostSub ?? null));
    // A seat's account, as counted in the stats (the master's own account never plays).
    const subOf = (id: string) => {
      const sub = seats.find((x) => x.id === id)?.sub;
      return sub && sub !== masterSub ? sub : null;
    };
    const days = daysBy(stored.setup, game.phase);
    const details = (p: (typeof game.players)[number]) => ({
      daysAlive: p.death ? daysBy(stored.setup, p.death.phase) : days,
      deathCause: p.death?.cause ?? null,
      wasMayor: game.events.some((e) => e.type === "mayor" && e.playerId === p.id),
      lover: !!game.lovers?.includes(p.id),
    });
    const seats = [...s.players, ...(s.formerPlayers ?? [])];
    const players = new Map<string, GameResult["players"][number]>();
    for (const p of game.players) {
      const seat = seats.find((x) => x.id === p.id);
      if (!seat?.sub || seat.sub === masterSub) continue;
      players.set(seat.sub, { sub: seat.sub, role: p.role, team: teamOf(game, p), won: winners.has(p.id), survived: p.alive, left: !!seat.left, ...details(p) });
    }
    // Phones without an account: the seat waits for its phone to sign in and claim it.
    const guests: GameResult["guests"] = [];
    for (const p of game.players) {
      const seat = s.players.find((x) => x.id === p.id);
      if (!seat || seat.sub || seat.manual || seat.left) continue;
      const code = ((stored.claims ??= {})[p.id] ??= crypto.randomUUID());
      guests.push({
        playerId: p.id,
        codeHash: await hashClaimCode(code),
        role: p.role,
        team: teamOf(game, p),
        won: winners.has(p.id),
        survived: p.alive,
        left: false,
        ...details(p),
      });
    }
    return {
      id: stored.id!,
      room: s.code,
      theme: stored.setup.settings.theme,
      startedAt: stored.startedAt ?? Date.now(),
      winnerTeam: game.winner!.team,
      playerCount: game.players.length,
      days,
      masterSub,
      organiserSub,
      auto: !!stored.auto,
      players: [...players.values()],
      guests,
      kills: game.players.flatMap((victim) => {
        const victimSub = subOf(victim.id);
        return victimSub && victim.death
          ? killersOf(game, victim).flatMap((id) => {
              const killer = subOf(id);
              return killer && killer !== victimSub ? [{ killer, victim: victimSub, cause: victim.death!.cause }] : [];
            })
          : [];
      }),
    };
  }

  // --- helpers ---

  private buildSetup(start: StartGame, config?: auto.AutoConfig): GameSetup {
    const players = this.state!.players.map(({ id, name, seat }) => ({ id, name, seat }));
    const options = { actorCards: start.actorCards, groups: start.groups };
    if (config) {
      // Without a game master nobody may know who got what: always dealt at random.
      if (start.mode !== "random") throw new EngineError("invalid-setup", "Cards are dealt at random without a game master");
      const deck = config.deck === "hidden" ? suggestedDeck(players.length, config.style, secureRandom, config.exclude) : start.deck;
      return dealRoles(players, deck, start.settings, config.deck === "hidden" ? {} : options, secureRandom);
    }
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

  /** A name as typed, tidied; null (and an error) when it's empty or too long. */
  private cleanName(conn: Conn, input: unknown): string | null {
    const name = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      this.send(conn, { type: "error", code: "invalid-name" });
      return null;
    }
    return name;
  }

  private validateName(conn: Conn, input: unknown, selfId?: string): string | null {
    const name = this.cleanName(conn, input);
    if (!name) return null;
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
    const account = { sub: ticket.sub, name: ticket.name, picture: ticket.picture, username: ticket.username };
    // Friends find and see accounts by what their sign-in says.
    const url = this.env.POSTGRES_URL;
    if (url) this.ctx.waitUntil(saveAccount(url, account).catch((error) => console.error("Saving the account failed:", error)));
    return account;
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

  /**
   * The game master's answer to a new phone (see JoinRequest): a seat of its
   * own, not during a game, or `seatId`, a seat without an account, which
   * moves to this phone (lost cookies, another browser, a friend taking over).
   */
  private async answerNewPhone(host: Conn, request: StoredRequest, allow: boolean, seatId: string | undefined) {
    const s = this.state!;
    const seat = seatId === undefined ? null : s.players.find((p) => p.id === seatId);
    if (allow && (seat ? seat.sub : seatId !== undefined || s.game)) return;
    const account = request.signedIn;
    // That account found its own way in meanwhile, or runs the room.
    if (allow && account && (this.findAccount(account.sub) || account.sub === s.hostSub)) {
      return this.send(host, { type: "error", code: "account-in-use" });
    }
    if (allow && !seat && this.isFull(host)) return;
    s.requests = s.requests!.filter((r) => r.id !== request.id);
    if (!allow) {
      s.deniedIds = [...(s.deniedIds ?? []), request.id];
      return;
    }
    const phones = [...this.getConnections<ConnState>()].filter((c) => c.state?.kind === "guest" && c.state.deviceId === request.id);
    let player: StoredPlayer;
    if (seat) {
      player = seat;
      const before = { ...seat };
      const kicked: string[] = [];
      // Whoever had this seat loses it, their request to come back too.
      for (const c of this.getConnections<ConnState>()) {
        const state = c.state;
        if ((state?.kind === "player" || state?.kind === "returning" || state?.kind === "locked") && state.playerId === seat.id) {
          this.send(c, { type: "error", code: "seat-given" });
          c.setState({ kind: "guest" });
          kicked.push(c.id);
        }
      }
      s.requests = s.requests.filter((r) => r.id !== seat.id);
      seat.token = request.token ?? crypto.randomUUID();
      seat.deviceId = request.id;
      seat.manual = false;
      seat.left = false;
      // The seat takes the new player's name (an account's comes with linking it).
      if (account) await this.linkSeat(seat, account);
      else this.renamePlayer(seat, this.isNameFree(request.name, seat.id) ? request.name : this.uniqueName(request.name, seat.id));
      s.handover = { before, request, kicked };
    } else {
      const name = account
        ? this.claimAccountName({ accountName: account.name, username: account.username, showUsername: request.showUsername })
        : this.isNameFree(request.name)
          ? request.name
          : this.uniqueName(request.name);
      const taken = [...s.players, ...(s.formerPlayers ?? [])].some((p) => p.id === request.id);
      player = this.addPlayer(name, false, request.token && !taken ? { id: request.id, token: request.token } : undefined);
      s.endedGame = null;
      if (account) {
        player.sub = account.sub;
        player.picture = account.picture;
        player.accountName = account.name;
        player.username = account.username;
        player.showUsername = request.showUsername;
        await this.tellAccount(account.sub, true);
      }
    }
    player.connected = phones.length > 0;
    for (const phone of phones) {
      phone.setState({ kind: "player", playerId: player.id });
      this.send(phone, { type: "joined", playerId: player.id, token: player.token! });
    }
  }

  /** A misclicked handover: the seat goes back to who had it, the new phone back to waiting. */
  private async undoHandover() {
    const s = this.state!;
    const handover = s.handover;
    s.handover = null;
    const index = s.players.findIndex((p) => p.id === handover?.before.id);
    if (!handover || index === -1) return;
    const { before, request, kicked } = handover;
    const seat = s.players[index];
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.kind === "player" && c.state.playerId === seat.id) {
        c.setState({ kind: "guest", deviceId: request.id, token: request.token });
      }
    }
    if (seat.sub && seat.sub !== before.sub) await this.tellAccount(seat.sub, false);
    const restored: StoredPlayer = { ...before, seat: seat.seat, connected: false };
    s.players[index] = restored;
    this.renamePlayer(restored, before.name);
    s.requests = [...(s.requests ?? []).filter((r) => r.id !== request.id), request];
    // The phone that lost the seat gets it back, if it's still here.
    for (const c of this.getConnections<ConnState>()) {
      const state = c.state;
      if (state?.kind !== "guest" || !(kicked.includes(c.id) || state.deviceId === before.id || (!!before.deviceId && state.deviceId === before.deviceId))) continue;
      c.setState({ kind: before.left ? "returning" : "player", playerId: before.id });
      if (before.token) this.send(c, { type: "joined", playerId: before.id, token: before.token });
      restored.connected = !before.left;
    }
  }

  private reseat() {
    this.state!.players.forEach((p, i) => (p.seat = i));
  }

  private viewFor(conn: Conn, speakerId = this.speakerId()): RoomView {
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
    const base = {
      code: s.code,
      phase,
      locked: s.locked,
      players,
      timer: s.timer ?? null,
      serverNow: Date.now(),
      mode: s.mode ?? "master",
      candidates: this.game && !this.game.mayorElected ? (s.candidates ?? []) : [],
    } as const;
    if (conn.state?.kind === "host") {
      const seatId = this.hostSeat()?.id ?? null;
      // Without a game master the creator plays: once the game is on, they see only their own seat.
      const playing = !!seatId && !!this.game && !!s.auto;
      return {
        ...base,
        kind: "host",
        game: playing ? null : this.game,
        seatId,
        seat: seatId && this.game ? this.phoneView(base, players, seatId, conn.id === speakerId) : null,
        actionCount: s.game?.log.length ?? 0,
        canResume: !!s.endedGame,
        ballot: playing ? null : (s.ballot ?? null),
        phonePlays: !s.auto && s.phonePlays && s.phonePlays.at === s.game?.log.length ? { actions: s.phonePlays.actions, wolfPicks: s.phonePlays.wolfPicks } : null,
        paused: !!s.paused,
        lostLeader: s.lostLeader && !s.lostLeader.settled ? { name: s.lostLeader.name } : null,
        requests: (s.requests ?? []).map(({ id, name, kind, account }) => ({ id, name, kind: kind ?? "rejoin", account: !!account })),
        handover: s.handover
          ? { name: s.players.find((p) => p.id === s.handover!.before.id)?.name ?? "", seatName: s.handover.before.name }
          : null,
      };
    }
    const state = conn.state;
    const view = this.phoneView(base, players, state?.kind === "player" ? state.playerId : null, conn.id === speakerId, state?.kind === "guest" && !!state.spectator);
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
    let knock: PlayerView["knock"] = null;
    if (state?.kind === "guest" && state.deviceId) {
      const request = s.requests?.find((r) => r.kind === "new" && r.id === state.deviceId);
      if (request) knock = { name: request.name, status: "pending" };
      else if (s.deniedIds?.includes(state.deviceId)) knock = { name: "", status: "denied" };
    }
    const seat = state?.kind === "locked" ? s.players.find((p) => p.id === state.playerId) : null;
    return { ...view, rejoin, knock, lockedSeat: seat ? { name: seat.name, picture: seat.picture ?? null } : null };
  }

  /** How one seat sees the room: public info, its own card, its turn. */
  private phoneView(base: Pick<PlayerView, "code" | "phase" | "locked" | "players" | "timer" | "serverNow" | "mode" | "candidates">, players: PublicPlayer[], playerId: string | null, speaking: boolean, spectator = false): PlayerView {
    const s = this.state!;
    const me = playerId ? players.find((p) => p.id === playerId) : undefined;
    const game = this.game;
    const info = me && game ? playerInfo(game, me.id) : null;
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
    const room = this.autoRoom();
    const dict = room ? this.narration() : null;
    const config = s.game?.auto;
    return {
      ...base,
      kind: "player",
      me: me ?? null,
      lockedSeat: null,
      info,
      game: game ? publicGame(game) : null,
      ballot: phoneBallot,
      rejoin: null,
      knock: null,
      renamed: !!(me && s.players.find((p) => p.id === me.id)?.renamed),
      claim: me ? this.claimFor(me.id) : null,
      host: s.hostSub && !s.hostSeatId ? (s.hostFace ?? null) : null,
      turn: me && game ? (room && dict ? auto.phoneTurn(room, me.id, dict) : this.masterTurn(game, me.id)) : null,
      pause: room && s.paused ? { reason: s.paused, leader: (s.paused === "leader" && s.lostLeader?.name) || (this.hostSeat()?.name ?? ""), next: this.hostSeat()?.name ?? "" } : null,
      masterGone: !room && !!s.masterGone && !!game && !game.winner,
      auto: room && dict ? auto.autoPublic(room, me?.id ?? null, dict) : null,
      speaker: room && speaking ? { cue: room.auto.cue, scene: game!.winner ? null : sceneFor(game!), locale: s.locale ?? "en" } : null,
      // The dead see everything, without a game master: there's nobody else to watch the game with.
      spectate: (room && info && !info.alive) || (spectator && game) ? game : null,
      canStand: !!info?.alive && this.mayorRaceOpen(),
      deck: game && config?.deck === "open" ? [...game.setup.players.map((p) => game.setup.roles[p.id]), ...game.setup.extraCards].sort() : null,
    };
  }

  /** With a game master: what a phone may play for the current step, if its player likes. */
  private masterTurn(game: GameState, playerId: string) {
    const s = this.state!;
    const plays = s.phonePlays?.at === s.game?.log.length ? s.phonePlays : null;
    return auto.turnFor(game, playerId, auto.masterShow(game.step), !!plays?.actions[playerId], plays?.wolfPicks ?? {});
  }

  /** Every socket gets its own filtered view, so secrets never reach the wrong phone. */
  private broadcastViews() {
    const speakerId = this.speakerId();
    for (const conn of this.getConnections<ConnState>()) {
      this.send(conn, { type: "view", view: this.viewFor(conn, speakerId) });
    }
  }

  private send(conn: Conn, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  /** True (with an error) when the room has no seat left. */
  private isFull(conn: Conn) {
    if (this.state!.players.length < MAX_PLAYERS) return false;
    this.send(conn, { type: "error", code: "room-full" });
    return true;
  }

  /** True (with an error) when too many phones already wait, `id` aside. */
  private tooManyRequests(conn: Conn, id: string) {
    const others = (this.state!.requests ?? []).filter((r) => r.id !== id);
    if (others.length < MAX_REQUESTS) return false;
    this.send(conn, { type: "error", code: "room-full" });
    return true;
  }

  /** Counts each connection's messages per second, and drops (then cuts off) a flood. */
  private flooding(conn: Conn) {
    const now = Date.now();
    let rate = this.rates.get(conn.id);
    if (!rate || now - rate.since >= 1000) this.rates.set(conn.id, (rate = { since: now, count: 0 }));
    rate.count++;
    if (rate.count > MESSAGES_PER_SECOND * 5) conn.close(1008, "Too many messages");
    return rate.count > MESSAGES_PER_SECOND;
  }

  /** One network can only open so many rooms a minute (the ROOM_CREATION rate limit). */
  private async mayCreateRoom(ctx: ConnectionContext) {
    const ip = ctx.request.headers.get("CF-Connecting-IP");
    if (!ip || !this.env.ROOM_CREATION) return true;
    const { success } = await this.env.ROOM_CREATION.limit({ key: ip });
    return success;
  }

  private reject(conn: Conn, code: ErrorCode) {
    this.send(conn, { type: "error", code });
    conn.close();
  }

  /** Saves the room. `active`: someone did something, so the room lives another day. */
  private async persist(active = true) {
    if (this.state && active) this.state.expiresAt = Date.now() + ROOM_TTL_MS;
    await this.ctx.storage.put(STORAGE_KEY, this.state);
    await this.scheduleAlarm();
  }

  /** Wakes the room when it expires, or sooner when a game without a game master has to move on. */
  private async scheduleAlarm() {
    const s = this.state;
    if (!s) return;
    const expires = s.expiresAt ?? Date.now() + ROOM_TTL_MS;
    const room = this.autoRoom();
    let next = room ? auto.nextWake(room, this.narration()) : null;
    // The leader's device away: check again when its grace runs out.
    if (room && s.leaderLostAt && !s.lostLeader) next = Math.min(next ?? Infinity, s.leaderLostAt + LEADER_GRACE_MS);
    // The game master's screen away: a dead player takes over after a minute.
    if (!room && s.masterLostAt && !s.masterGone) next = Math.min(next ?? Infinity, s.masterLostAt + MASTER_GRACE_MS);
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, Math.min(expires, next ?? Infinity)));
  }

  // --- without a game master ---

  /** The creator's seat, without a game master. */
  private hostSeat() {
    const id = this.state?.hostSeatId;
    return id ? (this.state!.players.find((p) => p.id === id) ?? null) : null;
  }

  /** The seat a connection plays: a phone's, or the creator's without a game master. */
  private seatOf(conn: Conn): string | null {
    if (conn.state?.kind === "player") return conn.state.playerId;
    if (conn.state?.kind === "host") return this.hostSeat()?.id ?? null;
    return null;
  }

  /** The creator takes a seat: their account's name, or the one they typed. */
  private addHostSeat(conn: Conn, name: unknown) {
    const s = this.state!;
    const face = s.hostSub ? s.hostFace : undefined;
    const seatName = face ? this.claimAccountName({ accountName: face.name, username: face.username ?? null }) : this.validateName(conn, name);
    if (!seatName || this.isFull(conn)) return false;
    const seat = this.addPlayer(seatName, false);
    seat.token = null;
    s.hostSeatId = seat.id;
    // Seated first: the creator usually starts the circle.
    s.players = [seat, ...s.players.filter((p) => p !== seat)];
    this.reseat();
    this.syncHostSeat();
    return true;
  }

  private async removeHostSeat() {
    const s = this.state!;
    const id = s.hostSeatId;
    if (!id) return;
    s.players = s.players.filter((p) => p.id !== id);
    s.hostSeatId = null;
    await this.ctx.storage.delete(PHOTO_PREFIX + id);
    this.reseat();
  }

  /** The creator's seat follows the account they're signed in with. */
  private syncHostSeat() {
    const s = this.state!;
    const seat = this.hostSeat();
    if (!seat) return;
    seat.connected = [...this.getConnections<ConnState>()].some((c) => c.state?.kind === "host");
    if (!s.hostSub || !s.hostFace) {
      delete seat.sub;
      seat.picture = null;
      return;
    }
    seat.sub = s.hostSub;
    seat.picture = s.hostFace.picture;
    seat.accountName = s.hostFace.name;
    seat.username = s.hostFace.username ?? null;
    const name = this.claimAccountName({ ...seat, accountName: s.hostFace.name }, seat.id);
    if (name !== seat.name) this.renamePlayer(seat, name);
  }

  /** The game as lib/auto.ts plays it; null with a game master. Changes go back with `keepAuto`. */
  private autoRoom(): auto.AutoRoom | null {
    const s = this.state;
    if (!s?.auto || !s.game || !this.game) return null;
    return { game: this.game, log: s.game.log, auto: s.auto, ballot: s.ballot ?? null, timer: s.timer ?? null, candidates: s.candidates ?? [] };
  }

  private keepAuto(room: auto.AutoRoom) {
    this.game = room.game;
    this.state!.ballot = room.ballot;
    this.state!.timer = room.timer;
  }

  private async runAuto() {
    if (!this.autoRoom()) return this.checkMaster();
    this.checkLeader();
    const room = this.autoRoom()!;
    auto.tick(room, this.autoContext());
    this.keepAuto(room);
    // Between two lines now, perhaps: the pause it was waiting for.
    await this.checkLeader();
  }

  /**
   * The leader's device away for a while: the game pauses (between two lines,
   * never mid-sentence) and the lead moves to the next phone around the
   * table, which decides: wait for them, their sudden death, or resume.
   */
  private async checkLeader() {
    const s = this.state!;
    const room = this.autoRoom();
    const now = Date.now();
    if (!room) return;
    if (this.hostSeat()?.connected) {
      s.leaderLostAt = null;
      return;
    }
    s.leaderLostAt ??= now;
    if (room.game.winner || now - s.leaderLostAt < LEADER_GRACE_MS) return;
    if (s.paused !== "leader") {
      if (!s.paused && room.auto.phase === "say") return;
      auto.pause(room, now);
      s.paused = "leader";
      this.keepAuto(room);
    }
    const next = this.successorId();
    const leader = this.hostSeat();
    if (!next || !leader) return;
    s.lostLeader = { seatId: leader.id, name: leader.name };
    await this.transferLead(next, true);
  }

  /** Starts a paused game again; at night, everyone closes their eyes first. */
  private resumeAuto() {
    const room = this.autoRoom();
    const s = this.state!;
    if (!room) return;
    const night = room.game.phase.kind === "night" && room.game.step.kind !== "prologue";
    auto.resume(room, Date.now(), night ? this.narration().auto.everyoneSleep : undefined);
    s.paused = null;
    this.keepAuto(room);
  }

  /** Saves and tells everyone, for a message handled outside the switch. */
  private async done() {
    await this.persist();
    this.broadcastViews();
  }

  /**
   * A device whose master key moved on while it was gone: a leader who comes
   * back before the new one decided takes the lead back; otherwise they play
   * their seat again, or (a game master) watch the game.
   */
  private async welcomeBack(conn: Conn, token: string) {
    const s = this.state!;
    const seatId = s.formerHosts![token];
    delete s.formerHosts![token];
    const seat = seatId ? s.players.find((p) => p.id === seatId) : null;
    const lost = s.lostLeader;
    if (seat && lost && lost.seatId === seat.id && !lost.settled && s.paused === "leader" && this.autoRoom()) {
      // Back in time: the lead goes back to them, and the phone that held it plays again.
      const interim = this.hostSeat();
      for (const c of [...this.getConnections<ConnState>()].filter((c) => c.state?.kind === "host")) {
        if (!interim) continue;
        interim.token = crypto.randomUUID();
        this.send(c, { type: "become", as: "player", id: interim.id, token: interim.token });
        c.setState({ kind: "player", playerId: interim.id });
      }
      s.hostToken = crypto.randomUUID();
      s.hostSeatId = seat.id;
      this.adoptAccount(seat);
      seat.connected = true;
      s.lostLeader = null;
      s.leaderLostAt = null;
      conn.setState({ kind: "host" });
      this.send(conn, { type: "host-token", token: s.hostToken });
      this.resumeAuto();
    } else if (seat) {
      seat.token = crypto.randomUUID();
      this.send(conn, { type: "become", as: "player", id: seat.id, token: seat.token });
    } else if (s.game) {
      const watcher = { id: crypto.randomUUID(), token: crypto.randomUUID() };
      s.spectators = [...(s.spectators ?? []), watcher];
      this.send(conn, { type: "become", as: "player", id: watcher.id, token: watcher.token });
    } else {
      this.send(conn, { type: "become", as: "guest" });
    }
    await this.done();
  }

  /** The room's master account follows the seat that leads (or runs) it. */
  private adoptAccount(seat: StoredPlayer) {
    const s = this.state!;
    if (seat.sub) {
      s.hostSub = seat.sub;
      s.hostFace = { name: seat.accountName ?? seat.name, picture: seat.picture ?? null, username: seat.username ?? null };
    } else {
      delete s.hostSub;
      delete s.hostFace;
    }
  }

  /**
   * With a game master: their screen gone for a minute, a dead player whose
   * phone is here takes the game over. Nobody dead: phones may leave.
   */
  private async checkMaster() {
    const s = this.state!;
    const game = this.game;
    if (!s.masterLostAt || s.auto || !game || game.winner) return;
    if (Date.now() - s.masterLostAt < MASTER_GRACE_MS) return;
    const online = new Set(
      [...this.getConnections<ConnState>()].flatMap((c) => (c.state?.kind === "player" ? [c.state.playerId] : [])),
    );
    const dead = [...s.players]
      .sort((a, b) => a.seat - b.seat)
      .find((p) => online.has(p.id) && !p.manual && !game.players.find((g) => g.id === p.id)?.alive);
    if (dead && (await this.transferLead(dead.id, true))) {
      s.masterLostAt = null;
      s.masterGone = false;
    } else {
      s.masterGone = true;
    }
  }

  /**
   * Players may run for Mayor during the election only: with a game master,
   * while it's on; without one, while the narrator asks who stands.
   */
  private mayorRaceOpen() {
    const game = this.game;
    if (!game || game.winner || game.step.kind !== "mayor-election") return false;
    const room = this.autoRoom();
    return !room || !!auto.autoPublic(room, null, this.narration()).candidacy;
  }

  /** The phone asked about a leader who's gone: the next one connected around the table. */
  private successorId(): string | null {
    const s = this.state!;
    const leader = this.hostSeat();
    const online = new Set(
      [...this.getConnections<ConnState>()].flatMap((c) => (c.state?.kind === "player" ? [c.state.playerId] : [])),
    );
    const seats = [...s.players].sort((a, b) => a.seat - b.seat);
    const from = leader ? seats.findIndex((p) => p.id === leader.id) : -1;
    for (let i = 1; i <= seats.length; i++) {
      const p = seats[(from + i + seats.length) % seats.length];
      if (p.id !== leader?.id && online.has(p.id)) return p.id;
    }
    return null;
  }

  /** A player out for good, without a game master: the room announces it and goes on. */
  private suddenDeath(playerId: string) {
    const room = this.autoRoom();
    if (!room) return;
    try {
      room.game = applyAction(room.game, { type: "sudden-death", playerId });
    } catch {
      return;
    }
    room.log.push({ type: "sudden-death", playerId });
    room.ballot = null;
    room.timer = null;
    // The step starts over after the announcement: no pause left hanging over it.
    room.auto.pausedAt = null;
    this.state!.paused = null;
    this.keepAuto(room);
  }

  /** Removes a seat from the room (and tells its phone). */
  private async dropSeat(playerId: string, tell = false) {
    const s = this.state!;
    await this.tellAccount(s.players.find((p) => p.id === playerId)?.sub, false);
    s.players = s.players.filter((p) => p.id !== playerId);
    s.requests = s.requests?.filter((r) => r.id !== playerId);
    await this.ctx.storage.delete(PHOTO_PREFIX + playerId);
    this.reseat();
    for (const c of this.getConnections<ConnState>()) {
      if ((c.state?.kind === "player" || c.state?.kind === "returning") && c.state.playerId === playerId) {
        if (tell) this.send(c, { type: "error", code: "removed" });
        c.setState({ kind: "guest" });
      }
    }
  }

  /**
   * The room goes to a player's device: it gets the master key and opens the
   * game master's screen. The device that had it plays its seat again
   * (without a game master), watches the game (a game master mid-game), or
   * is a visitor who may ask to join (a game master in the lobby). Without
   * a game master, anyone may lead; with one, during a game, only the dead.
   * `away`: the leader's device is gone (it's told nothing).
   */
  private async transferLead(targetId: string, away = false): Promise<boolean> {
    const s = this.state!;
    const target = s.players.find((p) => p.id === targetId && !p.left && !p.manual);
    const conns = [...this.getConnections<ConnState>()];
    const phones = conns.filter((c) => c.state?.kind === "player" && c.state.playerId === targetId);
    const autoMode = s.mode === "auto";
    const game = s.game ? this.game : null;
    if (!target || phones.length === 0 || target.id === s.hostSeatId) return false;
    if (game && !autoMode && game.players.find((p) => p.id === targetId)?.alive) return false;

    const oldSub = s.hostSub;
    const oldSeat = this.hostSeat();
    // A device that's gone keeps its key in mind: it gets its part back when it returns (welcomeBack).
    if (away) s.formerHosts = { ...s.formerHosts, [s.hostToken]: autoMode ? (oldSeat?.id ?? null) : null };
    s.hostToken = crypto.randomUUID();
    for (const c of conns.filter((c) => c.state?.kind === "host")) {
      if (away) continue;
      if (autoMode && oldSeat) {
        // Back to playing their own seat, from the phone page.
        oldSeat.token = crypto.randomUUID();
        this.send(c, { type: "become", as: "player", id: oldSeat.id, token: oldSeat.token });
        c.setState({ kind: "player", playerId: oldSeat.id });
      } else if (game) {
        const watcher = { id: crypto.randomUUID(), token: crypto.randomUUID() };
        s.spectators = [...(s.spectators ?? []), watcher];
        this.send(c, { type: "become", as: "player", id: watcher.id, token: watcher.token });
        c.setState({ kind: "guest", deviceId: watcher.id, token: watcher.token, spectator: true });
      } else {
        this.send(c, { type: "become", as: "guest" });
        c.setState({ kind: "guest" });
      }
    }
    if (autoMode && oldSeat && away) oldSeat.token = null;
    if (oldSeat) oldSeat.connected = conns.some((c) => c.state?.kind === "player" && c.state.playerId === oldSeat.id);

    this.adoptAccount(target);
    if (autoMode) s.hostSeatId = target.id;
    else if (game) s.masterSeatId = target.id;
    // A game master doesn't play: their seat goes.
    else await this.dropSeat(target.id);
    if (game && !autoMode && s.game) s.game.masterChanged = true;
    for (const phone of phones) this.send(phone, { type: "become", as: "host", token: s.hostToken });

    if (oldSub && oldSub !== s.hostSub) await this.tellAccount(oldSub, autoMode && !!oldSeat);
    if (s.hostSub) await this.tellAccount(s.hostSub, true);
    s.leaderLostAt = null;
    return true;
  }

  /** The narrator's words, in the room's language and the game's theme. */
  private narration() {
    const locale = this.state?.locale ?? "en";
    return themeDictionary(locale === "fr" ? fr : en, this.game?.setup.settings.theme, locale);
  }

  private autoContext(): auto.AutoContext {
    return { dict: this.narration(), random: secureRandom, now: Date.now() };
  }

  /** The device that reads the game out loud: the creator's, or else the first phone connected. */
  private speakerId(): string | null {
    if (!this.state?.auto || !this.game) return null;
    const conns = [...this.getConnections<ConnState>()];
    const host = conns.find((c) => c.state?.kind === "host");
    if (host) return host.id;
    const seats = new Map(this.state.players.map((p) => [p.id, p.seat]));
    const phones = conns.filter((c) => c.state?.kind === "player").sort((a, b) => (seats.get((a.state as { playerId: string }).playerId) ?? 0) - (seats.get((b.state as { playerId: string }).playerId) ?? 0));
    return phones[0]?.id ?? null;
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
