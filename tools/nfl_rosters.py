"""Download the current 2026 NFL rosters (nflverse) and write nfl_rosters.json for the site.
Run weekly by .github/workflows/nfl-rosters.yml. Fantasy positions only; FB counts as RB, P as K (league convention)."""
import csv, io, json, urllib.request, datetime
URL = "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv"
POS = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE", "K": "K", "P": "K"}
TEAM = {"LA": "LAR", "JAC": "JAX", "ARZ": "ARI", "WSH": "WAS"}
with urllib.request.urlopen(URL, timeout=60) as r:
    rows = list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))
out = []
for r in rows:
    p = POS.get(r["position"])
    if not p: continue
    gone = r["status"] in ("CUT", "RET")
    out.append({"n": r["full_name"], "p": p, "t": "FA" if gone else TEAM.get(r["team"], r["team"]),
                "s": r["status"], "w": int(r["week"] or 0), "y": r.get("yahoo_id") or None})
json.dump({"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "players": out},
          open("nfl_rosters.json", "w"), separators=(",", ":"))
print(len(out), "players written")
