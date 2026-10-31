# SacVerde League

League site for SacVerde fantasy football: salaries, $170 cap, sealed Tuesday blind bidding, forum, history.

- `index.html`, `live.js`, `supabase.js` — the website (static; Vercel serves it as-is).
- `db/` — Supabase setup. Run 001 → 004 in order in the Supabase SQL Editor.
- `tests/` — local-only tests (security rules + full browser test). Never run `000_local_supabase_stub.sql` in Supabase.
