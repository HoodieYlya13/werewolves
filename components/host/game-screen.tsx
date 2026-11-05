"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Crown, DoorClosed, Eye, EyeOff, Heart, Moon, Music, PawPrint, Pencil, ScrollText, Skull, Sun, Undo2, Volume2, VolumeX, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useCloseRoom } from "@/components/host/close-room-button";
import { PhonelessPanel } from "@/components/host/phoneless-cards";
import { PlayerEditor } from "@/components/host/player-editor";
import { ModelMark } from "@/components/host/player-grid";
import { setMuted, useGameSound, useSoundMuted } from "@/hooks/use-game-sound";
import { useGameTheme } from "@/hooks/use-game-theme";
import { JoinRequests } from "@/components/host/join-requests";
import { RoleName, teamColor } from "@/components/host/role-chip";
import { Avatar, useRoomContext } from "@/components/room-context";
import { leadLines, StepPanel } from "@/components/host/step-panel";
import { GiveLeadDialog } from "@/components/play/auto-game";
import { format } from "@/lib/i18n/config";
import { isWolf, remainingTeams, roles, teamOf, type GameEvent, type GameState } from "@/lib/engine";
import type { ClientMessage, HostView } from "@/lib/protocol";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProfileDialog, type ProfileTarget } from "@/components/friends/room-friends";

const HIDE_ROLES_KEY = "ww:hide-roles";

