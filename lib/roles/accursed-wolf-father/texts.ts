import { localizedTexts } from "../../i18n/localized-texts";

export const accursedWolfFatherTexts = localizedTexts({
  en: {
    roles: {
      "accursed-wolf-father": { name: "Accursed Wolf-Father", power: "Once per game, turns the wolves' victim into a werewolf instead of killing them." },
    },
    auto: {
      wake: {
        "accursed-wolf-father": "Accursed Wolf-Father, wake up. On your phone: do you infect the victim instead of killing them?",
      },
      infectedCheck: "Everyone, open your eyes and look at your phone: it tells you if the Accursed Wolf-Father infected you.",
      infect: "Infect {name}?",
      check: {
        infected: "The Accursed Wolf-Father infected you: you're a werewolf now. You keep your power, and from the next night you wake up with the pack.",
      },
    },
    game: {
      events: {
        infected: "{target} was infected",
      },
      steps: {
        infect: {
          say: "Accursed Wolf-Father, wake up. Raise your hand if you infect the victim instead of killing them.",
          do: "If {name} signals yes, tap Infect.",
          infect: "Infect {name}",
          no: "Don't infect",
        },
        infected: {
          say: "Everyone keeps their eyes closed. If the Accursed Wolf-Father infected tonight's victim, I'm touching them on the shoulder: from now on, they are a werewolf and wake up with the pack.",
          do: "Touch {names} on the shoulder.",
          nobody: "Nobody was infected tonight. Walk around the table for a moment as if touching someone, then continue.",
        },
      },
    },
  },
  fr: {
    roles: {
      "accursed-wolf-father": { name: "Infect Père des Loups", power: "Une fois par partie, transforme la victime des loups en loup-garou au lieu de la tuer." },
    },
    auto: {
      wake: {
        "accursed-wolf-father": "Infect Père des Loups, réveille-toi. Sur ton téléphone : infectes-tu la victime au lieu de la tuer ?",
      },
      infectedCheck: "Tout le monde, ouvrez les yeux et regardez votre téléphone : il vous dit si l'Infect Père des Loups vous a infecté.",
      infect: "Infecter {name} ?",
      check: {
        infected: "L'Infect Père des Loups t'a infecté : tu es maintenant un loup-garou. Tu gardes ton pouvoir, et dès la nuit prochaine tu te réveilles avec la meute.",
      },
    },
    game: {
      events: {
        infected: "{target} a été infecté",
      },
      steps: {
        infect: {
          say: "Infect Père des Loups, réveille-toi. Lève la main si tu infectes la victime au lieu de la tuer.",
          do: "Si {name} fait signe que oui, touchez Infecter.",
          infect: "Infecter {name}",
          no: "Ne pas infecter",
        },
        infected: {
          say: "Tout le monde garde les yeux fermés. Si l'Infect Père des Loups a infecté la victime de cette nuit, je lui touche l'épaule : désormais, c'est un loup-garou, et il se réveille avec la meute.",
          do: "Touchez l'épaule de : {names}.",
          nobody: "Personne n'a été infecté cette nuit. Faites un tour de table comme si vous touchiez quelqu'un, puis continuez.",
        },
      },
    },
  },
});
