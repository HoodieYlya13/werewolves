import { localizedTexts } from "../../i18n/localized-texts";

export const knightTexts = localizedTexts({
  en: {
    roles: {
      knight: { name: "Knight with the Rusty Sword", power: "If the wolves eat the Knight, the first wolf to the Knight's left dies of rust the next night." },
    },
    auto: {
      check: {
        sick: "The Knight's rusty sword got you: you die tonight. Keep your eyes closed, and stay silent until the end.",
      },
    },
    game: {
      causes: {
        rust: "struck down by the rusty sword",
      },
    },
  },
  fr: {
    roles: {
      knight: { name: "Chevalier à l'Épée Rouillée", power: "Si les loups le dévorent, le premier loup à sa gauche meurt du tétanos la nuit suivante." },
    },
    auto: {
      check: {
        sick: "L'épée rouillée du Chevalier t'a contaminé : tu meurs cette nuit. Garde les yeux fermés, et reste silencieux jusqu'à la fin.",
      },
    },
    game: {
      causes: {
        rust: "victime de l'épée rouillée",
      },
    },
  },
});
