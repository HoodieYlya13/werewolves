import { getServerByName, Server, type Connection } from "partyserver";
import { DEFAULT_ISSUER, verifyIdToken } from "../lib/account";
import { sessionTime, type AccountClientMessage, type AccountServerMessage } from "../lib/protocol";

const CURRENT_KEY = "session";
const ROOMS_KEY = "rooms";

/** A device's socket. `pending`: a newer sign-in, waiting for its answer about the game in progress. */
type DeviceState = { sessionId: string; pending?: { room: string } };
type Device = Connection<DeviceState>;

/**
 * One Durable Object per account (named by its `sub`). Every signed-in page
 * keeps a socket here, so an account is only signed in on one device: the
 * newest sign-in wins and the others are told to sign out.
 *
 * Rooms tell it where the account has a seat. A new device signing in while
 * the account plays somewhere is asked first: take the seat over, or have
 * the old device leave the room.
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
    if (msg.type === "resolve") return this.resolve(conn, msg.takeOver);
  }

  private async hello(conn: Device, msg: Extract<AccountClientMessage, { type: "hello" }>) {
    if (typeof msg.sessionId !== "string" || !sessionTime(msg.sessionId)) return;
    const clientId = this.env.AUTH_CLIENT_ID;
    const account = clientId ? await verifyIdToken(msg.idToken, { issuer: this.env.AUTH_ISSUER || DEFAULT_ISSUER, clientId }) : null;
    // The socket must prove it is this account.
    if (!account || account.sub !== this.name) return conn.close(4001, "invalid-account");

    const current = await this.ctx.storage.get<string>(CURRENT_KEY);
    if (current && sessionTime(msg.sessionId) < sessionTime(current)) {
      // An older sign-in, from a device that was replaced since.
      return this.signOut(conn);
    }
    if (current && current !== msg.sessionId) {
      // A new device while the account has a seat somewhere: ask it first.
      const seat = await this.liveSeat();
      if (seat) {
        conn.setState({ sessionId: msg.sessionId, pending: { room: seat.room } });
        return this.send(conn, { type: "in-room", room: seat.room, inGame: seat.inGame });
      }
    }
    conn.setState({ sessionId: msg.sessionId });
    await this.makeCurrent(conn);
  }

  /** The new device's answer: play from here, or have the old device leave the room. */
  private async resolve(conn: Device, takeOver: boolean) {
    const pending = conn.state?.pending;
    if (!pending) return;
    conn.setState({ sessionId: conn.state!.sessionId });
    await this.makeCurrent(conn);
    if (!takeOver) {
      for (const room of await this.rooms()) {
        try {
          await (await getServerByName(this.env.Main, room)).releaseAccount(this.name);
        } catch {}
      }
      await this.ctx.storage.put(ROOMS_KEY, []);
    }
    // When taking over, the device joins the room itself, which moves the seat.
    this.send(conn, { type: "resolved", takeOver, room: pending.room });
  }

  /** This device's sign-in becomes the account's; every other device signs out. */
  private async makeCurrent(conn: Device) {
    const sessionId = conn.state!.sessionId;
    if ((await this.ctx.storage.get<string>(CURRENT_KEY)) !== sessionId) await this.ctx.storage.put(CURRENT_KEY, sessionId);
    for (const other of this.getConnections<DeviceState>()) {
      if (other.id !== conn.id && other.state?.sessionId !== sessionId) this.signOut(other);
    }
  }

  /** The first room where the account still has a seat, asking each room (the list may be stale). */
  private async liveSeat() {
    const rooms = await this.rooms();
    for (const room of rooms) {
      try {
        const seat = await (await getServerByName(this.env.Main, room)).accountSeat(this.name);
        if (seat) return { room, inGame: seat.inGame };
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
