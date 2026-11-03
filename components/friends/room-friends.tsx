"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Send, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRoomReply } from "@/hooks/use-room";
import type { Person } from "@/lib/friends";
import { friendsApi } from "@/lib/friends-client";
import { format } from "@/lib/i18n/config";
import type { ClientMessage } from "@/lib/protocol";
import { useSession } from "@/lib/session";

/** Whether this device can use friends in a room: signed in, with the database on. */
export function useFriendsInRoom() {
  const session = useSession();
  return !!session?.stats && !!session.account;
}

/** Toasts the room's answers to "add friend" and "invite" (mounted once per room screen). */
export function useFriendToasts() {
  const { dict } = useI18n();
  const t = dict.friends;
  useRoomReply((reply) => {
    if (reply.type === "friends-here") return;
    if (reply.type === "friend-result") toast(t.results[reply.result]);
    else toast(reply.count === 0 ? t.invitedNone : reply.count === 1 ? t.invitedOne : format(t.invitedMany, { count: String(reply.count) }));
  });
}

// Who in the room is already a friend (seat ids, "host" for the game master), as the room last said.
let friendsHere = new Set<string>();
const friendsListeners = new Set<() => void>();
const subscribeFriends = (listener: () => void) => {
  friendsListeners.add(listener);
  return () => friendsListeners.delete(listener);
};
const HOST = "host";

/**
 * Asks the room which accounts here are already friends, again whenever the
 * signed-in seats (`key`) change or a request may have made a new friend.
 * Mounted once per room screen, next to useFriendToasts.
 */
export function useFriendsHere(send: ((msg: ClientMessage) => void) | null, key: string) {
  useEffect(() => {
    if (send) send({ type: "friends-here" });
  }, [send, key]);
  useRoomReply((reply) => {
    if (reply.type === "friend-result" && reply.result === "accepted" && send) send({ type: "friends-here" });
    if (reply.type !== "friends-here") return;
    friendsHere = new Set([...reply.playerIds, ...(reply.host ? [HOST] : [])]);
    friendsListeners.forEach((l) => l());
  });
}

/** Asks someone in the room (a seat, or the game master: null) to be friends; already friends, says so. */
export function AddFriendButton({ name, playerId, send, className = "" }: { name: string; playerId: string | null; send: (msg: ClientMessage) => void; className?: string }) {
  const { dict } = useI18n();
  const friend = useSyncExternalStore(subscribeFriends, () => friendsHere.has(playerId ?? HOST), () => false);
  if (friend) {
    const label = format(dict.friends.alreadyFriend, { name });
    return (
      <span role="img" aria-label={label} title={label} className={`grid size-8 shrink-0 place-items-center rounded-lg text-ok ${className}`}>
        <UserCheck aria-hidden className="size-4" />
      </span>
    );
  }
  const label = format(dict.friends.addFriend, { name });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => send({ type: "add-friend", playerId })}
      className={`grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-fg ${className}`}
    >
      <UserPlus aria-hidden className="size-4" />
    </button>
  );
}

/** Picks friends and invites them to this room. */
export function InviteFriendsButton({ send, className }: { send: (msg: ClientMessage) => void; className?: string }) {
  const { dict, locale } = useI18n();
  const t = dict.friends;
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  function show() {
    setOpen(true);
    setPicked([]);
    void friendsApi.list().then((list) => setFriends(list?.friends ?? []));
  }

  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={show}>
        <Send aria-hidden className="size-4" />
        {t.invite}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.invite}</DialogTitle>
            <DialogDescription>{t.inviteHint}</DialogDescription>
          </DialogHeader>
          {friends === null ? (
            <p className="py-4 text-center text-muted-foreground">…</p>
          ) : friends.length === 0 ? (
            <p className="py-2 text-muted-foreground">
              {t.inviteNone}{" "}
              <Link href={`/${locale}/friends`} className="underline" onClick={() => setOpen(false)}>
                {t.seeFriends}
              </Link>
            </p>
          ) : (
            <ul className="-mx-2 flex max-h-[50vh] flex-col overflow-y-auto">
              {friends.map((f) => {
                const on = picked.includes(f.sub);
                return (
                  <li key={f.sub}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setPicked((p) => (on ? p.filter((s) => s !== f.sub) : [...p, f.sub]))}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${on ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
                    >
                      <Face name={f.name} src={f.picture} className="size-9 text-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{f.name}</span>
                        {f.username && <span className="block truncate text-sm text-muted-foreground">@{f.username}</span>}
                      </span>
                      <span className={`grid size-6 shrink-0 place-items-center rounded-md border ${on ? "border-primary bg-primary text-primary-foreground" : "border-line"}`}>
                        {on && <Check aria-hidden className="size-4" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter>
            <Button
              type="button"
              disabled={picked.length === 0}
              onClick={() => {
                send({ type: "invite", subs: picked });
                setOpen(false);
              }}
            >
              <Send aria-hidden className="size-4" />
              {format(t.inviteSend, { count: String(picked.length) })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
