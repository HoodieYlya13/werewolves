import { localizedTexts } from "../../i18n/localized-texts";

export const wildChildTexts = localizedTexts({
  en: {
    roles: {
      "wild-child": { name: "Wild Child", power: "Picks a role model on the first night. Becomes a werewolf if the model dies." },
    },
    auto: {
      wake: {
        "wild-child": "Wild Child, wake up. On your phone, choose your role model.",
      },
      turn: {
        "wild-child": "Choose your role model",
      },
    },
    game: {
      model: "{name}'s role model (Wild Child)",
      events: {
        model: "{name} picked {model} as role model",
        "turned-wolf": "{name} turned into a werewolf",
      },
      steps: {
        "wild-child": {
          say: "Wild Child, wake up and point at your role model.",
          do: "Tap the player {name} points at.",
        },
      },
    },
  },
  fr: {
    roles: {
      "wild-child": { name: "Enfant Sauvage", power: "Choisit un modèle la première nuit. Devient loup-garou si son modèle meurt." },
    },
    auto: {
      wake: {
        "wild-child": "Enfant Sauvage, réveille-toi. Sur ton téléphone, choisis ton modèle.",
      },
      turn: {
        "wild-child": "Choisis ton modèle",
      },
    },
    game: {
      model: "Modèle de {name} (Enfant Sauvage)",
      events: {
        model: "{name} a choisi {model} comme modèle",
        "turned-wolf": "{name} est devenu loup-garou",
      },
      steps: {
        "wild-child": {
          say: "Enfant Sauvage, réveille-toi et désigne ton modèle.",
          do: "Touchez le joueur désigné par {name}.",
        },
      },
    },
  },
});
