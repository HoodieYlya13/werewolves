import { localizedTexts } from "../../i18n/localized-texts";

export const actorTexts = localizedTexts({
  en: {
    roles: {
      actor: { name: "Actor", power: "Each night, may borrow one of three face-up powers. Each works once." },
    },
    auto: {
      wake: {
        actor: "Actor, wake up. On your phone, choose the power you borrow tonight.",
      },
      actorHint: "Borrow one of these powers for tonight.",
      noPower: "No power tonight",
    },
    game: {
      events: {
        actor: "The Actor borrowed {role}",
      },
      steps: {
        actor: {
          say: "Actor, wake up. Which power do you borrow tonight?",
          do: "Tap the card {name} points at.",
          none: "No power tonight",
          borrowed: "This turn is the Actor's: {name} plays the borrowed {role} power. The real {role}'s turn came just before.",
        },
      },
    },
  },
  fr: {
    roles: {
      actor: { name: "Comédien", power: "Chaque nuit, peut emprunter l'un des trois pouvoirs posés face visible. Chacun ne sert qu'une fois." },
    },
    auto: {
      wake: {
        actor: "Comédien, réveille-toi. Sur ton téléphone, choisis le pouvoir que tu empruntes cette nuit.",
      },
      actorHint: "Emprunte l'un de ces pouvoirs pour cette nuit.",
      noPower: "Aucun pouvoir cette nuit",
    },
    game: {
      events: {
        actor: "Le Comédien a emprunté : {role}",
      },
      steps: {
        actor: {
          say: "Comédien, réveille-toi. Quel pouvoir empruntes-tu cette nuit ?",
          do: "Touchez la carte désignée par {name}.",
          none: "Aucun pouvoir cette nuit",
          borrowed: "Ce tour est celui du Comédien : {name} joue le pouvoir emprunté ({role}). Le tour du vrai rôle est passé juste avant.",
        },
      },
    },
  },
});
