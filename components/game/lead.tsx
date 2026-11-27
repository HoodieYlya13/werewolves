"use client";

import { useState } from "react";
import { Crown, HeartCrack, Pause, Play } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";
import { Avatar, useRoomContext, type Send, useName } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import type { PlayerView } from "@/lib/protocol";
import { PickList } from "@/components/game/pick-list";


/** The game is paused: by the leader, or because the leader's phone is gone. */
export function PauseBanner({ view }: { view: PlayerView }) {
  const { dict } = useI18n();
  if (!view.pause) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl border border-moon/40 bg-moon/10 px-4 py-3">
      <Pause aria-hidden className="size-5 shrink-0 text-moon" />
      {format(view.pause.reason === "manual" ? dict.lead.paused : dict.lead.leaderGone, { name: view.pause.leader, next: view.pause.next })}
    </p>
  );
}
/** On the new leader's screen: the one whose device went silent, until they're settled. */
export function LostLeaderCard({ name, send }: { name: string; send: Send }) {
  const { dict } = useI18n();
  return (
    <section className="card flex flex-col gap-3 p-4 ring-2 ring-moon/50">
      <p className="font-semibold">{format(dict.lead.lostLeader, { name })}</p>
      <p className="text-sm text-muted-foreground">{dict.lead.lostLeaderHint}</p>
      <Button type="button" variant="outline" className="h-11 self-start" onClick={() => send({ type: "succession", dead: true })}>
        <HeartCrack aria-hidden className="size-4" />
        {format(dict.lead.lostLeaderDead, { name })}
      </Button>
    </section>
  );
}
/** With a game master: their screen is gone and nobody dead can take over. */
export function MasterGoneCard({ onLeave }: { onLeave: () => void }) {
  const { dict } = useI18n();
  return (
    <section role="alert" className="card flex flex-col gap-3 p-4 ring-2 ring-primary/50">
      <p className="font-semibold">{dict.lead.masterGone}</p>
      <Button type="button" variant="outline" className="h-11 self-start" onClick={onLeave}>
        {dict.lead.leaveGame}
      </Button>
    </section>
  );
}
/** Picks who takes the room over: players whose phone is connected (and, if given, who `eligible` allows). */
export function GiveLeadDialog({
  open,
  onClose,
  hint,
  eligible = () => true,
  send,
  exclude,
}: {
  open: boolean;
  onClose: () => void;
  hint: string;
  eligible?: (id: string) => boolean;
  send: Send;
  exclude?: string | null;
}) {
  const { dict } = useI18n();
  const { players } = useRoomContext();
  const candidates = players.filter((p) => p.connected && !p.manual && !p.left && p.id !== exclude && eligible(p.id));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={dict.host.close}>
        <DialogHeader>
          <DialogTitle>{dict.lead.title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.lead.nobody}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-line bg-surface-2 px-3 py-2 text-left font-semibold hover:border-primary"
                  onClick={() => {
                    send({ type: "give-lead", playerId: p.id });
                    onClose();
                  }}
                >
                  <Avatar playerId={p.id} name={p.name} className="size-8" />
                  <span className="min-w-0 flex-1 truncate">{format(dict.lead.give, { name: p.name })}</span>
                  <Crown aria-hidden className="size-4 text-moon" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
/** A living player declared out for good: picked, then confirmed. */
export function SuddenDeathDialog({ open, onClose, living, send }: { open: boolean; onClose: () => void; living: string[]; send: Send }) {
  const { dict } = useI18n();
  const name = useName();
  const [target, setTarget] = useState<string | null>(null);
  return (
    <>
      <Dialog open={open && !target} onOpenChange={(o) => !o && onClose()}>
        <DialogContent closeLabel={dict.host.close}>
          <DialogHeader>
            <DialogTitle>{dict.lead.suddenDeath}</DialogTitle>
            <DialogDescription>{dict.lead.suddenDeathHint}</DialogDescription>
          </DialogHeader>
          <PickList targets={living} selected={[]} onToggle={setTarget} />
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{format(dict.lead.suddenDeathConfirm, { name: target ? name(target) : "" })}</AlertDialogTitle>
            <AlertDialogDescription>{dict.lead.suddenDeathHint}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.host.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (target) send({ type: "sudden-death", playerId: target });
                setTarget(null);
                onClose();
              }}
            >
              {dict.lead.suddenDeath}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
/** The leading phone's tools, without a game master: pause by day, sudden death, then `children` (the quit menu) on the right. */
export function LeaderBar({ view, paused, send, children }: { view: PlayerView; paused: boolean; send: Send; children?: React.ReactNode }) {
  const { dict } = useI18n();
  const [dying, setDying] = useState(false);
  const game = view.game;
  if (!game) return null;
  const over = !!game.winner;
  const night = game.phase.kind === "night" && !game.prologue;
  const dead = new Set(game.dead.map((d) => d.playerId));
  const living = view.players.filter((p) => !dead.has(p.id)).map((p) => p.id);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {over ? null : paused ? (
        <Button type="button" className="h-10" onClick={() => send({ type: "pause", value: false })}>
          <Play aria-hidden className="size-4" />
          {dict.lead.resume}
        </Button>
      ) : (
        !night &&
        !view.pause && (
          <Button type="button" variant="outline" className="h-10" onClick={() => send({ type: "pause", value: true })}>
            <Pause aria-hidden className="size-4" />
            {dict.lead.pause}
          </Button>
        )
      )}
      {!over && (
        <Button type="button" variant="outline" className="h-10" onClick={() => setDying(true)}>
          <HeartCrack aria-hidden className="size-4" />
          {dict.lead.suddenDeath}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">{children}</div>
      <SuddenDeathDialog open={dying} onClose={() => setDying(false)} living={living} send={send} />
    </div>
  );
}

// --- turns ---
