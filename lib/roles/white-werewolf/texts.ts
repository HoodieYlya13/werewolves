import { localizedTexts } from "../../i18n/localized-texts";

export const whiteWerewolfTexts = localizedTexts({
  en: {
    roles: {
      "white-werewolf": { name: "White Werewolf", power: "Wakes with the wolves, but every other night may kill one of them. Wins alone." },
    },
    auto: {
      wake: {
        "white-werewolf": "White Werewolf, wake up. On your phone, choose a wolf to kill, or nobody.",
      },
      turn: {
        "white-werewolf": "Choose a wolf to kill",
      },
    },
    game: {
      events: {
        "white-werewolf": "The White Werewolf chose {target}",
      },
      causes: {
        "white-werewolf": "killed by the White Werewolf",
      },
      steps: {
        "white-werewolf": {
          say: "White Werewolf, wake up. Do you kill one of the wolves?",
          do: "Tap the wolf {name} points at.",
          skip: "Kill nobody",
        },
      },
    },
  },
  fr: {
    roles: {
      "white-werewolf": { name: "Loup-Garou Blanc", power: "Se réveille avec les loups, mais une nuit sur deux peut en tuer un. Gagne seul." },
    },
    auto: {
      wake: {
        "white-werewolf": "Loup-Garou Blanc, réveille-toi. Sur ton téléphone, choisis un loup à tuer, ou personne.",
      },
      turn: {
        "white-werewolf": "Choisis un loup à tuer",
      },
    },
    game: {
      events: {
        "white-werewolf": "Le Loup-Garou Blanc a choisi {target}",
      },
      causes: {
        "white-werewolf": "victime du Loup-Garou Blanc",
      },
      steps: {
        "white-werewolf": {
          say: "Loup-Garou Blanc, réveille-toi. Veux-tu tuer l'un des loups ?",
          do: "Touchez le loup désigné par {name}.",
          skip: "Ne tuer personne",
        },
      },
    },
  },
});
