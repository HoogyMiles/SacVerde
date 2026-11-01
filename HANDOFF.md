# Handoff

The full build status, rules as built, open items and next steps are kept in the claude.ai Project doc
`claude/SacVerde-Build-Status-Handoff.md` (Project "SacVerde"). Summary of where things stand on 2026-10-31:

- Migrations 001–019 have all been run in Supabase. 020 (lineups) shipped 2026-10-31 with site code (lineups.js); the site falls back to the old roster view until 020 is run. pg_cron job `sacverde-auto-reveal` runs every 5 minutes.
- Penalties are OFF (test mode): `seasons.enforce_penalties = false`.
- In progress: Admin "NFL Teams" screen that reads `nfl_rosters.json` (built daily by `.github/workflows/nfl-rosters.yml`).
- Tests: `tests/run_all.sh` (local Postgres + Playwright mock); last run 43/43 passing.
- Supabase SQL Editor rules: no transactions/temp tables/new schemas; every file safe to re-run.
- Folder sync: stage under a new name, commit with force, verify md5 on the device.
