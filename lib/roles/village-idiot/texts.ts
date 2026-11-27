import { localizedTexts } from "../../i18n/localized-texts";

export const villageIdiotTexts = localizedTexts({
  en: {
    roles: {
      "village-idiot": { name: "Village Idiot", power: "If voted out, the Idiot is revealed and survives, but can no longer vote." },
    },
    game: {
      events: {
        "idiot-revealed": "{name} was revealed as the Village Idiot",
      },
      steps: {
        idiot: {
          say: "{name} is the Village Idiot! They survive, but can no longer vote.",
        },
      },
    },
  },
  fr: {
    roles: {
      "village-idiot": { name: "Idiot du Village", power: "S'il est éliminé par le vote, il est révélé et survit, mais perd son droit de vote." },
    },
    game: {
      events: {
        "idiot-revealed": "{name} a été révélé Idiot du Village",
      },
      steps: {
        idiot: {
          say: "{name} est l'Idiot du Village ! L'Idiot reste en vie, mais ne vote plus.",
        },
      },
    },
  },
});
