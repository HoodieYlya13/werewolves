"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { BadgeCheck, CircleUserRound, LogOut, UserRound } from "lucide-react";
import { AuthButton, goToAuth } from "@/components/account-button";
import { AccountLinks, AddAccountPhoto } from "@/components/account-page-link";
import { ConfirmButton } from "@/components/confirm-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useErrorToast } from "@/components/toasts";
import { useI18n } from "@/components/i18n-provider";
import { BackHome } from "@/components/back-home";
import { AddFriendButton, InviteFriendsButton, ProfileDialog, type ProfileTarget, useFriendToasts, useFriendsHere, useFriendsInRoom, useIsInvitedTo } from "@/components/friends/room-friends";
import { PhotoPicker } from "@/components/photo-picker";
import { rememberGuestGame } from "@/lib/guest-games";
import { Avatar, Face, RoomProvider } from "@/components/room-context";
import { ThemedI18n } from "@/components/themed-i18n";
import { ConnectionBanner, FatalError } from "@/components/room-status";
import { useNarrator, useWakeLock } from "@/hooks/use-narrator";
import { Spectator } from "@/components/phone/auto-game";
import { PhoneSkeleton } from "@/components/skeletons";
import { useRoom } from "@/hooks/use-room";
import { format } from "@/lib/i18n/config";
import { identity, takeoverKey } from "@/lib/room";
import { getTicket, setSignOutGuard, useSession } from "@/lib/session";
import { MAX_NAME_LENGTH, type ClientMessage, type ErrorCode, type PlayerView } from "@/lib/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MasterGoneCard } from "@/components/game/lead";
import { InGame } from "@/components/phone/in-game";
import { NameEditor, LockedSeatCard, KnockCard, RejoinCard, UsernameChoice, TakeBackCard } from "@/components/phone/seat-cards";

