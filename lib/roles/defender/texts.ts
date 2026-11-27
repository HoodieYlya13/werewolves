import { localizedTexts } from "../../i18n/localized-texts";

export const defenderTexts = localizedTexts({
  en: {
    roles: {
      defender: { name: "Defender", power: "Each night, protects one player from the wolves. Never the same one twice in a row." },
    },
    auto: {
      wake: {
        defender: "Defender, wake up. On your phone, choose who you protect tonight.",
      },
      turn: {
        defender: "Who do you protect tonight?",
      },
      lastProtected: "{name} was protected last night: not again.",
    },
    game: {
      events: {
        protected: "The Defender protected {target}",
      },
      steps: {
        defender: {
          say: "Defender, wake up. Who do you protect tonight?",
          do: "Tap the player {name} points at.",
          last: "{name} was protected last night and can't be picked.",
          skip: "Protect nobody",
        },
      },
    },
  },
  fr: {
    roles: {
      defender: { name: "Salvateur", power: "Chaque nuit, protège un joueur des loups. Jamais le même deux nuits de suite." },
    },
    auto: {
      wake: {
        defender: "Salvateur, réveille-toi. Sur ton téléphone, choisis qui tu protèges cette nuit.",
      },
      turn: {
        defender: "Qui protèges-tu cette nuit ?",
      },
      lastProtected: "{name} était protégé la nuit dernière : pas deux fois de suite.",
    },
    game: {
      events: {
        protected: "Le Salvateur a protégé {target}",
      },
      steps: {
        defender: {
          say: "Salvateur, réveille-toi. Qui protèges-tu cette nuit ?",
          do: "Touchez le joueur désigné par {name}.",
          last: "{name} a été protégé la nuit dernière et ne peut pas être choisi.",
          skip: "Ne protéger personne",
        },
      },
    },
  },
});
