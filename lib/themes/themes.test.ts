import { describe, expect, it } from "vitest";
import en from "../i18n/dictionaries/en";
import fr from "../i18n/dictionaries/fr";
import { themeDictionary, themeIds, themes } from ".";

/** Every string under the parts of the dictionary a themed game shows. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const themedParts = (d: typeof en) => ({ roles: d.roles, teams: d.teams, game: d.game, play: d.play, setup: d.setup });

// Words a themed game should never show. Checked whole-word, case-sensitive.
const leftovers = {
  en: ["werewolf", "werewolves", "Werewolf", "Werewolves", "wolf", "wolves", "Wolves", "Seer", "Witch", "Thief", "Elder", "Defender", "Raven"],
  fr: ["loup", "loups", "loup-garou", "loups-garous", "Loup-Garou", "Loups-Garous", "Voyante", "Sorcière", "Voleur", "Ancien", "Salvateur", "Corbeau"],
};

describe("themes", () => {
  for (const id of themeIds.filter((t) => t !== "werewolves")) {
    for (const [locale, dict] of [["en", en], ["fr", fr]] as const) {
      it(`${id} (${locale}) leaves no werewolf words behind`, () => {
        const themed = themeDictionary(dict, id, locale);
        const found = strings(themedParts(themed)).filter(([, s]) =>
          leftovers[locale].some((w) => new RegExp(`(?<![\\p{L}-])${w}(?![\\p{L}-])`, "u").test(s)),
        );
        expect(found).toEqual([]);
      });
    }
  }

  it("keeps placeholders intact", () => {
    const themed = themeDictionary(en, "mafia", "en");
    expect(themed.game.steps.hunter.say).toContain("{name}");
    expect(themed.roles.seer.name).toBe("Detective");
    expect(themed.game.steps.wolves.say).toBe("Mafia, wake up and agree on a victim.");
  });

  it("Werewolves is the untouched base", () => {
    expect(themeDictionary(en, "werewolves", "en")).toBe(en);
    expect(themeDictionary(en, "unknown", "en")).toBe(en);
    expect(Object.keys(themes)).toContain("mafia");
  });
});