export function PlayerRoom() {
  const { code } = useParams<{ code: string }>();
  return <PlayerScreen key={code} code={code} />;
}
const rejoinKey = (code: string) => `ww:rejoin:${code}`;
/** Errors about the account, which the screen has no better place to show. */
const PHONE_TOASTS: ErrorCode[] = ["invalid-account", "account-in-use", "account-is-host", "room-full"];
function PlayerScreen({ code }: { code: string }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const { view, live, error, status, isAwaitingReply, send, clockOffset, close, flushed, otherRoom, clearOtherRoom } = useRoom<PlayerView>(code, "player");
  // The last join, link or rejoin sent with the account, to send again after "leave the other room".
  const lastAccountMessage = useRef<Extract<ClientMessage, { leaveOther?: boolean }> | null>(null);
  function sendWithAccount(message: Extract<ClientMessage, { leaveOther?: boolean }>) {
    lastAccountMessage.current = message;
    send(message);
  }
  // The name used last time, ready to change.
  const [name, setName] = useState(() => identity.getName());
  const [photo, setPhoto] = useState(() => identity.getPhoto());
  // Signed in: the first name (the username only to tell namesakes apart), or the username.
  const [showUsername, setShowUsername] = useState(() => identity.getShowUsername());
  const session = useSession();
  const account = session?.account ?? null;
  // Signed in, with an account seat: friends to add from the room, and to invite.
  const friendsOn = useFriendsInRoom();
  useFriendToasts();
  const me = view?.me;
  // A signed-in player's (or the game master's) profile, from a tap on their name.
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const accountSeats = view?.players.filter((p) => p.account).map((p) => p.id).join() ?? "";
  useFriendsHere(me?.account && friendsOn && status === "open" ? send : null, `${accountSeats}|${view?.host?.name ?? ""}`);

  useErrorToast(error, PHONE_TOASTS);
  // Without a game master: one device reads the game out loud, and screens stay on.
  useNarrator(view?.speaker ?? null, send);
  useWakeLock(!!view?.auto && !!view.game && !view.game.winner);

  // Asked to come in: its button spins until the room answers, fetching the account's ticket included.
  const [hasAskedToJoin, setHasAskedToJoin] = useState(false);
  const [isFetchingTicket, setIsFetchingTicket] = useState(false);
  const isJoining = isFetchingTicket || (hasAskedToJoin && isAwaitingReply);

  async function ticketToJoin() {
    setHasAskedToJoin(true);
    setIsFetchingTicket(true);
    const ticket = await getTicket({ room: code });
    setIsFetchingTicket(false);
    return ticket;
  }

  // Left an account's seat, then chose "Join as a new player": show the join form instead.
  const [joinAsNew, setJoinAsNew] = useState(false);

  const signedIn = !!account;

  // Came here to take this account's seat over from another device: join right away.
  const canJoin = !!view && !me && !view.rejoin;
  useEffect(() => {
    if (!canJoin || !signedIn) return;
    try {
      if (!sessionStorage.getItem(takeoverKey(code))) return;
      sessionStorage.removeItem(takeoverKey(code));
    } catch {
      return;
    }
    void getTicket({ room: code }).then((ticket) => ticket && send((lastAccountMessage.current = { type: "join", name: "", ticket })));
  }, [canJoin, signedIn, code, send]);

  // Back from "Sign in to come back": ask the game master straight away.
  const rejoinAccount = !!view?.rejoin?.account && view.rejoin.status !== "pending";
  useEffect(() => {
    if (!rejoinAccount || !signedIn) return;
    try {
      if (!sessionStorage.getItem(rejoinKey(code))) return;
      sessionStorage.removeItem(rejoinKey(code));
    } catch {
      return;
    }
    void getTicket({ room: code }).then((ticket) => ticket && send((lastAccountMessage.current = { type: "request-rejoin", name: "", ticket })));
  }, [rejoinAccount, signedIn, code, send]);

  // This phone's seat is an account's: prove the account to take it back (on
  // every connection, since the room asks again after each reconnect).
  const lockedName = view?.lockedSeat?.name;
  const unlock = useEffectEvent(() => void getTicket({ room: code }).then((ticket) => ticket && send({ type: "unlock", ticket })));
  useEffect(() => {
    if (lockedName && signedIn && status === "open") unlock();
  }, [lockedName, signedIn, status]);

  // Signing out while this seat is the account's leaves the room too (after a confirmation).
  const accountSeat = !!me?.account;
  const inGame = !!view?.game;
  useEffect(() => {
    if (!accountSeat) return;
    setSignOutGuard({
      inGame,
      leave: async () => {
        send({ type: "leave" });
        identity.setPlayer(code, null);
        await flushed();
        close();
      },
    });
    return () => setSignOutGuard(null);
  }, [accountSeat, inGame, send, flushed, close, code]);

  // Someone signed in with this player's name: say so once, they can pick another.
  const renamed = !!view?.renamed;
  const myName = me?.name;
  const sayRenamed = useEffectEvent((name: string) => toast(format(dict.play.renamed, { name }), { duration: 10_000 }));
  useEffect(() => {
    if (renamed && myName) sayRenamed(myName);
  }, [renamed, myName]);

  // Signed in after joining as a guest: the seat becomes the account's.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!me || me.account || !account || linked.current === me.id) return;
    linked.current = me.id;
    void getTicket({ room: code }).then((ticket) => ticket && send((lastAccountMessage.current = { type: "link-account", ticket })));
  }, [me, account, send, code]);

  // The account's name or photo changed (on the account page): the seat follows.
  const seat = me && view?.players.find((p) => p.id === me.id);
  const accountKey = account && `${account.sub}|${account.name}|${account.picture}`;
  const expectedName = account && (showUsername && account.username ? account.username : account.name);
  const outdated =
    !!seat?.account &&
    !!account &&
    !!expectedName &&
    // The room may have added a username or a number to tell namesakes apart ("Ylya (hy13)", "Ylya 2").
    (seat.picture !== account.picture || !(seat.name === expectedName || seat.name.startsWith(`${expectedName} `)));
  const synced = useRef<string | null>(null);
  useEffect(() => {
    if (!outdated || !accountKey || synced.current === accountKey) return;
    synced.current = accountKey;
    void getTicket({ room: code }).then((ticket) => ticket && send({ type: "link-account", ticket }));
  }, [outdated, accountKey, code, send]);

  // A guest's seat in a finished game: kept on this phone until it signs in.
  const claim = view?.claim;
  useEffect(() => {
    if (claim) rememberGuestGame(claim);
  }, [claim]);

  // The photo is remembered on this phone for the next rooms too.
  function changePhoto(data: string | null) {
    setPhoto(data);
    identity.setPhoto(data);
  }

  const isInvitedHere = useIsInvitedTo(code, !!session?.stats && !!account && !!view?.locked && !view.game);

  if (error === "room-not-found" || error === "room-closed") return <FatalError code={error} />;

  /** A guest's photo, in the room and remembered on this phone. */
  function changeOwnPhoto(data: string | null) {
    changePhoto(data);
    send({ type: "set-photo", data });
  }

  function leave() {
    send({ type: "leave" });
    identity.setPlayer(code, null);
    close();
    router.push(`/${locale}`);
  }

  /** An account's seat needs the account's proof; a guest seat only a name. */
  async function askToComeBack(newName: string) {
    if (isJoining) return;
    if (view?.rejoin?.account) {
      const ticket = await ticketToJoin();
      if (ticket) sendWithAccount({ type: "request-rejoin", name: newName, ticket });
      return;
    }
    identity.setName(newName.trim());
    setHasAskedToJoin(true);
    send({ type: "request-rejoin", name: newName });
  }

  async function joinWithAccount() {
    if (isJoining) return;
    const ticket = await ticketToJoin();
    // Signed out meanwhile: the session update shows the guest form instead.
    if (ticket && account) sendWithAccount({ type: "join", name: account.name, ticket, showUsername });
  }

  function changeShowUsername(value: boolean) {
    setShowUsername(value);
    identity.setShowUsername(value);
    if (me?.account) send({ type: "show-username", value });
  }

  /** Confirmed: leave the other room and send the same request again, with a new ticket. */
  async function leaveOtherRoom() {
    clearOtherRoom();
    const message = lastAccountMessage.current;
    const ticket = await getTicket({ room: code });
    if (message && ticket) send({ ...message, ticket, leaveOther: true });
  }

  function rename(newName: string) {
    identity.setName(newName.trim());
    send({ type: "rename-self", name: newName });
  }

  const room = { code, players: view?.players ?? [], timer: view?.timer ?? null, clockOffset };
  // Night, eyes closed: the phone shows its player's name and photo, and nothing else.
  const asleep = !!(me && live && view?.info && view.game && view.game.phase.kind === "night" && !view.game.prologue && !view.game.winner);
  // A game, or a locked room this account wasn't invited to: joining only asks the game master (and says so).
  const closed = view?.game ? dict.play.knock.game : view?.locked && !isInvitedHere ? dict.play.knock.locked : null;
  const knocking = view?.knock?.status === "pending";
  // What to show a phone without a seat depends on the account too: until both
  // are known, a skeleton instead of a form that may be the wrong one.
  const ready = !!view && (!!me || session !== null);

  return (
    <RoomProvider value={room}>
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10">
      <ConnectionBanner status={status} />
      {!asleep && (
        <div className="relative flex min-h-5 items-center justify-center">
          {/* No seat yet, or waiting in the lobby: a plain way home (the seat stays, and home leads back). */}
          {(!me || !view?.game) && <BackHome className="absolute left-0" />}
          <p className="font-mono text-sm tracking-[0.3em] text-muted-foreground">{code}</p>
        </div>
      )}

      {(error === "removed" || error === "signed-in-elsewhere" || error === "left-elsewhere" || error === "moved-room" || error === "seat-given") && (
        <p role="alert" className="text-center text-primary">
          {dict.errors[error]}
        </p>
      )}

      {!ready && <PhoneSkeleton code={code} />}

      {ready && view?.rejoin && !joinAsNew && (
        <RejoinCard
          rejoin={view.rejoin}
          isRoomOpen={!view.locked && view.phase === "lobby"}
          isAsking={isJoining}
          error={error}
          signedIn={!!account}
          onAsk={(newName) => void askToComeBack(newName)}
          onSignIn={() => {
            // Asked once back from signing in (see the effect above).
            try {
              sessionStorage.setItem(rejoinKey(code), "1");
            } catch {}
            goToAuth("in");
          }}
          onJoinAsNew={() => setJoinAsNew(true)}
        />
      )}

      {ready && view?.lockedSeat && !joinAsNew && (
        <LockedSeatCard
          seat={view.lockedSeat}
          signedIn={signedIn}
          wrongAccount={error === "wrong-account"}
          onJoinAsNew={() => setJoinAsNew(true)}
        />
      )}

      {ready && view?.masterAway && !me && <TakeBackCard masterAway={view.masterAway} code={code} signedIn={!!account} send={send} />}

      {/* A game master who handed the game over watches it. */}
      {ready && view && !me && view.spectate && <Spectator view={view} former />}

      {ready && view && !me && knocking && <KnockCard name={view.knock!.name} onCancel={() => send({ type: "cancel-request" })} />}

      {ready && view && !me && ((!view.rejoin && !view.lockedSeat) || joinAsNew) && !knocking && account && (
        <section className="card flex flex-col items-center gap-3 p-6 text-center">
          <Face name={expectedName ?? account.name} src={account.picture} className="size-24 text-3xl" />
          <p className="text-muted-foreground">{dict.account.fromAccount}</p>
          <AddAccountPhoto />
          {account.username && (
            <UsernameChoice username={account.username} checked={showUsername} onChange={changeShowUsername} />
          )}
          {closed && <p className="text-sm text-muted-foreground">{closed}</p>}
          <Button type="button" className="w-full" aria-busy={isJoining} onClick={joinWithAccount}>
            {isJoining && <Spinner />}
            {closed ? dict.play.knock.ask : format(dict.account.joinAs, { name: expectedName ?? account.name })}
          </Button>
          {view.knock?.status === "denied" && (
            <p role="alert" className="text-sm text-primary">
              {dict.play.knock.denied}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {dict.account.notYou}{" "}
            <AuthButton to="out" variant="link" className="h-auto p-0 text-sm font-normal underline">
              {dict.account.signOut}
            </AuthButton>
          </p>
        </section>
      )}

      {ready && view && !me && ((!view.rejoin && !view.lockedSeat) || joinAsNew) && !knocking && !account && (
        <form
          className="card flex flex-col gap-3 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || isJoining) return;
            identity.setName(name.trim());
            setHasAskedToJoin(true);
            send({ type: "join", name, photo });
          }}
        >
          <div className="flex flex-col items-center gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-24 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid size-24 place-items-center rounded-full bg-surface-2 text-muted-foreground">
                <UserRound className="size-10" />
              </span>
            )}
            <PhotoPicker hasPhoto={photo !== null} onChange={changePhoto} />
          </div>
          <label htmlFor="name" className="font-medium">
            {dict.play.yourName}
          </label>
          <Input
            id="name"
            autoCorrect="off"
            spellCheck={false}
            className="text-lg"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {closed && <p className="text-sm text-muted-foreground">{closed}</p>}
          <Button type="submit" aria-busy={isJoining} disabled={!name.trim()}>
            {isJoining && <Spinner />}
            {closed ? dict.play.knock.ask : dict.play.join}
          </Button>
          {(error === "name-taken" || error === "invalid-name") && (
            <p role="alert" className="text-sm text-primary">
              {dict.errors[error]}
            </p>
          )}
          {view.knock?.status === "denied" && (
            <p role="alert" className="text-sm text-primary">
              {dict.play.knock.denied}
            </p>
          )}
          {session?.enabled && (
            <AuthButton to="in" variant="link" className="h-auto p-0 text-sm font-normal whitespace-normal text-muted-foreground underline">
              <CircleUserRound aria-hidden className="size-4 shrink-0" />
              {dict.account.orSignIn}
            </AuthButton>
          )}
        </form>
      )}

      {me && !view?.info && (
        <section className="card flex flex-col items-center gap-3 p-6 text-center">
          <Avatar playerId={me.id} name={me.name} className="size-24 text-3xl" />
          <p className="text-xl font-semibold">{format(dict.play.joinedAs, { name: me.name })}</p>
          {me.account ? (
            <>
              <p className="text-sm text-muted-foreground">{dict.account.fromAccount}</p>
              <AccountLinks />
              {account?.username && (
                <UsernameChoice username={account.username} checked={showUsername} onChange={changeShowUsername} />
              )}
            </>
          ) : (
            <>
              <PhotoPicker
                hasPhoto={me.photo !== null}
                onChange={changeOwnPhoto}
              />
              <NameEditor name={me.name} error={error} onSave={rename} />
              {/* Signing in turns this seat into the account's (see the linking effect above). */}
              {session?.enabled && (
                <AuthButton to="in" variant="link" className="h-auto p-0 text-sm font-normal whitespace-normal text-muted-foreground underline">
                  <CircleUserRound aria-hidden className="size-4 shrink-0" />
                  {dict.account.orSignIn}
                </AuthButton>
              )}
            </>
          )}
          <p className="text-muted-foreground">{view?.mode === "auto" ? dict.play.waitingAuto : dict.play.waiting}</p>
          {me.account && friendsOn && !view?.game && <InviteFriendsButton send={send} />}
        </section>
      )}

      {me && view?.masterGone && <MasterGoneCard onLeave={leave} />}

      {me && view?.info && view.game && (
        <ThemedI18n theme={view.game.theme}>
          <InGame view={view} live={live} act={send} send={me.account && friendsOn ? send : null} />
        </ThemedI18n>
      )}

      {ready && view && !view.game && view.players.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">{dict.play.roomPlayers}</h2>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => {
              // Another signed-in player, seen from an account seat: ask them to be friends.
              const befriend = !!me?.account && friendsOn && p.account && p.id !== me.id;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-1.5 rounded-full py-1 pl-1 text-sm ${befriend ? "pr-1" : "pr-3"} ${p.id === me?.id ? "bg-primary text-primary-foreground" : "bg-surface-2"}`}
                >
                  {p.account ? (
                    <button type="button" className="flex items-center gap-1.5" onClick={() => setProfile({ playerId: p.id, name: p.name })}>
                      <Avatar playerId={p.id} name={p.name} className="size-6" />
                      {p.name}
                      {/* Signed in: the badge says a tap shows their profile. */}
                      <BadgeCheck aria-label={dict.host.accountPlayer} className={`size-3.5 shrink-0 ${p.id === me?.id ? "" : "text-ok"}`} />
                    </button>
                  ) : (
                    <>
                      <Avatar playerId={p.id} name={p.name} className="size-6" />
                      {p.name}
                    </>
                  )}
                  {befriend && <AddFriendButton name={p.name} playerId={p.id} send={send} className="size-6 rounded-full" />}
                </li>
              );
            })}
          </ul>
          {view.host && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <button type="button" className="flex items-center gap-2" onClick={() => setProfile({ playerId: null, name: view.host!.name })}>
                <Face name={view.host.name} src={view.host.picture} className="size-6 text-xs" />
                {format(dict.friends.gameMaster, { name: view.host.name })}
              </button>
              {me?.account && friendsOn && <AddFriendButton name={view.host.name} playerId={null} send={send} className="size-6 rounded-full" />}
            </p>
          )}
        </section>
      )}

      {/* During the game too: a guest changes their own name and photo, an account goes to its page. */}
      {me && view?.info && !asleep && (
        <div className="flex flex-col items-center gap-3">
          {me.account ? (
            <AccountLinks />
          ) : (
            <>
              <PhotoPicker
                hasPhoto={me.photo !== null}
                onChange={changeOwnPhoto}
              />
              <NameEditor name={me.name} error={error} onSave={rename} />
            </>
          )}
        </div>
      )}

      {me && !asleep && (
        <ConfirmButton
          type="button"
          variant="outline"
          className="mt-auto self-center text-muted-foreground"
          title={dict.play.leaveConfirm.title}
          description={view?.game ? dict.play.leaveConfirm.bodyInGame : dict.play.leaveConfirm.body}
          action={dict.play.leave}
          onConfirm={leave}
        >
          <LogOut aria-hidden className="size-4" />
          {dict.play.leave}
        </ConfirmButton>
      )}
      <AlertDialog open={otherRoom !== null} onOpenChange={(open) => !open && clearOtherRoom()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dict.play.otherRoom.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {format(otherRoom?.inGame ? dict.play.otherRoom.bodyInGame : dict.play.otherRoom.body, { code: otherRoom?.room ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.play.otherRoom.stay}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void leaveOtherRoom()}>{dict.play.otherRoom.leave}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ProfileDialog target={profile} onClose={() => setProfile(null)} send={send} />
    </main>
    </RoomProvider>
  );
}
