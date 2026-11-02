import { deletePushSubscription, pushEndpoints } from "../lib/friends";

/**
 * Web Push from the Worker, for invites. The push carries nothing: the
 * service worker (public/sw.js) asks the site for the latest invites and
 * shows them. So no payload encryption, only the VAPID signature that proves
 * the push comes from this site.
 *
 * Keys (scripts/generate-vapid-keys.mjs): NEXT_PUBLIC_VAPID_PUBLIC_KEY (the
 * page subscribes with it too) and VAPID_PRIVATE_KEY, set by the Vercel
 * build (scripts/deploy-server.mjs); `wrangler dev` reads .env.local.
 */
type PushSecrets = { NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };

const SUBJECT = "https://werewolves.hy13dev.com";

const base64url = {
  encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  decode: (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
};
const text = (value: unknown) => base64url.encode(new TextEncoder().encode(JSON.stringify(value)));

let signingKey: Promise<CryptoKey> | null = null;

/** The private key as WebCrypto wants it: a JWK needs the public point too. */
function importKey(publicKey: string, privateKey: string) {
  const point = base64url.decode(publicKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKey,
    x: base64url.encode(point.slice(1, 33)),
    y: base64url.encode(point.slice(33, 65)),
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** `Authorization` for one push service: a JWT for its origin, valid 12 hours. */
export async function vapid(endpoint: string, keys: Required<Pick<PushSecrets, "NEXT_PUBLIC_VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY">>, subject: string) {
  signingKey ??= importKey(keys.NEXT_PUBLIC_VAPID_PUBLIC_KEY, keys.VAPID_PRIVATE_KEY);
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject };
  const unsigned = `${text({ typ: "JWT", alg: "ES256" })}.${text(claims)}`;
  // WebCrypto's ECDSA signature is already JOSE's r||s.
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await signingKey, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${base64url.encode(new Uint8Array(signature))}, k=${keys.NEXT_PUBLIC_VAPID_PUBLIC_KEY}`;
}

/** Wakes every device these accounts turned notifications on for. Gone subscriptions are forgotten. */
export async function sendPushes(env: object, url: string, subs: string[]) {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env as PushSecrets;
  if (!NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const keys = { NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY };
  const targets = await pushEndpoints(url, subs);
  await Promise.all(
    targets.map(async ({ endpoint }) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { TTL: "3600", Urgency: "high", Authorization: await vapid(endpoint, keys, VAPID_SUBJECT ?? SUBJECT) },
        });
        if (res.status === 404 || res.status === 410) await deletePushSubscription(url, endpoint);
      } catch (error) {
        console.error("Sending a push failed:", error);
      }
    }),
  );
}
