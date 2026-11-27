import { localizedTexts } from "../../i18n/localized-texts";

export const mayorTexts = localizedTexts({
  en: {
    auto: {
      succession: "{name}, as the dying Mayor, choose your successor on your phone.",
      mayorStand: "Time to elect your Mayor, whose vote counts double. Who wants the job? Tap “I want to be Mayor” on your phone.",
      mayorVote: "Now vote for your Mayor on your phone.",
      mayorElected: "{name} is your new Mayor.",
      turn: {
        "mayor-succession": "Choose the next Mayor",
      },
      mayorButton: "I want to be Mayor",
      mayorWithdraw: "Withdraw",
      mayorCandidates: "Running for Mayor: {names}",
      mayorNoCandidates: "Nobody is running for Mayor yet.",
      mayorStanding: "You're running for Mayor.",
    },
    game: {
      mayor: "Mayor",
      events: {
        mayor: "{name} is Mayor",
      },
      steps: {
        "mayor-election": {
          say: "Time to elect your Mayor. Their vote counts double.",
          do: "Tap the elected player.",
        },
        "mayor-succession": {
          say: "{name}, as the dying Mayor, name your successor.",
          do: "Tap the new Mayor.",
        },
      },
    },
  },
  fr: {
    auto: {
      succession: "{name}, Maire mourant, choisis ton successeur sur ton téléphone.",
      mayorStand: "Il est temps d'élire votre Maire, dont la voix compte double. Qui veut le poste ? Touchez « Je veux être Maire » sur votre téléphone.",
      mayorVote: "Votez maintenant pour votre Maire sur votre téléphone.",
      mayorElected: "{name} est votre nouveau Maire.",
      turn: {
        "mayor-succession": "Choisis le prochain Maire",
      },
      mayorButton: "Je veux être Maire",
      mayorWithdraw: "Me retirer",
      mayorCandidates: "Candidats à la mairie : {names}",
      mayorNoCandidates: "Personne n'est encore candidat à la mairie.",
      mayorStanding: "Tu es candidat à la mairie.",
    },
    game: {
      mayor: "Maire",
      events: {
        mayor: "{name} est Maire",
      },
      steps: {
        "mayor-election": {
          say: "Il est temps d'élire votre Maire. Sa voix compte double.",
          do: "Touchez le joueur élu.",
        },
        "mayor-succession": {
          say: "{name}, en tant que Maire mourant, désigne ton successeur.",
          do: "Touchez le nouveau Maire.",
        },
      },
    },
  },
});
