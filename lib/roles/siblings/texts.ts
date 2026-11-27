import { localizedTexts } from "../../i18n/localized-texts";

export const siblingsTexts = localizedTexts({
  en: {
    auto: {
      groupWake: {
        "two-sisters": "Two Sisters, wake up and look at each other.",
        "three-brothers": "Three Brothers, wake up and look at each other.",
      },
      groupSleep: {
        "two-sisters": "Two Sisters, go back to sleep.",
        "three-brothers": "Three Brothers, go back to sleep.",
      },
      group: {
        "two-sisters": "The Two Sisters",
        "three-brothers": "The Three Brothers",
      },
    },
    game: {
      steps: {
        siblings: {
          "two-sisters": "Two Sisters, wake up and look at each other, then go back to sleep.",
          "three-brothers": "Three Brothers, wake up and look at each other, then go back to sleep.",
          do: "{names} wake up.",
        },
      },
    },
  },
  fr: {
    auto: {
      groupWake: {
        "two-sisters": "Deux Sœurs, réveillez-vous et regardez-vous.",
        "three-brothers": "Trois Frères, réveillez-vous et regardez-vous.",
      },
      groupSleep: {
        "two-sisters": "Deux Sœurs, rendormez-vous.",
        "three-brothers": "Trois Frères, rendormez-vous.",
      },
      group: {
        "two-sisters": "Les Deux Sœurs",
        "three-brothers": "Les Trois Frères",
      },
    },
    game: {
      steps: {
        siblings: {
          "two-sisters": "Deux Sœurs, réveillez-vous et regardez-vous, puis rendormez-vous.",
          "three-brothers": "Trois Frères, réveillez-vous et regardez-vous, puis rendormez-vous.",
          do: "Se réveillent : {names}.",
        },
      },
    },
  },
});
