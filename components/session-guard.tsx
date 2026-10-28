"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import usePartySocket from "partysocket/react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "@/lib/i18n/config";
import type { AccountClientMessage, AccountServerMessage } from "@/lib/protocol";
import { partyHost, takeoverKey } from "@/lib/room";
import { forgetSession, getTicket, useSession } from "@/lib/session";

/**
 * Keeps an account signed in on one device at a time. Mounted on every page;
 * when the account signs in on another device, this one signs out.
 */
export function SessionGuard() {
  const session = useSession();
  const { account, sessionId } = session ?? {};
  if (!account || !sessionId) return null;
  // Keyed by the sign-in, so a new one reconnects with a ticket naming it.
  return <AccountSocket key={`${account.sub}:${sessionId}`} sub={account.sub} />;
}

function AccountSocket({ sub }: { sub: string }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const t = dict.account.inRoom;
  // The account has a seat in a room on another device: play from here instead?
  const [seat, setSeat] = useState<{ room: string; inGame: boolean } | null>(null);

  const socket = usePartySocket({
    host: partyHost(),
    party: "account",
    room: sub,
    // Each (re)connection proves the account with a new ticket, which also names this device's sign-in.
    onOpen: () => void getTicket("account").then((ticket) => ticket && send({ type: "hello", ticket })),
    onMessage: (event) => {
      const msg = JSON.parse(event.data as string) as AccountServerMessage;
      switch (msg.type) {
        case "signed-out":
          socket.close();
          void forgetSession().then(() => toast(dict.account.signedOutElsewhere, { duration: 10_000 }));
          break;
        case "in-room":
          setSeat({ room: msg.room, inGame: msg.inGame });
          break;
        case "resolved":
          if (!msg.takeOver) {
            toast(format(t.left, { code: msg.room }));
            break;
          }
          // The room page joins with the account as soon as it opens, which moves the seat here.
          try {
            sessionStorage.setItem(takeoverKey(msg.room), "1");
          } catch {}
          router.push(`/${locale}/play/${msg.room}`);
          break;
      }
    },
  });

  function send(message: AccountClientMessage) {
    socket.send(JSON.stringify(message));
  }

  function answer(takeOver: boolean) {
    send({ type: "resolve", takeOver });
    setSeat(null);
  }

  return (
    <AlertDialog open={seat !== null}>
      {/* An answer is needed: the other device waits for it. */}
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{seat?.inGame ? t.titleGame : t.titleRoom}</AlertDialogTitle>
          <AlertDialogDescription>
            {format(t.body, { code: seat?.room ?? "" })} {t.bodyNo}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>{t.leave}</AlertDialogCancel>
          <AlertDialogAction onClick={() => answer(true)}>{t.playHere}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
