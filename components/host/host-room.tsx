"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BadgeCheck, ChevronDown, ChevronUp, Copy, Crown, GripVertical, History, Layers, Lock, LockOpen, Pencil, Share2, Smartphone, UserPlus, Users, X } from "lucide-react";
import { GiveLeadDialog, LeaderBar, LostLeaderCard } from "@/components/play/auto-game";
import { InGame } from "@/components/play/player-room";
import { PhotoPicker } from "@/components/photo-picker";
import { useNarrator, useWakeLock } from "@/hooks/use-narrator";
import { QuitMenu } from "@/components/host/game-screen";
import { useGameTheme } from "@/hooks/use-game-theme";
import { toast } from "sonner";
import { GameScreen } from "@/components/host/game-screen";
import { ThemedI18n } from "@/components/themed-i18n";
import { BackHome } from "@/components/back-home";
import { AddFriendButton, InviteFriendsButton, useFriendToasts, useFriendsInRoom } from "@/components/friends/room-friends";
import { CloseRoomButton } from "@/components/host/close-room-button";
import { useDragSort } from "@/components/host/drag-sort";
import { PlayerEditor } from "@/components/host/player-editor";
import { JoinRequests } from "@/components/host/join-requests";
import { SetupScreen } from "@/components/host/setup-screen";
import { Avatar, RoomProvider } from "@/components/room-context";
import { useI18n } from "@/components/i18n-provider";
import { QrCode } from "@/components/qr-code";
import { ConnectionBanner, FatalError } from "@/components/room-status";
import { HostRoomSkeleton } from "@/components/skeletons";
import { useErrorToast, useHostToasts } from "@/components/toasts";
import { useRoom } from "@/hooks/use-room";
import { MIN_PLAYERS } from "@/lib/engine";
import { format } from "@/lib/i18n/config";
import { MAX_NAME_LENGTH, type ClientMessage, type ErrorCode, type HostView } from "@/lib/protocol";
import { generateRoomCode, identity } from "@/lib/room";
import { getTicket, useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Errors the game master sees as toasts (the others end the session). */
const HOST_TOASTS: ErrorCode[] = ["name-taken", "invalid-name", "game-in-progress", "invalid-setup", "invalid-action", "invalid-account", "account-in-use", "room-full"];

/** Marks the history entry of the card picker (see chooseCards). */
const CARDS_ENTRY = "wwCards";

export function HostRoom() {
  const { code } = useParams<{ code: string }>();
  // Keyed so a new code (after a collision) starts from fresh state.
  return <HostLobby key={code} code={code} />;
}

function HostLobby({ code }: { code: string }) {
  const { view, error, status, send, clockOffset } = useRoom<HostView>(code, "host");
  const room = {
    code,
    players: view?.players ?? [],
    timer: view?.timer ?? null,
    clockOffset,
    ballot: view?.ballot ?? null,
    requests: view?.requests ?? [],
    handover: view?.handover ?? null,
    phonePlays: view?.phonePlays ?? null,
    candidates: view?.candidates ?? [],
    send,
  };
  return (
    <RoomProvider value={room}>
      <HostContent code={code} view={view} error={error} status={status} send={send} />
    </RoomProvider>
  );
}

function HostContent({
  code,
  view,
  error,
  status,
  send,
}: Pick<ReturnType<typeof useRoom<HostView>>, "view" | "error" | "status" | "send"> & { code: string }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [screen, setScreen] = useState<"lobby" | "setup">("lobby");
  const [editing, setEditing] = useState<string | null>(null);
  const [giving, setGiving] = useState<string | null>(null);

  // Seats can be dragged; a dropped row stays put until the room confirms the new order.
  const [moved, setMoved] = useState<{ basis: string; ids: string[] } | null>(null);
  const roomPlayers = view?.players ?? [];
  const basis = roomPlayers.map((p) => p.id).join();
  const seated = moved?.basis === basis ? moved.ids.flatMap((id) => roomPlayers.find((p) => p.id === id) ?? []) : roomPlayers;
  const seats = useDragSort((from, to) => {
    const ids = seated.map((p) => p.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    setMoved({ basis, ids });
    send({ type: "move-player", playerId: id, seat: to });
  });

  // Code collision on create: pick a new code and move there.
  useEffect(() => {
    if (error !== "room-taken" || !identity.getHost(code)) return;
    const token = identity.getHost(code)!.token;
    identity.setHost(code, null);
    const next = generateRoomCode();
    identity.setHost(next, { token });
    router.replace(`/${locale}/host/${next}`);
  }, [error, code, locale, router]);

  // Signed in: friends to add from the seats, and to invite.
  const friends = useFriendsInRoom();
  useFriendToasts();

  // The games a signed-in game master runs count in their stats.
  const session = useSession();
  const sub = session && (session.account?.sub ?? ""); // null while loading
  const connected = status === "open";
  useEffect(() => {
    if (!connected || sub === null) return;
    if (!sub) send({ type: "host-account", ticket: null });
    else void getTicket({ room: code }).then((ticket) => ticket && send({ type: "host-account", ticket }));
  }, [connected, sub, send, code]);

  // Each screen starts at its top, not where the last one was scrolled to
  // (the lobby's "Choose the cards" sits at the bottom, on phones especially).
  const page = view?.game || view?.seat?.game ? "game" : screen;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const nameInput = useRef<HTMLInputElement>(null);
  /** On to the cards. The table is set: the room locks, and anyone new asks first. */
  function chooseCards() {
    if (!view || view.game || view.players.length < MIN_PLAYERS) return;
    if (!view.locked) send({ type: "set-locked", locked: true });
    // The cards get a history entry of their own: a phone's back gesture (or the
    // browser's back button) returns to the lobby, not to the home page.
    window.history.pushState({ ...window.history.state, [CARDS_ENTRY]: true }, "");
    setScreen("setup");
  }
  function backToLobby() {
    if (window.history.state?.[CARDS_ENTRY]) window.history.back();
    else setScreen("lobby");
  }
  // Back from the cards: the lobby. Back from a game started there lands on the
  // lobby's entry, but a game is left for the home page (its banner leads back in).
  const inGame = page === "game";
  const onHistory = useEffectEvent(() => {
    if (window.history.state?.[CARDS_ENTRY]) return;
    if (inGame) router.replace(`/${locale}`);
    else setScreen("lobby");
  });
  useEffect(() => {
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, []);
  // Enter with nothing to type into goes on to the cards too.
  const onEnter = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (screen !== "lobby" || editing) return;
    const focused = document.activeElement;
    if (focused && focused !== document.body) return;
    e.preventDefault();
    chooseCards();
  });
  useEffect(() => {
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, []);

  useErrorToast(error, HOST_TOASTS);
  // While cards are picked, requests have their own row there instead.
  useHostToasts(view, screen === "setup" && !view?.game);

  if (error === "room-not-found" || error === "not-host" || error === "room-closed" || error === "host-moved" || error === "too-many-rooms")
    return <FatalError code={error} />;

  // Nothing about the room is known yet: not even whether it's an empty lobby.
  if (!view) {
    return (
      <>
        <ConnectionBanner status={status} />
        <HostRoomSkeleton />
      </>
    );
  }

  // Without a game master the creator plays: their own seat's screen, and the leading tools.
  if (view.seat?.game) {
    return (
      <>
        <ConnectionBanner status={status} />
        <RoomCode code={code} />
        <ThemedI18n theme={view.seat.game.theme}>
          <AutoHostGame view={view} send={send} />
        </ThemedI18n>
      </>
    );
  }

  if (view.game) {
    return (
      <>
        <ConnectionBanner status={status} />
        <RoomCode code={code} />
        <ThemedI18n theme={view.game.setup.settings.theme}>
          <GameScreen view={view} game={view.game} send={send} />
        </ThemedI18n>
      </>
    );
  }

  if (view && screen === "setup") {
    return (
      <>
        <ConnectionBanner status={status} />
        <RoomCode code={code} />
        <SetupScreen
          players={view.players}
          canResume={view.canResume}
          send={send}
          onBack={backToLobby}
          mode={view.mode}
        />
      </>
    );
  }

  const joinUrl = `${window.location.origin}/play/${code}`;
  const players = seated;
  // Phones (and some desktops) have a share sheet; elsewhere copying is enough.
  const canShare = typeof navigator.share === "function";
  const copy = (text: string, done: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(done, { id: "copied" }), () => {});

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-3 lg:col-span-2">
        <ConnectionBanner status={status} />
        {/* Leaving keeps the room open: home offers to resume it (ResumeRooms). */}
        <BackHome />
      </div>

      <section className="card flex flex-col items-center gap-4 p-6 text-center lg:sticky lg:top-6 lg:self-start">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{dict.host.roomCode}</p>
        {/* The copy button hangs off the right so the code itself stays centred. */}
        <div className="relative">
          <p className="selectable font-mono text-6xl font-bold tracking-[0.25em] sm:text-7xl">{code}</p>
          <IconButton
            label={dict.host.copyCode}
            className="absolute top-1/2 -right-8 grid -translate-y-1/2"
            onClick={() => copy(code, dict.host.codeCopied)}
          >
            <Copy aria-hidden className="size-4" />
          </IconButton>
        </div>
        <div className="rounded-2xl bg-white p-3 text-black">
          <QrCode value={joinUrl} className="size-48 sm:size-56" />
        </div>
        <p className="text-sm text-muted-foreground">
          {dict.host.scanToJoin}
          {/* Sent to someone who can't scan the code. */}
          <span className="selectable block font-mono break-all text-fg">{joinUrl.replace(/^https?:\/\//, "")}</span>
        </p>
        <div className="flex w-full gap-2 [&>*]:flex-1">
          <Button type="button" variant="outline" onClick={() => copy(joinUrl, dict.host.linkCopied)}>
            <Copy aria-hidden className="size-4" />
            {dict.host.copyLink}
          </Button>
          {canShare && (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.share({ url: joinUrl, text: format(dict.host.shareText, { code }) }).catch(() => {})}
            >
              <Share2 aria-hidden className="size-4" />
              {dict.host.share}
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="outline" className="w-full"
          disabled={!view}
          onClick={() => send({ type: "set-locked", locked: !view?.locked })}
        >
          {view?.locked ? <LockOpen aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
          {view?.locked ? dict.host.unlock : dict.host.lock}
        </Button>
        {view?.locked && <p className="text-sm text-muted-foreground">{dict.host.locked}</p>}
        {friends && <InviteFriendsButton send={send} className="w-full" />}
      </section>

      <section className="card flex flex-col gap-4 p-4 sm:p-6">
        <ModeChoice view={view} send={send} />
        <JoinRequests inGame={false} />
        <div>
          <h1 className="text-xl font-semibold">{format(dict.host.players, { count: players.length })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dict.host.seatingHint}</p>
        </div>

        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted-foreground">{dict.host.noPlayers}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {players.map((p, i) => (
              <li
                key={p.id}
                style={seats.rowStyle(i)}
                className={`flex items-center gap-1.5 rounded-xl bg-surface-2 py-2 pr-1 pl-1 sm:gap-3 sm:pr-2 sm:pl-2 ${seats.dragging === i ? "shadow-lg ring-1 ring-moon/50" : ""}`}
              >
                <button
                  type="button"
                  aria-label={format(dict.host.dragSeat, { name: p.name })}
                  title={format(dict.host.dragSeat, { name: p.name })}
                  className={`grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-fg sm:size-8 ${seats.dragging === i ? "cursor-grabbing" : "cursor-grab"}`}
                  {...seats.handleProps(i)}
                >
                  <GripVertical className="size-4" />
                </button>
                <span className="w-4 shrink-0 text-right font-mono text-sm text-muted-foreground sm:w-5">{i + 1}</span>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  // Account players' names and photos are theirs to change.
                  disabled={p.account}
                  title={p.account ? dict.host.accountPlayer : undefined}
                  onClick={() => setEditing(p.id)}
                >
                  {/* Online or not, as a dot on the face: the row keeps its width for the name. */}
                  <span className="relative shrink-0">
                    <Avatar playerId={p.id} name={p.name} />
                    {!p.manual && (
                      <span
                        className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-surface-2 ${p.connected ? "bg-ok" : "bg-muted-foreground"}`}
                        title={p.connected ? dict.host.online : dict.host.offline}
                      />
                    )}
                  </span>
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  {p.account && <BadgeCheck aria-label={dict.host.accountPlayer} className="size-3.5 shrink-0 text-ok" />}
                  {p.id === view.seatId && <span className="shrink-0 rounded-full bg-moon/15 px-2 py-0.5 text-xs text-moon">{dict.lead.you}</span>}
                </button>
                {/* Hands the room to this player's device. */}
                {p.id !== view.seatId && !p.manual && p.connected && (
                  <IconButton label={format(dict.lead.giveRoom, { name: p.name })} onClick={() => setGiving(p.id)}>
                    <Crown className="size-4" />
                  </IconButton>
                )}
                {p.left && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{dict.host.left}</span>}
                {p.manual && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={dict.host.noPhone}>
                    <Smartphone aria-hidden className="size-3.5" />
                    <span className="sr-only sm:not-sr-only">{dict.host.noPhone}</span>
                  </span>
                )}
                {/* An account player has no edit button: the space asks them to be friends instead. */}
                {p.account && friends && <AddFriendButton name={p.name} playerId={p.id} send={send} />}
                {/* On phones the row is too narrow: tapping the name edits too. */}
                {!p.account && (
                  <IconButton
                    label={format(dict.host.editPlayer, { name: p.name })}
                    className="hidden sm:grid"
                    onClick={() => setEditing(p.id)}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                )}
                <IconButton
                  label={format(dict.host.moveUp, { name: p.name })}
                  disabled={i === 0}
                  onClick={() => send({ type: "move-player", playerId: p.id, seat: i - 1 })}
                >
                  <ChevronUp className="size-4" />
                </IconButton>
                <IconButton
                  label={format(dict.host.moveDown, { name: p.name })}
                  disabled={i === players.length - 1}
                  onClick={() => send({ type: "move-player", playerId: p.id, seat: i + 1 })}
                >
                  <ChevronDown className="size-4" />
                </IconButton>
                {p.id !== view.seatId && (
                  <IconButton
                    label={format(dict.host.remove, { name: p.name })}
                    onClick={() => send({ type: "remove-player", playerId: p.id })}
                  >
                    <X className="size-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ol>
        )}

        {view.mode !== "auto" && (
        <form
          className="mt-auto flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            send({ type: "add-player", name });
            setName("");
            // Clicking Add moves focus to the button: back to the name for the next one.
            nameInput.current?.focus();
          }}
        >
          <label htmlFor="add-player" className="text-sm font-medium">
            {dict.host.addPlayer}
          </label>
          <div className="flex gap-2">
            <Input
              id="add-player"
              ref={nameInput}
              placeholder={dict.host.addPlayerPlaceholder}
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              // An empty name: Enter means "that's everyone", on to the cards.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !name.trim()) {
                  e.preventDefault();
                  chooseCards();
                }
              }}
            />
            <Button type="submit" variant="outline" className="shrink-0" disabled={!view || !name.trim()}>
              <UserPlus aria-hidden className="size-4" />
              {dict.host.add}
            </Button>
          </div>
        </form>
        )}
        <GiveLeadDialog
          open={giving !== null}
          onClose={() => setGiving(null)}
          hint={dict.lead.lobbyHint}
          eligible={(id) => id === giving}
          send={send}
        />
        {editing && <PlayerEditor playerId={editing} onClose={() => setEditing(null)} />}

        {view?.canResume && (
          <Button type="button" variant="outline" className="h-12 text-base" onClick={() => send({ type: "resume-game" })}>
            <History aria-hidden className="size-5" />
            {dict.host.resume}
          </Button>
        )}
        <Button
          type="button"
          className="h-12 text-base"
          disabled={!view || players.length < MIN_PLAYERS}
          onClick={chooseCards}
        >
          <Layers aria-hidden className="size-5" />
          {dict.setup.start}
        </Button>
        {players.length < MIN_PLAYERS && (
          <p className="-mt-2 text-center text-sm text-muted-foreground">{format(dict.setup.needPlayers, { min: MIN_PLAYERS })}</p>
        )}
        {view && <CloseRoomButton className="self-center" />}
      </section>
    </main>
  );
}

/**
 * With a game master (who runs the game and doesn't play), or without one:
 * the app runs it and the creator takes a seat like everyone, under their
 * account's name or one they type (with a photo).
 */
function ModeChoice({ view, send }: { view: HostView; send: (message: ClientMessage) => void }) {
  const { dict, locale } = useI18n();
  const session = useSession();
  const t = dict.auto.mode;
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState(() => identity.getName());
  const [photo, setPhoto] = useState(() => identity.getPhoto());
  const auto = view.mode === "auto";
  function choose(mode: "master" | "auto") {
    if (mode === "master") {
      setAsking(false);
      if (auto) send({ type: "set-mode", mode, locale });
      return;
    }
    if (auto) return;
    if (session?.account) send({ type: "set-mode", mode, locale });
    else setAsking(true);
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">{t.title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["master", "auto"] as const).map((mode) => {
          const on = mode === "auto" ? auto || asking : !auto && !asking;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={on}
              onClick={() => choose(mode)}
              className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left ${on ? "border-primary bg-primary/10" : "border-line bg-surface hover:border-fg/30"}`}
            >
              {mode === "master" ? <Crown aria-hidden className="mt-0.5 size-5 shrink-0 text-moon" /> : <Users aria-hidden className="mt-0.5 size-5 shrink-0 text-moon" />}
              <span>
                <span className="block font-semibold">{mode === "master" ? t.master : t.auto}</span>
                <span className="block text-xs text-muted-foreground">{mode === "master" ? t.masterHint : t.autoHint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {asking && !auto && (
        <form
          className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            identity.setName(name.trim());
            identity.setPhoto(photo);
            send({ type: "set-mode", mode: "auto", name, photo, locale });
            setAsking(false);
          }}
        >
          <div className="flex items-center gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid size-14 place-items-center rounded-full bg-surface text-muted-foreground">
                <Users className="size-6" />
              </span>
            )}
            <PhotoPicker hasPhoto={photo !== null} onChange={setPhoto} />
          </div>
          <label htmlFor="creator-name" className="text-sm font-medium">
            {t.yourName}
          </label>
          <div className="flex gap-2">
            <Input id="creator-name" maxLength={MAX_NAME_LENGTH} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Button type="submit" className="shrink-0" disabled={!name.trim()}>
              {dict.play.join}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** The creator's screen during a game without a game master: their seat, plus the leading tools. */
function AutoHostGame({ view, send }: { view: HostView; send: (message: ClientMessage) => void }) {
  const { dict } = useI18n();
  const seat = view.seat!;
  const [giving, setGiving] = useState(false);
  useNarrator(seat.speaker, send);
  useWakeLock(!seat.game?.winner);
  const over = !!seat.game?.winner;
  useGameTheme(seat.game?.phase.kind === "night" && !seat.game.prologue && !over);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10">
      <JoinRequests inGame />
      {view.lostLeader && <LostLeaderCard name={view.lostLeader.name} send={send} />}
      <InGame
        view={seat}
        live
        act={send}
        send={null}
        lead={
          <LeaderBar view={seat} paused={view.paused} send={send}>
            {over && (
              <Button type="button" variant="outline" className="h-10 px-4" onClick={() => send({ type: "end-game" })}>
                <X aria-hidden className="size-4" />
                {dict.game.steps["game-over"].newGame}
              </Button>
            )}
            <QuitMenu over={over} onEndGame={() => send({ type: "end-game" })} onGiveLead={() => setGiving(true)} giveLabel={dict.lead.giveLead} />
          </LeaderBar>
        }
      />
      <GiveLeadDialog open={giving} onClose={() => setGiving(false)} hint={dict.lead.leadHint} send={send} exclude={view.seatId} />
    </main>
  );
}

/** The room code, out of the lobby too, for anyone who needs it again (like on phones). */
function RoomCode({ code }: { code: string }) {
  const { dict } = useI18n();
  return (
    <p className="mb-4 text-center font-mono text-sm tracking-[0.3em] text-muted-foreground" aria-label={`${dict.host.roomCode} ${code}`}>
      {code}
    </p>
  );
}

function IconButton({
  label,
  children,
  className = "grid",
  ...props
}: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${className} size-7 shrink-0 place-items-center rounded-lg sm:size-8 text-muted-foreground hover:bg-surface hover:text-fg disabled:opacity-30`}
      {...props}
    >
      {children}
    </button>
  );
}
