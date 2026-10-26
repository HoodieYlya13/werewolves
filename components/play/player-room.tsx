"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Crown, LogIn, LogOut, Moon, Pencil, Skull, Sun, UserRound, Vote } from "lucide-react";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/host/role-chip";
import { RoleCard } from "@/components/play/role-card";
import { PhotoPicker } from "@/components/photo-picker";
import { Avatar, Face, RoomProvider } from "@/components/room-context";
import { TimerDisplay } from "@/components/vote-timer";
import { ThemedI18n } from "@/components/themed-i18n";
import { ConnectionBanner, FatalError } from "@/components/room-status";
import { useGameTheme } from "@/hooks/use-game-theme";
import { useRoom } from "@/hooks/use-room";
import { format } from "@/lib/i18n/config";
import { identity } from "@/lib/room";
import { freshIdToken, useSession } from "@/lib/session";
import { MAX_NAME_LENGTH, type ErrorCode, type PlayerView } from "@/lib/protocol";

export function PlayerRoom() {
  const { code } = useParams<{ code: string }>();
  return <PlayerScreen key={code} code={code} />;
}

function PlayerScreen({ code }: { code: string }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const { view, error, status, send, clockOffset, close } = useRoom<PlayerView>(code, "player");
  // The name used last time, ready to change.
  const [name, setName] = useState(() => identity.getName());
  const [photo, setPhoto] = useState(() => identity.getPhoto());
  const session = useSession();
  const account = session?.account ?? null;
  const me = view?.me;

  // Signed in after joining as a guest: the seat becomes the account's.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!me || me.account || !account || linked.current === me.id) return;
    linked.current = me.id;
    void freshIdToken().then((idToken) => idToken && send({ type: "link-account", idToken }));
  }, [me, account, send]);

  // The photo is remembered on this phone for the next rooms too.
  function changePhoto(data: string | null) {
    setPhoto(data);
    identity.setPhoto(data);
  }

  if (error === "room-not-found" || error === "room-closed") return <FatalError code={error} />;

  function leave() {
    if (!window.confirm(view?.game ? dict.play.leaveConfirmInGame : dict.play.leaveConfirm)) return;
    send({ type: "leave" });
    identity.setPlayer(code, null);
    close();
    router.push(`/${locale}`);
  }

  async function joinWithAccount() {
    const idToken = await freshIdToken();
    // Signed out meanwhile: the session update shows the guest form instead.
    if (idToken && account) send({ type: "join", name: account.name, idToken });
  }

  function rename(newName: string) {
    identity.setName(newName.trim());
    send({ type: "rename-self", name: newName });
  }

  const room = { code, players: view?.players ?? [], timer: view?.timer ?? null, clockOffset };

  return (
    <RoomProvider value={room}>
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10">
      <ConnectionBanner status={status} />
      <p className="text-center font-mono text-sm tracking-[0.3em] text-muted">{code}</p>

      {error === "removed" && (
        <p role="alert" className="text-center text-accent">
          {dict.errors.removed}
        </p>
      )}

      {me && view?.renamed && (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-center">
          {format(dict.play.renamed, { name: me.name })}
        </p>
      )}

      {view?.rejoin && (
        <RejoinCard
          rejoin={view.rejoin}
          error={error}
          onAsk={(newName) => {
            identity.setName(newName.trim());
            send({ type: "request-rejoin", name: newName });
          }}
        />
      )}

      {view && !me && !view.rejoin && account && (
        <section className="card flex flex-col items-center gap-3 p-6 text-center">
          <Face name={account.name} src={account.picture} className="size-24 text-3xl" />
          <p className="text-muted">{dict.account.fromAccount}</p>
          <button type="button" className="btn w-full" onClick={joinWithAccount}>
            {format(dict.account.joinAs, { name: account.name })}
          </button>
          {(error === "room-locked" || error === "invalid-account" || error === "account-in-use") && (
            <p role="alert" className="text-sm text-accent">
              {dict.errors[error]}
            </p>
          )}
          <p className="text-sm text-muted">
            {dict.account.notYou}{" "}
            <AuthButton to="out" className="underline">
              {dict.account.signOut}
            </AuthButton>
          </p>
        </section>
      )}

      {view && !me && !view.rejoin && !account && (
        <form
          className="card flex flex-col gap-3 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            identity.setName(name.trim());
            send({ type: "join", name, photo });
          }}
        >
          <div className="flex flex-col items-center gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-24 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid size-24 place-items-center rounded-full bg-surface-2 text-muted">
                <UserRound className="size-10" />
              </span>
            )}
            <PhotoPicker hasPhoto={photo !== null} onChange={changePhoto} />
          </div>
          <label htmlFor="name" className="font-medium">
            {dict.play.yourName}
          </label>
          <input
            id="name"
            className="input text-lg"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!name.trim()}>
            {dict.play.join}
          </button>
          {(error === "name-taken" || error === "invalid-name" || error === "room-locked") && (
            <p role="alert" className="text-sm text-accent">
              {dict.errors[error]}
            </p>
          )}
          {session?.enabled && (
            <AuthButton to="in" className="flex items-center justify-center gap-1.5 text-center text-sm text-muted underline">
              <LogIn aria-hidden className="size-4 shrink-0" />
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
            <p className="text-sm text-muted">{dict.account.fromAccount}</p>
          ) : (
            <>
              <PhotoPicker
                hasPhoto={me.photo !== null}
                onChange={(data) => {
                  changePhoto(data);
                  send({ type: "set-photo", data });
                }}
              />
              <NameEditor name={me.name} error={error} onSave={rename} />
            </>
          )}
          <p className="text-muted">{dict.play.waiting}</p>
        </section>
      )}

      {me && view?.info && view.game && (
        <ThemedI18n theme={view.game.theme}>
          <InGame view={view} onVote={(targetId) => send({ type: "cast-vote", targetId })} />
        </ThemedI18n>
      )}

      {view && !view.game && view.players.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">{dict.play.roomPlayers}</h2>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm ${p.id === me?.id ? "bg-accent text-accent-fg" : "bg-surface-2"}`}
              >
                <Avatar playerId={p.id} name={p.name} className="size-6" />
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {me && !me.account && view?.info && (
        <div className="flex justify-center">
          <NameEditor name={me.name} error={error} onSave={rename} />
        </div>
      )}

      {me && (
        <button type="button" className="btn btn-ghost mt-auto self-center text-muted" onClick={leave}>
          <LogOut aria-hidden className="size-4" />
          {dict.play.leave}
        </button>
      )}
    </main>
    </RoomProvider>
  );
}

