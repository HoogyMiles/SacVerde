// =====================================================================
// SacVerde lineups: Starting Lineup → Bench → IR → Taxi on My Team and team pages,
// lineup moves with kickoff locks, both lineups in Matchup Center, lineup compliance,
// commissioner Admin → Lineups. Loaded after live.js.
// If migration 020 hasn't been run yet (no lineups table), everything falls back to
// the previous screens.
// =====================================================================
const SLOTS = [["QB","QB"],["RB1","RB"],["RB2","RB"],["WR1","WR"],["WR2","WR"],["TE","TE"],["FLEX","W/R/T"],["K","K"],["DST","DEF"]];
const SLOT_LABEL = Object.fromEntries(SLOTS);
document.head.insertAdjacentHTML("beforeend", `<style>
.lu-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:9px 0;border-bottom:1px solid var(--line)}
.lu-row:last-child{border-bottom:0}
.lu-slot{width:46px;font-weight:800;font-size:12px}
.lu-p{flex:1 1 200px;min-width:0}
.lu-sub{font-size:12px;color:var(--mut);margin-top:2px}
.lu-sal{width:44px;text-align:right}
.lu-act{margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.lu-act select{width:150px}
@media (max-width:600px){ .lu-act{width:100%} .lu-act select{width:auto;flex:1;max-width:200px} }
</style>`);
const slotFits = (slot, pos)=>({QB:["QB"],RB1:["RB"],RB2:["RB"],WR1:["WR"],WR2:["WR"],TE:["TE"],FLEX:["RB","WR","TE"],K:["K"],DST:["DST"]}[slot]||[]).includes(pos);

// ---------- data ----------
async function loadLineups(){
  const yr = LIVE.season.year, wk = LIVE.season.current_week;
  const lu = await fetchAll(()=>sb.from("lineups").select("week,team_id,slot,player_id").eq("season",yr).order("week").order("team_id").order("slot"))
    .then(rows=>({rows}), error=>({error}));
  LIVE.hasLineups = !lu.error && Array.isArray(lu.rows);
  if(!LIVE.hasLineups){ LIVE.lineups = []; return; }
  LIVE.lineups = lu.rows;
  const g = await sb.from("nfl_games").select("week,home,away,kickoff_at").eq("season",yr).in("week",[...new Set([wk, ...LIVE.lineups.map(l=>l.week)])]);
  LIVE.games = g.data || [];
}
const _loadSeason = loadSeason;
loadSeason = async function(){ await _loadSeason(); try { await loadLineups(); } catch(e){ LIVE.hasLineups = false; LIVE.lineups = []; } };

function gameFor(p, week){
  if(!p || p.nfl_team==="FA") return null;
  const g = (LIVE.games||[]).find(x=>x.week===week && (x.home===p.nfl_team || x.away===p.nfl_team));
  if(!g) return null;
  return {ko:g.kickoff_at, opp: g.home===p.nfl_team ? "vs "+g.away : "@"+g.home};
}
const isLocked = (p, week)=>{ const g = gameFor(p, week); return !!(g && new Date(g.ko) <= new Date()); };
function lineupMap(tid, week){
  const m = {}; (LIVE.lineups||[]).filter(l=>l.team_id===tid && l.week===week).forEach(l=>m[l.slot]=l.player_id); return m;
}
// Starters / bench / IR / taxi for one team in one week
function teamSections(tid, week){
  const spots = LIVE.roster26.filter(r=>r.team_id===tid).map(r=>({...r, p:LIVE.byId[r.player_id]||{}}));
  const m = lineupMap(tid, week), started = new Set(Object.values(m));
  const sortPos = (a,b)=>(POSORD[a.p.pos]||9)-(POSORD[b.p.pos]||9) || b.salary-a.salary;
  const starters = SLOTS.map(([slot])=>{ const pid = m[slot]; const r = pid ? (spots.find(s=>s.player_id===pid) || {player_id:pid, p:LIVE.byId[pid]||{}, salary:0, gone:true}) : null; return {slot, r}; });
  return {
    starters,
    bench: spots.filter(s=>s.status==="active" && !started.has(s.player_id)).sort(sortPos),
    ir: spots.filter(s=>s.status==="ir").sort(sortPos),
    taxi: spots.filter(s=>s.status==="taxi").sort(sortPos)
  };
}
function lineupIssues(tid, week){
  const s = teamSections(tid, week);
  return {
    empty: s.starters.filter(x=>!x.r).map(x=>x.slot),
    bye: s.starters.filter(x=>x.r && x.r.p.nfl_team!=="FA" && !gameFor(x.r.p, week)).map(x=>x.r.p.name),
    fa: s.starters.filter(x=>x.r && x.r.p.nfl_team==="FA").map(x=>x.r.p.name)
  };
}
const gameCell = (p, week)=>{ const g = gameFor(p, week);
  if(!p || !p.pos) return "";
  if(p.nfl_team==="FA") return `<span class="red sm">no NFL team</span>`;
  if(!g) return `<span class="red sm">BYE</span>`;
  const t = new Date(g.ko).toLocaleString([], {...PT, weekday:"short", hour:"numeric", minute:"2-digit"});
  return `<span class="sm mut">${g.opp} · ${t}</span>${isLocked(p, week)?' <span title="Game has kicked off — locked for the week">🔒</span>':""}`; };

