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

-- How long things lasted, in days (each vote or dawn starts one; the Angel's
-- opening day 0 counts). Missing on games saved before it was recorded.
-- games.days: how long the game lasted. days_alive: how many of those days
-- the player saw (dying in the night misses the next one).
ALTER TABLE games ADD COLUMN IF NOT EXISTS days integer;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS days_alive integer;
ALTER TABLE guest_seats ADD COLUMN IF NOT EXISTS days_alive integer;

-- How a player's game went, beyond winning (missing on games saved before):
-- what killed them (a DeathCause, NULL if they survived), whether they were
-- elected Mayor at some point, and whether Cupid made them a lover.
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS death_cause text;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS was_mayor boolean;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS lover boolean;
ALTER TABLE guest_seats ADD COLUMN IF NOT EXISTS death_cause text;
ALTER TABLE guest_seats ADD COLUMN IF NOT EXISTS was_mayor boolean;
ALTER TABLE guest_seats ADD COLUMN IF NOT EXISTS lover boolean;

-- Friends ---------------------------------------------------------------

-- Signed-in accounts as friends see them, refreshed from their sign-in (at
-- most daily, see app/api/auth/session) and by the rooms they play in.
-- friend_code: their friend link (/friends/add/CODE).
CREATE TABLE IF NOT EXISTS accounts (
  sub         text PRIMARY KEY,
  name        text NOT NULL,
  username    text,
  picture     text,
  friend_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_username ON accounts (lower(username) text_pattern_ops);

-- One row per pair: requester asked, addressee accepts (or declines: deleted).
CREATE TABLE IF NOT EXISTS friendships (
  requester  text NOT NULL REFERENCES accounts (sub) ON DELETE CASCADE,
  addressee  text NOT NULL REFERENCES accounts (sub) ON DELETE CASCADE,
  accepted   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester, addressee),
  CHECK (requester <> addressee)
);
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee);

-- Invites to a room, kept a little while: a push carries no content, so the
-- service worker asks for the latest ones to show the notification.
CREATE TABLE IF NOT EXISTS invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_sub   text NOT NULL,
  to_sub     text NOT NULL,
  room       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invites_to ON invites (to_sub, created_at);

-- Devices that turned on notifications (Web Push), by account.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   text PRIMARY KEY,
  sub        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_sub ON push_subscriptions (sub);
