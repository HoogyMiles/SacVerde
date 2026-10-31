import json, subprocess, re, base64, time, sys
from urllib.parse import urlparse, parse_qsl
from playwright.sync_api import sync_playwright

PSQL = ["psql", "-h", "/tmp/pg", "-p", "5433", "-U", "postgres", "-d", "sv", "-tA", "-v", "ON_ERROR_STOP=1", "-q"]
USERS = {"tritons": ("00000000-0000-0000-0000-000000000002", "chrisbadley@live.com"),
         "hoogy":   ("00000000-0000-0000-0000-000000000001", "chrishoogstad@gmail.com"),
         "pool":    ("00000000-0000-0000-0000-000000000003", "kaiser0505@gmail.com")}

def sql(q, uid=None):
    pre = ""
    if uid:
        pre = f"select set_config('request.jwt.claims', '{json.dumps({'sub': uid})}', false) \\gset\nset role authenticated;\n"
    r = subprocess.run(PSQL, input=pre + q, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip().split("ERROR:")[-1].split("\n")[0].strip())
    return r.stdout.strip()

def lit(v):
    if v is None: return "null"
    if isinstance(v, list): return ("ARRAY[" + ",".join(str(int(x)) for x in v) + "]::int[]") if v else "'{}'::int[]"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def where(params):
    w = []
    for k, v in params:
        if k in ("select", "order", "limit", "offset", "on_conflict", "columns"): continue
        op, _, val = v.partition(".")
        if op == "eq": w.append(f"{k} = {lit(val)}")
        if op == "in": w.append(f"{k} in (" + ",".join(lit(x) if not x.isdigit() else x for x in val.strip("()").split(",")) + ")")
    return (" where " + " and ".join(w)) if w else ""

def handle(route, uid):
    req = route.request; u = urlparse(req.url); params = parse_qsl(u.query)
    path = u.path
    try:
        if path.startswith("/auth/v1/user"):
            email = [e for i, e in USERS.values() if i == uid][0]
            return route.fulfill(status=200, json={"id": uid, "email": email, "aud": "authenticated"})
        if path.startswith("/auth/v1/"):
            return route.fulfill(status=200, json={})
        table = path.split("/rest/v1/")[1]
        if table.startswith("rpc/"):
            fn = table[4:]; args = json.loads(req.post_data or "{}")
            a = ", ".join(f"{k} => {lit(v)}" for k, v in args.items())
            setof = sql(f"select bool_or(proretset) from pg_proc where proname = {lit(fn)};") == "t"
            q = (f"select coalesce(json_agg(t), '[]') from public.{fn}({a}) t;" if setof else f"select to_json(public.{fn}({a}));")
            out = sql(q, uid)
            return route.fulfill(status=200, body=out or "null", headers={"content-type": "application/json"})
        P = dict(params)
        if req.method == "GET":
            cols = P.get("select", "*")
            order = ""
            if "order" in P:
                parts = [o.split(".") for o in P["order"].split(",")]
                order = " order by " + ", ".join(p[0] + (" desc" if "desc" in p else "") for p in parts)
            lim = f" limit {P['limit']}" if "limit" in P else ""
            off = f" offset {P['offset']}" if "offset" in P else ""
            q = f"select coalesce(json_agg(t), '[]') from (select {cols} from public.{table}{where(params)}{order}{lim}{off}) t;"
            return route.fulfill(status=200, body=sql(q, uid), headers={"content-type": "application/json"})
        body = json.loads(req.post_data or "null")
        if req.method == "POST":
            rows = body if isinstance(body, list) else [body]
            for row in rows:
                cols = ",".join(row.keys()); vals = ",".join(lit(v) for v in row.values())
                conflict = ""
                if "on_conflict" in P:
                    upd = ",".join(f"{c}=excluded.{c}" for c in row if c not in P["on_conflict"].split(","))
                    conflict = f" on conflict ({P['on_conflict']}) do update set {upd}"
                sql(f"insert into public.{table} ({cols}) values ({vals}){conflict};", uid)
            return route.fulfill(status=201, body="", headers={"content-type": "application/json"})
        if req.method == "PATCH":
            sets = ",".join(f"{k}={lit(v)}" for k, v in body.items())
            sql(f"update public.{table} set {sets}{where(params)};", uid)
            return route.fulfill(status=204, body="")
        if req.method == "DELETE":
            sql(f"delete from public.{table}{where(params)};", uid)
            return route.fulfill(status=204, body="")
    except RuntimeError as e:
        return route.fulfill(status=400, json={"message": str(e), "code": "P0001"})

