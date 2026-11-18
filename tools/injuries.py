"""Build injuries.json for the site: NFL injury-report game status + NFL injured reserve, from nflverse (free, public).
  - Injury report (injuries_2026.csv): Questionable / Doubtful / Out. For each NFL team we use its latest week
    that has a game status, so last week's statuses stay up until the new week's report gives one (usually Friday).
  - Roster status RES (injured reserve, PUP, NFI) -> "IR".
Fantasy positions only (FB->RB, P->K, league convention). Keyed by normalized name + position (same as nflNorm in live.js).
Run by .github/workflows/injuries.yml (every 3 hours Wed-Sun) and the daily roster job.
Optional: NFLV_DIR=<folder with cached injuries.csv / roster.csv>."""
import csv, io, json, os, re, unicodedata, urllib.request, datetime
from collections import defaultdict

YEAR = 2026
BASE = "https://github.com/nflverse/nflverse-data/releases/download"
POS = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE", "K": "K", "P": "K"}
TEAM = {"LA": "LAR", "JAC": "JAX", "ARZ": "ARI", "WSH": "WAS", "SD": "LAC", "STL": "LAR", "OAK": "LV"}
RES = {"R01": "Injured reserve", "R48": "IR, designated to return", "R04": "PUP list", "R05": "Non-football injury list"}
STATUS = {"Out": "OUT", "Doubtful": "D", "Questionable": "Q"}
CACHE = os.environ.get("NFLV_DIR")

def rows(path, local):
    if CACHE and os.path.exists(os.path.join(CACHE, local)):
        b = open(os.path.join(CACHE, local), "rb").read()
    else:
        with urllib.request.urlopen(f"{BASE}/{path}", timeout=120) as r: b = r.read()
    return list(csv.DictReader(io.StringIO(b.decode("utf-8"))))

def norm(n):   # same rule as player_stats.py / nflNorm in live.js
    n = unicodedata.normalize("NFKD", n or "")
    n = "".join(c for c in n if not unicodedata.combining(c)).lower()
    n = re.sub(r"[.'’\-]", " ", n)
    n = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", n)
    return re.sub(r"\s+", "", n)

def build(inj, roster):
    out = defaultdict(list)
    # NFL injured reserve / PUP / NFI
    on_ir = set()
    for r in roster:
        p = POS.get(r["position"])
        if not p or r["status"] != "RES": continue
        t = TEAM.get(r["team"], r["team"])
        out[norm(r["full_name"]) + "|" + p].append({"t": t, "s": "IR", "i": RES.get(r.get("status_description_abbr"), "Reserve list")})
        on_ir.add((r.get("gsis_id"), norm(r["full_name"])))
    # latest week with a game status, per NFL team (regular season only)
    reg = [r for r in inj if r.get("season_type", "REG") == "REG" and r["week"]]
    latest = {}
    for r in reg:
        if r["report_status"] in STATUS:
            t = r["team"]; latest[t] = max(latest.get(t, 0), int(r["week"]))
    for r in reg:
        p = POS.get(r["position"]); s = STATUS.get(r["report_status"])
        if not p or not s or int(r["week"]) != latest.get(r["team"]): continue
        if (r.get("gsis_id"), norm(r["full_name"])) in on_ir: continue
        t = TEAM.get(r["team"], r["team"])
        part = r.get("report_primary_injury") or r.get("practice_primary_injury") or ""
        out[norm(r["full_name"]) + "|" + p].append({"t": t, "s": s, "i": part.strip(), "w": int(r["week"])})
    return dict(out)

if __name__ == "__main__":
    inj = rows(f"injuries/injuries_{YEAR}.csv", "injuries.csv")
    roster = rows(f"rosters/roster_{YEAR}.csv", "roster.csv")
    players = build(inj, roster)
    json.dump({"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "players": players},
              open("injuries.json", "w"), separators=(",", ":"))
    c = defaultdict(int)
    for v in players.values():
        for x in v: c[x["s"]] += 1
    print(len(players), "players with a status:", dict(c))
