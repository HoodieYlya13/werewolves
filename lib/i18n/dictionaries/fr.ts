import type { Dictionary } from "./en";

const fr: Dictionary = {
  app: {
    name: "Loups-Garous",
    tagline:
      "L'assistant du meneur de jeu pour les Loups-Garous et autres jeux à rôles cachés. Fini les erreurs de narration.",
  },
  home: {
    hostTitle: "Je suis le meneur",
    hostDescription: "Créez une partie sur le grand écran. Les joueurs rejoignent avec leur téléphone.",
    createRoom: "Créer une partie",
    joinTitle: "Je suis joueur",
    joinDescription: "Entrez le code affiché sur l'écran du meneur.",
    roomCode: "Code de la partie",
    join: "Rejoindre",
  },
  host: {
    lobby: "Salle d'attente",
    roomCode: "Code de la partie",
    scanToJoin: "Scannez pour rejoindre, ou allez sur",
    players: "Joueurs ({count})",
    noPlayers: "Aucun joueur pour l'instant. Demandez à tout le monde de scanner le code.",
    addPlayer: "Ajouter un joueur sans téléphone",
    addPlayerPlaceholder: "Nom du joueur",
    add: "Ajouter",
    remove: "Retirer {name}",
    moveUp: "Monter {name}",
    moveDown: "Descendre {name}",
    seatingHint: "Classez les joueurs dans l'ordre où ils sont assis autour de la table, dans le sens horaire.",
    lock: "Verrouiller la partie",
    unlock: "Déverrouiller la partie",
    locked: "Partie verrouillée. Plus personne ne peut rejoindre.",
    noPhone: "sans téléphone",
    online: "en ligne",
    offline: "hors ligne",
  },
  play: {
    yourName: "Votre nom",
    join: "Rejoindre la partie",
    joinedAs: "Vous jouez en tant que {name}",
    waiting: "En attente du lancement par le meneur…",
    roomPlayers: "Dans cette partie",
  },
  connection: {
    connecting: "Connexion…",
    reconnecting: "Connexion perdue. Reconnexion…",
  },
  errors: {
    "room-not-found": "Cette partie n'existe pas. Vérifiez le code.",
    "room-taken": "Ce code de partie est déjà utilisé.",
    "room-locked": "Cette partie est verrouillée. Demandez au meneur de la déverrouiller.",
    "name-taken": "Ce nom est déjà pris.",
    "invalid-name": "Entrez un nom de 1 à 24 caractères.",
    "not-host": "Seul le meneur peut faire ça.",
    removed: "Le meneur vous a retiré de cette partie.",
    backHome: "Retour à l'accueil",
  },
  settings: {
    theme: "Thème",
    themeAuto: "Auto",
    themeLight: "Clair",
    themeDark: "Sombre",
    language: "Langue",
  },
};

export default fr;
