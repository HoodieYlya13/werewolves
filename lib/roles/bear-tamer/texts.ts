import { localizedTexts } from "../../i18n/localized-texts";

export const bearTamerTexts = localizedTexts({
  en: {
    roles: {
      "bear-tamer": { name: "Bear Tamer", power: "Each morning, the bear growls if a werewolf sits next to the Bear Tamer." },
    },
    game: {
      steps: {
        bear: {
          growls: "Grrr! The bear growls: a werewolf sits next to the Bear Tamer.",
          secret: "For your eyes only: {name} is the Bear Tamer. Don't say it.",
          quiet: "The bear stays quiet.",
        },
      },
    },
  },
  fr: {
    roles: {
      "bear-tamer": { name: "Montreur d'Ours", power: "Chaque matin, l'ours grogne si un loup-garou est assis à côté de lui." },
    },
    game: {
      steps: {
        bear: {
          growls: "Grrr ! L'ours grogne : un loup-garou est assis à côté du Montreur d'Ours.",
          secret: "Pour vous seul : {name} est le Montreur d'Ours. Ne le dites pas.",
          quiet: "L'ours reste silencieux.",
        },
      },
    },
  },
});
