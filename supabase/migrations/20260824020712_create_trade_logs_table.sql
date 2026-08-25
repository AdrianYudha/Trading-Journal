/*
# Create trade_logs table (single-tenant, no auth)

A minimal trading journal that lets a single user log crypto futures trades
and view analytics (win rate, pattern performance, confluence combinations).

1. New Tables
- `trade_logs`
  - `id` (uuid, primary key)
  - `trade_date` (date, not null) — the day the trade was taken; defaults to today
  - `coin` (text, not null) — trading pair symbol, e.g. BTCUSDT
  - `patterns` (text[], not null default '{}') — list of setup/pattern tags
  - `position` (text, not null) — 'Long' or 'Short'
  - `result` (text, not null) — 'Win', 'Loss', or 'BE'
  - `screenshot_url` (text, nullable) — optional TradingView image URL
  - `notes` (text, nullable) — optional freeform notes
  - `created_at` (timestamptz, default now())

2. Constraints
- `trade_logs_position_check` — position must be Long or Short
- `trade_logs_result_check` — result must be Win, Loss, or BE

3. Indexes
- `trade_logs_trade_date_idx` — sort/filter by date
- `trade_logs_coin_idx` — filter by coin

4. Security
- Enable RLS on `trade_logs`.
- Allow anon + authenticated full CRUD because the data is intentionally
  shared/public in this single-tenant journal (no sign-in screen).
*/

CREATE TABLE IF NOT EXISTS trade_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_date date NOT NULL DEFAULT CURRENT_DATE,
  coin text NOT NULL,
  patterns text[] NOT NULL DEFAULT '{}',
  position text NOT NULL,
  result text NOT NULL,
  screenshot_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT trade_logs_position_check CHECK (position IN ('Long', 'Short')),
  CONSTRAINT trade_logs_result_check CHECK (result IN ('Win', 'Loss', 'BE'))
);

CREATE INDEX IF NOT EXISTS trade_logs_trade_date_idx ON trade_logs (trade_date);
CREATE INDEX IF NOT EXISTS trade_logs_coin_idx ON trade_logs (coin);

ALTER TABLE trade_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trade_logs" ON trade_logs;
CREATE POLICY "anon_select_trade_logs" ON trade_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trade_logs" ON trade_logs;
CREATE POLICY "anon_insert_trade_logs" ON trade_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trade_logs" ON trade_logs;
CREATE POLICY "anon_update_trade_logs" ON trade_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trade_logs" ON trade_logs;
CREATE POLICY "anon_delete_trade_logs" ON trade_logs FOR DELETE
  TO anon, authenticated USING (true);
