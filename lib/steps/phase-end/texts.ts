import { localizedTexts } from "../../i18n/localized-texts";

export const phaseEndTexts = localizedTexts({
  en: {
    game: {
      story: {
        nightEnds: [
          "The night draws to an end…",
          "The first light of dawn creeps over the rooftops…",
          "Somewhere, a rooster clears its throat…",
        ],
        nightEndsDo: "Everyone has played. When the table is ready, wake the village up.",
        /** The ghost's jab at a village that still hasn't found the killers. */
        dayEnds: [
          "The sun sets on another day, and my killers still walk among you. Do you miss me so little?",
          "Evening falls. Somewhere, a ghost sighs: still no justice for your poor game master.",
          "The shadows grow longer. Lock your doors tonight… not that it helped me.",
          "Another day of arguing, and the guilty still sleep soundly. I've seen sharper minds in a henhouse.",
          "Darkness returns. Take your time, I have all of eternity.",
        ],
        /** The same ghost, cheered up: the village killed one of the wolves today. */
        /** A day the Scapegoat let nobody vote: no arguing over a vote to mock. */
        dayEndsNoVote: [
          "The sun sets on a day without a single vote. The Scapegoat's last laugh, I suppose.",
          "Evening falls. Not one vote today… my killers must be delighted.",
          "Darkness returns. A whole day of talking and no verdict: you'd almost think the Scapegoat was on their side.",
        ],
        dayEndsWolfDown: [
          "The sun sets, and one of my killers will never see it rise again. Well done… but don't celebrate too soon.",
          "Evening falls. For the first time in a while, my ghost smiles: one less murderer among you.",
          "Justice, at last! A little of it, anyway. The others are still out there, so sleep with one eye open.",
          "One down. I could almost rest in peace… almost. Finish the job.",
        ],
        dayEndsDo: "When the table is ready, start the night.",
      },
    },
  },
  fr: {
    game: {
      story: {
        nightEnds: [
          "La nuit touche à sa fin…",
          "Les premières lueurs de l'aube glissent sur les toits…",
          "Quelque part, un coq s'éclaircit la voix…",
        ],
        nightEndsDo: "Tout le monde a joué. Quand la table est prête, réveillez le village.",
        /** The ghost's jab at a village that still hasn't found the killers. */
        dayEnds: [
          "Le soleil se couche sur une nouvelle journée, et mes assassins courent toujours. Je vous manque si peu ?",
          "Le soir tombe. Quelque part, un fantôme soupire : toujours pas de justice pour votre pauvre meneur de jeu.",
          "Les ombres s'allongent. Fermez bien vos portes cette nuit… même si ça ne m'a servi à rien.",
          "Encore une journée de disputes, et les coupables dorment sur leurs deux oreilles. J'ai vu des esprits plus vifs dans un poulailler.",
          "L'obscurité revient. Prenez votre temps, j'ai toute l'éternité.",
        ],
        dayEndsNoVote: [
          "Le soleil se couche sur une journée sans le moindre vote. Le dernier rire du Bouc Émissaire, j'imagine.",
          "Le soir tombe. Pas un seul vote aujourd'hui… mes assassins doivent être ravis.",
          "L'obscurité revient. Toute une journée de palabres et pas de verdict : on croirait presque le Bouc Émissaire de leur côté.",
        ],
        dayEndsWolfDown: [
          "Le soleil se couche, et l'un de mes assassins ne le verra plus jamais se lever. Bravo… mais ne vous réjouissez pas trop vite.",
          "Le soir tombe. Pour la première fois depuis longtemps, mon fantôme sourit : un meurtrier de moins parmi vous.",
          "Justice, enfin ! Un peu, du moins. Les autres rôdent encore : dormez d'un œil.",
          "Un de moins. Je pourrais presque reposer en paix… presque. Finissez le travail.",
        ],
        dayEndsDo: "Quand la table est prête, lancez la nuit.",
      },
    },
  },
});
