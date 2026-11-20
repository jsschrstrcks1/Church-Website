-- Lakeview Fellowship Church backend — Cloudflare D1 schema
-- Replaces Firebase (Auth, Firestore, Storage) with our own free stack.
-- Sessions: our own opaque bearer tokens (crypto random), hashed in DB.
-- Live keys must never be readable back (mirrors Firestore rule).

PRAGMA foreign_keys = ON;

-- Members (the invitation-only staff). role: 'owner' | 'admin'
CREATE TABLE IF NOT EXISTS members (
  id            TEXT PRIMARY KEY,             -- stable member id (uuid)
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  pass_hash     TEXT NOT NULL,                -- scrypt-style hash (see worker)
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','removed')),
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

-- Auth sessions: opaque bearer token -> member
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,                -- sha256 of the bearer token
  member_id  TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_member ON sessions(member_id);

-- Invites (owner-created, single-use)
CREATE TABLE IF NOT EXISTS invites (
  code       TEXT PRIMARY KEY,                -- random single-use code
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- Public calendar events (read: public REST; write: members)
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  date    TEXT NOT NULL,                        -- YYYY-MM-DD
  type    TEXT NOT NULL DEFAULT 'church' CHECK (type IN ('church','holiday')),
  en      TEXT NOT NULL,
  es      TEXT NOT NULL DEFAULT '',
  time    TEXT,
  place   TEXT,
  created_by TEXT REFERENCES members(id),
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Live Studio destinations (channels to stream to). keyHint is a masked label,
-- never the key itself.
CREATE TABLE IF NOT EXISTS live_destinations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  platform   TEXT NOT NULL DEFAULT 'custom' CHECK (platform IN ('youtube','facebook','custom')),
  server_url TEXT,
  key_hint   TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_live_dest_platform ON live_destinations(platform);

-- Live stream keys: write-only. A plain row is fine because the Worker never
-- SELECTs the key out for non-streaming callers.
CREATE TABLE IF NOT EXISTS live_keys (
  destination_id TEXT PRIMARY KEY REFERENCES live_destinations(id),
  key_value      TEXT NOT NULL,
  updated_by     TEXT REFERENCES members(id),
  updated_at     TEXT
);

-- Live stream state: exactly one row (id=1)
CREATE TABLE IF NOT EXISTS live_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','live')),
  destinations TEXT NOT NULL DEFAULT '[]',     -- JSON [{id,name,platform}]
  started_by TEXT,
  started_by_name TEXT DEFAULT '',
  started_at TEXT,
  heartbeat_at TEXT,
  youtube_broadcast_id TEXT, youtube_watch_url TEXT, youtube_chat_id TEXT,
  facebook_live_video_id TEXT, facebook_video_id TEXT, facebook_watch_url TEXT,
  ended_at TEXT, ended_by TEXT, ended_by_name TEXT DEFAULT ''
);

-- Public "we're live" flag the home page reads: one row (id=1)
CREATE TABLE IF NOT EXISTS public_live (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  live INTEGER NOT NULL DEFAULT 0 CHECK (live IN (0,1)),
  youtube INTEGER NOT NULL DEFAULT 0 CHECK (youtube IN (0,1)),
  facebook INTEGER NOT NULL DEFAULT 0 CHECK (facebook IN (0,1)),
  youtube_video_id TEXT,
  started_at TEXT,
  heartbeat_at TEXT,
  ended_at TEXT
);

-- Seed a single row each so UPSERTs are deterministic.
INSERT OR IGNORE INTO live_state (id, status) VALUES (1, 'idle');
INSERT OR IGNORE INTO public_live (id, live) VALUES (1, 0);
