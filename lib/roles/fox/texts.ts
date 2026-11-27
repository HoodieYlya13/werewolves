import { localizedTexts } from "../../i18n/localized-texts";

export const foxTexts = localizedTexts({
  en: {
    roles: {
      fox: { name: "Fox", power: "Each night, sniffs three neighbours for a wolf. Loses the power on a miss." },
    },
    auto: {
      wake: {
        fox: "Fox, wake up. On your phone, choose a player: I'll tell you if a wolf is among them and their two neighbours.",
      },
      turn: {
        fox: "Choose a player: are they or their neighbours a wolf?",
      },
    },
    game: {
      events: {
        fox: "The Fox sniffed around {target}: {result}",
        foxYes: "wolf found",
        foxNo: "no wolf",
      },
      steps: {
        fox: {
          say: "Fox, wake up and point at a player. I'll tell you if a wolf is among them and their two neighbours.",
          do: "Tap the player {name} points at.",
        },
        "fox-result": {
          say: "Fox, go back to sleep.",
          do: "Show the answer to {name}, then hide it.",
          yes: "At least one werewolf among:",
          no: "No werewolf among:",
          lost: "The Fox missed and loses the power.",
        },
      },
    },
  },
  fr: {
    roles: {
      fox: { name: "Renard", power: "Chaque nuit, flaire trois voisins à la recherche d'un loup. Perd son pouvoir s'il se trompe." },
    },
    auto: {
      wake: {
        fox: "Renard, réveille-toi. Sur ton téléphone, choisis un joueur : je te dirai si un loup se cache parmi lui et ses deux voisins.",
      },
      turn: {
        fox: "Choisis un joueur : lui ou ses voisins sont-ils loups ?",
      },
    },
    game: {
      events: {
        fox: "Le Renard a flairé autour de {target} : {result}",
        foxYes: "un loup trouvé",
        foxNo: "aucun loup",
      },
      steps: {
        fox: {
          say: "Renard, réveille-toi et désigne un joueur. Je te dirai s'il y a un loup parmi lui et ses deux voisins.",
          do: "Touchez le joueur désigné par {name}.",
        },
        "fox-result": {
          say: "Renard, rendors-toi.",
          do: "Montrez la réponse à {name}, puis masquez-la.",
          yes: "Au moins un loup-garou parmi :",
          no: "Aucun loup-garou parmi :",
          lost: "Le Renard s'est trompé et perd son pouvoir.",
        },
      },
    },
  },
});