/** The phone during a game: public status, the player's own card, the table. */
function InGame({ view, onVote }: { view: PlayerView; onVote: (targetId: string | null) => void }) {
  const { dict } = useI18n();
  const info = view.info!;
  const game = view.game!;
  const me = view.me!;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  const dead = new Map(game.dead.map((d) => [d.playerId, d.role]));
  const isNight = game.phase.kind === "night";
  useGameTheme(isNight);
  const t = dict.play;

  return (
    <>
      {game.winner ? (
        <section className="card flex flex-col items-center gap-2 p-6 text-center">
          <p className="font-display text-2xl font-bold">
            {game.winner.team ? dict.game.steps["game-over"].wins[game.winner.team] : dict.game.steps["game-over"].draw}
          </p>
          <p className={`text-lg font-semibold ${game.winner.playerIds.includes(me.id) ? "text-ok" : "text-accent"}`}>
            {game.winner.playerIds.includes(me.id) ? t.youWin : t.youLose}
          </p>
        </section>
      ) : (
        <p className="flex items-center justify-center gap-2 text-muted">
          {isNight ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
          {format(isNight ? dict.game.night : dict.game.day, { n: game.phase.number })}
        </p>
      )}

      {!game.winner && <TimerDisplay />}

      {view.ballot && !game.winner && <PhoneBallotCard view={view} onVote={onVote} />}

      {!info.alive && !game.winner && (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-center">
          {t.card.dead}
        </p>
      )}

      <RoleCard info={info} loverName={info.loverId ? nameOf(info.loverId) : null} alwaysShown={!!game.winner} />

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">{t.roomPlayers}</h2>
        <ul className="flex flex-col gap-1">
          {view.players.map((p) => {
            const isDead = dead.has(p.id);
            const role = game.roles?.[p.id] ?? dead.get(p.id) ?? null;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p.id === me.id ? "bg-surface-2" : ""} ${isDead ? "opacity-50" : ""}`}
              >
                <Avatar playerId={p.id} name={p.name} className="size-7" />
                <span className={`min-w-0 flex-1 truncate ${isDead ? "line-through" : ""}`}>{p.name}</span>
                {game.sheriffId === p.id && <Crown aria-label={dict.game.sheriff} className="size-4 text-moon" />}
                {isDead && <Skull aria-label={dict.game.dead} className="size-4" />}
                {role && <RoleName role={role} className="text-sm" />}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** The day's vote on a phone, while the game master has it open. */
function PhoneBallotCard({ view, onVote }: { view: PlayerView; onVote: (targetId: string | null) => void }) {
  const { dict } = useI18n();
  const t = dict.ballot;
  const ballot = view.ballot!;
  const me = view.me!;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";

  if (!ballot.canVote) {
    return (
      <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-center">
        {t.phoneCannotVote}
      </p>
    );
  }

  const choices: { id: string | null; label: string }[] = [
    ...ballot.candidateIds.filter((id) => id !== me.id).map((id) => ({ id, label: nameOf(id) })),
    { id: null, label: t.noOne },
  ];

  return (
    <section className="card flex flex-col gap-3 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Vote aria-hidden className="size-5" />
        {t.phoneTitle}
      </h2>
      <p className="text-sm text-muted">
        {ballot.voted
          ? format(t.phoneVoted, { name: ballot.targetId ? nameOf(ballot.targetId) : t.noOne })
          : t.phoneHint}
      </p>
      <ul className="flex flex-col gap-2">
        {choices.map((choice) => {
          const selected = ballot.voted && ballot.targetId === choice.id;
          return (
            <li key={choice.id ?? "nobody"}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onVote(choice.id)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left text-lg font-semibold ${
                  selected ? "border-accent bg-accent/10" : "border-line bg-surface-2"
                }`}
              >
                {choice.id ? (
                  <Avatar playerId={choice.id} name={choice.label} className="size-9" />
                ) : (
                  <span aria-hidden className="grid size-9 place-items-center rounded-full bg-surface text-muted">
                    –
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                {selected && <Check aria-hidden className="size-5 text-accent" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-sm text-muted">
        {format(t.progress, { answered: ballot.answered, voters: ballot.voters })}
      </p>
    </section>
  );
}

/** A player without an account renames themself, in the lobby or mid-game. */
function NameEditor({ name, error, onSave }: { name: string; error: ErrorCode | null; onSave: (name: string) => void }) {
  const { dict } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const alert = (error === "name-taken" || error === "invalid-name") && (
    <p role="alert" className="text-sm text-accent">
      {dict.errors[error]}
    </p>
  );

  if (draft === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button type="button" className="btn btn-ghost text-sm" onClick={() => setDraft(name)}>
          <Pencil aria-hidden className="size-4" />
          {dict.play.changeName}
        </button>
        {alert}
      </div>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        if (draft.trim() !== name) onSave(draft);
        setDraft(null);
      }}
    >
      <label htmlFor="new-name" className="sr-only">
        {dict.play.yourName}
      </label>
      <input
        id="new-name"
        className="input text-lg"
        autoComplete="nickname"
        autoFocus
        maxLength={MAX_NAME_LENGTH}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={() => setDraft(null)}>
          {dict.host.cancel}
        </button>
        <button type="submit" className="btn flex-1" disabled={!draft.trim()}>
          {dict.host.save}
        </button>
      </div>
    </form>
  );
}

/** Someone who left this room asks the game master to let them back in. */
function RejoinCard({
  rejoin,
  error,
  onAsk,
}: {
  rejoin: NonNullable<PlayerView["rejoin"]>;
  error: ErrorCode | null;
  onAsk: (name: string) => void;
}) {
  const { dict } = useI18n();
  const t = dict.play.rejoin;
  const [name, setName] = useState(rejoin.name);

  if (rejoin.status === "pending") {
    return (
      <section role="status" className="card flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-xl font-semibold">{format(t.pending, { name: rejoin.name })}</p>
        <p className="text-muted">{t.pendingHint}</p>
      </section>
    );
  }

  return (
    <form
      className="card flex flex-col gap-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAsk(name);
      }}
    >
      <p className="text-xl font-semibold">{t.title}</p>
      <p className="text-muted">{rejoin.status === "denied" ? t.denied : rejoin.account ? t.hintAccount : t.hint}</p>
      {/* An account comes back under its own name. */}
      {!rejoin.account && (
        <>
          <label htmlFor="rejoin-name" className="font-medium">
            {dict.play.yourName}
          </label>
          <input
            id="rejoin-name"
            className="input text-lg"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </>
      )}
      <button type="submit" className="btn" disabled={!name.trim()}>
        {rejoin.status === "denied" ? t.askAgain : t.ask}
      </button>
      {(error === "name-taken" || error === "invalid-name") && (
        <p role="alert" className="text-sm text-accent">
          {dict.errors[error]}
        </p>
      )}
    </form>
  );
}
