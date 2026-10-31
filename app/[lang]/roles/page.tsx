import type { Metadata } from "next";
import { Moon } from "lucide-react";
import { GuidePage } from "@/components/guide/guide-page";
import { getGuide, type Guide, type RoleSet } from "@/lib/content/guide";
import { roles, type RoleId } from "@/lib/engine";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { pageMetadata } from "@/lib/seo";
import { teamColor } from "@/lib/team-colors";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return pageMetadata(locale, "/roles", dict.seo.roles);
}

/** The roles of each box, in the order the picker shows them. */
const sets: [RoleSet, RoleId[]][] = [
  ["base", ["werewolf", "villager", "seer", "witch", "hunter", "cupid", "little-girl", "thief"]],
  ["newMoon", ["elder", "village-idiot", "scapegoat", "pied-piper", "defender"]],
  [
    "characters",
    [
      "big-bad-wolf",
      "accursed-wolf-father",
      "white-werewolf",
      "wolf-hound",
      "wild-child",
      "angel",
      "knight",
      "actor",
      "two-sisters",
      "three-brothers",
      "stuttering-judge",
      "bear-tamer",
      "fox",
      "devoted-servant",
      "abominable-sectarian",
      "villager-villager",
    ],
  ],
  ["village", ["raven"]],
];

/** When a role wakes up, from the engine's own night order. */
function wakes(role: RoleId, t: Guide["roles"]["wakes"]) {
  if (role === "werewolf") return t.withWolves;
  if (role === "little-girl") return t.peeks;
  if (role === "two-sisters" || role === "three-brothers") return t.firstNight;
  const night = roles[role].night;
  if (!night) return t.never;
  if (night.firstNightOnly) return t.firstNight;
  if (night.evenNightsOnly) return t.everyOtherNight;
  return t.everyNight;
}

export default async function RolesPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = getGuide(locale).roles;
  return (
    <GuidePage locale={locale} path="/roles" title={t.title} intro={t.intro} cta={t.cta} startLabel={dict.nav.start}>
      {sets.map(([set, ids]) => (
        <section key={set} className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{t.sets[set].name}</h2>
            <p className="text-muted-foreground">{t.sets[set].blurb}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ids.map((id) => {
              const team = roles[id].team;
              return (
                // Each role has its own anchor, e.g. /en/roles#witch.
                <li key={id} id={id} className="card flex scroll-mt-6 flex-col gap-2 p-5">
                  <h3 className={`text-lg font-semibold ${teamColor[team]}`}>{dict.roles[id].name}</h3>
                  <p className="text-sm leading-relaxed text-pretty">{dict.roles[id].power}</p>
                  <div className="mt-auto flex flex-col gap-1 pt-1 text-xs text-muted-foreground">
                    <p>
                      {t.team} <span className={teamColor[team]}>{dict.teams[team]}</span>
                    </p>
                    <p className="flex items-center gap-1">
                      <Moon aria-hidden className="size-3" />
                      {wakes(id, t.wakes)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </GuidePage>
  );
}
