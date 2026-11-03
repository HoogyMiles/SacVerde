"""Build player_stats.json for the site's player cards from nflverse (free, public):
  - bio (players.csv + 2026 roster): age, height, weight, college, years in the NFL, draft
  - 2026 game log and season totals (regular season)
  - career regular-season totals by year, back to 2005
  - single-game career highs (regular season + playoffs)
Players: fantasy positions (QB/RB/WR/TE/K; FB->RB, P->K, league convention) seen since 2024.
Keyed by normalized name + position (same rule as nflNorm in live.js).
Run daily by .github/workflows/nfl-rosters.yml.  Optional: NFLV_DIR=<folder with cached files>."""
import csv, gzip, io, json, os, re, sys, unicodedata, urllib.request, datetime
from collections import defaultdict

YEAR = 2026
FIRST = 2005
BASE = "https://github.com/nflverse/nflverse-data/releases/download"
POS = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE", "K": "K", "P": "K"}
TEAM = {"LA": "LAR", "JAC": "JAX", "ARZ": "ARI", "WSH": "WAS", "SD": "LAC", "STL": "LAR", "OAK": "LV"}
CACHE = os.environ.get("NFLV_DIR")

def fetch(path):
    if CACHE:
        local = os.path.join(CACHE, {"players/players.csv": "players.csv", f"rosters/roster_{YEAR}.csv": "roster.csv"}.get(path, path.split("/")[-1].replace("stats_player_week_", "w")))
        if os.path.exists(local): return open(local, "rb").read()
    with urllib.request.urlopen(f"{BASE}/{path}", timeout=120) as r: return r.read()

def rows(path):
    b = fetch(path)
    if path.endswith(".gz"): b = gzip.decompress(b)
    return list(csv.DictReader(io.StringIO(b.decode("utf-8"))))

def norm(n):
    n = unicodedata.normalize("NFKD", n or "")
    n = "".join(c for c in n if not unicodedata.combining(c)).lower()
    n = re.sub(r"[.'’\-]", " ", n)
    n = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", n)
    return re.sub(r"\s+", "", n)

def num(v):
    try: f = float(v)
    except (TypeError, ValueError): return 0
    return int(f) if f == int(f) else round(f, 1)

# stat key on the site <- nflverse column
COLS = {"cmp": "completions", "att": "attempts", "py": "passing_yards", "ptd": "passing_tds", "int": "passing_interceptions",
        "car": "carries", "ry": "rushing_yards", "rtd": "rushing_tds", "rec": "receptions", "tgt": "targets",
        "rcy": "receiving_yards", "rctd": "receiving_tds", "fl": "fumbles_lost_total",
        "fgm": "fg_made", "fga": "fg_att", "fgl": "fg_long", "xpm": "pat_made", "xpa": "pat_att", "fg50": "fg_made_50_59", "fg60": "fg_made_60_"}
HIGHS = ["py", "ptd", "ry", "rtd", "rec", "rcy", "rctd", "fgm", "fgl"]

def line(r):
    d = {k: num(r.get(c)) for k, c in COLS.items()}
    d["fl"] = num(r.get("fumbles_lost_total")) or (num(r.get("rushing_fumbles_lost")) + num(r.get("receiving_fumbles_lost")) + num(r.get("sack_fumbles_lost")))
    d["fg50"] = num(r.get("fg_made_50_59")) + num(r.get("fg_made_60_")); d.pop("fg60", None)
    return d

def opp_home(r):
    g = r.get("game_id", "").split("_")   # 2026_08_CHI_SEA = away_home
    team = TEAM.get(r.get("team") or r.get("recent_team"), r.get("team") or r.get("recent_team"))
    opp = TEAM.get(r.get("opponent_team"), r.get("opponent_team"))
    home = len(g) == 4 and TEAM.get(g[3], g[3]) == team
    return team, opp, home

