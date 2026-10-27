import { Server, type Connection } from "partyserver";
import { DEFAULT_ISSUER, verifyIdToken } from "../lib/account";
import { sessionTime, type AccountClientMessage, type AccountServerMessage } from "../lib/protocol";

const CURRENT_KEY = "session";

/**
 * One Durable Object per account (named by its `sub`). Every signed-in page
 * keeps a socket here, so an account is only signed in on one device: the
 * newest sign-in wins and the others are told to sign out.
 */
export class AccountServer extends Server<Env> {
  static options = { hibernate: true };

  async onMessage(conn: Connection<{ sessionId: string }>, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;
    let msg: AccountClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type !== "hello" || typeof msg.sessionId !== "string" || !sessionTime(msg.sessionId)) return;

    const clientId = this.env.AUTH_CLIENT_ID;
    const account = clientId ? await verifyIdToken(msg.idToken, { issuer: this.env.AUTH_ISSUER || DEFAULT_ISSUER, clientId }) : null;
    // The socket must prove it is this account.
    if (!account || account.sub !== this.name) return conn.close(4001, "invalid-account");

    const current = await this.ctx.storage.get<string>(CURRENT_KEY);
    if (current && sessionTime(msg.sessionId) < sessionTime(current)) {
      // An older sign-in, from a device that was replaced since.
      return this.signOut(conn);
    }
    if (current !== msg.sessionId) {
      await this.ctx.storage.put(CURRENT_KEY, msg.sessionId);
      for (const other of this.getConnections<{ sessionId: string }>()) {
        if (other.id !== conn.id && other.state?.sessionId !== msg.sessionId) this.signOut(other);
      }
    }
    conn.setState({ sessionId: msg.sessionId });
  }

  private signOut(conn: Connection) {
    conn.send(JSON.stringify({ type: "signed-out" } satisfies AccountServerMessage));
    conn.close(4000, "signed-out");
  }
}
