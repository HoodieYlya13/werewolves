import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { MAX_NAME_LENGTH } from "./protocol";

/**
 * Accounts from the hy13 auth server (OpenID Connect), for the Next.js sign-in
 * routes. The room server never sees ID tokens: pages show it tickets instead
 * (lib/ticket.ts).
 */

export const DEFAULT_ISSUER = "https://auth.hy13dev.com";

/**
 * What a room knows about someone signed in. `username` is unique on the auth
 * server: it tells two accounts with the same first name apart.
 */
export type Account = { sub: string; name: string; picture: string | null; username: string | null };

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
  jwks_uri: string;
};

const discoveries = new Map<string, Promise<Discovery>>();
const keySets = new Map<string, JWTVerifyGetKey>();

/** The issuer's endpoints, fetched once per server instance. */
export function discover(issuer: string): Promise<Discovery> {
  let pending = discoveries.get(issuer);
  if (!pending) {
    pending = fetch(`${issuer}/.well-known/openid-configuration`).then((res) => {
      if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
      return res.json() as Promise<Discovery>;
    });
    // A failed fetch is retried next time instead of being cached.
    pending.catch(() => discoveries.delete(issuer));
    discoveries.set(issuer, pending);
  }
  return pending;
}

async function keysFor(issuer: string) {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL((await discover(issuer)).jwks_uri));
    keySets.set(issuer, keys);
  }
  return keys;
}

/**
 * Checks an ID token's signature, issuer, audience and expiry. Returns the
 * account and when the token expires (ms), or null when it isn't valid.
 */
export async function verifyIdToken(
  token: unknown,
  { issuer, clientId, nonce }: { issuer: string; clientId: string; nonce?: string },
): Promise<(Account & { expiresAt: number }) | null> {
  if (typeof token !== "string" || !token) return null;
  try {
    const { payload } = await jwtVerify(token, await keysFor(issuer), {
      issuer,
      audience: clientId,
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    if (!payload.sub || !payload.exp) return null;
    if (nonce !== undefined && payload.nonce !== nonce) return null;
    return {
      sub: payload.sub,
      name: gameName(payload),
      username: typeof payload.preferred_username === "string" && payload.preferred_username.trim() ? payload.preferred_username.trim() : null,
      // Only the auth server's own avatar URLs are shown to the room.
      picture: typeof payload.picture === "string" && payload.picture.startsWith(`${issuer}/`) ? payload.picture : null,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

/** The first name reads best around a table; the username or full name otherwise. */
function gameName(claims: Record<string, unknown>) {
  for (const key of ["given_name", "preferred_username", "name"]) {
    const value = claims[key];
    if (typeof value === "string" && value.trim()) return value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  }
  return "?";
}
