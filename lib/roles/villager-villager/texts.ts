import { localizedTexts } from "../../i18n/localized-texts";

export const villagerVillagerTexts = localizedTexts({
  en: {
    roles: {
      "villager-villager": { name: "Villager-Villager", power: "A villager on both sides of the card: everyone knows they're innocent." },
    },
    game: {
      story: {
        villagerVillager: "{name} is the Villager-Villager: their card shows a villager on both sides, so everyone knows they're a simple villager.",
      },
    },
  },
  fr: {
    roles: {
      "villager-villager": { name: "Villageois-Villageois", power: "Villageois des deux côtés de la carte : tout le monde sait qu'il est innocent." },
    },
    game: {
      story: {
        villagerVillager: "{name} est le Villageois-Villageois : sa carte montre un villageois des deux côtés, tout le monde sait donc que c'est un simple villageois.",
      },
    },
  },
});
