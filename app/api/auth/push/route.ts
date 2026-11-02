import { NextResponse, type NextRequest } from "next/server";
import { accountRoute } from "@/lib/account-route";
import { deletePushSubscription, savePushSubscription } from "@/lib/friends";

/** A push service's endpoint (https, as browsers give them). */
const endpointOf = (body: unknown) => {
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  return typeof endpoint === "string" && endpoint.startsWith("https://") && endpoint.length <= 1000 ? endpoint : null;
};

/** This device turned notifications on: invites from friends reach it. */
export async function POST(request: NextRequest) {
  const endpoint = endpointOf(await request.json().catch(() => null));
  if (!endpoint) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  return accountRoute(request, async (account, url) => {
    await savePushSubscription(url, account.sub, endpoint);
    return NextResponse.json({ ok: true });
  });
}

/** Turned off on this device. */
export async function DELETE(request: NextRequest) {
  const endpoint = endpointOf(await request.json().catch(() => null));
  if (!endpoint) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  return accountRoute(request, async (_, url) => {
    await deletePushSubscription(url, endpoint);
    return NextResponse.json({ ok: true });
  });
}
