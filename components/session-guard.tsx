"use client";

import usePartySocket from "partysocket/react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import type { AccountClientMessage, AccountServerMessage } from "@/lib/protocol";
import { partyHost } from "@/lib/room";
import { forgetSession, freshIdToken, useSession } from "@/lib/session";

/**
 * Keeps an account signed in on one device at a time. Mounted on every page;
 * when the account signs in on another device, this one signs out.
 */
export function SessionGuard() {
  const session = useSession();
  const { account, sessionId } = session ?? {};
  if (!account || !sessionId) return null;
  return <AccountSocket key={`${account.sub}:${sessionId}`} sub={account.sub} sessionId={sessionId} />;
}

function AccountSocket({ sub, sessionId }: { sub: string; sessionId: string }) {
  const { dict } = useI18n();
  const socket = usePartySocket({
    host: partyHost(),
    party: "account",
    room: sub,
    // ID tokens are short-lived: each (re)connection proves the account with a fresh one.
    onOpen: () =>
      void freshIdToken().then(
        (idToken) => idToken && socket.send(JSON.stringify({ type: "hello", idToken, sessionId } satisfies AccountClientMessage)),
      ),
    onMessage: (event) => {
      const msg = JSON.parse(event.data as string) as AccountServerMessage;
      if (msg.type !== "signed-out") return;
      socket.close();
      void forgetSession().then(() => toast(dict.account.signedOutElsewhere, { duration: 10_000 }));
    },
  });
  return null;
}
