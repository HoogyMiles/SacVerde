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
    # bench → FLEX via the Move dropdown (swap with Jack Bech)
    sel = pg.locator(row('Keenan Allen')+" select")
    flex_val = [o for o in sel.locator("option").all_inner_texts() if o.startswith("W/R/T")]
    sel.select_option(label=flex_val[0])
    pg.wait_for_function("document.body.innerText.includes('Keenan Allen is in your FLEX slot')", timeout=15000)
    check("Move dropdown puts a bench player in FLEX", at("Roaring Hoogy", "FLEX") == "Keenan Allen")
    check("old FLEX goes to the bench", "Jack Bech" in pg.inner_text(".card:has-text('Bench ·')"))
    # bench a starter → empty-slot warning
    pg.locator(row('Emeka Egbuka')+" select").select_option(label="Bench")
    pg.wait_for_function("document.body.innerText.includes('Emeka Egbuka moved to the bench')", timeout=15000)
    body = pg.inner_text("body")
    check("empty slot warning mentions automatic loss", "Empty lineup slot: WR 2" in body and "automatic loss" in body, body[:900])
    # fill the empty slot from the Start… dropdown
    pg.locator(".lu-row[data-pid=''] select").select_option(label="Emeka Egbuka (WR)")
    pg.wait_for_function("document.body.innerText.includes('Emeka Egbuka is in your WR2 slot')", timeout=15000)
    check("Start… dropdown fills the empty slot", at("Roaring Hoogy", "WR2") == "Emeka Egbuka" and "Empty lineup slot" not in pg.inner_text("body"))
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
    pg.evaluate("go('teams'); state.team='Roaring Hoogy'; render()"); pg.wait_for_timeout(400)
    body = pg.inner_text("body").upper()
    i = [body.find(x) for x in ("STARTING LINEUP · WEEK 8", "BENCH ·", "\nIR\n", "TAXI SQUAD")]
    check("team page: Starting Lineup → Bench → IR → Taxi", all(x >= 0 for x in i) and i == sorted(i), str(i))
    check("other managers can see the lineup", "Keenan Allen" in pg.inner_text(".card:has-text('Starting Lineup')"))
    pg.screenshot(path="/home/claude/e2e/team_lineup.png", full_page=True)
    pg.evaluate("go('match'); state.week=8; render()"); pg.wait_for_timeout(400)
    body = pg.inner_text("body")
    check("Matchup Center shows both lineups for week 8", ("LINEUPS · WEEK 8" in body.upper() or "LIVE SCORING · WEEK 8" in body.upper()) and body.count("W/R/T") >= 12)
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
    pg.evaluate("go('teams'); state.team='Roaring Hoogy'; render()"); pg.wait_for_timeout(300)
    check("without 020 team page shows Active Roster", "ACTIVE ROSTER" in pg.inner_text("body").upper())
    pg.evaluate("go('office')"); pg.wait_for_timeout(300)
    check("without 020 no Lineups admin tab", "Lineups" not in pg.inner_text(".tabs") if pg.locator(".tabs").count() else True)
    check("no JS errors (fallback)", not errs, "; ".join(errs))
    br.close()
print(f"\n{sum(r for _, r in results)}/{len(results)} passed")
