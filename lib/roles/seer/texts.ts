import { localizedTexts } from "../../i18n/localized-texts";

export const seerTexts = localizedTexts({
  en: {
    roles: {
      seer: { name: "Seer", power: "Each night, sees one player's card." },
    },
    auto: {
      wake: {
        seer: "Seer, wake up. On your phone, choose whose card you want to see.",
      },
      turn: {
        seer: "Whose card do you want to see?",
      },
    },
    game: {
      events: {
        seer: "The Seer saw {target}: {role}",
      },
      steps: {
        seer: {
          say: "Seer, wake up and point at the player whose card you want to see.",
          do: "Tap the player {name} points at.",
        },
        "seer-result": {
          say: "Seer, go back to sleep.",
          do: "Show the result to {name}, then hide it.",
          reveal: "{target} is",
        },
      },
    },
  },
  fr: {
    roles: {
      seer: { name: "Voyante", power: "Chaque nuit, découvre la carte d'un joueur." },
    },
    auto: {
      wake: {
        seer: "Voyante, réveille-toi. Sur ton téléphone, choisis la carte que tu veux voir.",
      },
      turn: {
        seer: "Quelle carte veux-tu voir ?",
      },
    },
    game: {
      events: {
        seer: "La Voyante a vu {target} : {role}",
      },
      steps: {
        seer: {
          say: "Voyante, réveille-toi et désigne le joueur dont tu veux voir la carte.",
          do: "Touchez le joueur désigné par {name}.",
        },
        "seer-result": {
          say: "Voyante, rendors-toi.",
          do: "Montrez le résultat à {name}, puis masquez-le.",
          reveal: "{target} est",
        },
      },
    },
  },
});
