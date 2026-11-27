import { localizedTexts } from "../../i18n/localized-texts";

export const bigBadWolfTexts = localizedTexts({
  en: {
    roles: {
      "big-bad-wolf": { name: "Big Bad Wolf", power: "Kills a second victim each night, until a wolf dies." },
    },
    auto: {
      wake: {
        "big-bad-wolf": "Big Bad Wolf, wake up. On your phone, choose a second victim, or nobody.",
      },
      turn: {
        "big-bad-wolf": "Choose a second victim",
      },
    },
    game: {
      events: {
        "big-bad-wolf": "The Big Bad Wolf chose {target}",
      },
      steps: {
        "big-bad-wolf": {
          say: "Big Bad Wolf, wake up and choose a second victim.",
          do: "Tap the player {name} points at.",
          skip: "No second victim",
        },
      },
    },
  },
  fr: {
    roles: {
      "big-bad-wolf": { name: "Grand Méchant Loup", power: "Dévore une seconde victime chaque nuit, tant qu'aucun loup n'est mort." },
    },
    auto: {
      wake: {
        "big-bad-wolf": "Grand Méchant Loup, réveille-toi. Sur ton téléphone, choisis une seconde victime, ou personne.",
      },
      turn: {
        "big-bad-wolf": "Choisis une seconde victime",
      },
    },
    game: {
      events: {
        "big-bad-wolf": "Le Grand Méchant Loup a choisi {target}",
      },
      steps: {
        "big-bad-wolf": {
          say: "Grand Méchant Loup, réveille-toi et choisis une seconde victime.",
          do: "Touchez le joueur désigné par {name}.",
          skip: "Pas de seconde victime",
        },
      },
    },
  },
});
