import { roles } from "./roles";
import { EngineError, type GameSetup, type RoleId, type SetupPlayer, type Settings } from "./types";

export const MIN_PLAYERS = 3;

/** Cards needed for a deck: one per player, plus 2 face-down when the Thief is in. */
export function deckSize(playerCount: number, deck: RoleId[]) {
  return playerCount + (deck.includes("thief") ? 2 : 0);
}

/** Human-checkable problems with a deck, empty when it's playable. */
export function deckProblems(playerCount: number, deck: RoleId[]) {
  const problems: ("too-few-players" | "wrong-size" | "no-wolf" | "no-village" | "too-many-copies")[] = [];
  if (playerCount < MIN_PLAYERS) problems.push("too-few-players");
  if (deck.length !== deckSize(playerCount, deck)) problems.push("wrong-size");
  if (!deck.some((r) => roles[r].team === "wolves")) problems.push("no-wolf");
  if (!deck.some((r) => roles[r].team !== "wolves")) problems.push("no-village");
  const counts = new Map<RoleId, number>();
  deck.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  if ([...counts].some(([r, n]) => n > (roles[r].max ?? Infinity))) problems.push("too-many-copies");
  return problems;
}

/**
 * A balanced starting deck: about one wolf per four players, then specials in
 * the order new groups usually add them, then villagers.
 */
export function suggestedDeck(playerCount: number): RoleId[] {
  const wolves = playerCount <= 5 ? 1 : playerCount <= 11 ? 2 : playerCount <= 17 ? 3 : 4;
  const specials: [RoleId, number][] = [
    ["seer", 3],
    ["witch", 4],
    ["hunter", 5],
    ["cupid", 6],
    ["little-girl", 8],
  ];
  const deck: RoleId[] = Array(wolves).fill("werewolf");
  for (const [role, minPlayers] of specials) if (playerCount >= minPlayers) deck.push(role);
  while (deck.length < playerCount) deck.push("villager");
  return deck.slice(0, Math.max(playerCount, wolves + 1));
}

/** Shuffles the deck and deals one card per player; the rest go face down. */
export function dealRoles(
  players: SetupPlayer[],
  deck: RoleId[],
  settings: Settings,
  random: () => number = Math.random,
): GameSetup {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const setup: GameSetup = {
    players: ordered,
    roles: Object.fromEntries(ordered.map((p, i) => [p.id, cards[i]])),
    extraCards: cards.slice(ordered.length),
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
): GameSetup {
  const setup: GameSetup = {
    players: [...players].sort((a, b) => a.seat - b.seat),
    roles: { ...assignment },
    extraCards: [...extraCards],
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
}
