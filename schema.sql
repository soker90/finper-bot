-- Cloudflare D1 (SQLite) schema for ticket-bot
-- Run: wrangler d1 execute ticket-bot-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  telegram_message_id INTEGER NOT NULL,
  telegram_chat_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  -- Data extracted by Gemini
  date INTEGER,            -- Unix timestamp (ms) extracted from ticket
  store TEXT,              -- Merchant/store name extracted
  amount REAL,             -- Total amount extracted
  raw_text TEXT,           -- Full text extracted by Gemini (for future use)
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | reviewed
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
