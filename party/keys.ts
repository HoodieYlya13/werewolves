import { ticketKey } from "../lib/ticket";

/** Secrets that aren't in the generated Env types (they come from deploys and .env.local). */
type Secrets = { TICKET_KEY?: string; AUTH_CLIENT_SECRET?: string };

let key: Promise<Uint8Array | null> | null = null;

/**
 * The key pages' tickets are signed with. Deploys set TICKET_KEY (derived from
 * the client secret, see scripts/deploy-server.mjs); `wrangler dev` derives it
 * from the client secret in .env.local. Null: accounts are off.
 */
export function workerTicketKey(env: object) {
  const { TICKET_KEY, AUTH_CLIENT_SECRET } = env as Secrets;
  return (key ??= ticketKey({ key: TICKET_KEY, clientSecret: AUTH_CLIENT_SECRET }));
}
