import { localizedTexts } from "../../i18n/localized-texts";

export const werewolfTexts = localizedTexts({
  en: {
    roles: {
      werewolf: { name: "Werewolf", power: "Each night, the wolves agree on a victim." },
    },
    auto: {
      wake: {
        wolves: "Werewolves, wake up. On your phones, all choose the same victim.",
      },
      wolvesName: "Werewolves",
      wolvesHint: "The kill happens once you all pick the same victim. If you don't agree in time, nobody dies.",
      wolvesPicks: "Your pack:",
      noPick: "no choice yet",
      withdrawPick: "Take back my pick",
    },
    game: {
      wolvesSleep: "Werewolves, go back to sleep.",
      events: {
        "wolves-target": "The wolves chose {target}",
      },
      causes: {
        wolves: "eaten by the werewolves",
      },
      steps: {
        wolves: {
          say: "Werewolves, wake up and agree on a victim.",
          do: "Tap the victim the wolves point at.",
          sick: "{name} caught the rust from the Knight's sword: they no longer wake up and will be found dead at dawn. Let them know quietly before calling the pack.",
          littleGirl: "{name} (Little Girl) may peek. If the wolves catch the Little Girl, pick {name} as the victim.",
        },
      },
    },
  },
  fr: {
    roles: {
      werewolf: { name: "Loup-Garou", power: "Chaque nuit, les loups choisissent ensemble une victime." },
    },
    auto: {
      wake: {
        wolves: "Loups-Garous, réveillez-vous. Sur vos téléphones, choisissez tous la même victime.",
      },
      wolvesName: "Loups-Garous",
      wolvesHint: "La victime meurt dès que vous choisissez tous la même. Sans accord à temps, personne ne meurt.",
      wolvesPicks: "Votre meute :",
      noPick: "pas encore choisi",
      withdrawPick: "Retirer mon choix",
    },
    game: {
      wolvesSleep: "Loups-Garous, rendormez-vous.",
      events: {
        "wolves-target": "Les loups ont choisi {target}",
      },
      causes: {
        wolves: "victime des loups-garous",
      },
      steps: {
        wolves: {
          say: "Loups-Garous, réveillez-vous et mettez-vous d'accord sur une victime.",
          do: "Touchez la victime désignée par les loups.",
          sick: "{name} a attrapé la rouille de l'épée du Chevalier : il ne se réveille plus et sera retrouvé mort à l'aube. Prévenez-le discrètement avant d'appeler la meute.",
          littleGirl: "{name} (Petite Fille) peut espionner. Si les loups surprennent la Petite Fille, choisissez {name} comme victime.",
        },
      },
    },
  },
});
