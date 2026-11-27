import { localizedTexts } from "../../i18n/localized-texts";

export const stutteringJudgeTexts = localizedTexts({
  en: {
    roles: {
      "stuttering-judge": { name: "Stuttering Judge", power: "Once per game, can call for a second vote right after the first." },
    },
    auto: {
      judge: "Call a second vote today?",
    },
    game: {
      events: {
        "second-vote": "The Stuttering Judge called a second vote",
      },
      steps: {
        judge: {
          do: "Did {name} (Stuttering Judge) signal for a second vote?",
          yes: "Yes, vote again",
          no: "No",
        },
      },
    },
  },
  fr: {
    roles: {
      "stuttering-judge": { name: "Juge Bègue", power: "Une fois par partie, peut déclencher un second vote juste après le premier." },
    },
    auto: {
      judge: "Demander un second vote aujourd'hui ?",
    },
    game: {
      events: {
        "second-vote": "Le Juge Bègue a demandé un second vote",
      },
      steps: {
        judge: {
          do: "Le Juge Bègue ({name}) a-t-il fait signe pour un second vote ?",
          yes: "Oui, on revote",
          no: "Non",
        },
      },
    },
  },
});
