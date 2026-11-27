import { localizedTexts } from "../../i18n/localized-texts";

export const thiefTexts = localizedTexts({
  en: {
    roles: {
      thief: { name: "Thief", power: "On the first night, may swap their card for one of the two left over." },
    },
    auto: {
      wake: {
        thief: "Thief, wake up. On your phone, keep your card or swap it for one of the two left over.",
      },
      thiefHint: "Keep your card, or take one of these two.",
      keep: "Keep my card",
    },
    game: {
      events: {
        "thief-swap": "{name} (Thief) took {role}",
      },
      steps: {
        thief: {
          say: "Thief, wake up. You may swap your card for one of these two.",
          do: "Show the cards to {name}, then tap the one they choose.",
          keep: "Keep the Thief card",
          mustTakeWolf: "Both cards are Werewolves: the Thief must take one.",
        },
      },
    },
  },
  fr: {
    roles: {
      thief: { name: "Voleur", power: "La première nuit, peut échanger sa carte contre l'une des deux restantes." },
    },
    auto: {
      wake: {
        thief: "Voleur, réveille-toi. Sur ton téléphone, garde ta carte ou échange-la contre l'une des deux restantes.",
      },
      thiefHint: "Garde ta carte, ou prends l'une de ces deux.",
      keep: "Garder ma carte",
    },
    game: {
      events: {
        "thief-swap": "{name} (Voleur) a pris : {role}",
      },
      steps: {
        thief: {
          say: "Voleur, réveille-toi. Tu peux échanger ta carte contre l'une de ces deux-là.",
          do: "Montrez les cartes à {name}, puis touchez la carte choisie.",
          keep: "Garder la carte Voleur",
          mustTakeWolf: "Les deux cartes sont des Loups-Garous : le Voleur doit en prendre une.",
        },
      },
    },
  },
});
