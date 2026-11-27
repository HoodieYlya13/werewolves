import { localizedTexts } from "../../i18n/localized-texts";

export const cupidTexts = localizedTexts({
  en: {
    roles: {
      cupid: { name: "Cupid", power: "On the first night, links two lovers who live and die together." },
    },
    auto: {
      wake: {
        cupid: "Cupid, wake up. On your phone, choose the two lovers.",
      },
      groupWake: {
        lovers: "Lovers, wake up and look at each other.",
      },
      groupSleep: {
        lovers: "Lovers, go back to sleep.",
      },
      turn: {
        cupid: "Choose the two lovers",
      },
      check: {
        lover: "You're in love with {name}. If one of you dies, the other dies of grief. Now you win together.",
      },
      group: {
        lovers: "The lovers",
      },
    },
    game: {
      lover: "Lover",
      events: {
        lovers: "{a} and {b} are lovers",
      },
      causes: {
        grief: "heartbroken over their lover",
      },
      steps: {
        cupid: {
          say: "Cupid, wake up and point at two players. They will be lovers.",
          do: "Tap the two players {name} points at.",
        },
        lovers: {
          say: "Cupid, go back to sleep. I'll tap the lovers on the shoulder. Lovers, wake up, look at each other, then go back to sleep.",
          do: "Tap {a} and {b} on the shoulder.",
        },
      },
    },
  },
  fr: {
    roles: {
      cupid: { name: "Cupidon", power: "La première nuit, unit deux amoureux qui vivent et meurent ensemble." },
    },
    auto: {
      wake: {
        cupid: "Cupidon, réveille-toi. Sur ton téléphone, choisis les deux amoureux.",
      },
      groupWake: {
        lovers: "Amoureux, réveillez-vous et regardez-vous.",
      },
      groupSleep: {
        lovers: "Amoureux, rendormez-vous.",
      },
      turn: {
        cupid: "Choisis les deux amoureux",
      },
      check: {
        lover: "Tu es amoureux de {name}. Si l'un de vous meurt, l'autre meurt de chagrin. Vous gagnez désormais ensemble.",
      },
      group: {
        lovers: "Les amoureux",
      },
    },
    game: {
      lover: "Amoureux",
      events: {
        lovers: "{a} et {b} sont amoureux",
      },
      causes: {
        grief: "victime d'un chagrin d'amour",
      },
      steps: {
        cupid: {
          say: "Cupidon, réveille-toi et désigne deux joueurs. Ils seront amoureux.",
          do: "Touchez les deux joueurs désignés par {name}.",
        },
        lovers: {
          say: "Cupidon, rendors-toi. Je vais toucher les amoureux sur l'épaule. Amoureux, réveillez-vous, regardez-vous, puis rendormez-vous.",
          do: "Touchez {a} et {b} sur l'épaule.",
        },
      },
    },
  },
});
