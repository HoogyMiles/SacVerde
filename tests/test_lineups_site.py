# Browser checks for lineups (020 + lineups.js). Run: TEST=test_lineups_site.py bash tests/run_all.sh
import os
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_site.py")).read()
exec(_src[:_src.index("with sync_playwright() as p:")])   # mock + helpers, without running the main suite

def row(name): return f".lu-row[data-pid='{sql(f'select id from players where name = {lit(name)} and active')}']"
def at(team, slot, week=8):
    return sql(f"select p.name from lineups l join players p on p.id=l.player_id join teams t on t.id=l.team_id where l.season=2026 and l.week={week} and t.name={lit(team)} and l.slot={lit(slot)}")

with sync_playwright() as p:
    br = p.chromium.launch()
    # Seattle's game has "kicked off" so Myers / Smith-Njigba are locked
    sql("update nfl_games set kickoff_at = now() - interval '1 hour' where season=2026 and week=8 and 'SEA' in (home, away)")
    pg, errs = page_as(br, "hoogy")
    pg.evaluate("go('myteam')"); pg.wait_for_function("document.body.innerText.toUpperCase().includes('STARTING LINEUP · WEEK 8')", timeout=20000)
    body = pg.inner_text("body").upper()
    i = [body.find(x) for x in ("STARTING LINEUP · WEEK 8", "BENCH ·", "IR ·", "TAXI SQUAD ·")]
    check("My Team shows Starting Lineup → Bench → IR → Taxi in order", all(x >= 0 for x in i) and i == sorted(i), str(i))
    check("all 9 slots listed", pg.locator(".card:has-text('Starting Lineup') .lu-row").count() == 9)
    check("locked starter shows the lock", "🔒" in pg.inner_text(row('Jason Myers')) and "locked" in pg.inner_text(row('Jason Myers')))
    check("bye-week player shows BYE", "BYE" in pg.inner_text(row('Christian McCaffrey')))
    # ---- tap-to-swap ----
    def tap(pid_name):   # tap the Swap/Fill button on a row
        pg.locator((row(pid_name) if pid_name else ".lu-row[data-pid='']")+" .lu-act button").first.click(); pg.wait_for_timeout(150)
    def go_to(sel, msg):
        pg.locator(sel).first.click(); pg.wait_for_function(f"document.body.innerText.includes({msg!r})", timeout=15000)
    tap('Keenan Allen')
    check("tap Swap shows the hint bar", "Moving Keenan Allen" in pg.inner_text(".lu-hint"))
    check("FLEX (Jack Bech) lights up as a target", "lu-tgt" in pg.get_attribute(row('Jack Bech'), "class"))
    check("illegal spots are dimmed (QB)", "lu-dim" in pg.get_attribute(row('Jayden Daniels'), "class"))
    check("locked starter is not a target", "lu-tgt" not in pg.get_attribute(row('Jaxon Smith-Njigba'), "class"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    check("Escape cancels the swap", pg.locator(".lu-hint").count() == 0)
    tap('Keenan Allen'); go_to(row('Jack Bech'), "Keenan Allen is in your FLEX slot")
    check("bench player → FLEX in two taps", at("Roaring Hoogy", "FLEX") == "Keenan Allen")
    check("old FLEX goes to the bench", "Jack Bech" in pg.inner_text(".card:has-text('Bench ·')"))
    # starter → bench player directly (no benching first)
    tap('Emeka Egbuka'); go_to(row('Deebo Samuel Sr.'), "Deebo Samuel Sr. is in your WR2 slot")
    check("starter swaps straight with a bench player", at("Roaring Hoogy", "WR2") == "Deebo Samuel Sr." and "Emeka Egbuka" in pg.inner_text(".card:has-text('Bench ·')"))
    # starter ↔ starter
    tap('Keenan Allen'); go_to(row('Deebo Samuel Sr.'), "Keenan Allen is in your WR2 slot")
    check("starter ↔ starter swap", at("Roaring Hoogy", "WR2") == "Keenan Allen" and at("Roaring Hoogy", "FLEX") == "Deebo Samuel Sr.")
    # move to the bench → empty slot warning
    tap('Keenan Allen'); go_to(".lu-benchtgt", "Keenan Allen moved to the bench")
    body = pg.inner_text("body")
    check("empty slot warning mentions automatic loss", "Empty lineup slot: WR 2" in body and "automatic loss" in body, body[:900])
    # fill the empty slot
    tap(None)
    check("Fill highlights eligible bench players only", "lu-tgt" in pg.get_attribute(row('Emeka Egbuka'), "class") and "lu-tgt" not in (pg.get_attribute(row('Cole Kmet'), "class") or ""))
    go_to(row('Emeka Egbuka'), "Emeka Egbuka is in your WR2 slot")
    check("Fill puts a bench player in the empty slot", at("Roaring Hoogy", "WR2") == "Emeka Egbuka" and "Empty lineup slot" not in pg.inner_text("body"))
    # ---- cap bar ----
    used = int(sql("select sum(case when status='ir' then salary - salary/2 else salary end) from roster_spots r join teams t on t.id=r.team_id where t.name='Roaring Hoogy' and r.season=2026 and status in ('active','ir')"))
    cap_txt = pg.inner_text(".cap-card")
    check("cap bar shows cap space, used, roster", f"${170-used}" in cap_txt.replace("−","-") and f"${used} / $170" in cap_txt and "ROSTER" in cap_txt.upper(), cap_txt)
    # ---- injury / bye tags (mock injuries.json) ----
    inj = {"updated": "test", "players": {"bijanrobinson|RB": [{"t": "ATL", "s": "Q", "i": "Ankle", "w": 8}],
            "colstonloveland|TE": [{"t": "CHI", "s": "OUT", "i": "Hamstring", "w": 8}],
            "colekmet|TE": [{"t": "CHI", "s": "IR", "i": "Injured reserve"}],
            "keenanallen|WR": [{"t": "LAC", "s": "OUT", "i": "Knee", "w": 8}]}}   # team on file is stale, name unique → still matches
    pg.context.route("**/injuries.json", lambda r: r.fulfill(status=200, json=inj))
    pg.reload(); pg.wait_for_function("document.querySelector('#nav') && document.querySelector('#nav').innerText.includes('sign out')", timeout=30000)
    pg.evaluate("go('myteam')"); pg.wait_for_function("document.querySelector('.lu-pill.q')", timeout=15000)
    lv = pg.locator(row('Colston Loveland'))
    check("OUT starter: red tinted row + OUT tag + won't score", "lu-out" in lv.get_attribute("class") and "OUT" in lv.inner_text() and "Out · Hamstring — won't score" in lv.inner_text(), lv.inner_text())
    bj = pg.locator(row('Bijan Robinson'))
    check("Questionable starter: amber row + Q tag", "lu-q" in bj.get_attribute("class") and "Questionable · Ankle" in bj.inner_text())
    km = pg.locator(row('Cole Kmet'))
    check("bench IR player: tag only, no row tint", "IR" in km.inner_text() and "lu-out" not in km.get_attribute("class"))
    cm = pg.locator(row('Christian McCaffrey'))
    check("bench bye player shows BYE tag", cm.locator(".lu-pill").inner_text() == "BYE")
    check("stale NFL team on file still gets the tag (unique name)", pg.locator(row('Keenan Allen')+" .lu-pill").inner_text() == "OUT")
    pg.screenshot(path="/home/claude/e2e/myteam_injuries.png", full_page=True)
    # ---- contract year chips ----
    ctr = lambda n: pg.locator(row(n)+" .ctr").inner_text() if pg.locator(row(n)+" .ctr").count() else ""
    check("contract chips: blank = Yr 1, keeper = Yr 2/3, franchise = Yr 5 F", ctr('Keenan Allen') == "Yr 1" and ctr('Colston Loveland') == "Yr 2"
          and ctr('Jayden Daniels') == "Yr 3" and ctr('Christian McCaffrey') == "Yr 5 F", f"{ctr('Keenan Allen')}|{ctr('Colston Loveland')}|{ctr('Jayden Daniels')}|{ctr('Christian McCaffrey')}")
    check("taxi players get no contract chip", ctr('Malachi Fields') == "")
    pg.screenshot(path="/home/claude/e2e/myteam_lineup_hoogy.png", full_page=True)
    # IR move from My Team clears the slot (Bijan → IR), then refill RB from bench is offered
    pg.locator(row('Bijan Robinson')+" button:has-text('IR')").click()
    pg.wait_for_function("document.body.innerText.includes('moved to IR')", timeout=15000)
    check("IR move empties his lineup slot", at("Roaring Hoogy", "RB1") == "" and "Bijan Robinson" in pg.inner_text(".card:has-text('IR ·')"))
    check("no JS errors (Hoogy lineup)", not errs, "; ".join(errs))
    # commissioner: Front Office lineup card + Admin → Lineups
    pg.evaluate("go('office')"); pg.wait_for_timeout(500)
    check("Front Office lists the empty slot", "STARTING LINEUPS · WEEK 8" in pg.inner_text("body").upper() and "RB1" in pg.inner_text(".card:has-text('Starting Lineups · Week 8')"))
    pg.evaluate("go('office'); state.adminTab='lineups'; state.alTeam=String(LIVE.teamId['Roaring Hoogy']); render()"); pg.wait_for_timeout(400)
    pg.select_option("#al_RB1", label="Christian McCaffrey · SF")
    pg.click("tr:has(#al_RB1) button:has-text('Save')")
    pg.wait_for_function("document.body.innerText.includes('Christian McCaffrey set at RB1')", timeout=15000)
    check("Admin → Lineups sets a slot", at("Roaring Hoogy", "RB1") == "Christian McCaffrey")
    pg.screenshot(path="/home/claude/e2e/admin_lineups.png", full_page=True)
    check("no JS errors (commissioner)", not errs, "; ".join(errs))
    # another manager sees Hoogy's lineup + matchup lineups
    pg, errs = page_as(br, "tritons")
    pg.evaluate("goTeam('Roaring Hoogy')"); pg.wait_for_timeout(400)
    body = pg.inner_text("body").upper()
    i = [body.find(x) for x in ("STARTING LINEUP · WEEK 8", "BENCH ·", "\nIR\n", "TAXI SQUAD")]
    check("team page: Starting Lineup → Bench → IR → Taxi", all(x >= 0 for x in i) and i == sorted(i), str(i))
    check("other managers can see the lineup", "Emeka Egbuka" in pg.inner_text(".card:has-text('Starting Lineup')"))
    check("team page shows contract chips by the salary", pg.locator(".card:has-text('Starting Lineup') td.r .ctr").count() == 9 and "Yr 5 F" in pg.inner_text(".card:has-text('Starting Lineup')") and pg.locator(".card:has-text('Bench ·') td.r .ctr").count() >= 1)
    pg.screenshot(path="/home/claude/e2e/team_lineup.png", full_page=True)
    pg.evaluate("go('match'); state.week=8; render()"); pg.wait_for_timeout(400)
    body = pg.inner_text("body")
    check("Matchup Center shows both lineups for week 8", "LIVE SCORING · WEEK 8" in body.upper() and pg.locator(".mc-lr:not(.hd):not(.tot)").count() == 9 and "W/R/T" in body)
    pg.screenshot(path="/home/claude/e2e/match_lineups.png", full_page=True)
    pg.evaluate("go('myteam')"); pg.wait_for_timeout(400)
    pg.screenshot(path="/home/claude/e2e/myteam_lineup_pr.png", full_page=True)
    check("no JS errors (Purple Reign)", not errs, "; ".join(errs))
    # phone width
    ctx = br.new_context(viewport={"width": 390, "height": 844}); fake_clock(ctx)
    ctx.add_init_script(f"localStorage.setItem('sb-apkzdhweoaeymxynawjx-auth-token', {json.dumps(session_for('hoogy'))});")
    ctx.route("https://apkzdhweoaeymxynawjx.supabase.co/**", lambda r: handle(r, USERS['hoogy'][0]))
    m = ctx.new_page(); m.goto("http://localhost:8080/index.html")
    m.wait_for_function("document.querySelector('#nav') && document.querySelector('#nav').innerText.includes('sign out')", timeout=30000)
    m.evaluate("go('myteam')"); m.wait_for_timeout(600)
    m.screenshot(path="/home/claude/e2e/phone_lineup.png", full_page=True)
    sw = m.evaluate("document.documentElement.scrollWidth")
    check("phone: My Team lineup has no horizontal page scroll", sw <= 392, str(sw))
    # fallback: site still works if 020 was never run
    sql("drop table lineups cascade")
    pg, errs = page_as(br, "hoogy")
    pg.evaluate("go('myteam')"); pg.wait_for_timeout(600)
    body = pg.inner_text("body")
    check("without 020 the old roster view still works", "YOUR 2026 ROSTER" in body.upper() and "Keenan Allen" in body and "STARTING LINEUP" not in body.upper())
    pg.evaluate("goTeam('Roaring Hoogy')"); pg.wait_for_timeout(300)
    check("without 020 team page shows Active Roster", "ACTIVE ROSTER" in pg.inner_text("body").upper())
    pg.evaluate("go('office')"); pg.wait_for_timeout(300)
    check("without 020 no Lineups admin tab", "Lineups" not in pg.inner_text(".tabs") if pg.locator(".tabs").count() else True)
    check("no JS errors (fallback)", not errs, "; ".join(errs))
    br.close()
print(f"\n{sum(r for _, r in results)}/{len(results)} passed")
