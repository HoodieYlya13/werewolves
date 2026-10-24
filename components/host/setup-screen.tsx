"use client";

import { useState } from "react";
import { ArrowLeft, Hand, History, Minus, Plus, Shuffle, Sparkles } from "lucide-react";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/host/role-chip";
import { format } from "@/lib/i18n/config";
import {
  actorRoles,
  defaultSettings,
  deckProblems,
  deckSize,
  MIN_PLAYERS,
  roleIds,
  roles,
  setupNeeds,
  suggestedDeck,
  type RoleId,
  type Settings,
} from "@/lib/engine";
import type { ClientMessage, PublicPlayer } from "@/lib/protocol";
import { themeDictionary, themeIds, themes } from "@/lib/themes";

type Counts = Partial<Record<RoleId, number>>;

const STORAGE_KEY = "ww:setup";

/** Wolves first, then specials, villagers last: the order people think in. */
const pickerOrder: RoleId[] = ["werewolf", ...roleIds.filter((r) => r !== "werewolf" && r !== "villager"), "villager"];

function toCounts(deck: RoleId[]): Counts {
  const counts: Counts = {};
  deck.forEach((r) => (counts[r] = (counts[r] ?? 0) + 1));
  return counts;
}

function toDeck(counts: Counts): RoleId[] {
  return pickerOrder.flatMap((r) => Array<RoleId>(counts[r] ?? 0).fill(r));
}

