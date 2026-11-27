import { localizedTexts } from "../../i18n/localized-texts";

export const deathsTexts = localizedTexts({
  en: {
    auto: {
      wasRole: "{name} was {role}.",
    },
    game: {
      steps: {
        deaths: {
          dawn: "The sun rises. Everyone wakes up!",
          vote: "The village has decided.",
          hunter: "The Hunter takes a shot.",
          powersLost: "The Elder was killed by the village: every villager loses their power until the end of the game!",
          sudden: "Terrible news: a sudden death.",
          /** Dawn says who died, never how: only grief, which the lovers' link makes plain. */
          found: [
            "At dawn, {name} is found lifeless.",
            "The village wakes up, but {name} doesn't.",
            "{name}'s door stays shut this morning. Inside, not a breath.",
            "A scream at sunrise: {name} has been found dead.",
            "{name} won't see this day. Their body is found at first light.",
          ],
          grief: "Grief takes {name}, who follows their lover into death.",
          nobody: [
            "Everyone wakes up. For once, the night spared the village.",
            "The village counts its own: nobody is missing this morning.",
            "A quiet night. Everyone is still here… for now.",
          ],
          died: "{name} died, {cause}.",
          secret: "For your eyes only: {cause}.",
          reveal: "Show their card:",
          hidden: "Don't reveal their role.",
        },
      },
    },
  },
  fr: {
    auto: {
      wasRole: "{name} était {role}.",
    },
    game: {
      steps: {
        deaths: {
          dawn: "Le jour se lève. Tout le monde se réveille !",
          vote: "Le village a tranché.",
          hunter: "Le Chasseur tire.",
          powersLost: "L'Ancien a été tué par le village : tous les villageois perdent leurs pouvoirs jusqu'à la fin de la partie !",
          sudden: "Terrible nouvelle : une mort subite.",
          /** Dawn says who died, never how: only grief, which the lovers' link makes plain. */
          found: [
            "On retrouve {name} sans vie à l'aube.",
            "Le village se réveille, mais pas {name}.",
            "La porte de {name} reste close ce matin. À l'intérieur, plus un souffle.",
            "Un cri au lever du soleil : on vient de découvrir le corps de {name}.",
            "{name} ne verra pas ce jour. Son corps est découvert aux premières lueurs.",
          ],
          grief: "Le chagrin emporte {name}, qui suit son amour dans la mort.",
          nobody: [
            "Tout le monde se réveille. Pour une fois, la nuit a épargné le village.",
            "Le village se compte : personne ne manque ce matin.",
            "Une nuit calme. Tout le monde est encore là… pour l'instant.",
          ],
          died: "{name} meurt, {cause}.",
          secret: "Rien que pour vous : {cause}.",
          reveal: "Montrez sa carte :",
          hidden: "Ne révélez pas son rôle.",
        },
      },
    },
  },
});
