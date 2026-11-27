import { localizedTexts } from "../../i18n/localized-texts";

export const scapegoatTexts = localizedTexts({
  en: {
    roles: {
      scapegoat: { name: "Scapegoat", power: "Dies whenever the vote is tied, then chooses who may vote the next day." },
    },
    auto: {
      scapegoat: "{name}, as the Scapegoat, choose on your phone who may vote tomorrow.",
      turn: {
        scapegoat: "Who may vote tomorrow?",
      },
    },
    game: {
      events: {
        scapegoat: "The Scapegoat allowed to vote: {names}",
        scapegoatNobody: "The Scapegoat allowed nobody to vote",
      },
      causes: {
        scapegoat: "sacrificed as the Scapegoat",
      },
      steps: {
        scapegoat: {
          say: "{name}, as the Scapegoat, choose who may vote tomorrow.",
          do: "Tap the players allowed to vote, then confirm.",
        },
      },
    },
  },
  fr: {
    roles: {
      scapegoat: { name: "Bouc Émissaire", power: "Meurt en cas d'égalité au vote, puis choisit qui pourra voter le lendemain." },
    },
    auto: {
      scapegoat: "{name}, Bouc Émissaire, choisis sur ton téléphone qui pourra voter demain.",
      turn: {
        scapegoat: "Qui pourra voter demain ?",
      },
    },
    game: {
      events: {
        scapegoat: "Le Bouc Émissaire a autorisé à voter : {names}",
        scapegoatNobody: "Le Bouc Émissaire n'a autorisé personne à voter",
      },
      causes: {
        scapegoat: "en Bouc Émissaire",
      },
      steps: {
        scapegoat: {
          say: "{name}, en tant que Bouc Émissaire, choisis qui pourra voter demain.",
          do: "Touchez les joueurs autorisés à voter, puis validez.",
        },
      },
    },
  },
});
