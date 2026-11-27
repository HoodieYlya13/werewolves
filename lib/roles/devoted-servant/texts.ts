import { localizedTexts } from "../../i18n/localized-texts";

export const devotedServantTexts = localizedTexts({
  en: {
    roles: {
      "devoted-servant": { name: "Devoted Servant", power: "May take the role of a player the village votes out." },
    },
    auto: {
      servant: "Before {name}'s card is revealed, the Devoted Servant may take it, on their phone.",
      servantChoice: "Take {name}'s card?",
    },
    game: {
      events: {
        servant: "{name} (Devoted Servant) took the role: {role}",
      },
      steps: {
        servant: {
          say: "Before the card is revealed: does the Devoted Servant want to take {name}'s role?",
          do: "If {servant} reveals the Devoted Servant card, tap Take the role.",
          take: "Take the role",
          no: "No",
        },
      },
    },
  },
  fr: {
    roles: {
      "devoted-servant": { name: "Servante Dévouée", power: "Peut prendre le rôle d'un joueur éliminé par le vote." },
    },
    auto: {
      servant: "Avant que la carte de {name} soit révélée, la Servante Dévouée peut la prendre, sur son téléphone.",
      servantChoice: "Prendre la carte de {name} ?",
    },
    game: {
      events: {
        servant: "{name} (Servante Dévouée) a pris le rôle : {role}",
      },
      steps: {
        servant: {
          say: "Avant de révéler la carte : est-ce que la Servante Dévouée veut prendre le rôle de {name} ?",
          do: "Si {servant} dévoile la carte Servante Dévouée, touchez Prendre le rôle.",
          take: "Prendre le rôle",
          no: "Non",
        },
      },
    },
  },
});
