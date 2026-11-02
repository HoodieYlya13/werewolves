"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { ArrowLeft, ChevronDown, Dices, Eraser, Globe, Hand, History, Minus, Pencil, Plus, RotateCcw, Shuffle, Sparkles, Trash2, Undo2 } from "lucide-react";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { JoinRequests } from "@/components/host/join-requests";
import { useSiteTheme } from "@/components/site-title";
import { RoleName } from "@/components/host/role-chip";
import { format } from "@/lib/i18n/config";
import {
  actorRoles,
  defaultSettings,
  deckProblems,
  deckSize,
  MIN_PLAYERS,
  REMOTE_UNPLAYABLE,
  roleIds,
  roles,
  setupNeeds,
  suggestedDeck,
  type DeckStyle,
  type RoleId,
  type Settings,
} from "@/lib/engine";
import type { ClientMessage, PublicPlayer, RoomMode } from "@/lib/protocol";
import { DISCUSSION_CHOICES, defaultAutoConfig, type AutoConfig } from "@/lib/auto";
import { defaultTheme, isThemeId, themeDictionary, themeIds, themes } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

/**
 * The deck and rules are remembered as they're picked, since groups tend to
 * replay them (and a trip to the lobby shouldn't lose them). A deck for
 * another number of players is kept, and the game master asked what to do.
 */
function loadSaved(playerCount: number) {
  let saved: {
    counts?: Counts;
    settings?: Partial<Settings>;
    actorCards?: RoleId[];
    style?: DeckStyle;
    removed?: RoleId[];
    auto?: Partial<AutoConfig>;
  } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {}
  const style: DeckStyle = saved?.style === "no-villagers" ? "no-villagers" : "classic";
  const removed = (saved?.removed ?? []).filter((r) => removable(r));
  const savedDeck = saved?.counts ? toDeck(saved.counts) : null;
  return {
    counts: savedDeck?.length ? saved!.counts! : toCounts(suggestedDeck(playerCount, style, Math.random, removed)),
    settings: { ...defaultSettings, ...saved?.settings },
    actorCards: saved?.actorCards ?? [],
    style,
    removed,
    auto: { ...defaultAutoConfig, ...saved?.auto },
  };
}