def main():
    players = rows("players/players.csv")
    roster = {r["gsis_id"]: r for r in rows(f"rosters/roster_{YEAR}.csv") if r.get("gsis_id")}
    keep = {}
    for p in players:
        pos = POS.get(p.get("position"))
        if not pos: continue
        last = int(p.get("last_season") or 0)
        if last < YEAR - 2 and p["gsis_id"] not in roster: continue
        keep[p["gsis_id"]] = (p, pos)
    for gid, r in roster.items():   # on a 2026 roster but missing from players.csv
        if gid not in keep and POS.get(r.get("position")):
            keep[gid] = ({"gsis_id": gid, "display_name": r["full_name"], "birth_date": r["birth_date"], "height": r["height"], "weight": r["weight"],
                          "college_name": r["college"], "years_of_experience": r["years_exp"], "rookie_season": r["rookie_year"],
                          "draft_year": r["entry_year"], "draft_team": r["draft_club"], "draft_pick": r["draft_number"], "latest_team": r["team"]}, POS[r["position"]])

    season = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))   # gid -> year -> stat -> total
    games = defaultdict(lambda: defaultdict(int)); teams = defaultdict(dict)
    highs = defaultdict(dict); log = defaultdict(list)
    for y in range(FIRST, YEAR + 1):
        try: wk = rows(f"stats_player/stats_player_week_{y}.csv.gz")
        except Exception as e: print("skip", y, e, file=sys.stderr); continue
        for r in wk:
            gid = r["player_id"]
            if gid not in keep: continue
            d = line(r); team, opp, home = opp_home(r)
            for k in HIGHS:
                v = d.get(k, 0)
                if v and (k not in highs[gid] or v > highs[gid][k][0]):
                    highs[gid][k] = [v, y, int(r["week"]), ("vs " if home else "@") + (opp or "")]
            if r["season_type"] != "REG": continue
            games[gid][y] += 1; teams[gid][y] = team
            for k, v in d.items():
                if k == "fgl": season[gid][y][k] = max(season[gid][y][k], v)
                else: season[gid][y][k] += v
            if y == YEAR:
                log[gid].append({"w": int(r["week"]), "o": ("vs " if home else "@") + (opp or ""), **{k: v for k, v in d.items() if v}})

    out = {}
    for gid, (p, pos) in keep.items():
        if not games[gid] and gid not in roster: continue   # never played and not on a roster now
        rr = roster.get(gid, {})
        col = rr.get("college") or p.get("college_name") or ""
        car = [{"y": y, "t": teams[gid].get(y, ""), "g": games[gid][y], **{k: num(v) for k, v in season[gid][y].items() if v}} for y in sorted(games[gid])]
        e = {"n": p.get("display_name"), "p": pos, "id": gid,
             "t": TEAM.get(rr.get("team") or p.get("latest_team"), rr.get("team") or p.get("latest_team") or ""),
             "bio": {k: v for k, v in {
                 "b": p.get("birth_date") or rr.get("birth_date"), "ht": num(p.get("height") or rr.get("height")), "wt": num(p.get("weight") or rr.get("weight")),
                 "col": col, "exp": num(rr.get("years_exp") or p.get("years_of_experience")), "no": rr.get("jersey_number") or p.get("jersey_number"),
                 "dy": num(p.get("draft_year")), "dr": num(p.get("draft_round")), "dp": num(p.get("draft_pick")), "dt": TEAM.get(p.get("draft_team"), p.get("draft_team")),
                 "rk": num(p.get("rookie_season") or rr.get("rookie_year")), "st": rr.get("status")}.items() if v not in (None, "", 0)},
             "car": car, "log": sorted(log[gid], key=lambda x: x["w"]), "hi": highs[gid]}
        out.setdefault(norm(e["n"]) + "|" + pos, []).append(e)
    json.dump({"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "season": YEAR, "players": out},
              open("player_stats.json", "w"), separators=(",", ":"))
    print(sum(len(v) for v in out.values()), "players written")

if __name__ == "__main__": main()
