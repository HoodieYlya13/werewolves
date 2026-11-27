import { localizedTexts } from "../../i18n/localized-texts";

export const hunterTexts = localizedTexts({
  en: {
    roles: {
      hunter: { name: "Hunter", power: "When the Hunter dies, they immediately take someone with them." },
    },
    auto: {
      hunter: "{name}, you're the Hunter. Before you die, choose on your phone who you take with you.",
      turn: {
        hunter: "Who do you take with you?",
      },
    },
    game: {
      causes: {
        hunter: "shot by the Hunter",
      },
      steps: {
        hunter: {
          say: "{name}, you're the Hunter. Before you die, choose someone to take with you.",
          do: "Tap the player {name} shoots.",
        },
      },
    },
  },
  fr: {
    roles: {
      hunter: { name: "Chasseur", power: "En mourant, il emporte immédiatement quelqu'un avec lui." },
    },
    auto: {
      hunter: "{name}, tu es le Chasseur. Avant de mourir, choisis sur ton téléphone qui tu emportes avec toi.",
      turn: {
        hunter: "Qui emportes-tu avec toi ?",
      },
    },
    game: {
      causes: {
        hunter: "victime du tir du Chasseur",
      },
      steps: {
        hunter: {
          say: "{name}, tu es le Chasseur. Avant de mourir, choisis quelqu'un à emporter avec toi.",
          do: "Touchez le joueur abattu par {name}.",
        },
      },
    },
  },
});
