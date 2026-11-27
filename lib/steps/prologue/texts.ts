import { localizedTexts } from "../../i18n/localized-texts";

export const prologueTexts = localizedTexts({
  en: {
    auto: {
      lookAtCard: "Welcome to the village. Look at your card on your phone, keep it to yourself, then put your phone down.",
    },
    game: {
      story: {
        prologue: {
          title: "Prologue",
          hint: "Read this before the first night",
          say: [
            "Welcome to Thiercelieux, a quiet village at the edge of the great forest. Quiet… until this week.",
            "Last night, the werewolves struck for the first time. And their first victim was me, your game master. This morning, you found what was left of me behind the mill.",
            "I speak to you now from beyond the grave. My killers hide among you, behind friendly faces. Find them before they finish what they started.",
          ],
          do: "Read the story aloud, then start when the table is ready.",
        },
      },
    },
  },
  fr: {
    auto: {
      lookAtCard: "Bienvenue au village. Regardez votre carte sur votre téléphone, gardez-la pour vous, puis posez votre téléphone.",
    },
    game: {
      story: {
        prologue: {
          title: "Prologue",
          hint: "À lire avant la première nuit",
          say: [
            "Bienvenue à Thiercelieux, un paisible village à l'orée de la grande forêt. Paisible… jusqu'à cette semaine.",
            "La nuit dernière, les loups-garous ont frappé pour la première fois. Et leur première victime, c'était moi, le meneur de jeu. Ce matin, vous avez retrouvé ce qu'il restait de moi derrière le moulin.",
            "Je vous parle désormais d'outre-tombe. Mes assassins se cachent parmi vous, derrière des visages amicaux. Trouvez-les avant qu'ils ne finissent ce qu'ils ont commencé.",
          ],
          do: "Lisez l'histoire à voix haute, puis lancez la partie quand la table est prête.",
        },
      },
    },
  },
});
