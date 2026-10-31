import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { DEFAULT_ISSUER, discover, verifyIdToken, type Account } from "./account";
import { newSessionId } from "./protocol";
import { ticketKey } from "./ticket";

/**
 * Server side of signing in (Next.js route handlers only). The browser sees
 * neither token: both live in httpOnly cookies scoped to /api/auth. Pages get
 * the account's name and photo from /api/auth/session, and short-lived
 * tickets (lib/ticket.ts) from /api/auth/ticket to show the room server.
 */

export type AuthConfig = { issuer: string; clientId: string; clientSecret: string };

/**
 * Null when no client is configured (e.g. Vercel previews): accounts are off.
 * The client secret is required: tickets for the room server are signed with a
 * key derived from it (see siteTicketKey).
 */
export function authConfig(): AuthConfig | null {
  const clientId = process.env.AUTH_CLIENT_ID;
  const clientSecret = process.env.AUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { issuer: process.env.AUTH_ISSUER ?? DEFAULT_ISSUER, clientId, clientSecret };
}

// Only what other players see: username, first name and photo (no last name or birthday).
export const SCOPE = "openid public_profile offline_access";
export const COOKIES = { flow: "ww_auth_flow", refresh: "ww_refresh", id: "ww_id", session: "ww_session" } as const;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * The origin the browser used. `nextUrl` reports the address the server binds
 * to (0.0.0.0 in dev), so the Host headers are the source of truth.
 */
export function siteOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0] ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** A redirect to a path on this site. */
export const sitePath = (request: NextRequest, path: string) => new URL(path, siteOrigin(request));

export const callbackUrl = (request: NextRequest) => `${siteOrigin(request)}/api/auth/callback`;
export const loggedOutUrl = (request: NextRequest) => `${siteOrigin(request)}/api/auth/logged-out`;

/**
 * Whether a sign-out request comes from a page of this site or of the auth
 * server, as a real navigation. A link, image or script planted on another
 * site can't sign anyone out (logout CSRF). Browsers that send none of these
 * headers are let through, as the auth server does.
 */
export function signOutAllowed(request: NextRequest, config: AuthConfig | null) {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return false;
  const referer = request.headers.get("referer");
  if (referer) {
    const ours = [siteOrigin(request), ...(config ? [new URL(config.issuer).origin] : [])];
    try {
      return ours.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  // No referrer (privacy settings): typed or bookmarked, or from our own domain.
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "none" || site === "same-origin" || site === "same-site";
}

/** Only same-site paths, so the sign-in flow can't redirect elsewhere. */
export function safeReturnTo(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

export function cookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    secure: siteOrigin(request).startsWith("https:"),
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge,
  };
}

type TokenResponse = { id_token?: string; refresh_token?: string };

/** The key tickets are signed with; null without a client secret (tickets need one). */
export const siteTicketKey = () => ticketKey({ clientSecret: process.env.AUTH_CLIENT_SECRET });

/** A token about to expire is refreshed rather than relied on. */
const MIN_VALIDITY_MS = 2 * 60 * 1000;

/**
 * Who is signed in on this device, from the cookies. Refreshes the ID token
 * with the refresh token when it's about to expire (the auth server rotates
 * that one). `finish` writes the new or cleared cookies on the route's response.
 */
export async function currentAccount(request: NextRequest, config: AuthConfig, { fresh = false } = {}) {
  const savedSession = request.cookies.get(COOKIES.session)?.value;
  // Signed in before sessions existed: start one now.
  const sessionId = savedSession ?? newSessionId();
  const keepSession = (response: NextResponse) => {
    if (!savedSession) saveSession(request, response, sessionId);
    return response;
  };

  const idToken = request.cookies.get(COOKIES.id)?.value;
  const current = await verifyIdToken(idToken, config);
  // `fresh`: back from the account page, so the name or photo may have changed since.
  if (current && !fresh && current.expiresAt - Date.now() > MIN_VALIDITY_MS) {
    return { account: publicAccount(current), sessionId, finish: keepSession };
  }

  const refreshToken = request.cookies.get(COOKIES.refresh)?.value;
  const tokens = refreshToken ? await requestTokens(config, { grant_type: "refresh_token", refresh_token: refreshToken }) : null;
  const account = await verifyIdToken(tokens?.id_token, config);
  if (!tokens || !account) {
    return {
      account: null,
      sessionId: null,
      finish: (response: NextResponse) => {
        if (refreshToken || idToken) clearTokens(request, response);
        return response;
      },
    };
  }
  return {
    account: publicAccount(account),
    sessionId,
    finish: (response: NextResponse) => {
      saveTokens(request, response, tokens, account.expiresAt);
      return keepSession(response);
    },
  };
}

const publicAccount = ({ sub, name, picture }: Account): Account => ({ sub, name, picture });

/** Calls the token endpoint, authenticating with the client secret. */
export async function requestTokens(config: AuthConfig, params: Record<string, string>): Promise<TokenResponse | null> {
  const { token_endpoint } = await discover(config.issuer);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams(params);
  const credentials = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`;
  headers.Authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
  const res = await fetch(token_endpoint, { method: "POST", headers, body, cache: "no-store" });
  return res.ok ? ((await res.json()) as TokenResponse) : null;
}

/** Stores freshly issued tokens. The ID token cookie lasts as long as the token. */
export function saveTokens(request: NextRequest, response: NextResponse, tokens: TokenResponse, idExpiresAt: number) {
  if (tokens.id_token) {
    const maxAge = Math.max(0, Math.floor((idExpiresAt - Date.now()) / 1000));
    response.cookies.set(COOKIES.id, tokens.id_token, cookieOptions(request, maxAge));
  }
  if (tokens.refresh_token) response.cookies.set(COOKIES.refresh, tokens.refresh_token, cookieOptions(request, REFRESH_MAX_AGE));
}

/** This device's sign-in, so the account can be signed in on one device at a time. */
export function saveSession(request: NextRequest, response: NextResponse, sessionId: string) {
  response.cookies.set(COOKIES.session, sessionId, cookieOptions(request, REFRESH_MAX_AGE));
}

export function clearTokens(request: NextRequest, response: NextResponse) {
  for (const name of [COOKIES.id, COOKIES.refresh, COOKIES.session]) response.cookies.set(name, "", cookieOptions(request, 0));
}

export function randomString(bytes = 32) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}

export async function codeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}
