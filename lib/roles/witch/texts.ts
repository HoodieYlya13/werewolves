import { localizedTexts } from "../../i18n/localized-texts";

export const witchTexts = localizedTexts({
  en: {
    roles: {
      witch: { name: "Witch", power: "One healing potion and one poison, each usable once per game." },
    },
    auto: {
      wake: {
        witch: "Witch, wake up. On your phone, here is tonight's victim. Will you use a potion?",
      },
    },
    game: {
      events: {
        "witch-heal": "The Witch healed {target}",
        "witch-poison": "The Witch poisoned {target}",
      },
      causes: {
        poison: "poisoned by the Witch",
      },
      steps: {
        witch: {
          say: "Witch, wake up. Here is tonight's victim. Will you use your healing potion? Your poison?",
          do: "Show the victim to {name}, then enter their choice.",
          victim: "Tonight's victim: {name}",
          noVictim: "No victim tonight.",
          heal: "Heal {name}",
          healUsed: "Healing potion already used",
          poison: "Poison someone",
          poisonUsed: "Poison already used",
          healAvailable: "Healing potion available",
          poisonAvailable: "Poison available",
          nothing: "Use nothing",
          wake: "Witch, wake up. Here is tonight's victim.",
          askHeal: "Will you use your healing potion?",
          askPoison: "And your poison?",
          thumbs: "{name} answers with a thumb up or down.",
          used: "Already used: ask anyway, so the village can't tell.",
          pickPoison: "Tap the player {name} poisons, then confirm.",
          cantHeal: "Your healing potion is used: you can't save anyone anymore.",
          cantHealSelf: "You can't heal yourself.",
          nobodyToHeal: "Nobody she can heal tonight: ask anyway, so the village can't tell.",
          cantPoison: "Your poison is used.",
          fromPhone: "{name}'s phone: {answer}",
          wait: "Wait for the game master's question.",
          answered: "Your answer: {answer}. Wait for the next question.",
        },
      },
    },
  },
  fr: {
    roles: {
      witch: { name: "Sorcière", power: "Une potion de vie et une potion de mort, chacune utilisable une fois." },
    },
    auto: {
      wake: {
        witch: "Sorcière, réveille-toi. Sur ton téléphone, voici la victime de cette nuit. Utilises-tu une potion ?",
      },
    },
    game: {
      events: {
        "witch-heal": "La Sorcière a sauvé {target}",
        "witch-poison": "La Sorcière a empoisonné {target}",
      },
      causes: {
        poison: "victime du poison de la Sorcière",
      },
      steps: {
        witch: {
          say: "Sorcière, réveille-toi. Voici la victime de cette nuit. Veux-tu utiliser ta potion de vie ? Ta potion de mort ?",
          do: "Montrez la victime à {name}, puis entrez son choix.",
          victim: "Victime de la nuit : {name}",
          noVictim: "Pas de victime cette nuit.",
          heal: "Sauver {name}",
          healUsed: "Potion de vie déjà utilisée",
          poison: "Empoisonner quelqu'un",
          poisonUsed: "Potion de mort déjà utilisée",
          healAvailable: "Potion de vie disponible",
          poisonAvailable: "Potion de mort disponible",
          nothing: "Ne rien utiliser",
          wake: "Sorcière, réveille-toi. Voici la victime de cette nuit.",
          askHeal: "Veux-tu utiliser ta potion de vie ?",
          askPoison: "Et ta potion de mort ?",
          thumbs: "{name} répond pouce en l'air ou pouce en bas.",
          used: "Déjà utilisée : posez quand même la question, pour que le village ne devine rien.",
          pickPoison: "Touchez le joueur que {name} empoisonne, puis validez.",
          cantHeal: "Ta potion de vie est utilisée : tu ne peux plus sauver personne.",
          cantHealSelf: "Tu ne peux pas te soigner toi-même.",
          nobodyToHeal: "Personne à soigner cette nuit : posez quand même la question, pour que le village ne devine rien.",
          cantPoison: "Ta potion de mort est utilisée.",
          fromPhone: "Téléphone de {name} : {answer}",
          wait: "Attends la question du meneur.",
          answered: "Ta réponse : {answer}. Attends la question suivante.",
        },
      },
    },
  },
});
