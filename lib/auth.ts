import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { DEFAULT_ISSUER, discover } from "./account";

/**
 * Server side of signing in (Next.js route handlers only). The browser never
 * sees the refresh token: it lives in an httpOnly cookie, and /api/auth/session
 * hands out short-lived ID tokens that phones pass to the room server.
 */

export type AuthConfig = { issuer: string; clientId: string; clientSecret: string | null };

/** Null when no client is configured (e.g. Vercel previews): accounts are off. */
export function authConfig(): AuthConfig | null {
  const clientId = process.env.AUTH_CLIENT_ID;
  if (!clientId) return null;
  return { issuer: process.env.AUTH_ISSUER ?? DEFAULT_ISSUER, clientId, clientSecret: process.env.AUTH_CLIENT_SECRET ?? null };
}

export const SCOPE = "openid profile offline_access";
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

/** Calls the token endpoint, authenticating with the client secret when there is one. */
export async function requestTokens(config: AuthConfig, params: Record<string, string>): Promise<TokenResponse | null> {
  const { token_endpoint } = await discover(config.issuer);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams(params);
  if (config.clientSecret) {
    const credentials = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`;
    headers.Authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
  } else {
    body.set("client_id", config.clientId);
  }
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
