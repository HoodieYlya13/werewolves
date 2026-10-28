import { base64url, jwtVerify, SignJWT } from "jose";
import type { Account } from "./account";

/**
 * Tickets: what a page hands the room or account server to prove who is
 * signed in, so the ID token never leaves the site's server. A ticket is
 * signed with a key the site and the Worker share, names one server
 * (`audience`), carries only the account's sub, game name and photo, and
 * expires within a minute. Shared by Next and the Worker.
 */

/** Long enough for the page to open a socket and send it, short enough to be useless if copied. */
const TICKET_TTL_SECONDS = 60;
const ISSUER = "werewolves";
const DERIVATION = "werewolves-ticket-v1";

/** Which server a ticket is for. */
export type TicketAudience = { room: string } | "account";
const audienceOf = (to: TicketAudience) => (to === "account" ? "account" : `room:${to.room}`);

export type Ticket = Account & {
  /** The device's sign-in (account tickets only; see `newSessionId`). */
  sid?: string;
  /** Unique per ticket, so a room accepts each one once. */
  jti: string;
  exp: number;
};

/**
 * The signing key, derived from the OIDC client secret so there's no extra
 * secret to manage. The Worker gets the derived key (TICKET_KEY), never the
 * client secret; `wrangler dev` reads the client secret from .env.local.
 */
export async function ticketKey({ key, clientSecret }: { key?: string; clientSecret?: string | null }) {
  if (key) return base64url.decode(key);
  if (!clientSecret) return null;
  const hmac = await crypto.subtle.importKey("raw", new TextEncoder().encode(clientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", hmac, new TextEncoder().encode(DERIVATION)));
}

export function signTicket(key: Uint8Array, to: TicketAudience, account: Account, sid?: string) {
  return new SignJWT({ name: account.name, picture: account.picture, ...(sid ? { sid } : {}) })
    .setProtectedHeader({ alg: "HS256", typ: "ww-ticket" })
    .setIssuer(ISSUER)
    .setAudience(audienceOf(to))
    .setSubject(account.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${TICKET_TTL_SECONDS}s`)
    .sign(key);
}

/** The account a ticket stands for, or null when it's forged, expired or meant for another server. */
export async function verifyTicket(key: Uint8Array | null, token: unknown, to: TicketAudience): Promise<Ticket | null> {
  if (!key || typeof token !== "string" || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: audienceOf(to), algorithms: ["HS256"], typ: "ww-ticket" });
    const { sub, name, picture, sid, jti, exp } = payload;
    if (!sub || typeof name !== "string" || !jti || !exp) return null;
    return {
      sub,
      name,
      picture: typeof picture === "string" ? picture : null,
      ...(typeof sid === "string" ? { sid } : {}),
      jti,
      exp,
    };
  } catch {
    return null;
  }
}