def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")

def session_for(who):
    uid, email = USERS[who]
    tok = b64({"alg": "HS256"}) + "." + b64({"sub": uid, "exp": 4102444800, "role": "authenticated"}) + ".x"
    return json.dumps({"access_token": tok, "refresh_token": "r", "token_type": "bearer", "expires_in": 3600,
                       "expires_at": 4102444800, "user": {"id": uid, "email": email, "aud": "authenticated"}})

def page_as(br, who):
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    uid = USERS[who][0] if who else None
    if who:
        ctx.add_init_script(f"localStorage.setItem('sb-apkzdhweoaeymxynawjx-auth-token', {json.dumps(session_for(who))});")
    ctx.route("https://apkzdhweoaeymxynawjx.supabase.co/**", lambda r: handle(r, uid))
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto("http://localhost:8080/index.html")
    if who: pg.wait_for_function("document.querySelector('#nav') && document.querySelector('#nav').innerText.includes('sign out')", timeout=30000)
    pg.wait_for_timeout(500)
    return pg, errs

results = []
def check(name, cond, extra=""):
    results.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name + (" — " + extra if extra and not cond else ""))

with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. logged out -> login screen
    pg, errs = page_as(br, None)
    check("logged-out visitor sees login screen", "Email me a login link" in pg.inner_text("body"))
    # 2. Tritons manager
    pg, errs = page_as(br, "tritons")
    body = pg.inner_text("body")
    check("Tritons home loads 2025 champion + standings", "Alligator Arms" in body and "Standings" in body, body[:300])
    check("header shows signed-in team", "Purple Reign · sign out" in pg.inner_text("#nav"))
    pg.evaluate("go('bids')"); pg.wait_for_timeout(500)
    body = pg.inner_text("body")
    check("bid room shows auto-opened week 9 closing Tue 9pm PT", "Week 9 bids close Tue, Nov 3, 9:00 PM PT" in body, body[:500])
    pg.fill(".searchrow input", "Jauan"); pg.wait_for_timeout(300)
    pg.locator("input[type=number]").first.fill("3"); pg.locator("input[type=number]").first.dispatch_event("change"); pg.wait_for_timeout(800)
    check("too-low bid rejected with min-bid message", "BID TOO LOW: minimum bid is $6" in pg.inner_text("body"))
    pg.fill(".searchrow input", "Jauan"); pg.wait_for_timeout(300)
    pg.locator("input[type=number]").first.fill("8"); pg.locator("input[type=number]").first.dispatch_event("change")
    pg.wait_for_function("document.body.innerText.includes('Sealed: Jauan Jennings')", timeout=15000)
    body = pg.inner_text("body")
    check("valid bid sealed and listed", "Sealed: Jauan Jennings for $8" in body and "YOUR SEALED BIDS · WEEK 9 (2)" in body.upper(), body[:800])
    pg.evaluate("go('myteam')"); pg.wait_for_timeout(500)
    check("bid receipt alert on My Team", "Bid saved: Jauan Jennings for $8" in pg.inner_text("body"))
    pg.evaluate("go('forum')"); pg.wait_for_selector("#chatlog")
    for _ in range(4):  # a background re-render can wipe the input between fill and click; retry
        pg.fill("#chatmsg", "Testing the new forum 🔥"); pg.click("button.btn:text-is('Send')")
        try: pg.wait_for_function("document.querySelector('#chatlog') && document.querySelector('#chatlog').innerText.includes('Testing the new forum')", timeout=8000); break
        except Exception: pass
    check("forum post saved", "Testing the new forum" in pg.inner_text("#chatlog"))
    pg.screenshot(path="/home/claude/e2e/forum.png")
    check("no JS errors (Purple Reign)", not errs, "; ".join(errs))
    pg.evaluate("go('teams'); state.team='Steel Curtain'; render()"); pg.wait_for_timeout(400)
    body = pg.inner_text("body")
    check("Teams page shows 2026 roster + record (Curtain 4-3, Derrick Henry, $191)", "2026 RECORD" in body.upper() and "4-3" in body and "Derrick Henry" in body and "$191" in body, body[:1200])
    pg.evaluate("go('home')"); pg.wait_for_timeout(400)
    body = pg.inner_text("body")
    check("Home shows 2026 divisions", "Sailgating Syndicate" in body and "Thunderdome" in body, body[:800])
    pg.evaluate("go('history')"); pg.wait_for_timeout(400)
    check("History still shows the 2025 archive", "Alligator Arms" in pg.inner_text("body") and not errs, "; ".join(errs))
    # 3. Commissioner cannot see Tritons' bids; sees commissioner tools
    pg, errs = page_as(br, "hoogy")
    pg.evaluate("go('office')"); pg.wait_for_timeout(500)
    body = pg.inner_text("body")
    check("commissioner tools visible to commish", "Commissioner Tools" in body and "Week 9 is open" in body, body[:400])
    check("reveal button hidden before close", "Reveal week 9" not in body)
    seen = pg.evaluate("sb.from('bids').select('*').then(r=>r.data.length)")
    check("commissioner sees 0 bids before reveal", seen == 0, str(seen))
    # fast-forward the deadline, then reveal
    sql("alter table bid_weeks disable trigger bid_week_guard; update bid_weeks set bids_close_at = now() - interval '1 minute' where status='open'; alter table bid_weeks enable trigger bid_week_guard;")
    pg.reload(); pg.wait_for_function("document.querySelector('#nav').innerText.includes('sign out')", timeout=30000); pg.evaluate("go('office')"); pg.wait_for_timeout(400)
    pg.click("button:has-text('Reveal week 9 bids')"); pg.wait_for_function("document.body.innerText.includes('Week 9 reveal')", timeout=20000)
    body = pg.inner_text("body")
    check("reveal shows Jauan Jennings with Pool Boy #1 ($9) over Purple Reign ($8)",
          re.search(r"Jauan Jennings[\s\S]*#1\s+Pool Boy\s+\$9[\s\S]*#2\s+Purple Reign\s+\$8", body) is not None, body[:1200])
    pg.screenshot(path="/home/claude/e2e/reveal.png", full_page=True)
    check("no JS errors (commish)", not errs, "; ".join(errs))
    # 3b. Pool Boy (#1 on Jennings) claims him in his window, then tries to drop him
    pg, errs = page_as(br, "pool")
    pg.evaluate("go('bids');state.bidTab='reveal';render()"); pg.wait_for_timeout(400)
    btn = pg.locator("text=Add Jauan Jennings for $9")
    check("claim button shown to #1 bidder in window", btn.count() == 1)
    btn.click(); pg.wait_for_function("document.body.innerText.includes('Jauan Jennings added at $9')", timeout=20000)
    body = pg.inner_text("body")
    check("claim succeeds and shows on roster", "Jauan Jennings added at $9." in body and "ADDED: POOL BOY · $9" in body.upper(), body[:900])
    check("over-cap warning banner with Sunday deadline", "is 1 player over the 15-man limit and $5 over the $170 cap" in body and "Must be legal by Sun, Nov 1, 9:55 AM PT" in body, body[:1500])
    pg.locator("tr:has-text('Jauan Jennings') button:has-text('drop')").last.click(); pg.wait_for_timeout(1000)
    check("Executive Order blocks same-week drop", "Executive Order" in pg.inner_text("body"))
    pg.screenshot(path="/home/claude/e2e/claim.png", full_page=True)
    check("no JS errors (Pool Boy)", not errs, "; ".join(errs))
    # 4. My Team: IR move + trade proposed by Purple Reign, accepted + approved by Hoogy (commissioner)
    pg, errs = page_as(br, "tritons")
    pg.evaluate("go('myteam')"); pg.wait_for_timeout(500)
    body = pg.inner_text("body")
    check("My Team page shows roster with IR/promote buttons", "MY TEAM" in body.upper() and "promote" in body and "PROPOSE A TRADE" in body.upper(), body[:600])
    pg.select_option("select >> nth=0", label="Roaring Hoogy"); pg.wait_for_timeout(400)
    pg.locator("label:has-text('Jerry Jeudy') input").check()
    pg.locator("label:has-text('Case Keenum') input").check()
    pg.locator("label:has-text('2027 5th') input").first.check(); pg.click("text=Send offer")
    pg.wait_for_function("document.body.innerText.includes('Offer sent to Roaring Hoogy')", timeout=15000)
    check("trade offer sent", True)
    check("no JS errors (Purple Reign trade)", not errs, "; ".join(errs))
    pg, errs = page_as(br, "hoogy")
    pg.evaluate("go('myteam')"); pg.wait_for_timeout(500)
    check("trade offer alert shows for Hoogy", "Trade offer from Purple Reign" in pg.inner_text("body"))
    check("Hoogy sees the offer", "OFFERS TO YOU" in pg.inner_text("body").upper() and "Jerry Jeudy" in pg.inner_text("body"))
    pg.click("button:has-text('Accept')"); pg.wait_for_function("document.body.innerText.includes('goes to the commissioner')", timeout=15000)
    pg.click("button:has-text('Approve')"); pg.wait_for_function("document.body.innerText.includes('Trade approved')", timeout=15000)
    body = pg.inner_text("body")
    check("approved trade moves Jeudy to Hoogy's roster", "Jerry Jeudy" in pg.inner_text(".card:has-text('Your 2026 Roster')"), body[:800])
    check("trade log shows the pick", "2027 5th (Purple Reign)" in pg.inner_text("body") or "2027 5TH (PURPLE REIGN)" in pg.inner_text("body").upper())
    pg.evaluate("go('teams'); state.team='Roaring Hoogy'; render()"); pg.wait_for_timeout(400)
    check("Hoogy's team page lists the acquired pick", "5th (Purple Reign)" in pg.inner_text("body"))
    pg.evaluate("state.team=\"K2's Kings\"; render()"); pg.wait_for_timeout(300)
    check("K2's team page shows picks from sheets (1st (Pool Boy))", "1st (Pool Boy)" in pg.inner_text("body"))
    pg.evaluate("go('myteam')"); pg.wait_for_timeout(400)
    pg.locator("tr:has-text('Deebo Samuel') button:has-text('IR')").click()
    pg.wait_for_function("document.body.innerText.includes('moved to IR')", timeout=15000)
    check("IR button moves player and shows return week", "Earliest return: week 11" in pg.inner_text("body"))
    pg.screenshot(path="/home/claude/e2e/myteam.png", full_page=True)
    check("no JS errors (Hoogy my team)", not errs, "; ".join(errs))
    # 6. Commissioner admin: enter week 8 scores -> standings update; rules, matchups, logs, playoff picture
    pg, errs = page_as(br, "hoogy")
    pg.evaluate("go('office'); state.adminTab='results'; state.adminWeek=8; render()"); pg.wait_for_timeout(500)
    ids = pg.evaluate("LIVE.m26.filter(m=>m.week===8).map(m=>m.id)")
    for k,i in enumerate(ids):
        pg.fill(f"#hs_{i}", str(100+k)); pg.fill(f"#as_{i}", str(90+k)); pg.click(f"tr:has(#hs_{i}) button:has-text('Save')")
        pg.wait_for_function("document.body.innerText.includes('Score saved') || document.body.innerText.includes('standings updated')", timeout=20000)
        pg.evaluate("go('office'); state.adminTab='results'; state.adminWeek=8; render()")
    check("week 8 scores entered -> standings through week 8", pg.evaluate("Object.keys(LIVE.standings).map(Number).includes(8)"))
    pg.evaluate("go('home')"); pg.wait_for_timeout(400); body = pg.inner_text("body")
    check("Home shows playoff picture after week 8", "PLAYOFF PICTURE" in body.upper() and "after week 8" in body, body[:400])
    order = pg.evaluate("DATA.divisions['Sailgating Syndicate'].map(x=>x.team)")
    check("division tiebreak uses head-to-head between the tied teams (Purple Reign beat Rhin-Owned wk 1)", order.index('Purple Reign') < order.index('Rhin-Owned'), str(order))
    pg.evaluate("go('rules')"); pg.wait_for_timeout(400); body = pg.inner_text("body")
    check("Rules page shows 2026 rules (Tuesday deadline, 14 games)", "Rules · 2026" in body and "Tuesday" in body and "Wednesday Tuesday" not in body)
    pg.evaluate("go('match'); state.week=8; render()"); pg.wait_for_timeout(300); body = pg.inner_text("body")
    check("Matchup Center shows real week 8 finals", "Final" in body and "Matchup Center" in body)
    pg.evaluate("go('teams'); state.team=\"K2's Kings\"; render()"); pg.wait_for_timeout(300); body = pg.inner_text("body")
    check("Team page shows sheet transaction history", "K2s send Zay Flowers to da bombers" in body)
    pg.evaluate("go('office'); state.adminTab='players'; state.adminQ='Romeo Doubs'; render()"); pg.wait_for_timeout(300)
    pg.select_option("select[id^=rt_]", label="Pool Boy"); pg.fill("input[id^=rsal_]", "13"); pg.click("button:has-text('Save roster')")
    pg.wait_for_function("document.body.innerText.includes('Romeo Doubs → Pool Boy')", timeout=20000)
    check("admin can put a player on a roster", True)
    pg.evaluate("go('office'); state.adminTab='nfl'; render()")
    pg.wait_for_function("document.body.innerText.includes('changed ·')", timeout=20000); body = pg.inner_text("body")
    check("NFL Teams tab lists A.J. Brown PHI → NE", "A.J. Brown" in body and "PHI → NE" in body, body[:600])
    pid = pg.evaluate("LIVE.players.find(p=>p.name==='A.J. Brown').id")
    pg.click(f"tr:has-text('A.J. Brown') button:has-text('Apply')")
    pg.wait_for_function("document.body.innerText.includes('A.J. Brown → NE')", timeout=20000)
    check("NFL Teams Apply updates the player's team", sql(f"select nfl_team from players where id={pid}") == "NE")
    n = pg.evaluate("state.nflChanges.length")
    pg.evaluate("state.nflChanges.slice(5).forEach(x=>state.nflSkip[x.p.id]=true); render()")
    pg.click("button:has-text('Apply 5 checked')")
    pg.wait_for_function("document.body.innerText.includes('5 players updated')", timeout=60000)
    check("NFL Teams Apply-checked updates 5 and leaves the rest", pg.evaluate("state.nflChanges.length") == n - 5, str(n))
    pg.evaluate("go('office'); state.adminTab='backup'; render()"); pg.wait_for_timeout(200)
    with pg.expect_download() as dl: pg.click("text=Download backup")
    check("backup downloads", dl.value.suggested_filename.startswith("sacverde-backup-"))
    check("no JS errors (admin)", not errs, "; ".join(errs))
    # 7. phone width
    ctx = br.new_context(viewport={"width": 390, "height": 844})
    ctx.add_init_script(f"localStorage.setItem('sb-apkzdhweoaeymxynawjx-auth-token', {json.dumps(session_for('pool'))});")
    ctx.route("https://apkzdhweoaeymxynawjx.supabase.co/**", lambda r: handle(r, USERS['pool'][0]))
    m = ctx.new_page(); m.goto("http://localhost:8080/index.html")
    m.wait_for_function("document.querySelector('#nav') && document.querySelector('#nav').innerText.includes('sign out')", timeout=30000)
    m.evaluate("go('bids');state.bidTab='reveal';render()"); m.wait_for_timeout(400)
    m.screenshot(path="/home/claude/e2e/phone.png")
    sw = m.evaluate("document.documentElement.scrollWidth")
    check("phone: no horizontal page scroll", sw <= 392, str(sw))
    br.close()
print(f"\n{sum(r for _, r in results)}/{len(results)} passed")
