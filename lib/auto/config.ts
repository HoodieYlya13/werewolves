import { roles, type DeckStyle, type RoleId } from "../engine";

/** Chosen in the lobby. */
export type AutoConfig = {
  /** "open": the creator picks the cards and everyone sees them. "hidden": nobody picks, nobody knows. */
  deck: "open" | "hidden";
  /** The hidden deck's kind. */
  style: DeckStyle;
  /** The day's debate, before the vote. */
  discussionSeconds: number;
  /** Roles the hidden deck never deals (taken out in the card picker). */
  exclude?: RoleId[];
};

export const DISCUSSION_CHOICES = [120, 180, 300, 420, 600];
export const defaultAutoConfig: AutoConfig = { deck: "hidden", style: "classic", discussionSeconds: 300 };

export function cleanAutoConfig(input: unknown): AutoConfig {
  const value = (input ?? {}) as Partial<AutoConfig>;
  return {
    deck: value.deck === "open" ? "open" : "hidden",
    style: value.style === "no-villagers" ? "no-villagers" : "classic",
    discussionSeconds: DISCUSSION_CHOICES.includes(value.discussionSeconds as number) ? value.discussionSeconds! : defaultAutoConfig.discussionSeconds,
    exclude: Array.isArray(value.exclude) ? value.exclude.filter((r): r is RoleId => r in roles && r !== "werewolf" && r !== "villager") : [],
  };
}
