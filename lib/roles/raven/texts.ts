import { localizedTexts } from "../../i18n/localized-texts";

export const ravenTexts = localizedTexts({
  en: {
    roles: {
      raven: { name: "Raven", power: "Each night, marks a player who starts the next vote with 2 votes against them." },
    },
    auto: {
      wake: {
        raven: "Raven, wake up. On your phone, choose a player to mark for tomorrow's vote, or nobody.",
      },
      turn: {
        raven: "Who gets 2 votes against them tomorrow?",
      },
    },
    game: {
      events: {
        raven: "The Raven marked {target}",
      },
      steps: {
        raven: {
          say: "Raven, wake up and point at a player. They'll start tomorrow's vote with 2 votes against them.",
          do: "Tap the player {name} points at.",
          skip: "Mark nobody",
        },
      },
    },
  },
  fr: {
    roles: {
      raven: { name: "Corbeau", power: "Chaque nuit, désigne un joueur qui commencera le prochain vote avec 2 voix contre lui." },
    },
    auto: {
      wake: {
        raven: "Corbeau, réveille-toi. Sur ton téléphone, choisis un joueur à marquer pour le vote de demain, ou personne.",
      },
      turn: {
        raven: "Qui aura 2 voix contre lui demain ?",
      },
    },
    game: {
      events: {
        raven: "Le Corbeau a désigné {target}",
      },
      steps: {
        raven: {
          say: "Corbeau, réveille-toi et désigne un joueur. Il commencera le vote de demain avec 2 voix contre lui.",
          do: "Touchez le joueur désigné par {name}.",
          skip: "Ne désigner personne",
        },
      },
    },
  },
});
