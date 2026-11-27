import { localizedTexts } from "../../i18n/localized-texts";

export const abominableSectarianTexts = localizedTexts({
  en: {
    roles: {
      "abominable-sectarian": { name: "Abominable Sectarian", power: "The village is split in two. Wins alone once the other half is dead." },
    },
    game: {
      story: {
        groups: "The Abominable Sectarian hides in one of two groups. On one side: {a}. On the other: {b}. If only their own group is left, they win alone.",
      },
    },
  },
  fr: {
    roles: {
      "abominable-sectarian": { name: "Abominable Sectaire", power: "Le village est coupé en deux. Gagne seul quand l'autre moitié est morte." },
    },
    game: {
      story: {
        groups: "L'Abominable Sectaire se cache dans l'un de deux groupes. D'un côté : {a}. De l'autre : {b}. S'il ne reste que son groupe, il gagne seul.",
      },
    },
  },
});
