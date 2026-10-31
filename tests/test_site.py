import json, subprocess, re, base64, time, sys
from urllib.parse import urlparse, parse_qsl
from playwright.sync_api import sync_playwright

PSQL = ["psql", "-h", "/tmp/pg", "-p", "5433", "-U", "postgres", "-d", "sv", "-tA", "-v", "ON_ERROR_STOP=1", "-q"]
USERS = {"tritons": ("00000000-0000-0000-0000-000000000002", "paulbstephens@hotmail.com"),
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
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def where(params):
    w = []
    for k, v in params:
        if k in ("select", "order", "limit", "offset", "on_conflict", "columns"): continue
        op, _, val = v.partition(".")
        if op == "eq": w.append(f"{k} = {lit(val)}")
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
            out = sql(f"select to_json(public.{fn}({a}));", uid)
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
    pg.goto("http://localhost:8080/index.html"); pg.wait_for_timeout(1500)
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
    check("header shows signed-in team", "Tritons · sign out" in pg.inner_text("#nav"))
    pg.evaluate("go('bids')"); pg.wait_for_timeout(500)
    body = pg.inner_text("body")
    check("bid room shows auto-opened week 9 closing Tue 9pm PT", "Week 9 bids close Tue, Nov 3, 9:00 PM PT" in body, body[:500])
    pg.fill(".searchrow input", "Jauan"); pg.wait_for_timeout(300)
    pg.locator("input[type=number]").first.fill("3"); pg.locator("input[type=number]").first.dispatch_event("change"); pg.wait_for_timeout(800)
    check("too-low bid rejected with min-bid message", "BID TOO LOW: minimum bid is $6" in pg.inner_text("body"))
    pg.fill(".searchrow input", "Jauan"); pg.wait_for_timeout(300)
    pg.locator("input[type=number]").first.fill("8"); pg.locator("input[type=number]").first.dispatch_event("change"); pg.wait_for_timeout(800)
    body = pg.inner_text("body")
    check("valid bid sealed and listed", "Sealed: Jauan Jennings for $8" in body and "YOUR SEALED BIDS · WEEK 9 (2)" in body.upper(), body[:800])
    pg.evaluate("go('forum')"); pg.wait_for_timeout(400)
    pg.fill("#chatmsg", "Testing the new forum 🔥"); pg.click("text=Send"); pg.wait_for_timeout(800)
    check("forum post saved", "Testing the new forum" in pg.inner_text("#chatlog"))
    pg.screenshot(path="/home/claude/e2e/forum.png")
    check("no JS errors (Tritons)", not errs, "; ".join(errs))
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
    pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("go('office')"); pg.wait_for_timeout(400)
    pg.click("text=Reveal week 9 bids"); pg.wait_for_timeout(1200)
    body = pg.inner_text("body")
    check("reveal shows Jauan Jennings with Pool Boy #1 ($9) over Tritons ($8)",
          re.search(r"Jauan Jennings[\s\S]*#1\s+Pool Boy\s+\$9[\s\S]*#2\s+Tritons\s+\$8", body) is not None, body[:1200])
    pg.screenshot(path="/home/claude/e2e/reveal.png", full_page=True)
    check("no JS errors (commish)", not errs, "; ".join(errs))
    # 3b. Pool Boy (#1 on Jennings) claims him in his window, then tries to drop him
    pg, errs = page_as(br, "pool")
    pg.evaluate("go('bids');state.bidTab='reveal';render()"); pg.wait_for_timeout(400)
    btn = pg.locator("text=Add Jauan Jennings for $9")
    check("claim button shown to #1 bidder in window", btn.count() == 1)
    btn.click(); pg.wait_for_timeout(1000)
    body = pg.inner_text("body")
    check("claim succeeds and shows on roster", "Jauan Jennings added at $9." in body and "ADDED: POOL BOY · $9" in body.upper(), body[:900])
    pg.locator("tr:has-text('Jauan Jennings') button:has-text('drop')").last.click(); pg.wait_for_timeout(1000)
    check("Executive Order blocks same-week drop", "Executive Order" in pg.inner_text("body"))
    pg.screenshot(path="/home/claude/e2e/claim.png", full_page=True)
    check("no JS errors (Pool Boy)", not errs, "; ".join(errs))
    # 4. phone width
    ctx = br.new_context(viewport={"width": 390, "height": 844})
    ctx.add_init_script(f"localStorage.setItem('sb-apkzdhweoaeymxynawjx-auth-token', {json.dumps(session_for('pool'))});")
    ctx.route("https://apkzdhweoaeymxynawjx.supabase.co/**", lambda r: handle(r, USERS['pool'][0]))
    m = ctx.new_page(); m.goto("http://localhost:8080/index.html"); m.wait_for_timeout(1500)
    m.evaluate("go('bids');state.bidTab='reveal';render()"); m.wait_for_timeout(400)
    m.screenshot(path="/home/claude/e2e/phone.png")
    sw = m.evaluate("document.documentElement.scrollWidth")
    check("phone: no horizontal page scroll", sw <= 392, str(sw))
    br.close()
print(f"\n{sum(r for _, r in results)}/{len(results)} passed")
