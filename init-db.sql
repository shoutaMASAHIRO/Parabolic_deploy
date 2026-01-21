-- init-db.sql
-- Parabolic DB schema (users / user_settings / emails(symbol対応) / memos)

-- =========================
-- users
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- emails (✅ user × symbol × email)
-- =========================
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,               -- 例: BTC-USD / ETH-USD / USDJPY=X
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, symbol, email)
);

CREATE INDEX IF NOT EXISTS emails_user_symbol_idx
  ON emails (user_id, symbol);

-- =========================
-- user_settings
-- =========================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- memos
-- =========================
CREATE TABLE IF NOT EXISTS memos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,               -- 例: 7203.T / BTC-USD / USDJPY=X
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 取得を速くする（/api/memos/:symbol 用）
CREATE INDEX IF NOT EXISTS memos_user_symbol_updated_idx
  ON memos (user_id, symbol, updated_at DESC);

-- =========================
-- updated_at auto-update trigger (for memos)
-- =========================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_memos_updated_at ON memos;

CREATE TRIGGER update_memos_updated_at
BEFORE UPDATE ON memos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