// ---------- moves ----------
async function setSlot(slot, pid){
  const {data, error} = await sb.rpc("set_lineup_slot", {p_slot:slot, p_player:pid});
  if(error){ await loadSeason(); return showErr(error); }
  await loadSeason(); if(LIVE.roster26.length) build2026(); flash(data);
}
function moveSelect(tid, week, row, fromSlot){
  // row = roster spot being moved (or null for an empty slot); fromSlot = its current slot (null = bench)
  const m = lineupMap(tid, week);
  let opts = [];
  if(row){
    if(isLocked(row.p, week)) return `<span class="sm mut2">locked</span>`;
    SLOTS.forEach(([slot, lbl])=>{ if(slot===fromSlot || !slotFits(slot, row.p.pos)) return;
      const occ = m[slot] ? LIVE.byId[m[slot]] : null;
      if(occ && isLocked(occ, week)) return;
      opts.push(`<option value="${slot}">${lbl}${slot.match(/\d/)?" "+slot.slice(-1):""} ${occ?"— swap with "+esc(occ.name):"(empty)"}</option>`); });
    if(fromSlot) opts.unshift(`<option value="__bench">Bench</option>`);
    if(!opts.length) return "";
    return `<select class="sm" aria-label="Move ${esc(row.p.name)}" onchange="lineupMove(this.value, ${row.player_id}, '${fromSlot||""}')"><option value="">Move…</option>${opts.join("")}</select>`;
  }
  // empty slot: pick a bench player who fits
  const s = teamSections(tid, week);
  const cands = s.bench.filter(b=>slotFits(fromSlot, b.p.pos) && !isLocked(b.p, week));
  if(!cands.length) return `<span class="sm mut2">no eligible bench player</span>`;
  return `<select class="sm" aria-label="Fill ${fromSlot}" onchange="lineupMove('${fromSlot}', +this.value, '')"><option value="">Start…</option>${cands.map(b=>`<option value="${b.player_id}">${esc(b.p.name)} (${b.p.pos})</option>`).join("")}</select>`;
}
function lineupMove(target, pid, fromSlot){
  if(!target) return;
  if(target==="__bench") return setSlot(fromSlot, null);
  return setSlot(target, pid);
}

