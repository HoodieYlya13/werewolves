-- Finished games, for players' stats. Applied by scripts/db-migrate.mjs
-- (each statement must stay idempotent: it runs on every deploy).

-- One row per finished game. Rewritten if the game master undoes the ending.
CREATE TABLE IF NOT EXISTS games (
  id          uuid PRIMARY KEY,
  room        text NOT NULL,
  theme       text NOT NULL,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz NOT NULL,
  -- NULL when everyone died.
  winner_team text,
  player_count integer NOT NULL,
  -- The game master's account, when they were signed in.
  master_sub  text
);

-- One row per signed-in player in a finished game. Guests are in guest_seats
-- until they claim their seat.
CREATE TABLE IF NOT EXISTS game_players (
  game_id   uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  sub       text NOT NULL,
  -- Their card at the end (after the Thief, the Actor…) and the side it played for.
  role      text NOT NULL,
  team      text NOT NULL,
  won       boolean NOT NULL,
  survived  boolean NOT NULL,
  -- Left mid-game; the game master played their part.
  left_game boolean NOT NULL DEFAULT false,
  PRIMARY KEY (game_id, sub)
);

CREATE INDEX IF NOT EXISTS game_players_sub ON game_players (sub);
CREATE INDEX IF NOT EXISTS games_master_sub ON games (master_sub);

-- Guests' seats (players with a phone, not signed in) in finished games. Only
-- the phone holding the seat was sent the claim code; the hash is kept here.
-- Signing in later and sending the code claims the seat: claimed_sub is set,
-- and the seat counts in that account's stats (game_players), also when the
-- game master undoes the ending and replays it. Unclaimed seats expire.
CREATE TABLE IF NOT EXISTS guest_seats (
  game_id     uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  player_id   text NOT NULL,
  code_hash   text NOT NULL UNIQUE,
  role        text NOT NULL,
  team        text NOT NULL,
  won         boolean NOT NULL,
  survived    boolean NOT NULL,
  left_game   boolean NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL,
  claimed_sub text,
  PRIMARY KEY (game_id, player_id)
);
