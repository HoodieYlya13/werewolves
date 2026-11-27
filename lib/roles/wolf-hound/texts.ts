import { localizedTexts } from "../../i18n/localized-texts";

export const wolfHoundTexts = localizedTexts({
  en: {
    roles: {
      "wolf-hound": { name: "Wolf-Hound", power: "On the first night, chooses to be a villager or a werewolf." },
    },
    auto: {
      wake: {
        "wolf-hound": "Wolf-Hound, wake up. On your phone, choose your side: villager or werewolf.",
      },
    },
    game: {
      events: {
        "wolf-hound": "{name} (Wolf-Hound) chose: {side}",
      },
      steps: {
        "wolf-hound": {
          say: "Wolf-Hound, wake up. Will you be a villager or a werewolf?",
          do: "Tap {name}'s choice.",
          village: "Villager",
          wolves: "Werewolf",
        },
      },
    },
  },
  fr: {
    roles: {
      "wolf-hound": { name: "Chien-Loup", power: "La première nuit, choisit d'être villageois ou loup-garou." },
    },
    auto: {
      wake: {
        "wolf-hound": "Chien-Loup, réveille-toi. Sur ton téléphone, choisis ton camp : villageois ou loup-garou.",
      },
    },
    game: {
      events: {
        "wolf-hound": "{name} (Chien-Loup) a choisi : {side}",
      },
      steps: {
        "wolf-hound": {
          say: "Chien-Loup, réveille-toi. Seras-tu villageois ou loup-garou ?",
          do: "Touchez le choix de {name}.",
          village: "Villageois",
          wolves: "Loup-Garou",
        },
      },
    },
  },
});