export function GameScreen({
  view,
  game,
  send,
}: {
  view: HostView;
  game: GameState;
  send: (message: ClientMessage) => void;
}) {
  const { dict } = useI18n();
  // The story is told in daylight: the village has just found the narrator's body.
  const prologue = game.step.kind === "prologue";
  const isNight = game.phase.kind === "night" && !prologue;
  useGameTheme(isNight);
  // The step panel's own state, kept here: the lead lines read, and whether the step was tapped.
  const [panel, setPanel] = useState({ at: view.actionCount, read: 0, touched: false, reset: 0 });
  if (panel.at !== view.actionCount) {
    // Undone: the step comes back as it starts, without the last turn's closing lines again.
    setPanel({ at: view.actionCount, read: view.actionCount < panel.at ? Infinity : 0, touched: false, reset: panel.reset });
  }
  const lead = leadLines(game, dict);
  const reading = panel.at === view.actionCount && panel.read < lead.length;
  // The soundtrack plays here only: phones stay silent in the dark.
  useGameSound(game, view.actionCount, !reading ? null : panel.read === 0 && game.backToSleep ? "sleep" : "night");
  // Phones get their turn once those lines are read, not while the last turn's player goes back to sleep.
  const leadRead = lead.length > 0 && !reading && panel.at === view.actionCount;
  useEffect(() => {
    if (leadRead) send({ type: "lead-read", at: view.actionCount });
  }, [leadRead, view.actionCount, send]);
  const muted = useSoundMuted();
  const over = game.step.kind === "game-over";
  // Each step starts at the top: the next thing to read is there, not where the last button was.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view.actionCount]);
  const [giving, setGiving] = useState(false);
  const [hideRoles, setHideRoles] = useState(() => {
    try {
      return localStorage.getItem(HIDE_ROLES_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggleRoles() {
    setHideRoles(!hideRoles);
    try {
      localStorage.setItem(HIDE_ROLES_KEY, hideRoles ? "0" : "1");
    } catch {}
  }

  return (
    <main
      data-hide-roles={hideRoles || undefined}
      className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="flex min-w-0 flex-col gap-5">
        {/* On phones the four icons make a square beside the title; from tablets up, a row. */}
        <div className={`flex items-center gap-3 sm:flex-wrap ${over ? "flex-wrap" : ""}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
            {prologue ? (
              <ScrollText aria-hidden className="size-7 text-moon" />
            ) : isNight ? (
              <Moon aria-hidden className="size-7 text-moon" />
            ) : (
              <Sun aria-hidden className="size-7 text-moon" />
            )}
            <div>
              <h1 className="font-display text-2xl leading-tight font-bold">
                {prologue
                  ? dict.game.story.prologue.title
                  : format(isNight ? dict.game.night : dict.game.day, { n: game.phase.number })}
              </h1>
              <p className="text-sm text-muted-foreground">
                {prologue
                  ? dict.game.story.prologue.hint
                  : isNight
                    ? dict.game.nightHint
                    : game.phase.number === 0
                      ? dict.game.dayZeroHint
                      : dict.game.dayHint}
              </p>
            </div>
          </div>
          <div className={`ml-auto shrink-0 gap-2 sm:flex sm:flex-wrap ${over ? "flex flex-wrap" : "grid grid-cols-2"}`}>
            <Button
              type="button"
              variant="outline"
              className="size-10 p-0"
              title={muted ? dict.game.unmute : dict.game.mute}
              onClick={() => setMuted(!muted)}
            >
              {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
              <span className="sr-only">{muted ? dict.game.unmute : dict.game.mute}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="size-10 p-0"
              aria-pressed={hideRoles}
              title={hideRoles ? dict.game.showRoles : dict.game.hideRoles}
              onClick={toggleRoles}
            >
              {hideRoles ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
              <span className="sr-only">{hideRoles ? dict.game.showRoles : dict.game.hideRoles}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="size-10 p-0"
              title={dict.game.undo}
              disabled={view.actionCount === 0 && !panel.touched}
              // A step already under way starts over first: Undo only then goes back to the last turn.
              onClick={() => (panel.touched ? setPanel({ ...panel, touched: false, reset: panel.reset + 1 }) : send({ type: "undo" }))}
            >
              <Undo2 aria-hidden className="size-4" />
              <span className="sr-only">{dict.game.undo}</span>
            </Button>
            {/* A finished game: starting the next one is the obvious move, and needs no asking. */}
            {over && (
              <Button type="button" variant="outline" className="h-10 px-4" onClick={() => send({ type: "end-game" })}>
                <X aria-hidden className="size-4" />
                {dict.game.steps["game-over"].newGame}
              </Button>
            )}
            <QuitMenu
              over={over}
              onEndGame={() => send({ type: "end-game" })}
              onGiveLead={() => setGiving(true)}
              giveLabel={dict.lead.giveMaster}
            />
            <GiveLeadDialog
              open={giving}
              onClose={() => setGiving(false)}
              hint={dict.lead.masterHint}
              // Only the dead may take the game over: the living are playing it.
              eligible={(id) => !game.players.find((p) => p.id === id)?.alive}
              send={send}
            />
          </div>
        </div>


        <JoinRequests inGame />

        <section className="flex flex-col gap-5">
          <StepPanel
            key={`${view.actionCount}:${panel.reset}`}
            game={game}
            act={(action) => send({ type: "game-action", action })}
            read={panel.at === view.actionCount ? panel.read : 0}
            onRead={(read) => setPanel({ ...panel, read })}
            onTouched={() => !panel.touched && setPanel({ ...panel, touched: true })}
          />
        </section>
      </div>

      {/* Folded cards. Under the game, with roles hidden, they'd only show bars: gone until shown again.
          Beside it, they stay, so nothing moves. */}
      <aside className={`${hideRoles ? "hidden lg:flex" : "flex"} flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-1`}>
        <Remaining game={game} />
        <PlayersPanel game={game} />
        <PhonelessPanel game={game} />
        <Timeline game={game} rolesHidden={hideRoles} />
      </aside>
    </main>
  );
}

function Remaining({ game }: { game: GameState }) {
  const { dict } = useI18n();
  const living = game.players.filter((p) => p.alive);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium tracking-wide text-muted-foreground uppercase">{dict.game.remaining}</summary>
      {game.villagePowersLost && <p className="mt-3 text-sm text-primary">{dict.game.powersLost}</p>}
      <ul className="secret-role mt-3 flex flex-wrap gap-2">
        {remainingTeams(game).map((team) => (
          <li key={team} className={`rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold ${teamColor[team]}`}>
            {dict.teams[team]} · {living.filter((p) => teamOf(game, p) === team).length}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PlayersPanel({ game }: { game: GameState }) {
  const { dict } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const { players: roomPlayers, send } = useRoomContext();
  const leftIds = new Set(roomPlayers.filter((p) => p.left).map((p) => p.id));
  const accountIds = new Set(roomPlayers.filter((p) => p.account).map((p) => p.id));
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium tracking-wide text-muted-foreground uppercase">{dict.game.players}</summary>
      <ol className="mt-3 flex flex-col gap-1">
        {game.players.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-2 text-sm ${p.alive ? "" : "opacity-45"}`}>
            <span className="w-5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
            <button
              type="button"
              className="group flex min-w-0 flex-1 items-center gap-2 text-left"
              title={accountIds.has(p.id) ? dict.host.accountPlayer : format(dict.host.editPlayer, { name: p.name })}
              // Account players' names and photos are theirs to change: a tap shows their profile instead.
              onClick={() => (accountIds.has(p.id) ? setProfile({ playerId: p.id, name: p.name }) : setEditing(p.id))}
            >
              <Avatar playerId={p.id} name={p.name} className="size-6" />
              <span className={`min-w-0 truncate font-medium ${p.alive ? "" : "line-through"}`}>{p.name}</span>
              {accountIds.has(p.id) ? (
                <BadgeCheck aria-label={dict.host.accountPlayer} className="size-3 shrink-0 text-ok" />
              ) : (
                <Pencil aria-hidden className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              )}
            </button>
            {leftIds.has(p.id) && <span className="text-xs text-primary">{dict.host.left}</span>}
            {game.lovers?.includes(p.id) && (
              <Heart aria-label={dict.game.lover} className="secret-role size-3.5 fill-pink-500 text-pink-500" />
            )}
            {game.mayorId === p.id && <Crown aria-label={dict.game.mayor} className="size-3.5 text-moon" />}
            {p.flags.charmed && (
              <Music aria-label={dict.game.charmed} className="secret-role size-3.5 text-emerald-500" />
            )}
            <ModelMark game={game} playerId={p.id} />
            {isWolf(p) && roles[p.role].team !== "wolves" && p.role !== "white-werewolf" && (
              <PawPrint aria-hidden className="secret-role size-3.5 text-primary" />
            )}
            {!p.alive && <Skull aria-label={dict.game.dead} className="size-3.5" />}
            <RoleName role={p.role} className="text-xs" secret />
          </li>
        ))}
      </ol>
      {editing && <PlayerEditor playerId={editing} onClose={() => setEditing(null)} />}
      {send && <ProfileDialog target={profile} onClose={() => setProfile(null)} send={send} />}
    </details>
  );
}

export function Timeline({ game, rolesHidden }: { game: GameState; rolesHidden: boolean }) {
  const { dict } = useI18n();
  if (game.events.length === 0) return null;
  // Every line gives roles away: say why it's empty rather than leave a blank card.
  if (rolesHidden) {
    return (
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {dict.game.timeline}
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">{dict.game.timelineHidden}</p>
      </details>
    );
  }
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium tracking-wide text-muted-foreground uppercase">
        {dict.game.timeline}
      </summary>
      <ol className="secret-role mt-3 flex flex-col gap-1.5 text-sm">
        {[...game.events].reverse().map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
              {e.phase.kind === "night" ? dict.game.nightShort : dict.game.dayShort}
              {e.phase.number}
            </span>
            <span>
              <EventText game={game} event={e} />
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function EventText({ game, event }: { game: GameState; event: GameEvent }) {
  const { dict } = useI18n();
  const t = dict.game.events;
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? "?";
  switch (event.type) {
    case "thief-swap":
      return format(t["thief-swap"], { name: name(event.playerId), role: dict.roles[event.to].name });
    case "lovers":
      return format(t.lovers, { a: name(event.lovers[0]), b: name(event.lovers[1]) });
    case "seer":
      return format(t.seer, { target: name(event.targetId), role: dict.roles[event.role].name });
    case "wolves-target":
    case "witch-heal":
    case "witch-poison":
      return format(t[event.type], { target: name(event.targetId) });
    case "death":
      return format(t.death, { name: name(event.playerId), cause: dict.game.causes[event.cause] });
    case "mayor":
      return format(t.mayor, { name: name(event.playerId) });
    case "vote":
      return event.targetId ? format(t.vote, { target: name(event.targetId) }) : t.voteNobody;
    case "actor":
      return format(t.actor, { role: dict.roles[event.role].name });
    case "wolf-hound":
      return format(t["wolf-hound"], {
        name: name(event.playerId),
        side: dict.game.steps["wolf-hound"][event.side],
      });
    case "model":
      return format(t.model, { name: name(event.playerId), model: name(event.modelId) });
    case "turned-wolf":
      return format(t["turned-wolf"], { name: name(event.playerId) });
    case "protected":
    case "infected":
    case "big-bad-wolf":
    case "white-werewolf":
    case "raven":
      return format(t[event.type], { target: name(event.targetId) });
    case "fox":
      return format(t.fox, { target: name(event.centerId), result: event.hasWolf ? t.foxYes : t.foxNo });
    case "charmed":
      return format(t.charmed, { names: event.targetIds.map(name).join(", ") });
    case "elder-survived":
      return format(t["elder-survived"], { name: name(event.playerId) });
    case "powers-lost":
      return t["powers-lost"];
    case "idiot-revealed":
      return format(t["idiot-revealed"], { name: name(event.playerId) });
    case "servant":
      return format(t.servant, { name: name(event.playerId), role: dict.roles[event.role].name });
    case "scapegoat":
      return event.voterIds.length > 0
        ? format(t.scapegoat, { names: event.voterIds.map(name).join(", ") })
        : t.scapegoatNobody;
    case "second-vote":
      return t["second-vote"];
  }
}

/**
 * One red cross for leaving: end the game (back to the lobby, players kept) or
 * close the room (everyone out). Each asks first.
 */
export function QuitMenu({
  over,
  onEndGame,
  onGiveLead,
  giveLabel,
}: {
  over: boolean;
  onEndGame: () => void;
  /** Hands the game over to another player's device. */
  onGiveLead?: () => void;
  giveLabel?: string;
}) {
  const { dict } = useI18n();
  const closeRoom = useCloseRoom();
  const [confirm, setConfirm] = useState<"end" | "close" | null>(null);
  const t = confirm === "close" ? dict.host.closeRoomConfirm : dict.game.endGameConfirm;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="size-10 p-0 text-primary" title={dict.game.quit}>
            <X aria-hidden className="size-5" />
            <span className="sr-only">{dict.game.quit}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-1.5">
          {/* After the game, "New game" already sits next to the cross. */}
          {!over && (
            <DropdownMenuItem className="gap-3 rounded-lg px-3 py-2.5 text-base" onSelect={() => setConfirm("end")}>
              <X aria-hidden className="size-4" />
              {dict.game.endGame}
            </DropdownMenuItem>
          )}
          {onGiveLead && !over && (
            <DropdownMenuItem className="gap-3 rounded-lg px-3 py-2.5 text-base" onSelect={onGiveLead}>
              <Crown aria-hidden className="size-4" />
              {giveLabel}
            </DropdownMenuItem>
          )}
          {closeRoom && (
            <DropdownMenuItem variant="destructive" className="gap-3 rounded-lg px-3 py-2.5 text-base" onSelect={() => setConfirm("close")}>
              <DoorClosed aria-hidden className="size-4" />
              {dict.host.closeRoom}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.host.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => (confirm === "close" ? closeRoom?.() : onEndGame())}>
              {confirm === "close" ? dict.host.closeRoom : dict.game.endGame}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
