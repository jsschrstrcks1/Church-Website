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
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  expires_at TEXT,
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

-- ============================================================
-- Content layer: newsletters, forms/RSVPs/polls, share customization
-- (replaces spaces/church/{newsletters, settings, responses} in Firestore).
-- JSON columns hold flexible shape (editor content, form schema, poll keys).
-- ============================================================

CREATE TABLE IF NOT EXISTS newsletters (
  id         TEXT PRIMARY KEY,                -- uuid (or reserved 'primary')
  name       TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  published  INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  is_publicly_listed INTEGER NOT NULL DEFAULT 1 CHECK (is_publicly_listed IN (0,1)),
  view_count INTEGER NOT NULL DEFAULT 0,
  content    TEXT NOT NULL DEFAULT '{}',      -- editor JSON (DEFAULT_NEWSLETTER_CONTENT shape)
  theme      TEXT NOT NULL DEFAULT '{}',      -- background/color/typography JSON
  created_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  last_modified TEXT,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_status ON newsletters(status);

-- Newsletter revisions (append-only history)
CREATE TABLE IF NOT EXISTS newsletter_revisions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  newsletter_id TEXT NOT NULL REFERENCES newsletters(id),
  content   TEXT NOT NULL,
  saved_at  TEXT NOT NULL,
  saved_by  TEXT REFERENCES members(id)
);

-- Published newsletters get one row per recipient-visible section for the public /newsletter routes.
CREATE TABLE IF NOT EXISTS newsletter_public (
  newsletter_id TEXT PRIMARY KEY REFERENCES newsletters(id),
  slug         TEXT NOT NULL,                 -- reusable public path token
  title        TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_nl_public_slug ON newsletter_public(slug);

-- Form definitions + responses (embedded in newsletters). Forms are JSON schemas;
-- responses keyed by newsletter + form + responder.
CREATE TABLE IF NOT EXISTS forms (
  id        TEXT PRIMARY KEY,                 -- uuid
  newsletter_id TEXT REFERENCES newsletters(id),
  title     TEXT NOT NULL,
  schema    TEXT NOT NULL DEFAULT '{}',       -- field definitions JSON
  settings  TEXT NOT NULL DEFAULT '{}',       -- email notifications etc.
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS form_responses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id   TEXT NOT NULL REFERENCES forms(id),
  payload   TEXT NOT NULL DEFAULT '{}',       -- {fieldKey: value}
  respondent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_form_res_form ON form_responses(form_id);

-- RSVPs and polls are special forms; keep one table, typed by kind.
CREATE TABLE IF NOT EXISTS events_rsvps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER REFERENCES events(id),
  newsletter_id TEXT REFERENCES newsletters(id),
  guest_name TEXT,
  guests     INTEGER NOT NULL DEFAULT 1,
  notes      TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id     TEXT NOT NULL,                  -- form id of the poll
  option_text TEXT NOT NULL,
  voter       TEXT,
  created_at  TEXT NOT NULL
);

-- Share page customization (what /share shows): one row per site.
CREATE TABLE IF NOT EXISTS share_settings (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL DEFAULT '{}'          -- colors, links, intro JSON
);
INSERT OR IGNORE INTO share_settings (id) VALUES (1);

-- Image uploads (replaces Firebase Storage). Bytes kept in memory by the Worker
-- and served at GET /files/:id; metadata here.
CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,               -- uuid
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        TEXT NOT NULL,                  -- base64
  uploaded_by TEXT REFERENCES members(id),
  created_at  TEXT NOT NULL
);
