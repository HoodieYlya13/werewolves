const en = {
  app: {
    name: "Werewolves",
    tagline:
      "The game master's companion for Werewolves and other hidden-role games. No more narrator mistakes.",
  },
  home: {
    hostTitle: "I'm the game master",
    hostDescription: "Create a room on the big screen. Players join with their phones.",
    createRoom: "Create a room",
    joinTitle: "I'm a player",
    joinDescription: "Enter the code shown on the game master's screen.",
    roomCode: "Room code",
    join: "Join",
  },
  host: {
    lobby: "Lobby",
    roomCode: "Room code",
    scanToJoin: "Scan to join, or go to",
    players: "Players ({count})",
    noPlayers: "No players yet. Ask everyone to scan the code.",
    addPlayer: "Add a player without a phone",
    addPlayerPlaceholder: "Player name",
    add: "Add",
    remove: "Remove {name}",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    seatingHint: "Order players as they sit around the table, clockwise.",
    lock: "Lock the room",
    unlock: "Unlock the room",
    locked: "Room locked. No one else can join.",
    noPhone: "no phone",
    online: "online",
    offline: "offline",
  },
  play: {
    yourName: "Your name",
    join: "Join the game",
    joinedAs: "You're in as {name}",
    waiting: "Waiting for the game master to start…",
    roomPlayers: "In this room",
  },
  connection: {
    connecting: "Connecting…",
    reconnecting: "Connection lost. Reconnecting…",
  },
  errors: {
    "room-not-found": "This room doesn't exist. Check the code.",
    "room-taken": "That room code is already in use.",
    "room-locked": "This room is locked. Ask the game master to unlock it.",
    "name-taken": "Someone already uses that name.",
    "invalid-name": "Enter a name between 1 and 24 characters.",
    "not-host": "Only the game master can do that.",
    removed: "The game master removed you from this room.",
    backHome: "Back to home",
  },
  settings: {
    theme: "Theme",
    themeAuto: "Auto",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
  },
};

export type Dictionary = typeof en;
export default en;
