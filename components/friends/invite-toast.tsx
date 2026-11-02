"use client";

import { X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import type { FriendFace } from "@/lib/protocol";

/** A friend's invite, as a toast card: join the room, or dismiss. */
export function InviteCard({ from, room, onJoin, close }: { from: FriendFace; room: string; onJoin: () => void; close: () => void }) {
  const { dict } = useI18n();
  const t = dict.friends;
  return (
    <div className="relative flex w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-line bg-surface p-4 pr-10 text-fg shadow-xl">
      <Face name={from.name} src={from.picture} className="size-10 text-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="font-semibold">{format(t.inviteToast, { name: from.name })}</p>
          <p className="font-mono text-sm tracking-widest text-muted-foreground">{format(t.inviteToastBody, { code: room })}</p>
        </div>
        <Button type="button" size="sm" className="w-fit" onClick={onJoin}>
          {t.join}
        </Button>
      </div>
      <button
        type="button"
        aria-label={dict.account.later}
        onClick={close}
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-fg"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
