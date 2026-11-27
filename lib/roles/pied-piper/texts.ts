import { localizedTexts } from "../../i18n/localized-texts";

export const piedPiperTexts = localizedTexts({
  en: {
    roles: {
      "pied-piper": { name: "Pied Piper", power: "Charms players each night. Wins alone once everyone else alive is charmed." },
    },
    auto: {
      wake: {
        "pied-piper": "Pied Piper, wake up. On your phone, choose {count} players to charm.",
      },
      oneOrTwo: "1 or 2",
      groupWake: {
        charmed: "Charmed players, wake up and recognise each other.",
      },
      groupSleep: {
        charmed: "Charmed players, go back to sleep.",
      },
      turn: {
        piper: "Choose the players to charm",
      },
      check: {
        charmed: "The Pied Piper has charmed you.",
      },
      group: {
        charmed: "Charmed players",
      },
    },
    game: {
      charmed: "Charmed",
      events: {
        charmed: "Charmed: {names}",
      },
      steps: {
        piper: {
          say: "Pied Piper, wake up and point at {count} players to charm.",
          do: "Tap the players {name} points at.",
        },
        charmed: {
          say: "I'll tap the charmed players on the shoulder. Charmed players, wake up and recognise each other, then go back to sleep.",
          do: "Tap these players on the shoulder: {names}. Newly charmed: {newNames}.",
        },
      },
    },
  },
  fr: {
    roles: {
      "pied-piper": { name: "Joueur de Flûte", power: "Charme des joueurs chaque nuit. Gagne seul quand tous les autres vivants sont charmés." },
    },
    auto: {
      wake: {
        "pied-piper": "Joueur de Flûte, réveille-toi. Sur ton téléphone, choisis {count} joueurs à charmer.",
      },
      oneOrTwo: "1 ou 2",
      groupWake: {
        charmed: "Joueurs charmés, réveillez-vous et reconnaissez-vous.",
      },
      groupSleep: {
        charmed: "Joueurs charmés, rendormez-vous.",
      },
      turn: {
        piper: "Choisis les joueurs à charmer",
      },
      check: {
        charmed: "Le Joueur de Flûte t'a charmé.",
      },
      group: {
        charmed: "Les joueurs charmés",
      },
    },
    game: {
      charmed: "Charmé",
      events: {
        charmed: "Charmés : {names}",
      },
      steps: {
        piper: {
          say: "Joueur de Flûte, réveille-toi et désigne {count} joueurs à charmer.",
          do: "Touchez les joueurs désignés par {name}.",
        },
        charmed: {
          say: "Je vais toucher les joueurs charmés sur l'épaule. Charmés, réveillez-vous et reconnaissez-vous, puis rendormez-vous.",
          do: "Touchez ces joueurs sur l'épaule : {names}. Nouveaux charmés : {newNames}.",
        },
      },
    },
  },
});