/** The last deck and rules are remembered, since groups tend to replay them. */
function loadSaved(playerCount: number): { counts: Counts; settings: Settings; actorCards: RoleId[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved) {
      return {
        counts: saved.counts,
        settings: { ...defaultSettings, ...saved.settings },
        actorCards: saved.actorCards ?? [],
      };
    }
  } catch {}
  return { counts: toCounts(suggestedDeck(playerCount)), settings: defaultSettings, actorCards: [] };
}

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export function SetupScreen({
  players,
  canResume,
  send,
  onBack,
}: {
  players: PublicPlayer[];
  canResume: boolean;
  send: (message: ClientMessage) => void;
  onBack: () => void;
}) {
  const { dict: baseDict, locale } = useI18n();
  const [initial] = useState(() => loadSaved(players.length));
  const [counts, setCounts] = useState<Counts>(initial.counts);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  // Role names follow the chosen theme as soon as it's picked.
  const dict = themeDictionary(baseDict, settings.theme, locale);
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [assignment, setAssignment] = useState<Record<string, RoleId>>({});
  const [actorCards, setActorCards] = useState<RoleId[]>(initial.actorCards);
  const [groups, setGroups] = useState<Record<string, "a" | "b">>({});

  const deck = toDeck(counts);
  const needed = deckSize(players.length, deck);
  const problems = deckProblems(players.length, deck);
  const needs = setupNeeds(deck);
  const actorReady = !needs.actorCards || (actorCards.length === 3 && actorCards.every((r) => actorRoles.includes(r)));
  const groupSides = players.map((p) => groups[p.id]);
  const groupsReady =
    !needs.groups || (groupSides.every(Boolean) && groupSides.includes("a") && groupSides.includes("b"));

  // Manual mode: what's left of the deck after the cards handed out so far.
  // A card only counts if the deck still has one (the deck may have shrunk since).
  const pool = { ...counts };
  const holds = new Set<string>();
  for (const p of players) {
    const r = assignment[p.id];
    if (r && (pool[r] ?? 0) > 0) {
      pool[r]! -= 1;
      holds.add(p.id);
    }
  }
  const leftover = toDeck(pool);
  const everyoneAssigned = players.every((p) => holds.has(p.id));
  const canStart = problems.length === 0 && actorReady && groupsReady && (mode === "random" || everyoneAssigned);

  function change(role: RoleId, delta: number) {
    // Sets (Two Sisters, Three Brothers) are added and removed as a whole.
    const step = roles[role].copies ?? 1;
    setCounts((c) => {
      const next = Math.max(0, Math.min(roles[role].max ?? 99, (c[role] ?? 0) + delta * step));
      return { ...c, [role]: next };
    });
  }

  function start() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ counts, settings, actorCards }));
    } catch {}
    const options = {
      actorCards: needs.actorCards ? actorCards : undefined,
      groups: needs.groups ? groups : undefined,
    };
    send(
      mode === "random"
        ? { type: "start-game", mode, deck, settings, ...options }
        : { type: "start-game", mode, assignment, extraCards: leftover, settings, ...options },
    );
  }

  const toggles: { key: BooleanSetting; hint?: string }[] = [
    { key: "sheriff", hint: dict.setup.sheriffHint },
    { key: "revealRoleOnDeath" },
    { key: "witchCanSelfHeal" },
    { key: "wolvesWinAtParity", hint: dict.setup.wolvesWinAtParityHint },
  ];

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn btn-ghost h-9 px-3 text-sm" onClick={onBack}>
              <ArrowLeft aria-hidden className="size-4" />
              {dict.setup.back}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost h-9 px-3 text-sm"
                onClick={() => setCounts(toCounts(suggestedDeck(players.length)))}
              >
                <Sparkles aria-hidden className="size-4" />
                {dict.setup.suggest}
              </button>
              <button type="button" className="btn btn-ghost h-9 px-3 text-sm" onClick={() => setCounts({})}>
                {dict.setup.clear}
              </button>
            </div>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{dict.setup.theme}</h2>
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {themeIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={settings.theme === id}
                    onClick={() => setSettings((s) => ({ ...s, theme: id }))}
                    className={`flex h-full w-full flex-col gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
                      settings.theme === id ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-fg/30"
                    }`}
                  >
                    <span className="font-semibold">{themes[id].name[locale]}</span>
                    <span className="text-xs text-muted">{themes[id].description[locale]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <h1 className="font-display text-2xl font-bold">{dict.setup.title}</h1>

          <ul className="grid gap-3 sm:grid-cols-2">
            {pickerOrder.map((role) => {
              const count = counts[role] ?? 0;
              const max = roles[role].max;
              return (
                <li
                  key={role}
                  className={`card flex gap-3 p-4 transition-colors ${count > 0 ? "border-fg/30" : "opacity-80"}`}
                >
                  <div className="min-w-0 flex-1">
                    <RoleName role={role} className="font-semibold" />
                    <p className="mt-1 text-sm text-muted">{dict.roles[role].power}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-center">
                    <button
                      type="button"
                      aria-label={format(dict.setup.removeOne, { role: dict.roles[role].name })}
                      className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-30"
                      disabled={count === 0}
                      onClick={() => change(role, -1)}
                    >
                      <Minus aria-hidden className="size-4" />
                    </button>
                    <span className="w-7 text-center font-mono text-lg tabular-nums">{count}</span>
                    <button
                      type="button"
                      aria-label={format(dict.setup.add, { role: dict.roles[role].name })}
                      className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-30"
                      disabled={max !== undefined && count >= max}
                      onClick={() => change(role, 1)}
                    >
                      <Plus aria-hidden className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-1">
          <section className="card flex flex-col gap-2 p-5">
            <p
              className={`font-mono text-3xl font-bold tabular-nums ${deck.length === needed ? "text-ok" : "text-accent"}`}
            >
              {format(dict.setup.cards, { count: deck.length, needed })}
            </p>
            {deck.includes("thief") && <p className="text-sm text-muted">{dict.setup.thiefNote}</p>}
            {problems.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-accent">
                {problems.map((p) => (
                  <li key={p}>{dict.setup.problems[p]}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <h2 className="font-semibold">{dict.setup.rules}</h2>
            {toggles.map(({ key, hint }) => (
              <label key={key} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--accent)]"
                  checked={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                />
                <span>
                  <span className="block">{dict.setup[key]}</span>
                  {hint && <span className="block text-sm text-muted">{hint}</span>}
                </span>
              </label>
            ))}
          </section>

          {deck.includes("pied-piper") && (
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="font-semibold">{dict.setup.piperCharms}</h2>
              <div className="segmented self-start">
                {([2, 1, "choice"] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-current={settings.piperCharms === n}
                    onClick={() => setSettings((s) => ({ ...s, piperCharms: n }))}
                  >
                    {n === 2 ? dict.setup.piperOfficial : n === 1 ? "1" : dict.setup.piperChoice}
                  </button>
                ))}
              </div>
            </section>
          )}

          {deck.includes("angel") && (
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="font-semibold">{dict.setup.angelRule}</h2>
              {(["opening-vote", "first-vote"] as const).map((rule) => (
                <label key={rule} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="angel-rule"
                    className="mt-1 size-4 accent-[var(--accent)]"
                    checked={settings.angelRule === rule}
                    onChange={() => setSettings((s) => ({ ...s, angelRule: rule }))}
                  />
                  <span>
                    <span className="block">{dict.setup.angelRules[rule].label}</span>
                    <span className="block text-sm text-muted">{dict.setup.angelRules[rule].hint}</span>
                  </span>
                </label>
              ))}
            </section>
          )}

          {needs.actorCards && (
            <section className="card flex flex-col gap-3 p-5">
              <div>
                <h2 className="font-semibold">{dict.setup.actorCards}</h2>
                <p className="text-sm text-muted">{dict.setup.actorCardsHint}</p>
              </div>
              {[0, 1, 2].map((i) => (
                <select
                  key={i}
                  className="input h-10 py-0"
                  value={actorCards[i] ?? ""}
                  onChange={(e) =>
                    setActorCards((cards) => {
                      const next = [...cards];
                      next[i] = e.target.value as RoleId;
                      return next;
                    })
                  }
                >
                  <option value="" disabled>
                    {dict.setup.pickRole}
                  </option>
                  {actorRoles.map((r) => (
                    <option key={r} value={r}>
                      {dict.roles[r].name}
                    </option>
                  ))}
                </select>
              ))}
              {!actorReady && <p className="text-sm text-accent">{dict.setup.actorNeedsCards}</p>}
            </section>
          )}

          {needs.groups && (
            <section className="card flex flex-col gap-3 p-5">
              <div>
                <h2 className="font-semibold">{dict.setup.groups}</h2>
                <p className="text-sm text-muted">{dict.setup.groupsHint}</p>
              </div>
              <ol className="flex flex-col gap-2">
                {players.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <div className="segmented">
                      {(["a", "b"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          aria-current={groups[p.id] === g}
                          onClick={() => setGroups((all) => ({ ...all, [p.id]: g }))}
                        >
                          {g === "a" ? dict.setup.groupA : dict.setup.groupB}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              {!groupsReady && <p className="text-sm text-accent">{dict.setup.groupsNeeded}</p>}
            </section>
          )}

          <section className="card flex flex-col gap-3 p-5">
            <h2 className="font-semibold">{dict.setup.dealing}</h2>
            <div className="segmented self-start">
              <button type="button" aria-current={mode === "random"} onClick={() => setMode("random")}>
                <Shuffle aria-hidden className="mr-1.5 size-4" />
                {dict.setup.dealRandom}
              </button>
              <button type="button" aria-current={mode === "manual"} onClick={() => setMode("manual")}>
                <Hand aria-hidden className="mr-1.5 size-4" />
                {dict.setup.dealManual}
              </button>
            </div>

            {mode === "manual" && (
              <ol className="flex flex-col gap-2">
                {players.map((p) => {
                  const current = assignment[p.id];
                  const options = pickerOrder.filter((r) => (pool[r] ?? 0) > 0 || r === current);
                  return (
                    <li key={p.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <select
                        className="input h-10 w-44 py-0"
                        value={holds.has(p.id) ? current : ""}
                        onChange={(e) => setAssignment((a) => ({ ...a, [p.id]: e.target.value as RoleId }))}
                      >
                        <option value="" disabled>
                          {dict.setup.pickRole}
                        </option>
                        {options.map((r) => (
                          <option key={r} value={r}>
                            {dict.roles[r].name}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
                {everyoneAssigned && leftover.length > 0 && (
                  <li className="text-sm text-muted">
                    {dict.setup.leftover}: {leftover.map((r) => dict.roles[r].name).join(", ")}
                  </li>
                )}
              </ol>
            )}
          </section>

          {canResume && (
            <button type="button" className="btn btn-ghost h-12 text-base" onClick={() => send({ type: "resume-game" })}>
              <History aria-hidden className="size-5" />
              {dict.host.resume}
            </button>
          )}
          <button type="button" className="btn h-12 text-base" disabled={!canStart} onClick={start}>
            {dict.setup.begin}
          </button>
          {players.length < MIN_PLAYERS && (
            <p className="text-sm text-accent">{format(dict.setup.needPlayers, { min: MIN_PLAYERS })}</p>
          )}
        </aside>
      </main>
    </I18nProvider>
  );
}
