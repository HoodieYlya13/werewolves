"use client";

import { useState } from "react";
import { FlaskConical, LogIn, Megaphone, Moon, Quote, Skull, Smartphone, Sun, Trophy } from "lucide-react";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { BallotPanel } from "@/components/host/ballot-panel";
import { PhonelessIntro } from "@/components/host/phoneless-cards";
import { PlayerGrid, toggle } from "@/components/host/player-grid";
import { Reveal } from "@/components/host/reveal";
import { RoleName } from "@/components/host/role-chip";
import { useRoomContext } from "@/components/room-context";
import { TimerControls } from "@/components/vote-timer";
import { format } from "@/lib/i18n/config";
import { isWolf, type Action, type Death, type GameState, type PhaseRef, type Player, type Step } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

type Props<K extends Step["kind"]> = {
  game: GameState;
  step: Extract<Step, { kind: K }>;
  act: (action: Action) => void;
};

/**
 * What the game master reads and taps for the current step. The parent keys it
 * by action count, so any local selection resets on each new step.
 */
export function StepPanel({ game, act }: { game: GameState; act: (action: Action) => void }) {
  const { dict } = useI18n();
  const sleeper = game.backToSleep;
  // Every night opens with the whole village closing their eyes.
  const nightFalls =
    game.phase.kind === "night" && game.phaseStep === 0 && game.step.kind !== "prologue" && game.step.kind !== "phase-end";
  // Lines that close the last turn or open the night are read on their own, one Continue each,
  // so every turn starts by itself. Only on this screen: the game doesn't wait for them.
  const lead = [
    sleeper && (sleeper === "wolves" ? dict.game.wolvesSleep : format(dict.game.sleep, { role: dict.roles[sleeper].name })),
    nightFalls && dict.game.nightFalls,
  ].filter((line): line is string => !!line);
  const [read, setRead] = useState(0);

  if (read < lead.length) {
    return (
      <>
        <Say>{lead[read]}</Say>
        <NextButton
          onClick={() => {
            setRead(read + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </>
    );
  }
  return <StepContent game={game} act={act} />;
}

function StepContent({ game, act }: { game: GameState; act: (action: Action) => void }) {
  return (
    <>
      <PhonePlays game={game} act={act} />
      <StepBody game={game} act={act} />
    </>
  );
}

/**
 * What players chose on their phones for this step, if they did (never
 * asked for): the game master validates it, or plays the step as usual.
 */
function PhonePlays({ game, act }: { game: GameState; act: (action: Action) => void }) {
  const { dict } = useI18n();
  const { phonePlays } = useRoomContext();
  if (!phonePlays) return null;
  const step = game.step;
  const rows: { key: string; label: string; action: Action }[] = [];
  if (step.kind === "wolves") {
    const votes = new Map<string, number>();
    for (const id of step.playerIds) {
      const target = phonePlays.wolfPicks[id];
      if (target) votes.set(target, (votes.get(target) ?? 0) + 1);
    }
    for (const [target, count] of [...votes].sort((a, b) => b[1] - a[1])) {
      rows.push({ key: target, label: format(dict.lead.wolvesVotes, { name: nameOf(game, target), count }), action: { type: "wolves", targetId: target } });
    }
  } else {
    for (const [id, action] of Object.entries(phonePlays.actions)) {
      rows.push({ key: id, label: `${nameOf(game, id)} · ${describe(game, action, dict)}`, action });
    }
  }
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-moon/40 bg-moon/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-moon">
        <Smartphone aria-hidden className="size-4" />
        {dict.lead.fromPhones}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 font-medium">{row.label}</span>
            <Button type="button" className="h-10 px-4" onClick={() => act(row.action)}>
              {dict.lead.validate}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A phone's choice in words, for the game master. */
function describe(game: GameState, action: Action, dict: ReturnType<typeof useI18n>["dict"]): string {
  const step = game.step;
  const steps = dict.game.steps;
  switch (action.type) {
    case "seer":
    case "hunter":
      return action.targetId ? nameOf(game, action.targetId) : "—";
    case "mayor":
      return nameOf(game, action.targetId);
    case "cupid":
      return names(game, action.lovers);
    case "pick":
      return action.targetIds.length ? names(game, action.targetIds) : "—";
    case "witch": {
      const parts = [];
      if (action.heal && step.kind === "witch" && step.victimId) parts.push(format(steps.witch.heal, { name: nameOf(game, step.victimId) }));
      if (action.poisonId) parts.push(`${steps.witch.poison}: ${nameOf(game, action.poisonId)}`);
      return parts.join(" · ") || steps.witch.nothing;
    }
    case "thief":
      return action.pick === null || step.kind !== "thief" ? steps.thief.keep : dict.roles[step.cards[action.pick]].name;
    case "choose":
      if (step.kind === "actor") return action.value === null ? steps.actor.none : dict.roles[step.cards[action.value as number]].name;
      if (step.kind === "wolf-hound") return steps["wolf-hound"][action.value as "village" | "wolves"];
      return action.value ? dict.auto.yes : dict.auto.no;
    default:
      return "";
  }
}

function StepBody({ game, act }: { game: GameState; act: (action: Action) => void }) {
  const step = game.step;
  switch (step.kind) {
    case "prologue":
      return <PrologueStep game={game} step={step} act={act} />;
    case "phase-end":
      return <PhaseEndStep game={game} step={step} act={act} />;
    case "actor":
      return <ActorStep game={game} step={step} act={act} />;
    case "wolf-hound":
      return <WolfHoundStep game={game} step={step} act={act} />;
    case "wild-child":
      return <WildChildStep game={game} step={step} act={act} />;
    case "siblings":
      return <SiblingsStep game={game} step={step} act={act} />;
    case "defender":
      return <DefenderStep game={game} step={step} act={act} />;
    case "fox":
      return <FoxStep game={game} step={step} act={act} />;
    case "fox-result":
      return <FoxResultStep game={game} step={step} act={act} />;
    case "infect":
      return <InfectStep game={game} step={step} act={act} />;
    case "big-bad-wolf":
      return <BigBadWolfStep game={game} step={step} act={act} />;
    case "white-werewolf":
      return <WhiteWerewolfStep game={game} step={step} act={act} />;
    case "piper":
      return <PiperStep game={game} step={step} act={act} />;
    case "charmed":
      return <CharmedStep game={game} step={step} act={act} />;
    case "raven":
      return <RavenStep game={game} step={step} act={act} />;
    case "bear":
      return <BearStep game={game} step={step} act={act} />;
    case "idiot":
      return <IdiotStep game={game} step={step} act={act} />;
    case "servant":
      return <ServantStep game={game} step={step} act={act} />;
    case "scapegoat":
      return <ScapegoatStep game={game} step={step} act={act} />;
    case "judge":
      return <JudgeStep game={game} step={step} act={act} />;
    case "thief":
      return <ThiefStep game={game} step={step} act={act} />;
    case "cupid":
      return <CupidStep game={game} step={step} act={act} />;
    case "lovers":
      return <LoversStep game={game} step={step} act={act} />;
    case "seer":
      return <SeerStep game={game} step={step} act={act} />;
    case "seer-result":
      return <SeerResultStep game={game} step={step} act={act} />;
    case "wolves":
      return <WolvesStep game={game} step={step} act={act} />;
    case "witch":
      return <WitchStep game={game} step={step} act={act} />;
    case "deaths":
      return <DeathsStep game={game} step={step} act={act} />;
    case "hunter":
      return <HunterStep game={game} step={step} act={act} />;
    case "mayor-election":
    case "mayor-succession":
      return <MayorStep game={game} step={step} act={act} />;
    case "vote":
      return <VoteStep game={game} step={step} act={act} />;
    case "bluff":
      return <BluffStep game={game} step={step} act={act} />;
    case "game-over":
      return <GameOverStep game={game} step={step} act={act} />;
  }
}

// --- building blocks ---

/** The narrator's words, set apart like a script: read them out as they are. */
function Say({ children }: { children: React.ReactNode }) {
  const { dict } = useI18n();
  return (
    <figure className="relative overflow-hidden rounded-3xl bg-linear-to-br from-moon/15 via-surface-2/80 to-surface-2/80 px-6 pt-4 pb-5 ring-1 ring-moon/20 sm:px-7">
      {/* A big quotation mark behind the text, barely there. */}
      <Quote aria-hidden className="pointer-events-none absolute top-3 right-4 size-14 fill-current text-moon/10" strokeWidth={0} />
      <figcaption className="relative mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.2em] text-moon uppercase">
        <Megaphone aria-hidden className="size-3.5" />
        {dict.game.say}
      </figcaption>
      <blockquote className="relative text-xl leading-relaxed text-pretty sm:text-2xl">{children}</blockquote>
    </figure>
  );
}

function Do({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

/** The step's main way on: the whole width on phones, its own size from tablets up. */
function NextButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const { dict } = useI18n();
  return (
    <Button type="button" className="h-12 w-full px-8 text-base sm:w-auto sm:self-start" onClick={onClick}>
      {label ?? dict.game.continue}
    </Button>
  );
}

function ContinueButton({ act, label }: { act: Props<"lovers">["act"]; label?: string }) {
  return <NextButton label={label} onClick={() => act({ type: "continue" })} />;
}

function ConfirmButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { dict } = useI18n();
  return (
    <Button type="button" className="h-12 px-5 text-base sm:px-8" disabled={disabled} onClick={onClick}>
      {dict.game.confirm}
    </Button>
  );
}

/** Starts the next night or day: the step that turns the screen dark or light. */
function StartPhaseButton({ act, next }: { act: Props<"prologue">["act"]; next: PhaseRef }) {
  const { dict } = useI18n();
  const Icon = next.kind === "night" ? Moon : Sun;
  return (
    <Button type="button" className="h-12 w-full px-8 text-base sm:w-auto sm:self-start" onClick={() => act({ type: "continue" })}>
      <Icon aria-hidden className="size-5" />
      {format(dict.game.story.start[next.kind], { n: next.number })}
    </Button>
  );
}

/**
 * One of a few narration lines, so the story doesn't repeat itself word for
 * word. The same moment always gets the same line (undo, reload, other device).
 */
function line(lines: string[], seed: string, offset = 0) {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return lines[(Math.abs(hash) + offset) % lines.length];
}

const living = (game: GameState) => game.players.filter((p) => p.alive);
const nameOf = (game: GameState, id: string) => game.players.find((p) => p.id === id)?.name ?? "?";

/**
 * Pick living players, then confirm. Exactly `count` by default; `min` allows
 * fewer, and `skip` adds a button that confirms with nobody.
 */
function PickPlayers({
  game,
  count,
  min = count,
  isDisabled,
  onConfirm,
  skip,
  extra,
}: {
  game: GameState;
  count: number;
  min?: number;
  isDisabled?: (p: Player) => boolean;
  onConfirm: (ids: string[]) => void;
  skip?: string;
  extra?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <PlayerGrid
        game={game}
        players={living(game)}
        selected={selected}
        onToggle={(id) => setSelected((s) => toggle(s, id, count))}
        isDisabled={isDisabled}
      />
      <div className="flex flex-wrap gap-2 [&>*]:grow sm:[&>*]:grow-0">
        <ConfirmButton
          disabled={selected.length < Math.max(min, 1) || selected.length > count}
          onClick={() => onConfirm(selected)}
        />
        {skip && (
          <Button type="button" variant="outline" className="h-12" onClick={() => onConfirm([])}>
            {skip}
          </Button>
        )}
        {extra}
      </div>
    </>
  );
}

/** For steps added after the base game, picks are sent as a generic "pick" action. */
const pickAction = (targetIds: string[]): Action => ({ type: "pick", targetIds });
const names = (game: GameState, ids: string[]) => ids.map((id) => nameOf(game, id)).join(", ");

function ChoiceButtons({ options }: { options: { label: React.ReactNode; onClick: () => void; ghost?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2 [&>*]:grow sm:[&>*]:grow-0">
      {options.map((o, i) => (
        <Button key={i} type="button" variant={o.ghost ? "outline" : "default"} className="h-12 px-6 text-base" onClick={o.onClick}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

// --- steps ---

function PrologueStep({ game, act }: Props<"prologue">) {
  const { dict } = useI18n();
  const t = dict.game.story.prologue;
  return (
    <>
      <PhonelessIntro game={game} />
      <Say>
        {t.say.map((paragraph, i) => (
          <span key={i} className="block not-first:mt-3">
            {paragraph}
          </span>
        ))}
      </Say>
      <Do>{t.do}</Do>
      <StartPhaseButton act={act} next={game.phase} />
    </>
  );
}

/** The end of a night or day: a pause, a line of story, then the game master moves on. */
function PhaseEndStep({ game, step, act }: Props<"phase-end">) {
  const { dict } = useI18n();
  const t = dict.game.story;
  const toDay = step.next.kind === "day";
  // A wolf the village killed today (vote, Hunter…) cheers the ghost up.
  const wolfDown = game.players.some(
    (p) => p.death && p.death.phase.kind === game.phase.kind && p.death.phase.number === game.phase.number && isWolf(p),
  );
  const lines = toDay ? t.nightEnds : wolfDown ? t.dayEndsWolfDown : t.dayEnds;
  return (
    <>
      <Say>{line(lines, `${game.phase.kind}${game.phase.number}`)}</Say>
      <Do>{toDay ? t.nightEndsDo : t.dayEndsDo}</Do>
      <StartPhaseButton act={act} next={step.next} />
    </>
  );
}

function ThiefStep({ game, step, act }: Props<"thief">) {
  const { dict } = useI18n();
  const t = dict.game.steps.thief;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      {/* The Thief may see these two cards, nothing else: the choice happens in the reveal. */}
      <Reveal to={nameOf(game, step.playerId)}>
        <div className="grid w-full grid-cols-2 gap-4">
          {step.cards.map((role, i) => (
            <button
              key={i}
              type="button"
              onClick={() => act({ type: "thief", pick: i })}
              className="card flex aspect-[3/4] flex-col items-center justify-center gap-2 p-4 text-center text-2xl font-semibold hover:border-fg/40"
            >
              <RoleName role={role} />
            </button>
          ))}
        </div>
        {step.mustTakeWolf ? (
          <p className="text-primary">{t.mustTakeWolf}</p>
        ) : (
          <Button type="button" variant="outline" className="h-12 w-full sm:w-auto sm:self-start" onClick={() => act({ type: "thief", pick: null })}>
            {t.keep}
          </Button>
        )}
      </Reveal>
    </>
  );
}

function CupidStep({ game, step, act }: Props<"cupid">) {
  const { dict } = useI18n();
  const t = dict.game.steps.cupid;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers game={game} count={2} onConfirm={([a, b]) => act({ type: "cupid", lovers: [a, b] })} />
    </>
  );
}

function LoversStep({ game, step, act }: Props<"lovers">) {
  const { dict } = useI18n();
  const t = dict.game.steps.lovers;
  const [a, b] = step.lovers.map((id) => nameOf(game, id));
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { a, b })}</Do>
      <ContinueButton act={act} />
    </>
  );
}

function SeerStep({ game, step, act }: Props<"seer">) {
  const { dict } = useI18n();
  const t = dict.game.steps.seer;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => p.id === step.playerId}
        onConfirm={([targetId]) => act({ type: "seer", targetId })}
      />
    </>
  );
}

function SeerResultStep({ game, step, act }: Props<"seer-result">) {
  const { dict } = useI18n();
  const t = dict.game.steps["seer-result"];
  return (
    <>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <Reveal to={nameOf(game, step.playerId)}>
        <p className="text-2xl">{format(t.reveal, { target: nameOf(game, step.targetId) })}</p>
        <RoleName role={step.role} className="font-display text-5xl font-bold sm:text-7xl" />
      </Reveal>
      <Say>{t.say}</Say>
      <ContinueButton act={act} />
    </>
  );
}

function WolvesStep({ game, step, act }: Props<"wolves">) {
  const { dict } = useI18n();
  const t = dict.game.steps.wolves;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{t.do}</Do>
      {step.littleGirlIds.map((id) => (
        <p key={id} className="rounded-xl bg-surface-2 px-4 py-2 text-sm">
          {format(t.littleGirl, { name: nameOf(game, id) })}
        </p>
      ))}
      <PickPlayers
        game={game}
        count={1}
        isDisabled={isWolf}
        onConfirm={([targetId]) => act({ type: "wolves", targetId })}
      />
    </>
  );
}

function WitchStep({ game, step, act }: Props<"witch">) {
  const { dict } = useI18n();
  const t = dict.game.steps.witch;
  const [heal, setHeal] = useState(false);
  const [poison, setPoison] = useState<string[]>([]);
  const victim = step.victimId ? nameOf(game, step.victimId) : null;

  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <Reveal to={nameOf(game, step.playerId)}>
        <p className="text-3xl font-semibold sm:text-4xl">{victim ? format(t.victim, { name: victim }) : t.noVictim}</p>
        <ul className="flex flex-col gap-2 text-lg">
          <li className={step.canHeal ? "text-ok" : "text-muted-foreground line-through"}>
            <FlaskConical aria-hidden className="mr-2 inline size-5" />
            {step.canHeal ? t.healAvailable : t.healUsed}
          </li>
          <li className={step.canPoison ? "text-primary" : "text-muted-foreground line-through"}>
            <Skull aria-hidden className="mr-2 inline size-5" />
            {step.canPoison ? t.poisonAvailable : t.poisonUsed}
          </li>
        </ul>
      </Reveal>
      <p className="text-lg font-semibold">{victim ? format(t.victim, { name: victim }) : t.noVictim}</p>

      <label
        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${heal ? "border-ok" : "border-line"} ${step.canHeal ? "cursor-pointer" : "opacity-50"}`}
      >
        <input
          type="checkbox"
          className="size-5 accent-[var(--ok)]"
          checked={heal}
          disabled={!step.canHeal}
          onChange={(e) => setHeal(e.target.checked)}
        />
        <FlaskConical aria-hidden className="size-5 text-ok" />
        {step.canHeal && victim ? format(t.heal, { name: victim }) : t.healUsed}
      </label>

      <div className={`flex flex-col gap-3 ${step.canPoison ? "" : "opacity-50"}`}>
        <p className="flex items-center gap-2 font-medium">
          <Skull aria-hidden className="size-5 text-primary" />
          {step.canPoison ? t.poison : t.poisonUsed}
        </p>
        {step.canPoison && (
          <PlayerGrid
            game={game}
            players={living(game)}
            selected={poison}
            onToggle={(id) => setPoison((s) => toggle(s, id, 1))}
            // Already dying: the poison would only tell the village who used it.
            isDisabled={(p) => p.id === step.victimId}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2 [&>*]:grow sm:[&>*]:grow-0">
        <Button
          type="button"
          className="h-12 px-8 text-base"
          onClick={() => act({ type: "witch", heal, poisonId: poison[0] ?? null })}
        >
          {heal || poison.length > 0 ? dict.game.confirm : t.nothing}
        </Button>
      </div>
    </>
  );
}

function DeathsStep({ game, step, act }: Props<"deaths">) {
  const { dict } = useI18n();
  const t = dict.game.steps.deaths;
  const reveal = game.setup.settings.revealRoleOnDeath;
  const dawn = step.context === "dawn";
  const seed = `${game.phase.kind}${game.phase.number}`;
  // At dawn, the order would hint at who killed whom: by seat, grief last.
  const seat = (d: Death) => game.players.findIndex((p) => p.id === d.playerId) + (d.cause === "grief" ? game.players.length : 0);
  const deaths = dawn ? [...step.deaths].sort((a, b) => seat(a) - seat(b)) : step.deaths;

  /** Dawn tells who died, never how, except a lover's grief. By day, everyone saw it. */
  const announce = (d: Death, i: number) => {
    const name = nameOf(game, d.playerId);
    if (d.cause === "grief") return format(t.grief, { name });
    if (dawn) return format(line(t.found, seed, i), { name });
    return format(t.died, { name, cause: dict.game.causes[d.cause] });
  };

  return (
    <>
      <Say>{t[step.context]}</Say>
      {deaths.length === 0 ? (
        <Say>{line(t.nobody, seed)}</Say>
      ) : (
        <ul className="flex flex-col gap-3">
          {deaths.map((d, i) => {
            const player = game.players.find((p) => p.id === d.playerId)!;
            return (
              <li key={d.playerId} className="card flex flex-col gap-1 px-5 py-4">
                <p className="text-xl text-balance">{announce(d, i)}</p>
                <p className="text-muted-foreground">
                  {reveal ? (
                    <>
                      {t.reveal}{" "}
                      <RoleName role={player.role} className="font-semibold" />
                    </>
                  ) : (
                    t.hidden
                  )}
                </p>
                {dawn && d.cause !== "grief" && (
                  <p className="secret-role secret-text text-sm text-muted-foreground">
                    {format(t.secret, { cause: dict.game.causes[d.cause] })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ContinueButton act={act} />
    </>
  );
}

function HunterStep({ game, step, act }: Props<"hunter">) {
  const { dict } = useI18n();
  const t = dict.game.steps.hunter;
  const name = nameOf(game, step.playerId);
  return (
    <>
      <Say>{format(t.say, { name })}</Say>
      <Do>{format(t.do, { name })}</Do>
      <PickPlayers game={game} count={1} onConfirm={([targetId]) => act({ type: "hunter", targetId })} />
    </>
  );
}

function MayorStep({ game, step, act }: Props<"mayor-election" | "mayor-succession">) {
  const { dict } = useI18n();
  const t = dict.game.steps[step.kind];
  const name = step.kind === "mayor-succession" ? nameOf(game, step.playerId) : "";
  const { ballot, send, candidates: standing = [] } = useRoomContext();
  // The election's phone vote: the candidates being picked, before it opens.
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const election = step.kind === "mayor-election" ? step : null;
  const picking = !!election && !ballot && candidates !== null;
  return (
    <>
      <Say>{format(t.say, { name })}</Say>
      {election && standing.length > 0 && <Do>{format(dict.auto.mayorCandidates, { names: names(game, standing) })}</Do>}
      {election && send && !ballot && !picking && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="h-11" onClick={() => setCandidates(standing.filter((id) => game.players.find((p) => p.id === id)?.alive))}>
            <Smartphone aria-hidden className="size-4" />
            {dict.ballot.open}
          </Button>
          <p className="text-sm text-muted-foreground">{dict.ballot.mayorOpenHint}</p>
        </div>
      )}
      {picking && send && (
        <>
          <Do>{dict.ballot.candidatesHint}</Do>
          <PlayerGrid
            game={game}
            players={living(game)}
            selected={candidates}
            onToggle={(id) => setCandidates((s) => toggle(s ?? [], id, Infinity))}
          />
          <div className="flex flex-wrap gap-2 [&>*]:grow sm:[&>*]:grow-0">
            <Button
              type="button"
              className="h-12 px-8 text-base"
              disabled={candidates.length < 2}
              onClick={() => send({ type: "open-ballot", candidateIds: candidates })}
            >
              {format(dict.ballot.startElection, { count: candidates.length })}
            </Button>
            <Button type="button" variant="outline" className="h-12" onClick={() => setCandidates(null)}>
              {dict.ballot.back}
            </Button>
          </div>
        </>
      )}
      {election && <BallotPanel game={game} step={election} act={act} />}
      {!picking && (
        <>
          <Do>{t.do}</Do>
          <PickPlayers game={game} count={1} onConfirm={([targetId]) => act({ type: "mayor", targetId })} />
        </>
      )}
    </>
  );
}

function VoteStep({ game, step, act }: Props<"vote">) {
  const { dict } = useI18n();
  const t = dict.game.steps.vote;
  return (
    <>
      {step.second && <p className="font-semibold text-moon">{t.second}</p>}
      <Say>{t.say}</Say>
      <Do>
        {t.do}
        {step.mayorId && <> {format(t.mayor, { name: nameOf(game, step.mayorId) })}</>}
      </Do>
      {step.ravenTargetId && (
        <p className="rounded-xl bg-surface-2 px-4 py-2">{format(t.raven, { name: nameOf(game, step.ravenTargetId) })}</p>
      )}
      {step.cannotVote.length > 0 && (
        <p className="rounded-xl bg-surface-2 px-4 py-2">{format(t.cannotVote, { names: names(game, step.cannotVote) })}</p>
      )}
      <TimerControls />
      <BallotPanel game={game} step={step} act={act} />
      <PickPlayers
        game={game}
        count={1}
        onConfirm={([targetId]) => act({ type: "vote", targetId })}
        extra={
          <>
            {/* Tighter on phones, so Validate, Tie and No elimination share a line. */}
            <Button
              type="button"
              variant="outline"
              className="h-12 px-3 sm:px-5"
              onClick={() => act({ type: "vote", targetId: null, tie: true })}
            >
              {step.scapegoatId ? t.tieScapegoat : t.tie}
            </Button>
            <Button type="button" variant="outline" className="h-12 px-3 sm:px-5" onClick={() => act({ type: "vote", targetId: null })}>
              {t.nobody}
            </Button>
          </>
        }
      />
    </>
  );
}

/** A turn nobody can play: the narrator calls it anyway, word for word. */
function BluffStep({ game, step, act }: Props<"bluff">) {
  const { dict } = useI18n();
  const turns = dict.game.steps as Record<string, { say?: string }>;
  const siblings = dict.game.steps.siblings as Record<string, string>;
  const piper = game.setup.settings.piperCharms;
  const say = format(turns[step.turn]?.say ?? siblings[step.turn] ?? "", { count: piper === "choice" ? 2 : piper });
  return (
    <>
      <Say>{say}</Say>
      <Do>{dict.game.steps.bluff.do}</Do>
      <ContinueButton act={act} />
    </>
  );
}

// --- expansion steps ---

function ActorStep({ game, step, act }: Props<"actor">) {
  const { dict } = useI18n();
  const t = dict.game.steps.actor;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
        {step.cards.map((role, i) => (
          <button
            key={i}
            type="button"
            onClick={() => act({ type: "choose", value: i })}
            className="card flex aspect-[3/4] items-center justify-center p-3 text-center font-semibold hover:border-fg/40"
          >
            <RoleName role={role} />
          </button>
        ))}
      </div>
      <Button type="button" variant="outline" className="h-12 w-full sm:w-auto sm:self-start" onClick={() => act({ type: "choose", value: null })}>
        {t.none}
      </Button>
    </>
  );
}

function WolfHoundStep({ game, step, act }: Props<"wolf-hound">) {
  const { dict } = useI18n();
  const t = dict.game.steps["wolf-hound"];
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: t.village, onClick: () => act({ type: "choose", value: "village" }), ghost: true },
          { label: t.wolves, onClick: () => act({ type: "choose", value: "wolves" }) },
        ]}
      />
    </>
  );
}

function WildChildStep({ game, step, act }: Props<"wild-child">) {
  const { dict } = useI18n();
  const t = dict.game.steps["wild-child"];
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => p.id === step.playerId}
        onConfirm={(ids) => act(pickAction(ids))}
      />
    </>
  );
}

function SiblingsStep({ game, step, act }: Props<"siblings">) {
  const { dict } = useI18n();
  const t = dict.game.steps.siblings;
  return (
    <>
      <Say>{t[step.role]}</Say>
      <Do>{format(t.do, { names: names(game, step.playerIds) })}</Do>
      <ContinueButton act={act} />
    </>
  );
}

function DefenderStep({ game, step, act }: Props<"defender">) {
  const { dict } = useI18n();
  const t = dict.game.steps.defender;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      {step.lastProtectedId && <Do>{format(t.last, { name: nameOf(game, step.lastProtectedId) })}</Do>}
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => p.id === step.lastProtectedId}
        onConfirm={(ids) => act(pickAction(ids))}
        skip={t.skip}
      />
    </>
  );
}

function FoxStep({ game, step, act }: Props<"fox">) {
  const { dict } = useI18n();
  const t = dict.game.steps.fox;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers game={game} count={1} onConfirm={(ids) => act(pickAction(ids))} />
    </>
  );
}

function FoxResultStep({ game, step, act }: Props<"fox-result">) {
  const { dict } = useI18n();
  const t = dict.game.steps["fox-result"];
  const fox = game.players.find((p) => p.id === step.playerId);
  return (
    <>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <Reveal to={nameOf(game, step.playerId)}>
        <p className={`font-display text-4xl font-bold ${step.hasWolf ? "text-primary" : "text-ok"}`}>
          {step.hasWolf ? t.yes : t.no}
        </p>
        <p className="text-2xl">{names(game, step.playerIds)}</p>
      </Reveal>
      {!step.hasWolf && fox?.role === "fox" && <Do>{t.lost}</Do>}
      <Say>{t.say}</Say>
      <ContinueButton act={act} />
    </>
  );
}

function InfectStep({ game, step, act }: Props<"infect">) {
  const { dict } = useI18n();
  const t = dict.game.steps.infect;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: format(t.infect, { name: nameOf(game, step.victimId) }), onClick: () => act({ type: "choose", value: true }) },
          { label: t.no, onClick: () => act({ type: "choose", value: false }), ghost: true },
        ]}
      />
    </>
  );
}

function BigBadWolfStep({ game, step, act }: Props<"big-bad-wolf">) {
  const { dict } = useI18n();
  const t = dict.game.steps["big-bad-wolf"];
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => isWolf(p) || p.id === step.wolvesTargetId}
        onConfirm={(ids) => act(pickAction(ids))}
        skip={t.skip}
      />
    </>
  );
}

function WhiteWerewolfStep({ game, step, act }: Props<"white-werewolf">) {
  const { dict } = useI18n();
  const t = dict.game.steps["white-werewolf"];
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => !isWolf(p) || p.id === step.playerId}
        onConfirm={(ids) => act(pickAction(ids))}
        skip={t.skip}
      />
    </>
  );
}

function PiperStep({ game, step, act }: Props<"piper">) {
  const { dict } = useI18n();
  const t = dict.game.steps.piper;
  return (
    <>
      <Say>{format(t.say, { count: step.min === step.count ? step.count : `${step.min}–${step.count}` })}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={step.count}
        min={step.min}
        isDisabled={(p) => p.id === step.playerId || !!p.flags.charmed}
        onConfirm={(ids) => act(pickAction(ids))}
      />
    </>
  );
}

function CharmedStep({ game, step, act }: Props<"charmed">) {
  const { dict } = useI18n();
  const t = dict.game.steps.charmed;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { names: names(game, step.playerIds), newNames: names(game, step.newIds) })}</Do>
      <ContinueButton act={act} />
    </>
  );
}

function RavenStep({ game, step, act }: Props<"raven">) {
  const { dict } = useI18n();
  const t = dict.game.steps.raven;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers game={game} count={1} onConfirm={(ids) => act(pickAction(ids))} skip={t.skip} />
    </>
  );
}

function BearStep({ game, step, act }: Props<"bear">) {
  const { dict } = useI18n();
  const t = dict.game.steps.bear;
  return (
    <>
      <Say>{step.growls ? t.growls : t.quiet}</Say>
      {/* The tamer stays secret: only they know whose neighbours the bear means. */}
      {step.playerId && <Do>{format(t.secret, { name: nameOf(game, step.playerId) })}</Do>}
      <ContinueButton act={act} />
    </>
  );
}

function IdiotStep({ game, step, act }: Props<"idiot">) {
  const { dict } = useI18n();
  return (
    <>
      <Say>{format(dict.game.steps.idiot.say, { name: nameOf(game, step.playerId) })}</Say>
      <ContinueButton act={act} />
    </>
  );
}

function ServantStep({ game, step, act }: Props<"servant">) {
  const { dict } = useI18n();
  const t = dict.game.steps.servant;
  return (
    <>
      <Say>{format(t.say, { name: nameOf(game, step.victimId) })}</Say>
      <Do>{format(t.do, { servant: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: t.take, onClick: () => act({ type: "choose", value: true }) },
          { label: t.no, onClick: () => act({ type: "choose", value: false }), ghost: true },
        ]}
      />
    </>
  );
}

function ScapegoatStep({ game, step, act }: Props<"scapegoat">) {
  const { dict } = useI18n();
  const t = dict.game.steps.scapegoat;
  return (
    <>
      <Say>{format(t.say, { name: nameOf(game, step.playerId) })}</Say>
      <Do>{t.do}</Do>
      <PickPlayers
        game={game}
        count={living(game).length}
        min={1}
        onConfirm={(ids) => act(pickAction(ids))}
        skip={dict.game.events.scapegoatNobody}
      />
    </>
  );
}

function JudgeStep({ game, step, act }: Props<"judge">) {
  const { dict } = useI18n();
  const t = dict.game.steps.judge;
  return (
    <>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: t.yes, onClick: () => act({ type: "choose", value: true }) },
          { label: t.no, onClick: () => act({ type: "choose", value: false }), ghost: true },
        ]}
      />
    </>
  );
}

function GameOverStep({ game, step }: Props<"game-over">) {
  const { dict } = useI18n();
  const session = useSession();
  const t = dict.game.steps["game-over"];
  const { team, playerIds } = step.winner;
  return (
    <>
      <Say>{dict.game.story.epilogue[team ?? "draw"]}</Say>
      <div className="card flex flex-col items-center gap-5 px-6 py-10 text-center">
        <Trophy aria-hidden className="size-12 text-moon" />
        <p className="font-display text-3xl font-bold sm:text-4xl">{team ? t.wins[team] : t.draw}</p>
        {playerIds.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">{t.winners}</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {playerIds.map((id) => {
                const p = game.players.find((pl) => pl.id === id)!;
                return (
                  <li key={id} className="rounded-full bg-surface-2 px-3 py-1">
                    {p.name} · <RoleName role={p.role} className="text-sm" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {/* Signing in now still counts it: the room saves the result again with the master's account. */}
        {session?.stats && !session.account && (
          <AuthButton
            to="in"
            variant="link"
            className="h-auto p-0 text-sm font-normal whitespace-normal text-muted-foreground underline"
          >
            <LogIn aria-hidden className="size-4 shrink-0" />
            {dict.account.keepMastered}
          </AuthButton>
        )}
      </div>
    </>
  );
}
