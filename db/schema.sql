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

-- One row per signed-in player in a finished game. Guests aren't recorded.
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
