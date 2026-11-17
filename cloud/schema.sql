-- Earning Bots cloud database (Cloudflare D1)
CREATE TABLE IF NOT EXISTS docs (
  col TEXT NOT NULL,          -- items | earnings | runs | watches | config
  id TEXT NOT NULL,
  data TEXT,                  -- full JSON (NULL when deleted)
  lite TEXT,                  -- JSON without large fields (puzzles, chapters, markdown), what the bots read
  updated INTEGER NOT NULL,   -- ms timestamp of the last change; newest write wins
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (col, id)
);
CREATE INDEX IF NOT EXISTS docs_updated ON docs (updated);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS log (t INTEGER NOT NULL, level TEXT, msg TEXT);
CREATE INDEX IF NOT EXISTS log_t ON log (t);
