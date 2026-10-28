"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BadgeCheck, ChevronDown, ChevronUp, History, Layers, Lock, LockOpen, Pencil, Smartphone, UserPlus, X } from "lucide-react";
import { GameScreen } from "@/components/host/game-screen";
import { ThemedI18n } from "@/components/themed-i18n";
import { CloseRoomButton } from "@/components/host/close-room-button";
import { PlayerEditor } from "@/components/host/player-editor";
import { RejoinRequests } from "@/components/host/rejoin-requests";
import { SetupScreen } from "@/components/host/setup-screen";
import { Avatar, RoomProvider } from "@/components/room-context";
import { useI18n } from "@/components/i18n-provider";
import { QrCode } from "@/components/qr-code";
import { ConnectionBanner, FatalError } from "@/components/room-status";
import { useErrorToast, useHostToasts } from "@/components/toasts";
import { useRoom } from "@/hooks/use-room";
import { MIN_PLAYERS } from "@/lib/engine";
import { format } from "@/lib/i18n/config";
import { MAX_NAME_LENGTH, type ErrorCode, type HostView } from "@/lib/protocol";
import { generateRoomCode, identity } from "@/lib/room";
import { getTicket, useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Errors the game master sees as toasts (the others end the session). */
const HOST_TOASTS: ErrorCode[] = ["name-taken", "invalid-name", "game-in-progress", "invalid-setup", "invalid-action", "invalid-account", "account-in-use"];

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

  // Code collision on create: pick a new code and move there.
  useEffect(() => {
    if (error !== "room-taken" || !identity.getHost(code)) return;
    const token = identity.getHost(code)!.token;
    identity.setHost(code, null);
    const next = generateRoomCode();
    identity.setHost(next, { token });
    router.replace(`/${locale}/host/${next}`);
  }, [error, code, locale, router]);

  // The games a signed-in game master runs count in their stats.
  const session = useSession();
  const sub = session && (session.account?.sub ?? ""); // null while loading
  const connected = status === "open";
  useEffect(() => {
    if (!connected || sub === null) return;
    if (!sub) send({ type: "host-account", ticket: null });
    else void getTicket({ room: code }).then((ticket) => ticket && send({ type: "host-account", ticket }));
  }, [connected, sub, send, code]);

  useErrorToast(error, HOST_TOASTS);
  useHostToasts(view);

  if (error === "room-not-found" || error === "not-host" || error === "room-closed" || error === "host-moved")
    return <FatalError code={error} />;

  if (view?.game) {
    return (
      <>
        <ConnectionBanner status={status} />
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
        <SetupScreen
          players={view.players}
          canResume={view.canResume}
          send={send}
          onBack={() => setScreen("lobby")}
        />
      </>
    );
  }

  const joinUrl = `${window.location.origin}/play/${code}`;
  const players = view?.players ?? [];

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="lg:col-span-2">
        <ConnectionBanner status={status} />
      </div>

      <section className="card flex flex-col items-center gap-4 p-6 text-center lg:sticky lg:top-6 lg:self-start">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{dict.host.roomCode}</p>
        <p className="font-mono text-6xl font-bold tracking-[0.25em] sm:text-7xl">{code}</p>
        <div className="rounded-2xl bg-white p-3 text-black">
          <QrCode value={joinUrl} className="size-48 sm:size-56" />
        </div>
        <p className="text-sm text-muted-foreground">
          {dict.host.scanToJoin}{" "}
          <span className="font-mono break-all text-fg">{joinUrl.replace(/^https?:\/\//, "")}</span>
        </p>
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
      </section>

      <section className="card flex flex-col gap-4 p-4 sm:p-6">
        <RejoinRequests />
        <div>
          <h1 className="text-xl font-semibold">{format(dict.host.players, { count: players.length })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dict.host.seatingHint}</p>
        </div>

        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted-foreground">{dict.host.noPlayers}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-surface-2 py-2 pr-1 pl-2 sm:gap-3 sm:pr-2 sm:pl-3">
                <span className="w-5 shrink-0 text-right font-mono text-sm text-muted-foreground sm:w-6">{i + 1}</span>
                <span
                  className={`size-2.5 shrink-0 rounded-full ${p.manual ? "bg-transparent" : p.connected ? "bg-ok" : "bg-muted-foreground/40"}`}
                  title={p.manual ? undefined : p.connected ? dict.host.online : dict.host.offline}
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  // Account players' names and photos are theirs to change.
                  disabled={p.account}
                  title={p.account ? dict.host.accountPlayer : undefined}
                  onClick={() => setEditing(p.id)}
                >
                  <Avatar playerId={p.id} name={p.name} />
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  {p.account && <BadgeCheck aria-label={dict.host.accountPlayer} className="size-3.5 shrink-0 text-ok" />}
                </button>
                {p.left && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{dict.host.left}</span>}
                {p.manual && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={dict.host.noPhone}>
                    <Smartphone aria-hidden className="size-3.5" />
                    <span className="sr-only sm:not-sr-only">{dict.host.noPhone}</span>
                  </span>
                )}
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
                <IconButton
                  label={format(dict.host.remove, { name: p.name })}
                  onClick={() => send({ type: "remove-player", playerId: p.id })}
                >
                  <X className="size-4" />
                </IconButton>
              </li>
            ))}
          </ol>
        )}

        <form
          className="mt-auto flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            send({ type: "add-player", name });
            setName("");
          }}
        >
          <label htmlFor="add-player" className="text-sm font-medium">
            {dict.host.addPlayer}
          </label>
          <div className="flex gap-2">
            <Input
              id="add-player"
              placeholder={dict.host.addPlayerPlaceholder}
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="outline" className="shrink-0" disabled={!view || !name.trim()}>
              <UserPlus aria-hidden className="size-4" />
              {dict.host.add}
            </Button>
          </div>
        </form>
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
          onClick={() => setScreen("setup")}
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
      className={`${className} size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-fg disabled:opacity-30`}
      {...props}
    >
      {children}
    </button>
  );
}
