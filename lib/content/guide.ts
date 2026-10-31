import "server-only";
import type { Locale } from "@/lib/i18n/config";

/**
 * The public pages' long text (home sections, rules, role guide, FAQ), kept
 * out of the dictionaries so the game's client code never ships it.
 */

type Section = { title: string; paragraphs: string[]; list?: string[] };

export type RoleSet = "base" | "newMoon" | "characters" | "village";

export type Guide = {
  home: {
    howTitle: string;
    steps: { title: string; body: string }[];
    featuresTitle: string;
    features: { title: string; body: string }[];
    learnTitle: string;
    learnBody: string;
  };
  rules: { title: string; intro: string; sections: Section[]; cta: string };
  roles: {
    title: string;
    intro: string;
    sets: Record<RoleSet, { name: string; blurb: string }>;
    team: string;
    wakes: { never: string; firstNight: string; everyNight: string; everyOtherNight: string; withWolves: string; peeks: string };
    cta: string;
  };
  faq: { title: string; intro: string; items: { q: string; a: string }[] };
  breadcrumbHome: string;
  disclaimer: string;
};

const en: Guide = {
  home: {
    howTitle: "How it works",
    steps: [
      {
        title: "Create a room",
        body: "The game master opens the app on a tablet, a laptop or the TV, and gets a four-letter code and a QR code.",
      },
      {
        title: "Players join",
        body: "Everyone scans the code with their phone. No app to install, no account needed. Players without a phone are added by hand.",
      },
      {
        title: "Play",
        body: "The app deals the cards, then tells the game master exactly what to say and who to wake, night after night, until a side wins.",
      },
    ],
    featuresTitle: "Everything the game master needs",
    features: [
      {
        title: "No more forgotten roles",
        body: "Every role is called in the official order. Roles that can no longer play are still called, so nobody can guess who is gone.",
      },
      {
        title: "Secret cards on the phones",
        body: "Each phone shows only its own card, held to read. Players without a phone see theirs on the game master's screen.",
      },
      {
        title: "Knows who wins",
        body: "Lovers, the Pied Piper, the White Werewolf, the Angel: the app knows every win condition and ends the game at the right moment.",
      },
      {
        title: "Undo anything",
        body: "Tapped the wrong player? Undo the last action and carry on, as if nothing happened.",
      },
      {
        title: "30+ roles",
        body: "The base game, New Moon, Characters and the Raven, with a suggested deck for any number of players.",
      },
      {
        title: "Atmosphere included",
        body: "A story to read aloud, music that follows the night and the day, and four settings: werewolves, mafia, vampires or a spaceship.",
      },
    ],
    learnTitle: "New to Werewolves?",
    learnBody: "Read the rules in five minutes, discover every role, or check the questions people ask most.",
  },
  rules: {
    title: "How to play Werewolves",
    intro:
      "Werewolves (Les Loups-Garous de Thiercelieux in French) is a party game of bluff and deduction for 8 to 18 players, or more. Every night, werewolves secretly kill a villager. Every day, the village debates and votes to eliminate someone they suspect. Here are the rules, step by step.",
    sections: [
      {
        title: "The goal",
        paragraphs: [
          "Each player secretly belongs to a side. The villagers win when every werewolf is dead. The werewolves win when every villager is dead (some groups play that they win as soon as they are as many as the others).",
          "A few roles play for themselves, like the lovers, the Pied Piper or the White Werewolf. They win in their own way.",
        ],
      },
      {
        title: "What you need",
        paragraphs: [
          "One game master, who narrates and doesn't play, and at least eight players for a classic game. You can play with the cards from the box, or let the app deal them to the players' phones.",
          "A good first deck: one werewolf for every four players or so, a Seer, a Witch, a Hunter, Cupid, and villagers for everyone else.",
        ],
      },
      {
        title: "Setting up",
        paragraphs: [
          "Everyone gets one card face down, looks at it without showing it, and keeps it secret. Sit in a circle: some roles depend on who sits next to whom. The game master then tells the story of the village and says that night is falling.",
        ],
      },
      {
        title: "The night",
        paragraphs: [
          "Everyone closes their eyes. The game master wakes the roles one by one, always in the same order, and each does its part in silence by pointing at a player:",
        ],
        list: [
          "On the first night only: the Thief may swap his card, Cupid makes two players fall in love, and the lovers open their eyes to recognise each other.",
          "The Seer looks at one player's card.",
          "The werewolves wake up together and agree on a victim.",
          "The Witch learns who the victim is. Once per game she can save them with her healing potion, and once per game she can kill someone with her poison.",
          "Expansion roles wake at their own moment: the Defender, the Fox, the Pied Piper, the Raven and others.",
        ],
      },
      {
        title: "The day",
        paragraphs: [
          "Everyone wakes up and the game master announces who died during the night, without saying how. Dead players reveal their card (or not, depending on your house rules) and stay silent until the end.",
          "On the first day, the village elects a Mayor, whose vote counts double and who names a successor when he dies. Then comes the debate: accuse, defend yourself, bluff. When the time is up, everyone votes, and the player with the most votes is eliminated. Then night falls again.",
        ],
      },
      {
        title: "How the game ends",
        paragraphs: [
          "The game ends as soon as one side has won. The game master reveals everyone's card and tells the whole story of the game: who the wolves were, who the Seer saw, who the Witch saved.",
        ],
      },
      {
        title: "Tips for the game master",
        paragraphs: [
          "Speak the same way and take the same time for every role, even for one that is dead or out of powers: hesitating or skipping a role gives information away. Never say how someone died, except for a lover who dies of grief. Keep the story alive: the village is a character too.",
          "This is exactly what the app does for you: it calls every role in order, keeps calling the ones that can no longer play, never reveals a cause of death, and knows when the game is over.",
        ],
      },
    ],
    cta: "Ready? Create a room and the app will guide you through your first game.",
  },
  roles: {
    title: "Every Werewolves role",
    intro:
      "Every role the app knows, from the base game of Les Loups-Garous de Thiercelieux to its expansions. Mix them freely: the app works out the night order and every way to win.",
    sets: {
      base: { name: "Base game", blurb: "The roles in the original box: enough for great games with any group." },
      newMoon: { name: "New Moon", blurb: "Five roles that shake up the village's certainties." },
      characters: { name: "Characters", blurb: "Sixteen roles that change sides, play alone or bend the vote." },
      village: { name: "The Village", blurb: "The Raven, who points the finger at night." },
    },
    team: "Side:",
    wakes: {
      never: "Doesn't wake up at night",
      firstNight: "Wakes on the first night",
      everyNight: "Wakes every night",
      everyOtherNight: "Wakes every other night",
      withWolves: "Wakes every night with the werewolves",
      peeks: "May peek during the werewolves' turn",
    },
    cta: "Pick your roles when you create a room: the app suggests a balanced deck for your group.",
  },
  faq: {
    title: "Questions and answers",
    intro: "Everything people ask before their first game with the app.",
    items: [
      {
        q: "Is the app free?",
        a: "Yes, completely, with no ads. It runs in the web browser, so there's nothing to download, and you can add it to your home screen like an app.",
      },
      {
        q: "Does everyone need a phone?",
        a: "No. Only the game master needs a screen. Players with a phone see their card on it; players without one are added by hand and see their card on the game master's screen, behind a cover so nobody else can read it.",
      },
      {
        q: "How many players can play?",
        a: "From 3 players, but the game shines from 8 players up, and it handles big groups of 20 or more. The suggested deck adapts to the number of players.",
      },
      {
        q: "Do I need the physical cards?",
        a: "No: the app deals the cards to the phones. If you prefer your own cards, deal them as usual and tell the app who got which card with \"Assign by hand\".",
      },
      {
        q: "Which roles are included?",
        a: "Over 30 roles: the base game (Werewolf, Seer, Witch, Hunter, Cupid, Little Girl, Thief), New Moon, Characters and the Raven. See the full list on the roles page.",
      },
      {
        q: "Does the game master play too?",
        a: "The game master narrates and doesn't play a role. The app takes care of all the bookkeeping, so the game master can focus on the story and the table.",
      },
      {
        q: "What if I make a mistake?",
        a: "Undo it. Every action can be taken back, and the game picks up exactly where it was.",
      },
      {
        q: "What if a player's phone dies or they leave?",
        a: "They keep their seat. They can come back on any phone, and meanwhile the game master plays their part.",
      },
      {
        q: "Do I need an account?",
        a: "No. Signing in is optional: it keeps your name and photo, and saves your stats (win rate, favourite roles, games run as game master).",
      },
      {
        q: "Does it work offline?",
        a: "No, the game master's screen and the phones need an internet connection to stay in sync.",
      },
      {
        q: "Can I play something other than werewolves?",
        a: "Yes: the same rules can be played as Mafia in a 1920s town, Vampires in Transylvania or impostors on a spaceship. Only the names and the story change.",
      },
      {
        q: "Which languages are available?",
        a: "English and French, switchable at any time, even during a game.",
      },
      {
        q: "Is this the official game?",
        a: "No. It's a free, fan-made companion for running the game. It isn't affiliated with the publishers of Les Loups-Garous de Thiercelieux.",
      },
    ],
  },
  breadcrumbHome: "Home",
  disclaimer:
    "A free, fan-made companion. Not affiliated with the publishers of Les Loups-Garous de Thiercelieux; the game and its names belong to their owners.",
};

