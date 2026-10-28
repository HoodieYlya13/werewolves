import { getServerByName, Server, type Connection } from "partyserver";
import { verifyTicket } from "../lib/ticket";
import { workerTicketKey } from "./keys";
import { sessionTime, type AccountClientMessage, type AccountServerMessage } from "../lib/protocol";

const CURRENT_KEY = "session";
const ROOMS_KEY = "rooms";

/** A device's socket. `pending`: a newer sign-in, waiting for its answer about the seat on another device. */
type DeviceState = { sessionId: string; pending?: { room: string; role: "player" | "host" } };
type Device = Connection<DeviceState>;

/**
 * One Durable Object per account (named by its `sub`). Every signed-in page
 * keeps a socket here, so an account is only signed in on one device: the
 * newest sign-in wins and the others are told to sign out.
 *
 * Rooms tell it where the account has a seat, as a player or as the game
 * master. A new device signing in meanwhile is asked first: take the seat
 * over, or leave it to the old device (a player leaves the room; a master
 * keeps running it, signed out).
 */
export class AccountServer extends Server<Env> {
  static options = { hibernate: true };

  // --- called by RoomServer ---

  async addRoom(code: string) {
    const rooms = await this.rooms();
    if (!rooms.includes(code)) await this.ctx.storage.put(ROOMS_KEY, [...rooms, code]);
  }

  async removeRoom(code: string) {
    await this.ctx.storage.put(ROOMS_KEY, (await this.rooms()).filter((r) => r !== code));
  }

  /** The account's player seat in a room other than `except`, if any (running a room doesn't count). */
  async otherSeat(except: string) {
    return this.liveSeat(except, "player");
  }

  /** The account joins `except` as a player: it leaves every other room it plays in. */
  async releaseOtherRooms(except: string) {
    for (const room of await this.rooms()) {
      if (room === except) continue;
      let stillThere = false;
      try {
        stillThere = await (await getServerByName(this.env.Main, room)).releaseAccount(this.name, "moved-room");
      } catch {}
      if (!stillThere) await this.removeRoom(room);
    }
  }

  // --- devices ---

  async onMessage(conn: Device, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;
    let msg: AccountClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "hello") return this.hello(conn, msg);
    if (msg.type === "resolve") return this.resolve(conn, msg.takeOver, msg.here === true);
  }

  private async hello(conn: Device, msg: Extract<AccountClientMessage, { type: "hello" }>) {
    const ticket = await verifyTicket(await workerTicketKey(this.env), msg.ticket, "account");
    // The socket must prove it is this account, from a known sign-in.
    if (!ticket || ticket.sub !== this.name || !ticket.sid || !sessionTime(ticket.sid)) return conn.close(4001, "invalid-account");
    const sessionId = ticket.sid;

    const current = await this.ctx.storage.get<string>(CURRENT_KEY);
    if (current && sessionTime(sessionId) < sessionTime(current)) {
      // An older sign-in, from a device that was replaced since.
      return this.signOut(conn);
    }
    if (current && current !== sessionId) {
      // A new device while the account has a seat somewhere: ask it first.
      const seat = await this.liveSeat();
      if (seat) {
        conn.setState({ sessionId, pending: { room: seat.room, role: seat.role } });
        return this.send(
          conn,
          seat.role === "host"
            ? { type: "in-room", room: seat.room, inGame: seat.inGame, role: "host" }
            : { type: "in-room", room: seat.room, inGame: seat.inGame, role: "player", playerId: seat.playerId },
        );
      }
    }
    conn.setState({ sessionId });
    await this.makeCurrent(conn);
  }

  /** The new device's answer: take the seat here, or leave it to the old device. */
  private async resolve(conn: Device, takeOver: boolean, here: boolean) {
    const pending = conn.state?.pending;
    if (!pending) return;
    conn.setState({ sessionId: conn.state!.sessionId });
    // A master moving here: the old master screen stops first, so signing it
    // out (just below) can't drop the account from the room.
    if (takeOver && !here && pending.role === "host") {
      try {
        await (await getServerByName(this.env.Main, pending.room)).moveHost(this.name);
      } catch {}
    }
    await this.makeCurrent(conn);
    if (!takeOver) {
      for (const room of await this.rooms()) {
        try {
          await (await getServerByName(this.env.Main, room)).releaseAccount(this.name);
        } catch {}
      }
      await this.ctx.storage.put(ROOMS_KEY, []);
    }
    // When taking over, the device opens the room itself, which moves the seat.
    this.send(conn, { type: "resolved", takeOver, room: pending.room, role: pending.role });
  }

  /** This device's sign-in becomes the account's; every other device signs out. */
  private async makeCurrent(conn: Device) {
    const sessionId = conn.state!.sessionId;
    if ((await this.ctx.storage.get<string>(CURRENT_KEY)) !== sessionId) await this.ctx.storage.put(CURRENT_KEY, sessionId);
    for (const other of this.getConnections<DeviceState>()) {
      if (other.id !== conn.id && other.state?.sessionId !== sessionId) this.signOut(other);
    }
  }

  /** The first room where the account still has a seat (of `role`, if given), asking each room (the list may be stale). */
  private async liveSeat(except?: string, role?: "player" | "host") {
    const rooms = await this.rooms();
    for (const room of rooms) {
      if (room === except) continue;
      try {
        const seat = await (await getServerByName(this.env.Main, room)).accountSeat(this.name);
        if (seat && (!role || seat.role === role)) return { room, ...seat };
        if (seat) continue;
      } catch {}
      await this.removeRoom(room);
    }
    return null;
  }

  private async rooms() {
    return (await this.ctx.storage.get<string[]>(ROOMS_KEY)) ?? [];
  }

  private signOut(conn: Connection) {
    this.send(conn, { type: "signed-out" });
    conn.close(4000, "signed-out");
  }

  private send(conn: Connection, msg: AccountServerMessage) {
    conn.send(JSON.stringify(msg));
  }
}
