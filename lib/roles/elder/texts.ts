import { localizedTexts } from "../../i18n/localized-texts";

export const elderTexts = localizedTexts({
  en: {
    roles: {
      elder: { name: "Elder", power: "Survives the first wolf attack. If the village kills the Elder, every villager loses their power." },
    },
    game: {
      powersLost: "The Elder was killed by the village: villagers have lost their powers.",
      events: {
        "elder-survived": "{name} (Elder) survived the wolves",
        "powers-lost": "The villagers lost their powers",
      },
    },
  },
  fr: {
    roles: {
      elder: { name: "Ancien", power: "Survit à la première attaque des loups. Si le village le tue, tous les villageois perdent leur pouvoir." },
    },
    game: {
      powersLost: "L'Ancien a été tué par le village : les villageois ont perdu leurs pouvoirs.",
      events: {
        "elder-survived": "{name} (Ancien) a survécu aux loups",
        "powers-lost": "Les villageois ont perdu leurs pouvoirs",
      },
    },
  },
});