/** Every role but the two a game needs can be taken out of a group's games. */
const removable = (role: RoleId) => role in roles && role !== "werewolf" && role !== "villager";

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export function SetupScreen({
  players,
  canResume,
  send,
  onBack,
  mode: roomMode = "master",
}: {
  players: PublicPlayer[];
  canResume: boolean;
  send: (message: ClientMessage) => void;
  onBack: () => void;
  /** Without a game master: always dealt at random, and the deck may stay secret. */
  mode?: RoomMode;
}) {
  const { dict: baseDict, locale } = useI18n();
  const [initial] = useState(() => loadSaved(players.length));
  const [counts, setCounts] = useState<Counts>(initial.counts);
  const [style, setStyle] = useState<DeckStyle>(initial.style);
  // The table changed since the deck was picked: keep it, start over, or go back.
  const [asking, setAsking] = useState(() => {
    const deck = toDeck(initial.counts);
    return deck.length !== deckSize(players.length, deck);
  });
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [removed, setRemoved] = useState<RoleId[]>(initial.removed);
  const [autoConfig, setAutoConfig] = useState<AutoConfig>(initial.auto);
  const [remoteAsk, setRemoteAsk] = useState(false);
  const autoMode = roomMode === "auto";
  // A secret deck: nobody picks the cards, the room deals them.
  const hidden = autoMode && autoConfig.deck === "hidden";
  // Role names follow the chosen theme as soon as it's picked.
  const dict = themeDictionary(baseDict, settings.theme, locale);
  useSiteTheme(settings.theme);
  // The deck summary says what's in it: the full card list only opens on demand.
  const [cardsOpen, setCardsOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Esc goes back to the lobby, unless it's closing a dialog (or the browser's own UI).
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    onBack();
  });
  useEffect(() => {
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  function openCards() {
    setCardsOpen(true);
    document.getElementById("card-picker")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [assignment, setAssignment] = useState<Record<string, RoleId>>({});
  const [actorCards, setActorCards] = useState<RoleId[]>(initial.actorCards);
  const [groups, setGroups] = useState<Record<string, "a" | "b">>({});

  const deck = toDeck(counts);
  const needed = deckSize(players.length, deck);
  // Players joined or left while picking: ask again.
  const [sizedFor, setSizedFor] = useState(players.length);
  if (players.length !== sizedFor) {
    setSizedFor(players.length);
    if (deck.length !== needed) setAsking(true);
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ counts, settings, actorCards, style, removed, auto: autoConfig }));
    } catch {}
  }, [counts, settings, actorCards, style, removed, autoConfig]);
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
  const canStart = hidden
    ? players.length >= MIN_PLAYERS
    : problems.length === 0 && actorReady && groupsReady && (mode === "random" || everyoneAssigned);

  function suggest(next: DeckStyle) {
    setStyle(next);
    setCounts(toCounts(suggestedDeck(players.length, next, Math.random, removed)));
  }

  /** Out of the group's games: out of the deck too. */
  function removeRoles(list: RoleId[]) {
    const out = list.filter(removable);
    setRemoved(out);
    setCounts((c) => Object.fromEntries(Object.entries(c).filter(([r]) => !out.includes(r as RoleId))) as Counts);
  }

  function change(role: RoleId, delta: number) {
    // Sets (Two Sisters, Three Brothers) are added and removed as a whole.
    const step = roles[role].copies ?? 1;
    setCounts((c) => {
      const next = Math.max(0, Math.min(roles[role].max ?? 99, (c[role] ?? 0) + delta * step));
      return { ...c, [role]: next };
    });
  }

  function start() {
    const options = {
      actorCards: needs.actorCards && !hidden ? actorCards : undefined,
      groups: needs.groups && !hidden ? groups : undefined,
    };
    if (autoMode) {
      send({ type: "start-game", mode: "random", deck: hidden ? [] : deck, settings, ...options, auto: { ...autoConfig, exclude: removed } });
      return;
    }
    send(
      mode === "random"
        ? { type: "start-game", mode, deck, settings, ...options }
        : { type: "start-game", mode, assignment, extraCards: leftover, settings, ...options },
    );
  }
  const shown = pickerOrder.filter((r) => !removed.includes(r));

  const toggles: { key: BooleanSetting; hint?: string }[] = [
    { key: "mayor", hint: dict.setup.mayorHint },
    { key: "revealRoleOnDeath" },
    { key: "witchCanSelfHeal" },
    { key: "wolvesWinAtParity", hint: dict.setup.wolvesWinAtParityHint },
  ];

  return (
    <I18nProvider locale={locale} dict={dict}>
      <Dialog open={remoteAsk} onOpenChange={setRemoteAsk}>
        <DialogContent closeLabel={dict.host.close}>
          <DialogHeader>
            <DialogTitle>{dict.setup.removed.remoteTitle}</DialogTitle>
            <DialogDescription>
              {format(dict.setup.removed.remoteBody, { roles: REMOTE_UNPLAYABLE.map((r) => dict.roles[r].name).join(", ") })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                removeRoles(REMOTE_UNPLAYABLE);
                setRemoteAsk(false);
              }}
            >
              {dict.setup.removed.remoteOnly}
            </Button>
            <Button
              type="button"
              onClick={() => {
                removeRoles([...new Set([...removed, ...REMOTE_UNPLAYABLE])]);
                setRemoteAsk(false);
              }}
            >
              {dict.setup.removed.remoteAdd}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={asking && !hidden && deck.length !== needed} onOpenChange={(open) => !open && setAsking(false)}>
        <DialogContent
          closeLabel={dict.host.close}
          className="max-w-[min(38rem,calc(100vw-2rem))] sm:max-w-[38rem]"
          // Keeping the deck is the likely answer: Enter does it.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            document.getElementById("keep-deck")?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{dict.setup.tableChanged.title}</DialogTitle>
            <DialogDescription>
              {format(dict.setup.tableChanged.body, { players: players.length, cards: deck.length, needed })}
            </DialogDescription>
          </DialogHeader>
          {deck.length > 0 && <DeckChips counts={counts} />}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft aria-hidden className="size-4" />
              {dict.setup.tableChanged.lobby}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                suggest(style);
                setAsking(false);
              }}
            >
              <Sparkles aria-hidden className="size-4" />
              {dict.setup.tableChanged.newDeck}
            </Button>
            <Button id="keep-deck" type="button" onClick={() => setAsking(false)}>
              {dict.setup.tableChanged.keep}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            {/* On phones, just the arrow, so the three buttons share a line. */}
            <Button
              type="button"
              variant="outline"
              className="size-9 px-0 text-sm has-[>svg]:px-0 sm:w-auto sm:px-3 sm:has-[>svg]:px-3"
              aria-label={dict.setup.back}
              title={dict.setup.back}
              onClick={onBack}
            >
              <ArrowLeft aria-hidden className="size-4" />
              <span className="sr-only sm:not-sr-only">{dict.setup.back}</span>
            </Button>
            <div className={`flex flex-wrap gap-2 ${hidden ? "invisible" : ""}`}>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-2.5 text-sm has-[>svg]:px-2.5 sm:px-3 sm:has-[>svg]:px-3"
                title={dict.setup.suggestHint}
                onClick={() => suggest("classic")}
              >
                {/* Icons only from tablets up: on phones the three buttons share one line. */}
                <Sparkles aria-hidden className="hidden size-4 sm:block" />
                {dict.setup.suggest}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-2.5 text-sm has-[>svg]:px-2.5 sm:px-3 sm:has-[>svg]:px-3"
                title={dict.setup.suggestSpecialsHint}
                onClick={() => suggest("no-villagers")}
              >
                <Dices aria-hidden className="hidden size-4 sm:block" />
                {dict.setup.suggestSpecials}
              </Button>
            </div>
          </div>
          {/* Let in from the lobby, or refused right here. */}
          <JoinRequests inGame={false} onLobby={onBack} />

          {autoMode && (
            <section className="card flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold">{dict.auto.deckTitle}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["hidden", "open"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={autoConfig.deck === kind}
                      onClick={() => setAutoConfig((c) => ({ ...c, deck: kind }))}
                      className={`flex flex-col gap-1 rounded-xl border-2 p-3 text-left ${autoConfig.deck === kind ? "border-primary bg-primary/10" : "border-line bg-surface hover:border-fg/30"}`}
                    >
                      <span className="font-semibold">{kind === "hidden" ? dict.auto.deckHidden : dict.auto.deckOpen}</span>
                      <span className="text-xs text-muted-foreground">{kind === "hidden" ? dict.auto.deckHiddenHint : dict.auto.deckOpenHint}</span>
                    </button>
                  ))}
                </div>
                {hidden && (
                  <div className="segmented self-start">
                    {(["classic", "no-villagers"] as const).map((kind) => (
                      <button key={kind} type="button" aria-current={autoConfig.style === kind} onClick={() => setAutoConfig((c) => ({ ...c, style: kind }))}>
                        {kind === "classic" ? dict.setup.suggest : dict.setup.suggestSpecials}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{dict.auto.discussionTime}</span>
                <NativeSelect
                  className="h-10 py-0"
                  value={autoConfig.discussionSeconds}
                  onChange={(e) => setAutoConfig((c) => ({ ...c, discussionSeconds: Number(e.target.value) }))}
                >
                  {DISCUSSION_CHOICES.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {format(dict.auto.minutes, { n: seconds / 60 })}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              {hidden && (
                <RemovedRoles removed={removed} onChange={removeRoles} onRemote={() => setRemoteAsk(true)} />
              )}
            </section>
          )}

          {/* Folded to the theme picked; picking one folds it again. */}
          <section>
            <h2>
              <button
                type="button"
                aria-expanded={themesOpen}
                aria-controls="theme-list"
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-fg/30"
                onClick={() => setThemesOpen((open) => !open)}
              >
                <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{dict.setup.theme}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{themes[isThemeId(settings.theme) ? settings.theme : defaultTheme].name[locale]}</span>
                <ChevronDown aria-hidden className={`size-5 shrink-0 transition-transform ${themesOpen ? "rotate-180" : ""}`} />
              </button>
            </h2>
            <div
              id="theme-list"
              inert={!themesOpen}
              className={`grid shrink-0 transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none ${themesOpen ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
            <ul className="grid min-h-0 grid-cols-2 gap-2 overflow-hidden lg:grid-cols-4">
              {themeIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={settings.theme === id}
                    onClick={() => {
                      setSettings((s) => ({ ...s, theme: id }));
                      setThemesOpen(false);
                    }}
                    className={`flex h-full w-full flex-col gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
                      settings.theme === id ? "border-primary bg-primary/10" : "border-line bg-surface hover:border-fg/30"
                    }`}
                  >
                    <span className="font-semibold">{themes[id].name[locale]}</span>
                    <span className="text-xs text-muted-foreground">{themes[id].description[locale]}</span>
                  </button>
                </li>
              ))}
            </ul>
            </div>
          </section>

          {/* Folded, it still has to look like the way in: a card to tap, saying what's inside. */}
          {!hidden && (
          <>
          <div id="card-picker" className="flex scroll-mt-4 items-center gap-2">
            <h1 className="min-w-0 flex-1">
              <button
                type="button"
                aria-expanded={cardsOpen}
                aria-controls="card-list"
                className={`card flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-fg/40 ${cardsOpen ? "" : "border-primary/60"}`}
                onClick={() => setCardsOpen((open) => !open)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-bold sm:text-2xl">{dict.setup.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {cardsOpen ? dict.setup.cardsFold : format(dict.setup.cardsUnfold, { count: pickerOrder.length })}
                  </span>
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
                  <ChevronDown aria-hidden className={`size-5 transition-transform ${cardsOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
            </h1>
            <button
              type="button"
              aria-label={dict.setup.clear}
              title={dict.setup.clear}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-muted-foreground hover:text-fg disabled:opacity-30"
              disabled={deck.length === 0}
              onClick={() => setCounts({})}
            >
              <Eraser aria-hidden className="size-4" />
            </button>
          </div>

          {/* Opens and folds smoothly: the row grows from 0fr to 1fr. Folded, it's out of the tab order. */}
          <div
            id="card-list"
            inert={!cardsOpen}
            className={`grid shrink-0 transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none ${cardsOpen ? "grid-rows-[1fr]" : "-mt-4 grid-rows-[0fr]"}`}
          >
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((role) => {
              const count = counts[role] ?? 0;
              const max = roles[role].max;
              return (
                <li
                  key={role}
                  className={`card flex gap-3 p-4 transition-colors ${count > 0 ? "border-fg/30" : "opacity-80"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1">
                      <RoleName role={role} className="min-w-0 flex-1 font-semibold" />
                      {/* Out of the group's games: folded away at the bottom of the list. */}
                      {removable(role) && (
                        <button
                          type="button"
                          aria-label={format(dict.setup.removed.remove, { role: dict.roles[role].name })}
                          title={format(dict.setup.removed.remove, { role: dict.roles[role].name })}
                          className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground/70 hover:bg-surface-2 hover:text-primary"
                          onClick={() => removeRoles([...removed, role])}
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{dict.roles[role].power}</p>
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
          <RemovedRoles removed={removed} onChange={removeRoles} onRemote={() => setRemoteAsk(true)} />
          </div>
          </div>
          </>
          )}
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-1">
          {hidden && <p className="card p-5 text-muted-foreground">{dict.auto.deckHiddenHint}</p>}
          <section className={`card flex flex-col gap-2 p-5 ${hidden ? "hidden" : ""}`}>
            <div className="flex min-h-10 items-start justify-between gap-3">
              <p
                className={`font-mono text-3xl font-bold tabular-nums ${deck.length === needed ? "text-ok" : "text-primary"}`}
              >
                {format(dict.setup.cards, { count: deck.length, needed })}
              </p>
              {/* Opens the list and scrolls to it; once it's open, the list is the way. */}
              {!cardsOpen && (
                <button
                  type="button"
                  aria-label={dict.setup.editCards}
                  title={dict.setup.editCards}
                  className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-muted-foreground hover:text-fg"
                  onClick={openCards}
                >
                  <Pencil aria-hidden className="size-4" />
                </button>
              )}
            </div>
            {/* The whole deck at a glance, without scrolling through every card. */}
            {deck.length > 0 && <DeckChips counts={counts} />}
            {deck.includes("thief") && <p className="text-sm text-muted-foreground">{dict.setup.thiefNote}</p>}
            {problems.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-primary">
                {problems.map((p) => (
                  <li key={p}>{dict.setup.problems[p]}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Folded to the rules that are on. */}
          <section className="card flex flex-col p-5">
            <h2>
              <button
                type="button"
                aria-expanded={rulesOpen}
                aria-controls="rule-list"
                className="flex w-full items-center gap-3 text-left"
                onClick={() => setRulesOpen((open) => !open)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{dict.setup.rules}</span>
                  {!rulesOpen && (
                    <span className="block truncate text-sm text-muted-foreground">
                      {toggles.filter(({ key }) => settings[key]).map(({ key }) => dict.setup[key]).join(" · ") || "—"}
                    </span>
                  )}
                </span>
                <ChevronDown aria-hidden className={`size-5 shrink-0 transition-transform ${rulesOpen ? "rotate-180" : ""}`} />
              </button>
            </h2>
            <div
              id="rule-list"
              inert={!rulesOpen}
              className={`grid shrink-0 transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none ${rulesOpen ? "mt-3 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            {toggles.map(({ key, hint }) => (
              <label key={key} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                />
                <span>
                  <span className="block">{dict.setup[key]}</span>
                  {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
                </span>
              </label>
            ))}
            </div>
            </div>
          </section>

          {!hidden && deck.includes("pied-piper") && (
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

          {!hidden && deck.includes("angel") && (
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="font-semibold">{dict.setup.angelRule}</h2>
              {(["first-vote", "opening-vote"] as const).map((rule) => (
                <label key={rule} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="angel-rule"
                    className="mt-1 size-4 accent-[var(--primary)]"
                    checked={settings.angelRule === rule}
                    onChange={() => setSettings((s) => ({ ...s, angelRule: rule }))}
                  />
                  <span>
                    <span className="block">{dict.setup.angelRules[rule].label}</span>
                    <span className="block text-sm text-muted-foreground">{dict.setup.angelRules[rule].hint}</span>
                  </span>
                </label>
              ))}
            </section>
          )}

          {!hidden && needs.actorCards && (
            <section className="card flex flex-col gap-3 p-5">
              <div>
                <h2 className="font-semibold">{dict.setup.actorCards}</h2>
                <p className="text-sm text-muted-foreground">{dict.setup.actorCardsHint}</p>
              </div>
              {[0, 1, 2].map((i) => (
                <NativeSelect
                  key={i}
                  wrapperClassName="w-full"
                  className="h-10 py-0"
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
                </NativeSelect>
              ))}
              {!actorReady && <p className="text-sm text-primary">{dict.setup.actorNeedsCards}</p>}
            </section>
          )}

          {!hidden && needs.groups && (
            <section className="card flex flex-col gap-3 p-5">
              <div>
                <h2 className="font-semibold">{dict.setup.groups}</h2>
                <p className="text-sm text-muted-foreground">{dict.setup.groupsHint}</p>
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
              {!groupsReady && <p className="text-sm text-primary">{dict.setup.groupsNeeded}</p>}
            </section>
          )}

          {autoMode && <p className="text-sm text-muted-foreground">{dict.auto.noManual}</p>}
          <section className={`card flex flex-col gap-3 p-5 ${autoMode ? "hidden" : ""}`}>
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
                      <NativeSelect
                        className="h-10 w-44 py-0"
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
                      </NativeSelect>
                    </li>
                  );
                })}
                {everyoneAssigned && leftover.length > 0 && (
                  <li className="text-sm text-muted-foreground">
                    {dict.setup.leftover}: {leftover.map((r) => dict.roles[r].name).join(", ")}
                  </li>
                )}
              </ol>
            )}
          </section>

          {canResume && (
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => send({ type: "resume-game" })}>
              <History aria-hidden className="size-5" />
              {dict.host.resume}
            </Button>
          )}
          <Button type="button" className="h-12 text-base" disabled={!canStart} onClick={start}>
            {hidden ? dict.auto.startHidden : dict.setup.begin}
          </Button>
          {players.length < MIN_PLAYERS && (
            <p className="text-sm text-primary">{format(dict.setup.needPlayers, { min: MIN_PLAYERS })}</p>
          )}
        </aside>
      </main>
    </I18nProvider>
  );
}

/**
 * Roles the group took out of its games, folded at the bottom of the list:
 * put back one by one or all at once, or set for a player who isn't in the room.
 */
function RemovedRoles({ removed, onChange, onRemote }: { removed: RoleId[]; onChange: (roles: RoleId[]) => void; onRemote: () => void }) {
  const { dict } = useI18n();
  const t = dict.setup.removed;
  return (
    <details className="card p-4" open={false}>
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
        <Trash2 aria-hidden className="size-4" />
        <span className="min-w-0 flex-1">{format(t.title, { count: removed.length })}</span>
        <button
          type="button"
          aria-label={t.remote}
          title={t.remote}
          className="grid size-8 place-items-center rounded-lg hover:bg-surface-2 hover:text-fg"
          onClick={(e) => {
            e.preventDefault();
            onRemote();
          }}
        >
          <Globe aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t.restoreAll}
          title={t.restoreAll}
          disabled={removed.length === 0}
          className="grid size-8 place-items-center rounded-lg hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          onClick={(e) => {
            e.preventDefault();
            onChange([]);
          }}
        >
          <RotateCcw aria-hidden className="size-4" />
        </button>
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">{t.hint}</p>
      {removed.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {removed.map((role) => (
            <li key={role} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-sm">
              <RoleName role={role} />
              <button
                type="button"
                aria-label={format(t.restore, { role: dict.roles[role].name })}
                title={format(t.restore, { role: dict.roles[role].name })}
                className="grid size-6 place-items-center rounded-full hover:bg-surface hover:text-fg"
                onClick={() => onChange(removed.filter((r) => r !== role))}
              >
                <Undo2 aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** The deck at a glance: one chip per role, with its count. */
function DeckChips({ counts }: { counts: Counts }) {
  const { dict } = useI18n();
  return (
    <ul aria-label={dict.setup.title} className="flex flex-wrap gap-1.5">
      {pickerOrder
        .filter((role) => (counts[role] ?? 0) > 0)
        .map((role) => (
          <li key={role} className="rounded-full bg-surface-2 px-2.5 py-1 text-sm">
            {counts[role]! > 1 && <span className="font-mono tabular-nums">{counts[role]} × </span>}
            <RoleName role={role} className="font-medium" />
          </li>
        ))}
    </ul>
  );
}
