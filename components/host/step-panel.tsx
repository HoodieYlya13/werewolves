"use client";

import { useState } from "react";
import { FlaskConical, Skull, Trophy } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { PlayerGrid, toggle } from "@/components/host/player-grid";
import { Reveal } from "@/components/host/reveal";
import { RoleName } from "@/components/host/role-chip";
import { format } from "@/lib/i18n/config";
import type { Action, GameState, Player, Step } from "@/lib/engine";

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
  const step = game.step;
  switch (step.kind) {
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
    case "sheriff-election":
    case "sheriff-succession":
      return <SheriffStep game={game} step={step} act={act} />;
    case "vote":
      return <VoteStep game={game} step={step} act={act} />;
    case "game-over":
      return <GameOverStep game={game} step={step} act={act} />;
  }
}

// --- building blocks ---

function Say({ children }: { children: React.ReactNode }) {
  const { dict } = useI18n();
  return (
    <blockquote className="rounded-2xl border-l-4 border-moon bg-surface-2 px-5 py-4">
      <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{dict.game.say}</p>
      <p className="text-xl leading-snug text-balance sm:text-2xl">{children}</p>
    </blockquote>
  );
}

function Do({ children }: { children: React.ReactNode }) {
  return <p className="text-muted">{children}</p>;
}

function ContinueButton({ act, label }: { act: Props<"lovers">["act"]; label?: string }) {
  const { dict } = useI18n();
  return (
    <button type="button" className="btn h-12 self-start px-8 text-base" onClick={() => act({ type: "continue" })}>
      {label ?? dict.game.continue}
    </button>
  );
}

function ConfirmButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { dict } = useI18n();
  return (
    <button type="button" className="btn h-12 px-8 text-base" disabled={disabled} onClick={onClick}>
      {dict.game.confirm}
    </button>
  );
}

const living = (game: GameState) => game.players.filter((p) => p.alive);
const nameOf = (game: GameState, id: string) => game.players.find((p) => p.id === id)?.name ?? "?";

/** Pick exactly `count` living players, then confirm. */
function PickPlayers({
  game,
  count,
  isDisabled,
  onConfirm,
  extra,
}: {
  game: GameState;
  count: number;
  isDisabled?: (p: Player) => boolean;
  onConfirm: (ids: string[]) => void;
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
      <div className="flex flex-wrap gap-2">
        <ConfirmButton disabled={selected.length !== count} onClick={() => onConfirm(selected)} />
        {extra}
      </div>
    </>
  );
}

// --- steps ---

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
          <p className="text-accent">{t.mustTakeWolf}</p>
        ) : (
          <button type="button" className="btn btn-ghost h-12" onClick={() => act({ type: "thief", pick: null })}>
            {t.keep}
          </button>
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
        isDisabled={(p) => p.role === "werewolf"}
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
          <li className={step.canHeal ? "text-ok" : "text-muted line-through"}>
            <FlaskConical aria-hidden className="mr-2 inline size-5" />
            {step.canHeal ? t.healAvailable : t.healUsed}
          </li>
          <li className={step.canPoison ? "text-accent" : "text-muted line-through"}>
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
          <Skull aria-hidden className="size-5 text-accent" />
          {step.canPoison ? t.poison : t.poisonUsed}
        </p>
        {step.canPoison && (
          <PlayerGrid
            game={game}
            players={living(game)}
            selected={poison}
            onToggle={(id) => setPoison((s) => toggle(s, id, 1))}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn h-12 px-8 text-base"
          onClick={() => act({ type: "witch", heal, poisonId: poison[0] ?? null })}
        >
          {heal || poison.length > 0 ? dict.game.confirm : t.nothing}
        </button>
      </div>
    </>
  );
}

function DeathsStep({ game, step, act }: Props<"deaths">) {
  const { dict } = useI18n();
  const t = dict.game.steps.deaths;
  const reveal = game.setup.settings.revealRoleOnDeath;
  return (
    <>
      <Say>{t[step.context]}</Say>
      {step.deaths.length === 0 ? (
        <p className="text-xl">{t.nobody}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {step.deaths.map((d) => {
            const player = game.players.find((p) => p.id === d.playerId)!;
            return (
              <li key={d.playerId} className="card flex flex-col gap-1 px-5 py-4">
                <p className="text-xl">
                  {format(t.died, { name: player.name, cause: dict.game.causes[d.cause] })}
                </p>
                <p className="text-muted">
                  {reveal ? (
                    <>
                      {t.reveal}{" "}
                      <RoleName role={player.role} className="font-semibold" />
                    </>
                  ) : (
                    t.hidden
                  )}
                </p>
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

function SheriffStep({ game, step, act }: Props<"sheriff-election" | "sheriff-succession">) {
  const { dict } = useI18n();
  const t = dict.game.steps[step.kind];
  const name = step.kind === "sheriff-succession" ? nameOf(game, step.playerId) : "";
  return (
    <>
      <Say>{format(t.say, { name })}</Say>
      <Do>{t.do}</Do>
      <PickPlayers game={game} count={1} onConfirm={([targetId]) => act({ type: "sheriff", targetId })} />
    </>
  );
}

function VoteStep({ game, step, act }: Props<"vote">) {
  const { dict } = useI18n();
  const t = dict.game.steps.vote;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>
        {t.do}
        {step.sheriffId && <> {format(t.sheriff, { name: nameOf(game, step.sheriffId) })}</>}
      </Do>
      <PickPlayers
        game={game}
        count={1}
        onConfirm={([targetId]) => act({ type: "vote", targetId })}
        extra={
          <button type="button" className="btn btn-ghost h-12" onClick={() => act({ type: "vote", targetId: null })}>
            {t.nobody}
          </button>
        }
      />
    </>
  );
}

function GameOverStep({ game, step }: Props<"game-over">) {
  const { dict } = useI18n();
  const t = dict.game.steps["game-over"];
  const { team, playerIds } = step.winner;
  return (
    <div className="card flex flex-col items-center gap-5 px-6 py-10 text-center">
      <Trophy aria-hidden className="size-12 text-moon" />
      <p className="font-display text-3xl font-bold sm:text-4xl">{team ? t.wins[team] : t.draw}</p>
      {playerIds.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{t.winners}</p>
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
    </div>
  );
}
