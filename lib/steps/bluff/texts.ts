import { localizedTexts } from "../../i18n/localized-texts";

export const bluffTexts = localizedTexts({
  en: {
    game: {
      steps: {
        bluff: {
          do: "Nobody can play this turn any more, but the village mustn't know. Wait a few seconds as if they were choosing, then move on: the next screen sends them back to sleep.",
        },
      },
    },
  },
  fr: {
    game: {
      steps: {
        bluff: {
          do: "Plus personne ne peut jouer ce tour, mais le village ne doit pas le savoir. Attendez quelques secondes comme si on choisissait, puis passez à la suite : l'écran suivant les renvoie dormir.",
        },
      },
    },
  },
});
