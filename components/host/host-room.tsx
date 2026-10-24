"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Layers, Lock, LockOpen, Smartphone, UserPlus, X } from "lucide-react";
import { GameScreen } from "@/components/host/game-screen";
import { SetupScreen } from "@/components/host/setup-screen";
import { useI18n } from "@/components/i18n-provider";
import { QrCode } from "@/components/qr-code";
import { ConnectionBanner, FatalError } from "@/components/room-status";
import { useRoom } from "@/hooks/use-room";
import { MIN_PLAYERS } from "@/lib/engine";
import { format } from "@/lib/i18n/config";
import { MAX_NAME_LENGTH, type HostView } from "@/lib/protocol";
import { generateRoomCode, identity } from "@/lib/room";

export function HostRoom() {
  const { code } = useParams<{ code: string }>();
  // Keyed so a new code (after a collision) starts from fresh state.
  return <HostLobby key={code} code={code} />;
}

function HostLobby({ code }: { code: string }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const { view, error, status, send } = useRoom<HostView>(code, "host");
  const [name, setName] = useState("");
  const [screen, setScreen] = useState<"lobby" | "setup">("lobby");

  // Code collision on create: pick a new code and move there.
  useEffect(() => {
    if (error !== "room-taken" || !identity.getHost(code)) return;
    const token = identity.getHost(code)!.token;
    identity.setHost(code, null);
    const next = generateRoomCode();
    identity.setHost(next, { token });
    router.replace(`/${locale}/host/${next}`);
  }, [error, code, locale, router]);

  if (error === "room-not-found" || error === "not-host") return <FatalError code={error} />;

  if (view?.game) {
    return (
      <>
        <ConnectionBanner status={status} />
        <GameScreen view={view} game={view.game} error={error} send={send} />
      </>
    );
  }

  if (view && screen === "setup") {
    return (
      <>
        <ConnectionBanner status={status} />
        <SetupScreen players={view.players} send={send} onBack={() => setScreen("lobby")} />
        {error && (
          <p role="alert" className="mx-auto mb-6 text-sm text-accent">
            {dict.errors[error]}
          </p>
        )}
      </>
    );
  }

  const joinUrl = `${window.location.origin}/play/${code}`;
  const players = view?.players ?? [];

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="lg:col-span-2">
        <ConnectionBanner status={status} />
      </div>

      <section className="card flex flex-col items-center gap-4 p-6 text-center lg:sticky lg:top-6 lg:self-start">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">{dict.host.roomCode}</p>
        <p className="font-mono text-6xl font-bold tracking-[0.25em] sm:text-7xl">{code}</p>
        <div className="rounded-2xl bg-white p-3 text-black">
          <QrCode value={joinUrl} className="size-48 sm:size-56" />
        </div>
        <p className="text-sm text-muted">
          {dict.host.scanToJoin}{" "}
          <span className="font-mono break-all text-fg">{joinUrl.replace(/^https?:\/\//, "")}</span>
        </p>
        <button
          type="button"
          className="btn btn-ghost w-full"
          disabled={!view}
          onClick={() => send({ type: "set-locked", locked: !view?.locked })}
        >
          {view?.locked ? <LockOpen aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
          {view?.locked ? dict.host.unlock : dict.host.lock}
        </button>
        {view?.locked && <p className="text-sm text-muted">{dict.host.locked}</p>}
      </section>

      <section className="card flex flex-col gap-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">{format(dict.host.players, { count: players.length })}</h1>
          <p className="mt-1 text-sm text-muted">{dict.host.seatingHint}</p>
        </div>

        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">{dict.host.noPlayers}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 py-2 pr-2 pl-3">
                <span className="w-6 text-right font-mono text-sm text-muted">{i + 1}</span>
                <span
                  className={`size-2.5 shrink-0 rounded-full ${p.manual ? "bg-transparent" : p.connected ? "bg-ok" : "bg-muted/40"}`}
                  title={p.manual ? undefined : p.connected ? dict.host.online : dict.host.offline}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                {p.manual && (
                  <span className="flex items-center gap-1 text-xs text-muted" title={dict.host.noPhone}>
                    <Smartphone aria-hidden className="size-3.5" />
                    <span className="sr-only sm:not-sr-only">{dict.host.noPhone}</span>
                  </span>
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
            <input
              id="add-player"
              className="input"
              placeholder={dict.host.addPlayerPlaceholder}
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-ghost shrink-0" disabled={!view || !name.trim()}>
              <UserPlus aria-hidden className="size-4" />
              {dict.host.add}
            </button>
          </div>
          {(error === "name-taken" || error === "invalid-name") && (
            <p role="alert" className="text-sm text-accent">
              {dict.errors[error]}
            </p>
          )}
        </form>

        <button
          type="button"
          className="btn h-12 text-base"
          disabled={!view || players.length < MIN_PLAYERS}
          onClick={() => setScreen("setup")}
        >
          <Layers aria-hidden className="size-5" />
          {dict.setup.start}
        </button>
        {players.length < MIN_PLAYERS && (
          <p className="-mt-2 text-center text-sm text-muted">{format(dict.setup.needPlayers, { min: MIN_PLAYERS })}</p>
        )}
      </section>
    </main>
  );
}

function IconButton({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg disabled:opacity-30"
      {...props}
    >
      {children}
    </button>
  );
}