// ---------- My Team ----------
const _myRosterHTML = myRosterHTML;
myRosterHTML = function(){
  if(!LIVE.hasLineups) return _myRosterHTML();
  const me = LIVE.me.team_id, wk = LIVE.season.current_week, cap = capInfo(me);
  if(!LIVE.roster26.some(r=>r.team_id===me)) return "";
  const s = teamSections(me, wk), iss = lineupIssues(me, wk);
  const late = LIVE.deadline && new Date() >= new Date(LIVE.deadline);
  const warn = [
    iss.empty.length ? `<div class="note" style="border-color:var(--red)">⚠️ Empty lineup slot${iss.empty.length>1?"s":""}: <b>${iss.empty.map(x=>SLOT_LABEL[x]+(x.match(/\d/)?" "+x.slice(-1):"")).join(", ")}</b>. ${late?`<b class="red">The Sunday 9:55 AM PT deadline has passed.</b>`:`Fill ${iss.empty.length>1?"them":"it"} by <b>${LIVE.deadline?fmtPT(LIVE.deadline):"Sunday 9:55 AM PT"}</b> or it's an <b>automatic loss</b> for the week.`}</div>` : "",
    iss.bye.length ? `<div class="note">Starting on a bye: <b>${iss.bye.map(esc).join(", ")}</b> — legal, but he won't score.</div>` : "",
    iss.fa.length ? `<div class="note">Starting a player with no NFL team: <b>${iss.fa.map(esc).join(", ")}</b>.</div>` : ""
  ].join("");
  const btns = r=>`${rosterButtons(r)}<button class="btn ghost sm" onclick="dropPlayer(${r.player_id})">drop</button>`;
  const row = (slotLbl, r, fromSlot, moves)=>`<div class="lu-row" data-pid="${r?r.player_id:""}" data-slot="${fromSlot||""}">
    <div class="lu-slot">${slotLbl}</div>
    <div class="lu-p">${r?`<span class="pos ${r.p.pos}">${r.p.pos}</span> ${esc(r.p.name)}<div class="lu-sub">${r.p.nfl_team} · ${gameCell(r.p, wk)}</div>`:`<span class="red sm">Empty</span>`}</div>
    <div class="lu-sal">${r?money(r.salary):""}</div>
    <div class="lu-act">${moves?moveSelect(me, wk, r, fromSlot):""}${r&&!r.gone?btns(r):""}</div></div>`;
  const sect = (title, rows)=>`<div class="card" style="margin-top:14px"><h3>${title}</h3>${rows}</div>`;
  return `<div class="card" style="margin-top:14px"><h3>Your ${LIVE.season.year} Roster · ${cap.count}/${LIVE.season.roster_size} active · ${money(cap.used)} of $${LIVE.season.salary_cap}</h3>
      <div class="sm mut">Week ${wk} lineup. Players lock at their game's kickoff. No changes → last week's lineup carries over.</div></div>
    ${warn}
    ${sect(`Starting Lineup · Week ${wk}`, s.starters.map(x=>row(SLOT_LABEL[x.slot], x.r, x.slot, true)).join(""))}
    ${sect(`Bench · ${s.bench.length}`, s.bench.map(r=>row("BN", r, null, true)).join("") || `<div class="sm mut2">Nobody on the bench.</div>`)}
    ${s.ir.length?sect(`IR · ${s.ir.length}/${LIVE.season.max_ir}`, s.ir.map(r=>row("IR", r, null, false)).join("")):""}
    ${s.taxi.length?sect(`Taxi Squad · ${s.taxi.length}/${LIVE.season.max_taxi}`, s.taxi.map(r=>row("TAXI", r, null, false)).join("")):""}`;
};

// ---------- team pages (view only): build2026 adds lineup + bench to each team ----------
const _build2026 = build2026;
build2026 = function(){
  _build2026();
  if(!LIVE.hasLineups) return;
  const wk = LIVE.season.current_week;
  Object.keys(DATA.teams).forEach(n=>{
    const tid = LIVE.teamId[n]; if(!tid) return;
    const s = teamSections(tid, wk), cell = r=>({pos:r.p.pos, name:r.p.name, nfl:r.p.nfl_team, salary:r.salary, contract:r.contract, status:r.status, game:gameCell(r.p, wk)});
    DATA.teams[n].lineup = {week:wk, starters:s.starters.map(x=>({slot:SLOT_LABEL[x.slot], ...(x.r?cell(x.r):{})})), bench:s.bench.map(cell)};
  });
};

