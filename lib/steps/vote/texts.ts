import { localizedTexts } from "../../i18n/localized-texts";

export const voteTexts = localizedTexts({
  en: {
    auto: {
      discussion: "Who are the werewolves? You have {minutes} minutes to debate. Tap “Ready to vote” to vote sooner.",
      vote: "Time to vote. Who do you eliminate? Vote on your phone.",
      votesMissing: "Still waiting for {count} votes.",
      tally: "The votes: {list}.",
      tallyEntry: "{name} {count}",
      tie: "It's a tie: nobody is eliminated.",
      tieScapegoat: "It's a tie: the Scapegoat pays for it.",
      tieMayor: "It's a tie: the Mayor decides.",
      tieRunoff: "It's a tie: a second vote, only between the tied players.",
      tieBreak: "{name}, as Mayor, choose who leaves the village among {names}.",
      nobody: "Nobody is eliminated.",
      turn: {
        "tie-break": "Who leaves the village?",
      },
      ready: "Ready to vote",
      notReady: "Not ready anymore",
      readyCount: "{ready} of {living} ready: the vote starts when more than half are.",
    },
    game: {
      events: {
        vote: "The village voted out {target}",
        voteNobody: "The village voted out nobody",
      },
      causes: {
        vote: "voted out by the village",
      },
      steps: {
        vote: {
          say: "Time to vote. Who do you want to eliminate?",
          do: "Tap the player with the most votes.",
          mayor: "{name}'s vote counts double and breaks ties.",
          nobody: "No elimination",
          tie: "Tie",
          tieScapegoat: "Tie: the Scapegoat dies",
          tieMayor: "Tie: the Mayor decides",
          tieRunoff: "Tie: second vote",
          runoff: "Second vote, only against {names}. Another tie: nobody is eliminated.",
          runoffAll: "Second vote, only against the tied players. Another tie: nobody is eliminated.",
          noVoters: "Nobody may vote today: the Scapegoat decided so. The village can still talk, then night falls.",
          raven: "{name} starts with 2 votes against them (Raven).",
          cannotVote: "Can't vote: {names}.",
          second: "Second vote, called by the Stuttering Judge.",
        },
        "tie-break": {
          say: "It's a tie! {name}, as Mayor, you decide: who leaves the village?",
          do: "Tap the player the Mayor names, then confirm.",
          tied: "Tied: {names}.",
        },
      },
    },
  },
  fr: {
    auto: {
      discussion: "Qui sont les loups-garous ? Vous avez {minutes} minutes pour débattre. Touchez « Prêt à voter » pour voter plus tôt.",
      vote: "C'est l'heure du vote. Qui éliminez-vous ? Votez sur votre téléphone.",
      votesMissing: "Il manque encore {count} votes.",
      tally: "Les votes : {list}.",
      tallyEntry: "{name} {count}",
      tie: "Égalité : personne n'est éliminé.",
      tieScapegoat: "Égalité : le Bouc Émissaire en fait les frais.",
      tieMayor: "Égalité : le Maire tranche.",
      tieRunoff: "Égalité : on revote, uniquement entre les ex æquo.",
      tieBreak: "{name}, en tant que Maire, choisis qui quitte le village parmi {names}.",
      nobody: "Personne n'est éliminé.",
      turn: {
        "tie-break": "Qui quitte le village ?",
      },
      ready: "Prêt à voter",
      notReady: "Plus prêt",
      readyCount: "{ready} sur {living} prêts : le vote commence dès que plus de la moitié l'est.",
    },
    game: {
      events: {
        vote: "Le village a éliminé {target}",
        voteNobody: "Le village n'a éliminé personne",
      },
      causes: {
        vote: "par décision du village",
      },
      steps: {
        vote: {
          say: "Place au vote. Qui voulez-vous éliminer ?",
          do: "Touchez le joueur qui a le plus de voix.",
          mayor: "La voix de {name} compte double et départage les égalités.",
          nobody: "Aucun éliminé",
          tie: "Égalité",
          tieScapegoat: "Égalité : le Bouc Émissaire meurt",
          tieMayor: "Égalité : le Maire tranche",
          tieRunoff: "Égalité : on revote",
          runoff: "Deuxième vote, uniquement contre {names}. Nouvelle égalité : personne n'est éliminé.",
          runoffAll: "Deuxième vote, uniquement contre les ex æquo. Nouvelle égalité : personne n'est éliminé.",
          noVoters: "Personne ne peut voter aujourd'hui : le Bouc Émissaire l'a décidé. Le village peut quand même discuter, puis la nuit tombe.",
          raven: "2 voix sont déjà comptées contre {name} (Corbeau).",
          cannotVote: "Ne votent pas : {names}.",
          second: "Second vote, demandé par le Juge Bègue.",
        },
        "tie-break": {
          say: "Égalité ! {name}, en tant que Maire, c'est toi qui tranches : qui quitte le village ?",
          do: "Touchez le joueur désigné par le Maire, puis validez.",
          tied: "À égalité : {names}.",
        },
      },
    },
  },
});