const fr: Guide = {
  home: {
    howTitle: "Comment ça marche",
    steps: [
      {
        title: "Créez une partie",
        body: "Le meneur de jeu ouvre l'application sur une tablette, un ordinateur ou la télé, et obtient un code de quatre lettres et un QR code.",
      },
      {
        title: "Les joueurs rejoignent",
        body: "Chacun scanne le code avec son téléphone. Rien à installer, aucun compte nécessaire. Les joueurs sans téléphone sont ajoutés à la main.",
      },
      {
        title: "Jouez",
        body: "L'application distribue les cartes, puis dit au meneur exactement quoi dire et qui réveiller, nuit après nuit, jusqu'à la victoire d'un camp.",
      },
    ],
    featuresTitle: "Tout ce dont le meneur a besoin",
    features: [
      {
        title: "Plus aucun rôle oublié",
        body: "Chaque rôle est appelé dans l'ordre officiel. Les rôles qui ne peuvent plus jouer sont quand même appelés, pour que personne ne devine qui a disparu.",
      },
      {
        title: "Des cartes secrètes sur les téléphones",
        body: "Chaque téléphone ne montre que sa propre carte, qu'on maintient pour la lire. Les joueurs sans téléphone voient la leur sur l'écran du meneur.",
      },
      {
        title: "Sait qui gagne",
        body: "Amoureux, Joueur de Flûte, Loup-Garou Blanc, Ange : l'application connaît chaque condition de victoire et termine la partie au bon moment.",
      },
      {
        title: "Tout s'annule",
        body: "Vous avez touché le mauvais joueur ? Annulez la dernière action et continuez, comme si de rien n'était.",
      },
      {
        title: "Plus de 30 rôles",
        body: "Le jeu de base, Nouvelle Lune, Personnages et le Corbeau, avec un paquet conseillé pour n'importe quel nombre de joueurs.",
      },
      {
        title: "L'ambiance en prime",
        body: "Une histoire à lire à voix haute, une musique qui suit la nuit et le jour, et quatre univers : loups-garous, mafia, vampires ou vaisseau spatial.",
      },
    ],
    learnTitle: "Nouveau aux Loups-Garous ?",
    learnBody: "Lisez les règles en cinq minutes, découvrez tous les rôles ou consultez les questions les plus fréquentes.",
  },
  rules: {
    title: "Comment jouer aux Loups-Garous",
    intro:
      "Les Loups-Garous de Thiercelieux sont un jeu d'ambiance, de bluff et de déduction, de 8 à 18 joueurs, voire plus. Chaque nuit, les loups-garous éliminent secrètement un villageois. Chaque jour, le village débat et vote pour éliminer un suspect. Voici les règles, étape par étape.",
    sections: [
      {
        title: "Le but du jeu",
        paragraphs: [
          "Chaque joueur appartient secrètement à un camp. Les villageois gagnent quand tous les loups-garous sont morts. Les loups-garous gagnent quand tous les villageois sont morts (certains groupes jouent qu'ils gagnent dès qu'ils sont aussi nombreux que les autres).",
          "Quelques rôles jouent pour eux-mêmes, comme les amoureux, le Joueur de Flûte ou le Loup-Garou Blanc. Ils gagnent à leur façon.",
        ],
      },
      {
        title: "Ce qu'il vous faut",
        paragraphs: [
          "Un meneur de jeu, qui raconte et ne joue pas, et au moins huit joueurs pour une partie classique. Vous pouvez jouer avec les cartes de la boîte, ou laisser l'application les distribuer sur les téléphones.",
          "Un bon premier paquet : environ un loup-garou pour quatre joueurs, une Voyante, une Sorcière, un Chasseur, Cupidon, et des villageois pour tous les autres.",
        ],
      },
      {
        title: "La mise en place",
        paragraphs: [
          "Chacun reçoit une carte face cachée, la regarde sans la montrer et la garde secrète. Asseyez-vous en cercle : certains rôles dépendent de qui est assis à côté de qui. Le meneur raconte alors l'histoire du village et annonce que la nuit tombe.",
        ],
      },
      {
        title: "La nuit",
        paragraphs: [
          "Tout le monde ferme les yeux. Le meneur réveille les rôles un par un, toujours dans le même ordre, et chacun agit en silence en désignant un joueur :",
        ],
        list: [
          "La première nuit seulement : le Voleur peut échanger sa carte, Cupidon rend deux joueurs amoureux, et les amoureux ouvrent les yeux pour se reconnaître.",
          "La Voyante découvre la carte d'un joueur.",
          "Les loups-garous se réveillent ensemble et choisissent une victime.",
          "La Sorcière apprend qui est la victime. Une fois par partie, elle peut la sauver avec sa potion de guérison, et une fois par partie, tuer quelqu'un avec sa potion de poison.",
          "Les rôles des extensions se réveillent à leur tour : le Salvateur, le Renard, le Joueur de Flûte, le Corbeau et d'autres.",
        ],
      },
      {
        title: "Le jour",
        paragraphs: [
          "Tout le monde se réveille et le meneur annonce qui est mort pendant la nuit, sans dire comment. Les morts révèlent leur carte (ou non, selon vos règles maison) et se taisent jusqu'à la fin.",
          "Le premier jour, le village élit un Maire, dont la voix compte double et qui désigne son successeur à sa mort. Vient ensuite le débat : accuser, se défendre, bluffer. Quand le temps est écoulé, tout le monde vote, et le joueur qui a le plus de voix est éliminé. Puis la nuit retombe.",
        ],
      },
      {
        title: "La fin de la partie",
        paragraphs: [
          "La partie s'arrête dès qu'un camp a gagné. Le meneur révèle toutes les cartes et raconte toute l'histoire de la partie : qui étaient les loups, qui la Voyante a vu, qui la Sorcière a sauvé.",
        ],
      },
      {
        title: "Conseils pour le meneur de jeu",
        paragraphs: [
          "Parlez de la même façon et prenez le même temps pour chaque rôle, même pour un rôle mort ou sans pouvoir : hésiter ou sauter un rôle donne des indices. Ne dites jamais comment quelqu'un est mort, sauf pour un amoureux qui meurt de chagrin. Faites vivre l'histoire : le village est un personnage, lui aussi.",
          "C'est exactement ce que fait l'application pour vous : elle appelle chaque rôle dans l'ordre, continue d'appeler ceux qui ne peuvent plus jouer, ne révèle jamais la cause d'une mort et sait quand la partie est finie.",
        ],
      },
    ],
    cta: "Prêts ? Créez une partie, l'application vous guidera pendant votre première partie.",
  },
  roles: {
    title: "Tous les rôles des Loups-Garous",
    intro:
      "Tous les rôles que connaît l'application, du jeu de base des Loups-Garous de Thiercelieux à ses extensions. Mélangez-les librement : l'application calcule l'ordre de la nuit et toutes les façons de gagner.",
    sets: {
      base: { name: "Jeu de base", blurb: "Les rôles de la boîte d'origine : de quoi faire de très belles parties avec n'importe quel groupe." },
      newMoon: { name: "Nouvelle Lune", blurb: "Cinq rôles qui bousculent les certitudes du village." },
      characters: { name: "Personnages", blurb: "Seize rôles qui changent de camp, jouent seuls ou faussent le vote." },
      village: { name: "Le Village", blurb: "Le Corbeau, qui désigne un suspect pendant la nuit." },
    },
    team: "Camp :",
    wakes: {
      never: "Ne se réveille pas la nuit",
      firstNight: "Se réveille la première nuit",
      everyNight: "Se réveille chaque nuit",
      everyOtherNight: "Se réveille une nuit sur deux",
      withWolves: "Se réveille chaque nuit avec les loups-garous",
      peeks: "Peut espionner pendant le tour des loups-garous",
    },
    cta: "Choisissez vos rôles en créant une partie : l'application propose un paquet équilibré pour votre groupe.",
  },
  faq: {
    title: "Questions fréquentes",
    intro: "Tout ce qu'on se demande avant sa première partie avec l'application.",
    items: [
      {
        q: "L'application est-elle gratuite ?",
        a: "Oui, entièrement, et sans publicité. Elle fonctionne dans le navigateur, donc rien à télécharger, et vous pouvez l'ajouter à votre écran d'accueil comme une application.",
      },
      {
        q: "Tout le monde doit-il avoir un téléphone ?",
        a: "Non. Seul le meneur a besoin d'un écran. Les joueurs avec un téléphone y voient leur carte ; ceux qui n'en ont pas sont ajoutés à la main et voient leur carte sur l'écran du meneur, derrière un cache pour que personne d'autre ne la lise.",
      },
      {
        q: "Combien de joueurs peuvent jouer ?",
        a: "Dès 3 joueurs, mais le jeu prend toute sa dimension à partir de 8, et l'application gère les grands groupes de 20 joueurs ou plus. Le paquet conseillé s'adapte au nombre de joueurs.",
      },
      {
        q: "Faut-il les vraies cartes ?",
        a: "Non : l'application distribue les cartes sur les téléphones. Si vous préférez vos propres cartes, distribuez-les comme d'habitude et indiquez à l'application qui a reçu quoi avec « Attribuer à la main ».",
      },
      {
        q: "Quels rôles sont disponibles ?",
        a: "Plus de 30 rôles : le jeu de base (Loup-Garou, Voyante, Sorcière, Chasseur, Cupidon, Petite Fille, Voleur), Nouvelle Lune, Personnages et le Corbeau. La liste complète est sur la page des rôles.",
      },
      {
        q: "Le meneur joue-t-il aussi ?",
        a: "Le meneur raconte et n'a pas de rôle. L'application s'occupe de tout le suivi, pour que le meneur se concentre sur l'histoire et la table.",
      },
      {
        q: "Et si je me trompe ?",
        a: "Annulez. Chaque action peut être annulée, et la partie reprend exactement là où elle en était.",
      },
      {
        q: "Et si le téléphone d'un joueur s'éteint ou s'il part ?",
        a: "Il garde sa place. Il peut revenir sur n'importe quel téléphone, et en attendant, le meneur joue à sa place.",
      },
      {
        q: "Faut-il un compte ?",
        a: "Non. La connexion est facultative : elle garde votre nom et votre photo, et enregistre vos statistiques (taux de victoire, rôles préférés, parties menées).",
      },
      {
        q: "Est-ce que ça marche hors ligne ?",
        a: "Non, l'écran du meneur et les téléphones ont besoin d'une connexion internet pour rester synchronisés.",
      },
      {
        q: "Peut-on jouer à autre chose qu'aux loups-garous ?",
        a: "Oui : les mêmes règles se jouent en Mafia dans une ville des années 1920, en Vampires en Transylvanie ou avec des imposteurs dans un vaisseau spatial. Seuls les noms et l'histoire changent.",
      },
      {
        q: "Quelles langues sont disponibles ?",
        a: "Le français et l'anglais, que l'on peut changer à tout moment, même en pleine partie.",
      },
      {
        q: "Est-ce le jeu officiel ?",
        a: "Non. C'est un compagnon gratuit, créé par un fan, pour animer le jeu. Il n'est pas affilié aux éditeurs des Loups-Garous de Thiercelieux.",
      },
    ],
  },
  breadcrumbHome: "Accueil",
  disclaimer:
    "Un compagnon gratuit, créé par un fan. Non affilié aux éditeurs des Loups-Garous de Thiercelieux ; le jeu et ses noms appartiennent à leurs propriétaires.",
};

const guides: Record<Locale, Guide> = { en, fr };
export const getGuide = (locale: Locale) => guides[locale];