// ---------- Matchup Center: both lineups for each game ----------
const _vMatch = window.vMatch;
window.vMatch = function(){
  const html = _vMatch();
  if(!LIVE.hasLineups || !LIVE.m26 || !LIVE.m26.length) return html;
  const weeks = [...new Set(LIVE.m26.map(m=>m.week))].sort((a,b)=>a-b);
  const wk = +(state.week || weeks[0]);
  if(!LIVE.lineups.some(l=>l.week===wk)) return html + `<div class="sm mut2" style="margin-top:12px">Lineups are tracked on the site starting week ${Math.min(...LIVE.lineups.map(l=>l.week).concat([LIVE.season.current_week]))}.</div>`;
  const side = tid=>{ const s = teamSections(tid, wk);
    return `<table>${s.starters.map(x=>`<tr><td class="sm"><b>${SLOT_LABEL[x.slot]}</b></td><td>${x.r?esc(x.r.p.name):'<span class="red sm">Empty</span>'}</td>
      <td class="sm mut">${x.r?x.r.p.nfl_team:""}</td><td class="r sm mut2">–</td></tr>`).join("")}</table>`; };
  const games = LIVE.m26.filter(m=>m.week===wk);
  return html + `<h2>Lineups · Week ${wk}</h2><div class="sub">Player points fill in here once live scoring is connected.</div>
    ${games.map(m=>`<div class="card" style="margin-top:12px"><div class="grid g2">
      <div><h3>${esc(LIVE.teamsById[m.home_team])}</h3>${side(m.home_team)}</div>
      <div><h3>${esc(LIVE.teamsById[m.away_team])}</h3>${side(m.away_team)}</div></div></div>`).join("")}`;
};

// ---------- Front Office: lineup compliance ----------
const _complianceCard = complianceCard;
complianceCard = function(){
  const html = _complianceCard();
  if(!LIVE.hasLineups) return html;
  const wk = LIVE.season.current_week;
  const bad = LIVE.teamRows.map(t=>({t, e:lineupIssues(t.id, wk).empty})).filter(x=>x.e.length).sort((a,b)=>a.t.name.localeCompare(b.t.name));
  const card = `<div class="card" style="margin-top:14px"><h3>Starting Lineups · Week ${wk}</h3>
    ${bad.length?`<table><tr><th>Team</th><th>Empty slots</th></tr>${bad.map(x=>`<tr><td>${esc(x.t.name)}</td><td class="red sm">${x.e.join(", ")}</td></tr>`).join("")}</table>
      <div class="sm mut" style="margin-top:6px">Empty at Sunday 9:55 AM PT = automatic loss (same rule as cap/roster).</div>`
      :`<div class="sm grn">All 12 lineups are complete.</div>`}</div>`;
  return html + card;
};

// ---------- Admin → Lineups (tab added in live.js adminHTML when the lineups table exists) ----------
function adminLineups(){
  const cw = LIVE.season.current_week, wk = +(state.alWeek || cw);
  const tid = +(state.alTeam || LIVE.me.team_id), m = lineupMap(tid, wk);
  const spots = LIVE.roster26.filter(r=>r.team_id===tid).map(r=>({...r, p:LIVE.byId[r.player_id]||{}}));
  const weeks = [...new Set([...LIVE.lineups.map(l=>l.week), cw])].sort((a,b)=>a-b);
  return `<div class="flex" style="margin-bottom:10px;flex-wrap:wrap;gap:8px">
      Team <select onchange="state.alTeam=this.value;render()">${LIVE.teamRows.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<option value="${t.id}" ${t.id===tid?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
      Week <select onchange="state.alWeek=this.value;render()">${weeks.map(w=>`<option ${w===wk?"selected":""}>${w}</option>`).join("")}</select>
      <button class="btn ghost sm" onclick="if(confirm('Fill every team\\'s EMPTY slots for week ${cw} with its highest-salary eligible players?')) adminCall('admin_autofill_lineups',{})">Autofill empty slots (all teams)</button></div>
    <div class="sm mut" style="margin-bottom:8px">Commissioner override: ignores kickoff locks. Use it to fix a lineup or match Yahoo.</div>
    <table><tr><th>Slot</th><th>Player</th><th></th></tr>
    ${SLOTS.map(([slot,lbl])=>{ const opts = spots.filter(s=>slotFits(slot, s.p.pos));
      return `<tr><td><b>${lbl}${slot.match(/\d/)?" "+slot.slice(-1):""}</b></td><td><select id="al_${slot}"><option value="">— empty —</option>${opts.map(s=>`<option value="${s.player_id}" ${m[slot]===s.player_id?"selected":""}>${esc(s.p.name)} · ${s.p.nfl_team}${s.status!=="active"?" · "+s.status.toUpperCase():""}</option>`).join("")}</select></td>
        <td><button class="btn sm" onclick="adminCall('admin_set_lineup',{p_team:${tid},p_week:${wk},p_slot:'${slot}',p_player:$('#al_${slot}').value?+$('#al_${slot}').value:null})">Save</button></td></tr>`; }).join("")}</table>`;
}
