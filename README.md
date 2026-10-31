# SacVerde League

League site for SacVerde fantasy football: salaries, $170 cap, sealed Tuesday blind bidding, claims, drops, forum, history.

- `index.html`, `live.js`, `supabase.js` — the website (static; Vercel serves it as-is).
- `db/` — Supabase setup. Run files in number order in the Supabase SQL Editor (each only once).
  - 001 schema · 002 security · 003 league seed · 004 2025 history · 005 bidding engine · 006 2026 NFL schedule · 007 fixes · 008 cap/roster grace period · 009 compliance penalty · 010 2026 season import · 011 penalty on/off switch · 012 Curtain trade salaries
- `tests/` — local-only tests (security, engine, full browser). Never run `000_local_supabase_stub.sql` in Supabase.
- `tools/` — scripts that built 010 from the league Google Sheets (parse, standings, FA replay).
