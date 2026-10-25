// No I, O, 0 or 1: easy to read off a screen and type on a phone.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

export function generateRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function normalizeRoomCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z]/g, "").slice(0, CODE_LENGTH);
}

export function isRoomCode(value: string) {
  return value.length === CODE_LENGTH && normalizeRoomCode(value) === value;
}

/**
 * Identities live in localStorage so a refresh, a locked screen or a closed tab
 * puts you back in the same seat. One entry per room.
 */
type HostIdentity = { token: string };
type PlayerIdentity = { id: string; token: string };

const hostKey = (code: string) => `ww:host:${code}`;
const playerKey = (code: string) => `ww:player:${code}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const identity = {
  getHost: (code: string) => read<HostIdentity>(hostKey(code)),
  setHost: (code: string, value: HostIdentity | null) => write(hostKey(code), value),
  getPlayer: (code: string) => read<PlayerIdentity>(playerKey(code)),
  setPlayer: (code: string, value: PlayerIdentity | null) => write(playerKey(code), value),
};

export function partyHost() {
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? `${window.location.hostname}:1999`;
}

/** HTTP origin of the room server (partysocket uses the same rule for ws:// vs wss://). */
function partyOrigin() {
  const host = partyHost();
  const local = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(host) || host.includes(".local");
  return `${local ? "http" : "https"}://${host}`;
}

/** Where a player's photo is served; the version busts the cache when it changes. */
export function photoUrl(code: string, playerId: string, version: number) {
  return `${partyOrigin()}/parties/main/${code}/photo/${playerId}?v=${version}`;
}
