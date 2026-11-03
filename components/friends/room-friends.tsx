"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChartColumn, Check, Clock, Send, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRoomReply } from "@/hooks/use-room";
import type { Person, ProfilePeek } from "@/lib/friends";
import { friendsApi } from "@/lib/friends-client";
import { format } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
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
    if (reply.type === "friends-here" || reply.type === "profile") return;
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
      <span role="img" aria-label={label} title={label} className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-ok", className)}>
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
      // Merged, so a smaller size from the caller wins (a pill's height stays the avatar's).
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-fg", className)}
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

/** Whose profile to show: a seat, or the game master (null). */
export type ProfileTarget = { playerId: string | null; name: string };

/**
 * A signed-in player in brief, from a tap on their name in the room: photo,
 * games and wins, where they stand with the viewer (and the button that goes
 * with it), and their full profile in a new tab (the room stays open).
 */
export function ProfileDialog({
  target,
  onClose,
  send,
  children,
}: {
  target: ProfileTarget | null;
  onClose: () => void;
  send: (msg: ClientMessage) => void;
  /** More for this profile, shown even when it couldn't load (one's own seat: account settings). */
  children?: React.ReactNode;
}) {
  const { dict, locale } = useI18n();
  const t = dict.friends.peek;
  const key = target ? (target.playerId ?? HOST) : null;
  const [answer, setAnswer] = useState<{ key: string; profile: ProfilePeek | null } | null>(null);
  useEffect(() => {
    if (target) send({ type: "profile", playerId: target.playerId });
    // Only when another profile opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useRoomReply((reply) => {
    if (reply.type === "profile" && (reply.playerId ?? HOST) === key) setAnswer({ key, profile: reply.profile });
    // A request from this dialog: show where things stand now.
    if (reply.type === "friend-result" && target) send({ type: "profile", playerId: target.playerId });
  });
  const loaded = answer && answer.key === key ? answer : null;
  const profile = loaded?.profile ?? null;

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm" closeLabel={dict.host.close}>
        <DialogHeader className="items-center text-center">
          {profile ? (
            <Face name={profile.name} src={profile.picture} className="size-20 text-2xl" />
          ) : (
            <span aria-hidden className="size-20 animate-pulse rounded-full bg-surface-2" />
          )}
          <DialogTitle className="text-xl">{profile?.name ?? target?.name}</DialogTitle>
          <DialogDescription>{profile?.username ? `@${profile.username}` : loaded && !profile ? t.failed : "\u00a0"}</DialogDescription>
        </DialogHeader>
        {profile && (
          <div className="flex flex-col gap-3">
            {/* A record as people say it: wins, draws (games nobody won), losses. How the viewer fares against them is on the full profile. */}
            <div className="rounded-xl bg-surface-2 px-3 py-2 text-center">
              <p className="font-mono text-2xl font-bold">
                {profile.won}–{profile.drawn}–{profile.played - profile.won - profile.drawn}
              </p>
              <p className="text-xs text-muted-foreground">{t.record}</p>
            </div>
            {profile.friendship === "friends" && (
              <p className="flex items-center justify-center gap-2 font-medium text-ok">
                <UserCheck aria-hidden className="size-4" />
                {t.friends}
              </p>
            )}
            {profile.friendship === "sent" && (
              <p className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock aria-hidden className="size-4" />
                {t.sent}
              </p>
            )}
            {(profile.friendship === "none" || profile.friendship === "received") && (
              <Button type="button" onClick={() => send({ type: "add-friend", playerId: target!.playerId })}>
                <UserPlus aria-hidden className="size-4" />
                {profile.friendship === "received" ? t.accept : t.add}
              </Button>
            )}
            {profile.friendship === "guest" && <p className="text-center text-sm text-muted-foreground">{t.guest}</p>}
            <Button asChild variant="outline">
              <Link href={`/${locale}/players/${profile.code}`}>
                <ChartColumn aria-hidden className="size-4" />
                {profile.friendship === "self" ? t.yours : t.full}
              </Link>
            </Button>
          </div>
        )}
        {children && <div className="flex flex-col items-center gap-3 border-t border-line pt-4">{children}</div>}
      </DialogContent>
    </Dialog>
  );
}
