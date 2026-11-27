import type { Connection } from "partyserver";
import { ENGINE_VERSION, upgradeLog, type Action, type GameSetup } from "../../lib/engine";
import { Account } from "../../lib/account";
import { Ballot, Timer } from "../../lib/ballot";
import { INVITE_MINUTES } from "../../lib/friends";
import * as auto from "../../lib/auto";
import type { WitchAsk } from "../../lib/auto";
import type { Locale } from "../../lib/i18n/config";
import type { PublicPlayer, JoinRequest, RoomMode } from "../../lib/protocol";

/** Rooms with nobody connected are wiped after this, freeing the code. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const STORAGE_KEY = "room";
/** Friend requests and invite batches, per connection per minute. */
export const FRIEND_CALLS_PER_MINUTE = 10;
/** Friends invited in one go. */
export const MAX_INVITES = 30;
export const INVITE_MS = INVITE_MINUTES * 60_000;

export type StoredPlayer = Omit<PublicPlayer, "account" | "picture"> & {
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
export type StoredRequest = JoinRequest & { signedIn?: Account; showUsername?: boolean; token?: string };

export type StoredGame = {
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
export function upgradeGame(game: StoredGame | null | undefined): StoredGame | null {
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
export type RoomState = {
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
  /** The game master whose screen went away when the game was handed over: they may take it back. */
  awayMaster?: { sub: string | null; face: RoomState["hostFace"] | null; spectatorId: string | null } | null;
  /** With a game master: what phones chose for the step at `at` (players may play on their phones). */
  phonePlays?: { at: number; actions: Record<string, Action>; wolfPicks: Record<string, string>; asked?: Record<string, WitchAsk> } | null;
  /** With a game master: the Witch's question the game master is on, for the step at `at` (her phone follows). */
  masterStage?: { at: number; stage: WitchAsk } | null;
  /** Accounts invited from this room, and when: for the length of the invite, they join a locked lobby without asking. */
  invitedAt?: Record<string, number>;
  /** With a game master: the log length whose lead lines ("go back to sleep"…) the game master has read. */
  leadReadAt?: number | null;
};

/** How long the leader's device may be away before the game pauses for it. */
export const LEADER_GRACE_MS = 20_000;
/**
 * The leader's device away for less than this keeps the narration: a page
 * reload or a language switch reconnects within a second or two, and another
 * phone shouldn't flash "this phone is the narrator" meanwhile.
 */
export const SPEAKER_GRACE_MS = 6_000;
/** How long the game master's screen may be away before a dead player takes over. */
export const MASTER_GRACE_MS = 60_000;

export const PHOTO_PREFIX = "photo:";
export const MAX_TIMER_SECONDS = 60 * 60;
/** Past this, a connection's messages are dropped; past five times this, it's closed. */
export const MESSAGES_PER_SECOND = 20;

/** Who a socket belongs to. Kept on the connection so it survives restarts. */
export type ConnState =
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

export const isDeviceId = (value: string | null): value is string => !!value && /^[\w-]{16,64}$/.test(value);

export type Conn = Connection<ConnState>;

/**
 * One Durable Object per room code. It hibernates between messages, so all
 * state lives in storage and `onStart` reloads it on every wake-up.
 */

/** Card dealing uses the platform's secure random source. */
export function secureRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
