import { actorRoles, roles } from "./roles";
import { EngineError, type GameSetup, type RoleId, type SetupPlayer, type Settings } from "./types";

export const MIN_PLAYERS = 3;

/** Cards needed for a deck: one per player, plus 2 face-down when the Thief is in. */
export function deckSize(playerCount: number, deck: RoleId[]) {
  return playerCount + (deck.includes("thief") ? 2 : 0);
}

export type DeckProblem =
  | "too-few-players"
  | "wrong-size"
  | "no-wolf"
  | "no-village"
  | "too-many-copies"
  | "incomplete-set";

/** Human-checkable problems with a deck, empty when it's playable. */
export function deckProblems(playerCount: number, deck: RoleId[]) {
  const problems: DeckProblem[] = [];
  if (playerCount < MIN_PLAYERS) problems.push("too-few-players");
  if (deck.length !== deckSize(playerCount, deck)) problems.push("wrong-size");
  if (!deck.some((r) => roles[r].team === "wolves" || r === "white-werewolf")) problems.push("no-wolf");
  if (!deck.some((r) => roles[r].team === "village")) problems.push("no-village");
  const counts = new Map<RoleId, number>();
  deck.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  if ([...counts].some(([r, n]) => n > (roles[r].max ?? Infinity))) problems.push("too-many-copies");
  if ([...counts].some(([r, n]) => roles[r].copies && n !== roles[r].copies)) problems.push("incomplete-set");
  return problems;
}

/** Extra choices some cards need before the game can start. */
export function setupNeeds(deck: RoleId[]) {
  return { actorCards: deck.includes("actor"), groups: deck.includes("abominable-sectarian") };
}

export type SetupOptions = Pick<GameSetup, "actorCards" | "groups">;

/** "classic": base-game roles, then villagers. "no-villagers": a power for everyone. */
export type DeckStyle = "classic" | "no-villagers";

/**
 * Village powers that need no extra setup (no Actor cards, no groups, no
 * opening vote, no cards left over) and don't win alone, so any mix plays.
 */
const villagePowers: RoleId[] = [
  "little-girl",
  "elder",
  "defender",
  "village-idiot",
  "scapegoat",
  "knight",
  "fox",
  "bear-tamer",
  "raven",
  "stuttering-judge",
  "devoted-servant",
  "wild-child",
];
const villageSets: RoleId[] = ["two-sisters", "three-brothers"];

/**
 * A balanced starting deck: about one wolf per four players, then the base
 * game's specials in the order new groups usually add them. "classic" fills
 * the rest with villagers; "no-villagers" with a random mix of village powers,
 * different on each call.
 */
export function suggestedDeck(playerCount: number, style: DeckStyle = "classic", random: () => number = Math.random): RoleId[] {
  const wolves = playerCount <= 5 ? 1 : playerCount <= 11 ? 2 : playerCount <= 17 ? 3 : 4;
  const specials: [RoleId, number][] = [
    ["seer", 3],
    ["witch", 4],
    ["hunter", 5],
    ["cupid", 6],
    ...(style === "classic" ? [["little-girl", 8] as [RoleId, number]] : []),
  ];
  const deck: RoleId[] = Array(wolves).fill("werewolf");
  for (const [role, minPlayers] of specials) if (playerCount >= minPlayers) deck.push(role);

  if (style === "no-villagers") {
    const singles = shuffle(villagePowers, random);
    let room = playerCount - deck.length;
    for (const set of shuffle(villageSets, random)) {
      const size = roles[set].copies!;
      // Sets are a coin toss, unless the single powers alone can't fill the deck.
      if (size <= room && (random() < 0.5 || room > singles.length)) {
        deck.push(...Array<RoleId>(size).fill(set));
        room -= size;
      }
    }
    deck.push(...singles.slice(0, Math.max(0, room)));
  }

  // Villagers only fill what's left (very large groups, in "no-villagers").
  while (deck.length < playerCount) deck.push("villager");
  return deck.slice(0, Math.max(playerCount, wolves + 1));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffles the deck and deals one card per player; the rest go face down. */
export function dealRoles(
  players: SetupPlayer[],
  deck: RoleId[],
  settings: Settings,
  options: SetupOptions = {},
  random: () => number = Math.random,
): GameSetup {
  const cards = shuffle(deck, random);
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const setup: GameSetup = {
    players: ordered,
    roles: Object.fromEntries(ordered.map((p, i) => [p.id, cards[i]])),
    extraCards: cards.slice(ordered.length),
    ...options,
    settings,
  };
  validateSetup(setup);
  return setup;
}

/** Builds a setup from the game master's own card assignment. */
export function assignRoles(
  players: SetupPlayer[],
  assignment: Record<string, RoleId>,
  extraCards: RoleId[],
  settings: Settings,
  options: SetupOptions = {},
): GameSetup {
  const setup: GameSetup = {
    players: [...players].sort((a, b) => a.seat - b.seat),
    roles: { ...assignment },
    extraCards: [...extraCards],
    ...options,
    settings,
  };
  validateSetup(setup);
  return setup;
}

export function validateSetup(setup: GameSetup) {
  const missing = setup.players.filter((p) => !(setup.roles[p.id] in roles));
  if (missing.length > 0) {
    throw new EngineError("invalid-setup", `No role for ${missing.map((p) => p.name).join(", ")}`);
  }
  const deck = [...setup.players.map((p) => setup.roles[p.id]), ...setup.extraCards];
  const problems = deckProblems(setup.players.length, deck);
  if (problems.length > 0) throw new EngineError("invalid-setup", problems.join(", "));

  // Only cards dealt to players matter: a card left face down never plays.
  const dealt = setup.players.map((p) => setup.roles[p.id]);
  const needs = setupNeeds(dealt.includes("thief") ? deck : dealt);
  if (needs.actorCards) {
    const cards = setup.actorCards ?? [];
    if (cards.length !== 3 || cards.some((r) => !actorRoles.includes(r))) {
      throw new EngineError("invalid-setup", "The Actor needs 3 powers to borrow");
    }
  }
  if (needs.groups) {
    const groups = setup.groups ?? {};
    const sides = setup.players.map((p) => groups[p.id]);
    if (sides.some((g) => g !== "a" && g !== "b") || !sides.includes("a") || !sides.includes("b")) {
      throw new EngineError("invalid-setup", "The Sectarian needs every player in one of two groups");
    }
  }
}
