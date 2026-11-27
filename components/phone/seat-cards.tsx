"use client";

import { useState } from "react";
import { Crown, CircleUserRound, LogOut, Pencil, UserPlus } from "lucide-react";
import { AuthButton } from "@/components/account-button";
import { useAuthRedirect } from "@/lib/auth-redirect";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { format } from "@/lib/i18n/config";
import { getTicket } from "@/lib/session";
import { MAX_NAME_LENGTH, type ClientMessage, type ErrorCode, type PlayerView } from "@/lib/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** A player without an account renames themself, in the lobby or mid-game. */
export function NameEditor({ name, error, onSave }: { name: string; error: ErrorCode | null; onSave: (name: string) => void }) {
  const { dict } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const alert = (error === "name-taken" || error === "invalid-name") && (
    <p role="alert" className="text-sm text-primary">
      {dict.errors[error]}
    </p>
  );

  if (draft === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button type="button" variant="outline" className="text-sm" onClick={() => setDraft(name)}>
          <Pencil aria-hidden className="size-4" />
          {dict.play.changeName}
        </Button>
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
      <Input
        id="new-name"
        autoCorrect="off"
        spellCheck={false}
        className="text-lg"
        autoComplete="nickname"
        autoFocus
        maxLength={MAX_NAME_LENGTH}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setDraft(null)}>
          {dict.host.cancel}
        </Button>
        <Button type="submit" className="flex-1" disabled={!draft.trim()}>
          {dict.host.save}
        </Button>
      </div>
    </form>
  );
}
/** Someone who left this room asks the game master to let them back in. */
/** This phone's seat belongs to an account it isn't signed in to (anymore). */
export function LockedSeatCard({
  seat,
  signedIn,
  wrongAccount,
  onJoinAsNew,
}: {
  seat: NonNullable<PlayerView["lockedSeat"]>;
  signedIn: boolean;
  wrongAccount: boolean;
  onJoinAsNew: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.play.lockedSeat;
  return (
    <section className="card flex flex-col items-center gap-3 p-6 text-center">
      <Face name={seat.name} src={seat.picture} className="size-24 text-3xl" />
      <p className="text-xl font-semibold">{t.title}</p>
      <p className="text-muted-foreground">{format(wrongAccount ? t.wrongAccount : t.hint, { name: seat.name })}</p>
      {/* Signed in with the right account, the seat comes back on its own (see the effect above). */}
      {!signedIn && (
        <AuthButton to="in" className="w-full">
          <CircleUserRound aria-hidden />
          {t.signIn}
        </AuthButton>
      )}
      {signedIn && wrongAccount && (
        <AuthButton to="out" variant="outline" className="w-full">
          <LogOut aria-hidden />
          {dict.account.signOut}
        </AuthButton>
      )}
      <Button type="button" variant="outline" className="w-full" onClick={onJoinAsNew}>
        <UserPlus aria-hidden />
        {dict.play.rejoin.joinAsNew}
      </Button>
    </section>
  );
}
/** Asked to join a locked room or a game: waiting for the game master's answer. */
export function KnockCard({ name, onCancel }: { name: string; onCancel: () => void }) {
  const { dict } = useI18n();
  const t = dict.play.knock;
  return (
    <section role="status" className="card flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-xl font-semibold">{format(t.pending, { name })}</p>
      <p className="text-muted-foreground">{t.pendingHint}</p>
      <Button type="button" variant="outline" onClick={onCancel}>
        {t.cancel}
      </Button>
    </section>
  );
}
export type RejoinDict = ReturnType<typeof useI18n>["dict"]["play"]["rejoin"];
/** What the player who left reads: asked and refused, signing in first, coming straight back, or asking. */
export function rejoinHint(t: RejoinDict, { rejoin, needsSignIn, isRoomOpen }: { rejoin: NonNullable<PlayerView["rejoin"]>; needsSignIn: boolean; isRoomOpen: boolean }) {
  if (rejoin.status === "denied") return t.denied;
  if (needsSignIn) return t.hintSignIn;
  if (isRoomOpen) return rejoin.account ? t.hintOpenAccount : t.hintOpen;
  return rejoin.account ? t.hintAccount : t.hint;
}
export function RejoinCard({
  rejoin,
  isRoomOpen,
  isAsking,
  error,
  signedIn,
  onAsk,
  onSignIn,
  onJoinAsNew,
}: {
  rejoin: NonNullable<PlayerView["rejoin"]>;
  /** An open lobby: coming back needs no one's OK. */
  isRoomOpen: boolean;
  isAsking: boolean;
  error: ErrorCode | null;
  signedIn: boolean;
  onAsk: (name: string) => void;
  onSignIn: () => void;
  onJoinAsNew: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.play.rejoin;
  const [name, setName] = useState(rejoin.name);
  // An account's seat only goes back to that account: sign in first.
  const needsSignIn = rejoin.account && !signedIn;
  const isSigningIn = useAuthRedirect() === "in" && needsSignIn;
  const isBusy = isAsking || isSigningIn;

  if (rejoin.status === "pending") {
    return (
      <section role="status" className="card flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-xl font-semibold">{format(t.pending, { name: rejoin.name })}</p>
        <p className="text-muted-foreground">{t.pendingHint}</p>
      </section>
    );
  }

  return (
    <form
      className="card flex flex-col gap-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (needsSignIn) onSignIn();
        else if (name.trim()) onAsk(name);
      }}
    >
      <p className="text-xl font-semibold">{t.title}</p>
      <p className="text-muted-foreground">
        {rejoinHint(t, { rejoin, needsSignIn, isRoomOpen })}
      </p>
      {/* An account comes back under its own name. */}
      {!rejoin.account && (
        <>
          <label htmlFor="rejoin-name" className="font-medium">
            {dict.play.yourName}
          </label>
          <Input
            id="rejoin-name"
            autoCorrect="off"
            spellCheck={false}
            className="text-lg"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </>
      )}
      <Button type="submit" aria-busy={isBusy} disabled={!needsSignIn && !name.trim()}>
        {isBusy ? <Spinner /> : needsSignIn && <CircleUserRound aria-hidden />}
        {needsSignIn ? t.signInToReturn : isRoomOpen ? t.comeBack : rejoin.status === "denied" ? t.askAgain : t.ask}
      </Button>
      {rejoin.account && (
        <Button type="button" variant="outline" onClick={onJoinAsNew}>
          <UserPlus aria-hidden />
          {t.joinAsNew}
        </Button>
      )}
      {(error === "name-taken" || error === "invalid-name" || error === "wrong-account" || error === "invalid-account") && (
        <p role="alert" className="text-sm text-primary">
          {dict.errors[error]}
        </p>
      )}
    </form>
  );
}
/** Signed in: play under the account's first name, or under its username. */
export function UsernameChoice({ username, checked, onChange }: { username: string; checked: boolean; onChange: (value: boolean) => void }) {
  const { dict } = useI18n();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {format(dict.account.showUsername, { username })}
    </label>
  );
}
/** The game master whose screen went away: run the game again, or just watch. */
export function TakeBackCard({
  masterAway,
  code,
  signedIn,
  send,
}: {
  masterAway: NonNullable<PlayerView["masterAway"]>;
  code: string;
  signedIn: boolean;
  send: (msg: ClientMessage) => void;
}) {
  const { dict } = useI18n();
  const t = dict.play.takeBack;
  const [dismissed, setDismissed] = useState(false);
  const canTakeBack = masterAway.byDevice || (masterAway.byAccount && signedIn);
  if (dismissed || !canTakeBack) return null;

  async function takeBack() {
    if (masterAway.byDevice) return send({ type: "reclaim-master" });
    const ticket = await getTicket({ room: code });
    if (ticket) send({ type: "reclaim-master", ticket });
  }

  return (
    <section className="card flex flex-col gap-3 p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Crown aria-hidden className="size-5 text-moon" />
        {t.title}
      </p>
      <p className="text-sm text-muted-foreground">{format(t.body, { name: masterAway.runner })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" onClick={() => void takeBack()}>
          {t.takeBack}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => setDismissed(true)}>
          {t.watch}
        </Button>
      </div>
    </section>
  );
}
