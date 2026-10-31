// =====================================================================
// SacVerde live layer: login, data loading from Supabase, real Bid Room,
// real Forum, commissioner tools. Loaded after the original view code.
// =====================================================================
const SB_URL = "https://apkzdhweoaeymxynawjx.supabase.co";
const SB_KEY = "sb_publishable_WwwVDil_-GZsM0rW5F0gjg_XE1TWSsp";   // public key, safe in page code
const sb = window.supabase.createClient(SB_URL, SB_KEY);

const LIVE = { me:null, season:null, players:[], byId:{}, roster26:[], bidWeek:null, myBids:{}, revealed:null, forum:[], reacts:[], teamsById:{}, teamId:{}, standings:{} };
const PT = {timeZone:"America/Los_Angeles"};

async function fetchAll(q){            // PostgREST returns max 1000 rows per request
  let out=[], from=0;
  while(true){ const {data,error}=await q().range(from,from+999); if(error) throw error; out=out.concat(data); if(data.length<1000) break; from+=1000; }
  return out;
}
function showErr(e){ state.flash = {bad:true, msg:(e && (e.message||e.error_description)) || String(e)}; render(); }
function flash(msg){ state.flash = {bad:false,msg}; render(); }

// ---------- login ----------
function vLogin(note){
  return `<div class="card" style="max-width:420px;margin:60px auto;text-align:center">
    <h1 style="margin-bottom:6px">SacVerde League</h1>
    <div class="sub" style="margin-bottom:16px">Sign in with the email the league has on file. We'll send you a one-tap login link — no password.</div>
    ${note?`<div class="note">${note}</div>`:""}
    <input type="email" id="loginemail" placeholder="you@email.com" style="width:100%;margin-bottom:10px" onkeydown="if(event.key==='Enter')sendLink()">
    <button class="btn" style="width:100%" onclick="sendLink()">Email me a login link</button>
  </div>`;
}
async function sendLink(){
  const email = ($("#loginemail").value||"").trim().toLowerCase(); if(!email) return;
  const {error} = await sb.auth.signInWithOtp({email, options:{emailRedirectTo: location.origin + location.pathname}});
  $("#app").innerHTML = vLogin(error ? `<b class="red">${esc(error.message)}</b>` : `Check <b>${esc(email)}</b> for your login link. It can take a minute — check spam too.`);
}
async function signOut(){ await sb.auth.signOut(); location.reload(); }

// ---------- data ----------
let ARCH = null, SEASON = 2025;
// Turn live 2026 rows into the shape the original views expect
function build2026(){
  const yr = LIVE.season.year, byId = LIVE.teamsById, divName = {}; LIVE.divs.forEach(d=>divName[d.id]=d.name);
  const teamDiv = {}; LIVE.teamRows.forEach(t=>teamDiv[t.name]=divName[t.division_id]);
  const rec = {}; Object.values(byId).forEach(n=>rec[n]={w:0,l:0,t:0,dw:0,dl:0,dt:0,pf:0,pa:0,sched:[]});
  const weeks = {};
  LIVE.m26.filter(m=>m.home_pts!=null && m.away_pts!=null && !m.playoff).forEach(m=>{
    const h=byId[m.home_team], a=byId[m.away_team], hs=+m.home_pts, as=+m.away_pts;
    (weeks[m.week]=weeks[m.week]||[]).push({home:h, hs, away:a, as});
    [[h,hs,a,as],[a,as,h,hs]].forEach(([me,ms,op,os])=>{
      const r=rec[me], k = ms>os?"w":ms<os?"l":"t"; r[k]++; r.pf+=ms; r.pa+=os;
      if(teamDiv[me]===teamDiv[op]) r["d"+k]++;
      r.sched.push({week:String(m.week), opp:op.toUpperCase(), result:k.toUpperCase(), pf:ms, pa:os});
    });
  });
  const latest = Math.max(-1, ...Object.keys(LIVE.standings).map(Number));
  const rankOf = LIVE.standings[latest] || {};
  const ord = n=>{const s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]);};
  const divisions = {};
  Object.values(byId).forEach(n=>{ const d=teamDiv[n]; (divisions[d]=divisions[d]||[]).push(n); });
  Object.keys(divisions).forEach(d=>{
    divisions[d] = rankGroup(divisions[d].map(n=>LIVE.teamId[n])).map(id=>byId[id])
      .map((n,i)=>({rank:i+1, team:n, w:String(rec[n].w), l:String(rec[n].l), t:String(rec[n].t), dw:String(rec[n].dw), dl:String(rec[n].dl), dt:String(rec[n].dt), pts:rec[n].pf}));
  });
  const teams = {};
  Object.values(byId).forEach(n=>{
    const tid = LIVE.teamId[n], arch = ARCH.DATA.teams[n] || ARCH.DATA.teams[n==="Purple Reign"?"Tritons":n] || {};
    const spots = LIVE.roster26.filter(r=>r.team_id===tid).map(r=>{const p=LIVE.byId[r.player_id]||{};
      return {pos:p.pos, name:p.name, nfl:p.nfl_team, salary:r.salary, contract:r.contract, status:r.status};});
    const gp = rec[n].w+rec[n].l+rec[n].t, owner = LIVE.members.find(m=>m.team_id===tid);
    const divRank = (divisions[teamDiv[n]].find(x=>x.team===n)||{}).rank;
    teams[n] = {
      name:n, roster:spots.filter(x=>x.status==="active"), taxi:spots.filter(x=>x.status==="taxi"), ir:spots.filter(x=>x.status==="ir"),
      schedule:rec[n].sched, transactions:teamTx(n, tid), picks:picksFor(tid),
      info:{owners: owner&&owner.display_name, division:teamDiv[n], record:[String(rec[n].w),String(rec[n].l),String(rec[n].t)],
            div_record:[String(rec[n].dw),String(rec[n].dl),String(rec[n].dt)], pf:rec[n].pf.toFixed(2), pa:rec[n].pa.toFixed(2),
            ppg: gp?(rec[n].pf/gp).toFixed(2):"-", standing: divRank?ord(divRank):""},
      history: (()=>{ const h = {...(arch.history||{})};
        if(h.all_time) h.all_time = [String(+h.all_time[0]+rec[n].w), String(+h.all_time[1]+rec[n].l), String(+(h.all_time[2]||0)+rec[n].t)];
        if(h.all_time_div) h.all_time_div = [String(+h.all_time_div[0]+rec[n].dw), String(+h.all_time_div[1]+rec[n].dl), String(+(h.all_time_div[2]||0)+rec[n].dt)];
        return h; })(),
      total_salary: capInfo(tid).used, taxi_salary: spots.filter(x=>x.status==="taxi").reduce((s,x)=>s+x.salary,0)
    };
  });
  const owner = {}; LIVE.roster26.forEach(r=>owner[r.player_id]=byId[r.team_id]);
  DATA = {teams, divisions, weeks, salary_list: LIVE.players.filter(p=>p.active && p.salary!=null)
            .map(p=>({name:p.name, nfl:p.nfl_team, pos:p.pos, rookie:p.rookie, salary:p.salary, owner:owner[p.id]||null}))};
  TEAMS = Object.keys(teams).sort();
  SEASON = yr;
  const yrs = [...new Set(LIVE.picks.map(p=>String(p.draft_year)))].sort();
  if(yrs.length) PICK_YEARS = yrs.slice(0,2);
  state.week = Math.max(1, ...Object.keys(weeks).map(Number));
}
// Human-readable log lines for a team: sheet history first, then moves made on the site
function teamTx(name, tid){
  const P = id=>(LIVE.byId[id]||{}).name||"a player", T = id=>LIVE.teamsById[id]||"?";
  const line = x=>{ const d=x.details||{}, w=x.week?` (wk ${x.week})`:"";
    switch(x.kind){
      case "add": return `Added ${P(x.player_id)} for $${x.amount}${w}`;
      case "drop": return `Dropped ${P(x.player_id)}${w}`;
      case "forced_drop": return `Penalty drop: ${P(x.player_id)}${w}`;
      case "forfeit": return `Automatic loss — not cap/roster legal at Sunday 9:55am${w}`;
      case "ir_on": return `Moved ${P(x.player_id)} to IR${w}`;
      case "ir_off": return `Activated ${P(x.player_id)} from IR${w}`;
      case "taxi_promote": return `Promoted ${P(x.player_id)} from the taxi squad${w}`;
      case "taxi_add": return `Moved ${P(x.player_id)} to the taxi squad${w}`;
      case "trade_in": return `Acquired ${P(x.player_id)} by trade${w}`;
      case "trade_out": return `Traded ${P(x.player_id)}${w}`;
      case "commissioner_roster": return `Commissioner: ${P(x.player_id)} placed on roster (${d.status||""}, $${x.amount})${w}`;
      case "commissioner_release": return `Commissioner: ${P(x.player_id)} released${w}`;
      default: return null; } };
  const site = (LIVE.tx||[]).filter(x=>x.team_id===tid && x.kind!=="roster_add" && x.kind!=="roster_remove" && x.kind!=="roster_change").map(line).filter(Boolean);
  const sheet = (LIVE.txSheet||{})[name] || [];
  return [...sheet, ...site];
}
// Order a group of teams by the constitution tiebreakers, comparing only the teams in the group:
// overall record -> head-to-head among teams still tied -> division record -> total points
function rankGroup(ids){
  const div = {}; LIVE.teamRows.forEach(t=>div[t.id]=t.division_id);
  const games = LIVE.m26.filter(m=>m.home_pts!=null && m.away_pts!=null && !m.playoff);
  const st = {}; ids.forEach(t=>st[t]={wp:0,gp:0,dwp:0,dgp:0,pf:0});
  const res = (me,op,ms,os)=>{ const r=st[me]; if(!r) return; const w=ms>os?1:ms===os?0.5:0; r.wp+=w; r.gp++; r.pf+=ms; if(div[me]===div[op]){ r.dwp+=w; r.dgp++; } };
  games.forEach(m=>{ res(m.home_team,m.away_team,+m.home_pts,+m.away_pts); res(m.away_team,m.home_team,+m.away_pts,+m.home_pts); });
  const pct = t=>st[t].gp?st[t].wp/st[t].gp:0, dpct = t=>st[t].dgp?st[t].dwp/st[t].dgp:0;
  const h2h = (t, group)=>{ let w=0,g=0; games.forEach(m=>{ const opp = m.home_team===t?m.away_team:m.away_team===t?m.home_team:null;
      if(opp!=null && group.includes(opp)){ const ms=m.home_team===t?+m.home_pts:+m.away_pts, os=m.home_team===t?+m.away_pts:+m.home_pts; w+=ms>os?1:ms===os?0.5:0; g++; } }); return g?w/g:0; };
  const out = [], byPct = {};
  ids.forEach(t=>{ const k=pct(t).toFixed(6); (byPct[k]=byPct[k]||[]).push(t); });
  Object.keys(byPct).sort((a,b)=>b-a).forEach(k=>{ const g=byPct[k];
    out.push(...g.sort((a,b)=>(h2h(b,g)-h2h(a,g)) || (dpct(b)-dpct(a)) || (st[b].pf-st[a].pf) || (a-b))); });
  return out;
}
// Playoff seeding if the season ended today (constitution XI): 4 division winners + 2 wildcards; top 2 division winners get byes
function playoffPicture(){
  const latest = Math.max(...Object.keys(LIVE.standings).map(Number)); if(!(latest>=1)) return null;
  const byDiv = {}; LIVE.teamRows.forEach(t=>(byDiv[t.division_id]=byDiv[t.division_id]||[]).push(t.id));
  const winners = rankGroup(Object.values(byDiv).map(ids=>rankGroup(ids)[0]));
  const wild = rankGroup(LIVE.teamRows.map(t=>t.id).filter(t=>!winners.includes(t))).slice(0,2);
  return {week: latest, seeds:[...winners, ...wild].map((t,i)=>({seed:i+1, team:LIVE.teamsById[t], tag: i<2?"bye":i<4?"division winner":"wildcard"}))};
}
const ORD = n=>n+(["th","st","nd","rd"][(n%100-20)%10]||["th","st","nd","rd"][n%100]||"th");
const pickLabel = (p, owner)=>`${p.draft_year} ${ORD(p.round)}${p.original_team!==owner?` (${LIVE.teamsById[p.original_team]})`:""}`;
function picksFor(tid){
  const out = {}; LIVE.picks.filter(p=>p.owner_team===tid).forEach(p=>{
    (out[p.draft_year]=out[p.draft_year]||[]).push(ORD(p.round)+(p.original_team!==tid?` (${LIVE.teamsById[p.original_team]})`:"")); });
  return out;
}
// Rules: 2026 rule document, with the 2025 version one click away
(function(){ const orig = window.vRules; window.vRules = function(){
  if(typeof RULES_2026_HTML==="undefined" || state.rules2025) return `<div class="flex" style="margin-bottom:8px">${typeof RULES_2026_HTML!=="undefined"?`<button class="btn ghost sm" onclick="state.rules2025=false;render()">← 2026 rules</button>`:""}</div>`+orig();
  return `<h1>League Rules · 2026</h1><div class="sub">From the 2026 rule document. Crossed-out text is left out. <a onclick="state.rules2025=true;render()">View the 2025 version</a></div>`+RULES_2026_HTML;
}; })();
// Matchup Center: real final scores only (player-by-player scoring comes with Yahoo sync)
window.openMatch = function(week, gi){ state.view="match"; state.week=+week; state.gi=gi; render(); window.scrollTo(0,0); };
window.vMatch = function(){
  if(!LIVE.m26 || !LIVE.m26.length) return `<h1>Matchup Center</h1><div class="note">No games loaded yet.</div>`;
  const weeks = [...new Set(LIVE.m26.map(m=>m.week))].sort((a,b)=>a-b);
  const wk = +(state.week || weeks[0]);
  const games = LIVE.m26.filter(m=>m.week===wk);
  const team = id=>esc(LIVE.teamsById[id]);
  return `<h1>Matchup Center</h1>
  <div class="sub">Final scores by week. Live player-by-player scoring arrives with the Yahoo sync.</div>
  <div class="flex" style="margin:12px 0">Week <select onchange="state.week=this.value;render()">${weeks.map(w=>`<option ${w===wk?"selected":""}>${w}</option>`).join("")}</select></div>
  <div class="grid g2">${games.map(m=>{ const done = m.home_pts!=null && m.away_pts!=null, hw = done && +m.home_pts > +m.away_pts, aw = done && +m.away_pts > +m.home_pts;
    return `<div class="card"><div class="spread"><b class="${hw?'grn':''}">${team(m.home_team)}</b><span class="big">${done?(+m.home_pts).toFixed(2):"–"}</span></div>
      <div class="spread"><b class="${aw?'grn':''}">${team(m.away_team)}</b><span class="big">${done?(+m.away_pts).toFixed(2):"–"}</span></div>
      <div class="sm mut2" style="margin-top:6px">${done?"Final":"Not played yet"}</div></div>`; }).join("")}</div>`;
};
(function(){ const orig = window.vHome; window.vHome = function(){
  const html = orig(); const pp = (SEASON>2025) ? playoffPicture() : null; if(!pp) return html;
  const card = `<h2>Playoff Picture <span class="sub">· if the season ended after week ${pp.week}</span></h2>
    <div class="card"><table><tr><th>Seed</th><th>Team</th><th></th></tr>${pp.seeds.map(s=>`<tr><td>${s.seed}</td><td><a ${tgo(s.team)}>${esc(s.team)}</a></td>
      <td><span class="pill ${s.tag==="bye"?"g":s.tag==="wildcard"?"b":"y"}">${s.tag}</span></td></tr>`).join("")}</table>
    <div class="sm mut2" style="margin-top:6px">Four division winners and two wildcards make it. The two division winners with the best records get first-round byes.</div></div>`;
  const i = html.indexOf('<h2 class="spread">Scoreboard'); return i<0 ? html+card : html.slice(0,i)+card+html.slice(i);
}; })();
// Views that show the 2025 archive keep using it
["vHistory","vFinancials","vDraft"].forEach(fn=>{
  const orig = window[fn];
  window[fn] = function(){ if(!ARCH || SEASON===2025) return orig(); const d=DATA, t=TEAMS; DATA=ARCH.DATA; TEAMS=ARCH.TEAMS;
    try{ return orig(); } finally { DATA=d; TEAMS=t; } };
});
async function loadAll(){
  const [{data:mem}, {data:teams}, {data:seasons}, arch, {data:mt}] = await Promise.all([
    sb.from("league_members").select("email,team_id,role,user_id,display_name,phone"),
    sb.from("teams").select("id,name,division_id"),
    sb.from("seasons").select("*"),
    fetchAll(()=>sb.from("season_archive").select("season,kind,key,data").eq("season",2025)),
    sb.from("matchups").select("season,week,home_team,away_team,home_pts,away_pts").eq("season",2025).order("week")
  ]);
  const uid = (await sb.auth.getUser()).data.user.id;
  LIVE.me = (mem||[]).find(m=>m.user_id===uid) || null;
  if(!LIVE.me) return false;
  teams.forEach(t=>{ LIVE.teamsById[t.id]=t.name; LIVE.teamId[t.name]=t.id; });
  LIVE.season = seasons.find(s=>s.is_current);

  // 2025 archive -> the original DATA shape
  DATA = {teams:{}, divisions:{}, weeks:{}, salary_list:[]};
  arch.forEach(a=>{
    if(a.kind==="team_page") DATA.teams[a.key]=a.data;
    if(a.kind==="divisions") DATA.divisions=a.data;
    if(a.kind==="salary_list") DATA.salary_list=a.data;
    if(a.kind==="draft") DRAFT_DATA={"2025":a.data};
  });
  (mt||[]).forEach(m=>{ (DATA.weeks[m.week]=DATA.weeks[m.week]||[]).push({home:LIVE.teamsById[m.home_team], hs:+m.home_pts, away:LIVE.teamsById[m.away_team], as:+m.away_pts}); });
  TEAMS = Object.keys(DATA.teams);
  state.team = LIVE.teamsById[LIVE.me.team_id]; state.bidTeam = state.team; state.forumAs = state.team;

  await loadSeason();
  ARCH = {DATA, TEAMS:[...TEAMS], DRAFT_DATA};
  LIVE.members = mem||[];
  if(LIVE.roster26.length) build2026();
  await loadForum();
  return true;
}
async function loadSeason(){
  const yr = LIVE.season.year;
  const [ps, sal, rs, bw, st] = await Promise.all([
    fetchAll(()=>sb.from("players").select("id,name,pos,nfl_team,rookie,active").order("id")),
    fetchAll(()=>sb.from("player_salaries").select("player_id,list_salary").eq("season",yr).order("player_id")),
    fetchAll(()=>sb.from("roster_spots").select("team_id,player_id,status,salary,contract,acquired_via,acquired_week,ir_since_week").eq("season",yr).order("id")),
    sb.from("bid_weeks").select("*").eq("season",yr).order("week",{ascending:false}),
    fetchAll(()=>sb.from("standings").select("week,team_id,rank").eq("season",yr).order("week"))
  ]);
  const salBy = {}; sal.forEach(s=>salBy[s.player_id]=s.list_salary);
  LIVE.players = ps.map(p=>({...p, salary:salBy[p.id]??null}));
  LIVE.byId = {}; LIVE.players.forEach(p=>LIVE.byId[p.id]=p);
  LIVE.roster26 = rs;
  LIVE.standings = {}; st.forEach(s=>{ (LIVE.standings[s.week]=LIVE.standings[s.week]||{})[s.team_id]=s.rank; });
  const weeks = bw.data||[];
  LIVE.bidWeek = weeks.find(w=>w.status==="open") || null;
  LIVE.lastRevealed = weeks.find(w=>w.status==="revealed") || null;
  LIVE.closedWeek = weeks.find(w=>w.status==="closed") || null;
  LIVE.myBids = {};
  if(LIVE.bidWeek){
    const {data} = await sb.from("bids").select("player_id,amount,updated_at").eq("bid_week_id",LIVE.bidWeek.id).eq("team_id",LIVE.me.team_id);
    (data||[]).forEach(b=>LIVE.myBids[b.player_id]=b);
  }
  const [m26, divs, tms] = await Promise.all([
    sb.from("matchups").select("id,week,home_team,away_team,home_pts,away_pts,playoff").eq("season",yr).order("week").order("id"),
    sb.from("divisions").select("id,name"),
    sb.from("teams").select("id,name,division_id")]);
  LIVE.m26 = m26.data||[]; LIVE.divs = divs.data||[]; LIVE.teamRows = tms.data||[];
  const [tr, ti] = await Promise.all([
    sb.from("trades").select("*").eq("season",yr).order("created_at",{ascending:false}),
    sb.from("trade_items").select("*")]);
  LIVE.trades = tr.data||[]; LIVE.tradeItems = ti.data||[];
  const [txr, txs] = await Promise.all([
    fetchAll(()=>sb.from("transactions").select("id,week,kind,team_id,player_id,amount,details,created_at").eq("season",yr).order("id")),
    sb.from("season_archive").select("key,data").eq("season",yr).eq("kind","team_tx_sheet")]);
  LIVE.tx = txr||[]; LIVE.txSheet = {}; (txs.data||[]).forEach(r=>LIVE.txSheet[r.key]=r.data);
  const [dp, tp] = await Promise.all([
    sb.from("draft_picks").select("id,draft_year,round,original_team,owner_team").order("draft_year").order("round"),
    sb.from("trade_picks").select("*")]);
  LIVE.picks = dp.data||[]; LIVE.tradePicks = tp.data||[];
  const tdl = await sb.rpc("trade_deadline", {p_season: yr}); LIVE.tradeDeadline = tdl.data;
  const comp = await sb.rpc("team_compliance", {p_season: yr});
  LIVE.compliance = comp.data || [];
  const dl = await sb.rpc("compliance_deadline", {p_season: yr, p_week: LIVE.season.current_week});
  LIVE.deadline = dl.data;
  const pen = await sb.from("penalties").select("*").eq("season", yr).order("week", {ascending:false});
  LIVE.penalties = pen.data || [];
  LIVE.revealed = null;
  if(LIVE.lastRevealed){
    const {data} = await sb.from("bid_results").select("*").eq("bid_week_id",LIVE.lastRevealed.id).order("priority");
    LIVE.revealed = data||[];
  }
}
function capInfo(teamId){
  const mine = LIVE.roster26.filter(r=>r.team_id===teamId);
  const active = mine.filter(r=>r.status==="active").reduce((s,r)=>s+r.salary,0);
  const ir = mine.filter(r=>r.status==="ir").reduce((s,r)=>s+r.salary,0);
  const irRelief = mine.filter(r=>r.status==="ir").reduce((s,r)=>s+Math.floor(r.salary/2),0);
  const used = active + ir - irRelief;
  return {used, space: LIVE.season.salary_cap - used, count: mine.filter(r=>r.status==="active").length};
}
const fmtPT = d=>new Date(d).toLocaleString([], {...PT, weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"}) + " PT";

// Priority order for one player's bidders: highest bid; tie -> lower in standings
// (standings after the previous week). Returns sorted list + whether a tie couldn't be broken.
function priorityOrder(bids, week){
  const st = LIVE.standings[week-1] || {};
  let unresolved = false;
  const sorted = [...bids].sort((a,b)=>{
    if(b.amount!==a.amount) return b.amount-a.amount;
    const ra = st[a.team_id], rb = st[b.team_id];
    if(ra==null || rb==null){ unresolved = true; return 0; }
    return rb - ra;                     // bigger rank number = lower in standings = goes first
  });
  return {sorted, unresolved};
}

// ---------- BID ROOM (real) ----------
vBids = function(){
  const w = LIVE.bidWeek, myTeam = LIVE.me.team_id, cap = capInfo(myTeam);
  const rostered = new Set(LIVE.roster26.map(r=>r.player_id));
  const noRosters = LIVE.roster26.length===0;
  const open = w && new Date(w.bids_close_at) > new Date();
  let fas = LIVE.players.filter(p=>p.active && p.salary!=null && !rostered.has(p.id));
  if(state.posF!=="ALL") fas = fas.filter(p=>p.pos===state.posF);
  if(state.search) fas = fas.filter(p=>p.name.toLowerCase().includes(state.search.toLowerCase()));
  fas = fas.sort((a,b)=>b.salary-a.salary || a.name.localeCompare(b.name)).slice(0,60);
  const mine = Object.entries(LIVE.myBids).map(([pid,b])=>({p:LIVE.byId[pid], ...b}));
  const total = mine.reduce((s,b)=>s+b.amount,0);
  return `
  <h1>Tuesday Bid Room</h1>
  <div class="sub">Sealed blind bidding for ${esc(state.team)}. Bids lock at the deadline; nobody — commissioner included — sees them until the reveal.</div>
  ${flashHTML()}
  <div class="tabs">
    <button class="${state.bidTab==='place'?'on':''}" onclick="state.bidTab='place';render()">Place Bids 🔒</button>
    <button class="${state.bidTab==='reveal'?'on':''}" onclick="state.bidTab='reveal';render()">Reveal</button>
    <button class="${state.bidTab==='rules'?'on':''}" onclick="state.bidTab='rules';render()">Process & Rules</button>
  </div>
  ${state.bidTab==='place' ? (!w ? `<div class="note">No bid week is open right now. The commissioner opens each week from the Front Office.</div>` : `
  ${noRosters?`<div class="note"><b>Heads up:</b> 2026 rosters haven't been imported yet, so every player shows as available. Bidding on rostered players is blocked automatically once rosters are loaded.</div>`:""}
  <div class="note"><span class="lock">🔒 SEALED</span>&nbsp; Week ${w.week} bids ${open?`close <b>${fmtPT(w.bids_close_at)}</b>`:`<b class="red">are closed</b>`}. You can change or withdraw a bid any time before then.</div>
  <div class="spread" style="margin:12px 0">
    <div class="flex sm mut">Cap space: <b class="grn">${money(cap.space)}</b> · Roster: <b>${cap.count}/${LIVE.season.roster_size}</b></div>
    <div class="flex sm mut">Total bid: <b class="${total>cap.space?'red':'gold'}">${money(total)}</b>${total>cap.space?' <span class="warn">over cap space — you\'ll need to drop players if you win</span>':""}</div>
  </div>
  ${mine.length?`<div class="card" style="margin-bottom:14px"><h3>Your Sealed Bids · Week ${w.week} (${mine.length})</h3>
    <table><tr><th>Pos</th><th>Player</th><th class="r">Salary</th><th class="r">Your Bid</th><th>Saved</th><th></th></tr>
    ${mine.sort((a,b)=>b.amount-a.amount).map(b=>`<tr><td><span class="pos ${b.p.pos}">${b.p.pos}</span></td><td>${esc(b.p.name)}</td><td class="r">${money(b.p.salary)}</td><td class="r"><b>${money(b.amount)}</b></td><td class="sm mut">${fmtPT(b.updated_at)}</td>
      <td>${open?`<button class="btn ghost sm" onclick="withdrawBid(${b.player_id})">withdraw</button>`:""}</td></tr>`).join("")}
    </table></div>`:""}
  ${open?`
  <div class="searchrow">
    <input type="text" placeholder="Search free agents…" value="${esc(state.search)}" oninput="state.search=this.value;render();this.focus();this.setSelectionRange(this.value.length,this.value.length)">
    <select onchange="state.posF=this.value;render()">${["ALL","QB","RB","WR","TE","K","DST"].map(p=>`<option ${p===state.posF?"selected":""}>${p}</option>`).join("")}</select>
  </div>
  <div class="card"><h3>Free Agents · top 60 by salary (search to find anyone)</h3>
  <table><tr><th>Pos</th><th>Player</th><th>NFL</th><th class="r">Salary</th><th class="r">Min Bid</th><th class="r">Bid</th></tr>
  ${fas.map(p=>{const b=LIVE.myBids[p.id]; const mb=minBid(p.salary);
    return `<tr><td><span class="pos ${p.pos}">${p.pos}</span></td><td>${esc(p.name)}${p.rookie?'<span class="badge">R</span>':""}</td><td class="mut">${p.nfl_team}</td>
    <td class="r">${money(p.salary)}</td><td class="r mut">${money(mb)}</td>
    <td class="r"><input type="number" min="${mb}" step="1" style="width:70px" value="${b?b.amount:""}" placeholder="${mb}" onchange="placeBid(${p.id},this.value)"></td></tr>`;}).join("")}
  </table></div>`:""}
  `) : ""}
  ${state.bidTab==='reveal' ? revealHTML() : ""}
  ${state.bidTab!=='rules' ? complianceBanner(LIVE.me.team_id) + myRosterHTML() : ""}
  ${state.bidTab==='rules' ? bidRulesHTML() : ""}`;
};
async function placeBid(pid, val){
  const amt = parseInt(val,10), w = LIVE.bidWeek;
  if(!amt){ return withdrawBid(pid); }
  const {error} = await sb.from("bids").upsert({bid_week_id:w.id, team_id:LIVE.me.team_id, player_id:pid, amount:amt}, {onConflict:"bid_week_id,team_id,player_id"});
  if(error) return showErr(error);
  await loadSeason(); flash(`Sealed: ${LIVE.byId[pid].name} for ${money(amt)}.`);
}
async function withdrawBid(pid){
  const {error} = await sb.from("bids").delete().eq("bid_week_id",LIVE.bidWeek.id).eq("team_id",LIVE.me.team_id).eq("player_id",pid);
  if(error) return showErr(error);
  await loadSeason(); flash(`Withdrew bid on ${LIVE.byId[pid].name}.`);
}
function revealHTML(){
  const w = LIVE.lastRevealed;
  if(!w) return `<div class="note">No week has been revealed yet.</div>`;
  if(!LIVE.revealed) return `<div class="note">Loading…</div>`;
  const by = {}; LIVE.revealed.forEach(b=>(by[b.player_id]=by[b.player_id]||[]).push(b));
  const now = new Date(), me = LIVE.me.team_id;
  const rostered = new Set(LIVE.roster26.map(r=>r.player_id));
  const t = d=>d?new Date(d).toLocaleString([], {...PT, weekday:"short", hour:"numeric", minute:"2-digit"}):"";
  const winTxt = b=> b.window_end ? (b.priority===1?`until ${t(b.window_end)}`:`${t(b.window_start)} – ${t(b.window_end)}`) : `from ${t(b.open_from)}`;
  const canClaim = b=> b.team_id===me && !rostered.has(b.player_id) && (!b.kickoff_at || now < new Date(b.kickoff_at))
      && ((b.window_start && now >= new Date(b.window_start) && now < new Date(b.window_end)) || now >= new Date(b.open_from));
  const myRoster = LIVE.roster26.filter(r=>r.team_id===me).map(r=>({...r, p:LIVE.byId[r.player_id]})).sort((a,b)=>(POSORD[a.p.pos]||9)-(POSORD[b.p.pos]||9));
  const dropSel = pid=>`<select id="drop_${pid}" class="sm"><option value="">no drop</option>${myRoster.map(r=>`<option value="${r.player_id}">drop ${esc(r.p.name)} (${money(r.salary)})</option>`).join("")}</select>`;
  const cards = Object.entries(by).map(([pid,rows])=>({p:LIVE.byId[pid], rows, top:rows[0].amount,
      owner: LIVE.roster26.find(r=>r.player_id===+pid)})).sort((a,b)=>b.top-a.top);
  return `<div class="note">Week ${w.week} reveal · bids closed ${fmtPT(w.bids_close_at)}. Priority = highest bid; ties go to the team lower in the standings. Only teams that bid on a player can add him, at their own bid. Thursday-game players use the Thursday 12pm / 4pm windows. All times PT.</div>
  ${flashHTML()}
  <div class="grid g2">${cards.map(c=>`<div class="card">
    <div class="spread"><div><span class="pos ${c.p.pos}">${c.p.pos}</span> <b>${esc(c.p.name)}</b> <span class="sm mut">${c.p.nfl_team} · list ${money(c.p.salary)}</span></div>
      ${c.owner?`<span class="pill g">ADDED: ${esc(LIVE.teamsById[c.owner.team_id])} · ${money(c.owner.salary)}</span>`:""}</div>
    <table style="margin-top:8px">${c.rows.map(b=>`<tr><td>${b.priority<=3?`<span class="pill ${b.priority===1?'g':'b'}">#${b.priority}</span>`:`<span class="sm mut2">#${b.priority}</span>`}</td>
      <td>${esc(LIVE.teamsById[b.team_id])}</td><td class="r"><b>${money(b.amount)}</b></td><td class="sm mut">${winTxt(b)}</td></tr>
      ${canClaim(b)?`<tr><td></td><td colspan="3"><div class="flex">${dropSel(b.player_id)} <button class="btn sm" onclick="claim(${w.id},${b.player_id})">Add ${esc(c.p.name)} for ${money(b.amount)}</button></div></td></tr>`:""}`).join("")}
    </table>
    ${!c.owner && c.rows[0].kickoff_at?`<div class="sm mut2" style="margin-top:6px">Adds close at kickoff: ${fmtPT(c.rows[0].kickoff_at)}</div>`:""}
  </div>`).join("") || `<div class="note">No bids were placed that week.</div>`}</div>`;
}
async function claim(wid, pid){
  const d = $("#drop_"+pid), drop = d && d.value ? +d.value : null;
  const {data, error} = await sb.rpc("claim_player", {p_week_id:wid, p_player:pid, p_drop:drop});
  if(error) return showErr(error);
  await loadSeason(); flash(data);
}
async function dropPlayer(pid){
  if(!confirm(`Drop ${LIVE.byId[pid].name}? He becomes a free agent for next week's bidding.`)) return;
  const {data, error} = await sb.rpc("drop_player", {p_player:pid});
  if(error) return showErr(error);
  await loadSeason(); flash(data);
}
function complianceBanner(teamId){
  const c = (LIVE.compliance||[]).find(x=>x.team_id===teamId);
  if(!c || (!c.over_roster && !c.over_cap)) return "";
  const parts = [c.over_roster?`${c.over_roster} player${c.over_roster>1?"s":""} over the ${LIVE.season.roster_size}-man limit`:"", c.over_cap?`$${c.over_cap} over the $${LIVE.season.salary_cap} cap`:""].filter(Boolean).join(" and ");
  const late = LIVE.deadline && new Date() >= new Date(LIVE.deadline);
  return `<div class="note" style="border-color:var(--red)">⚠️ <b>${esc(c.team)}</b> is ${parts}. ${late?`<b class="red">The Sunday 9:55 AM PT deadline has passed.</b>`:`Must be legal by <b>${fmtPT(LIVE.deadline)}</b> or it's an <b>automatic loss</b> for the week and every player added since last Sunday is dropped.`}</div>`;
}
function complianceCard(){
  const bad = (LIVE.compliance||[]).filter(c=>c.over_roster||c.over_cap);
  return `<div class="card"><h3>Roster & Cap Compliance</h3>
    <div class="sm mut" style="margin-bottom:8px">Teams may be over until <b>${LIVE.deadline?fmtPT(LIVE.deadline):"Sunday 9:55 AM PT"}</b>.
      ${LIVE.season.enforce_penalties===false?'<span class="pill b">TEST MODE — penalties are not applied</span>':""}</div>
    ${bad.length?`<table><tr><th>Team</th><th class="r">Active</th><th class="r">Cap used</th><th>Issue</th></tr>${bad.map(c=>`<tr><td>${esc(c.team)}</td><td class="r">${c.active}</td><td class="r">${money(c.cap_used)}</td>
      <td class="red sm">${[c.over_roster?`+${c.over_roster} roster`:"", c.over_cap?`$${c.over_cap} over cap`:""].filter(Boolean).join(" · ")}</td></tr>`).join("")}</table>`
      :`<div class="sm grn">All teams are legal.</div>`}
    ${(LIVE.penalties||[]).length?`<h3 style="margin-top:14px">Penalties</h3><table><tr><th>Wk</th><th>Team</th><th>Penalty</th><th>Forced drops</th>${LIVE.me.role==="commissioner"?"<th>Yahoo</th>":""}</tr>
      ${LIVE.penalties.map(p=>`<tr><td>${p.week}</td><td>${esc(LIVE.teamsById[p.team_id])}</td><td class="red">Automatic loss</td>
        <td class="sm">${(p.dropped||[]).map(d=>esc(d.name)+" ("+money(d.salary)+")").join(", ")||"—"}</td>
        ${LIVE.me.role==="commissioner"?`<td><label class="sm"><input type="checkbox" ${p.applied_in_yahoo?"checked":""} onchange="markYahoo(${p.id},this.checked)"> entered</label></td>`:""}</tr>`).join("")}</table>`:""}
  </div>`;
}
async function markYahoo(id, v){
  const {error} = await sb.from("penalties").update({applied_in_yahoo:v}).eq("id",id);
  if(error) return showErr(error); await loadSeason(); render();
}
function rosterButtons(r){
  const lw = LIVE.season.current_week, nIR = LIVE.roster26.filter(x=>x.team_id===LIVE.me.team_id && x.status==="ir").length;
  const b = (fn,label,title)=>`<button class="btn ghost sm" title="${title||""}" onclick="${fn}(${r.player_id})">${label}</button> `;
  if(r.status==="taxi") return b("promoteTaxi","promote","Move up to your active roster (permanent)");
  if(r.status==="ir"){
    const back = (r.ir_since_week||0) + LIVE.season.ir_min_weeks;
    return lw >= back ? b("activateIR","activate","Return from IR") : `<span class="sm mut2" title="3-week minimum">back wk ${back}</span> `;
  }
  let out = nIR < LIVE.season.max_ir && r.p.nfl_team!=="FA" ? b("placeIR","IR","Move to injured reserve (half salary counts)") : "";
  if(r.p.rookie && r.acquired_via==="fa_bid" && r.acquired_week>=lw) out += b("toTaxi","taxi","Move this new rookie to your taxi squad");
  return out;
}
async function rosterMove(fn, pid, confirmText){
  if(confirmText && !confirm(confirmText)) return;
  const {data, error} = await sb.rpc(fn, {p_player:pid});
  if(error) return showErr(error);
  await loadSeason(); if(LIVE.roster26.length) build2026(); flash(data);
}
const placeIR = pid=>rosterMove("place_on_ir", pid, `Move ${LIVE.byId[pid].name} to IR? He must stay at least ${LIVE.season.ir_min_weeks} weeks.`);
const activateIR = pid=>rosterMove("activate_from_ir", pid);
const promoteTaxi = pid=>rosterMove("promote_from_taxi", pid, `Promote ${LIVE.byId[pid].name}? This is permanent and his salary will count against your cap.`);
const toTaxi = pid=>rosterMove("move_to_taxi", pid);
function myRosterHTML(){
  const me = LIVE.me.team_id, cap = capInfo(me);
  const rows = LIVE.roster26.filter(r=>r.team_id===me).map(r=>({...r, p:LIVE.byId[r.player_id]}))
    .sort((a,b)=>(POSORD[a.p.pos]||9)-(POSORD[b.p.pos]||9) || b.salary-a.salary);
  if(!rows.length) return "";
  return `<div class="card" style="margin-top:14px"><h3>Your ${LIVE.season.year} Roster · ${cap.count}/${LIVE.season.roster_size} active · ${money(cap.used)} of $${LIVE.season.salary_cap}</h3>
    <div style="overflow-x:auto"><table><tr><th>Pos</th><th>Player</th><th>NFL</th><th class="r">Salary</th><th></th></tr>
    ${rows.map(r=>`<tr><td><span class="pos ${r.p.pos}">${r.p.pos}</span></td><td>${esc(r.p.name)}${r.status!=="active"?` <span class="badge">${r.status.toUpperCase()}</span>`:""}</td><td class="mut">${r.p.nfl_team}</td>
      <td class="r">${money(r.salary)}</td><td class="r">${rosterButtons(r)}<button class="btn ghost sm" onclick="dropPlayer(${r.player_id})">drop</button></td></tr>`).join("")}
    </table></div></div>`;
}
function bidRulesHTML(){
  return `<div class="grid g2">
    <div class="card"><h3>Sunday / MNF players</h3><div class="sm" style="line-height:2">
      #1 priority (winning bid) → adds until <b>Friday 9am PT</b><br>#2 priority → <b>Friday 9am – Saturday 9am</b><br>#3 priority → <b>Saturday 9am – Sunday 9am</b><br>
      Sunday 9am on → any team that bid may add, first come first served.</div></div>
    <div class="card"><h3>Thursday night players</h3><div class="sm" style="line-height:2">
      #1 priority → adds until <b>Thursday 12pm PT</b><br>#2 priority → <b>12pm – 4pm Thursday</b><br>4pm to kickoff → any team that bid, first come first served.</div></div>
    <div class="card"><h3>Bid rules (enforced by the site)</h3><div class="sm" style="line-height:2">
      Minimum bid = half the listed salary, rounded to the nearest dollar ($5 → $3).<br>Deadline: <b>Tuesday 9:00pm PT</b>.<br>
      Highest bid wins; tie → team lower in the standings.<br>Only teams that bid on a player that week may add him.<br>Your bid becomes the player's salary.<br>No bids after the free agent deadline (kickoff of the final bye week).</div></div>
  </div>`;
}
function flashHTML(){ const f=state.flash; if(!f) return ""; state.flash=null; return `<div class="note" style="${f.bad?'border-color:var(--red)':''}">${f.bad?'⚠️ ':'✅ '}${esc(f.msg)}</div>`; }

// ---------- MY TEAM: roster moves + trades ----------
function vMyTeam(){
  return `<h1>My Team · ${esc(state.team)}</h1>
  <div class="sub">Roster moves and trades. IR: max ${LIVE.season.max_ir}, ${LIVE.season.ir_min_weeks}-week minimum, half salary counts. Taxi: max ${LIVE.season.max_taxi}, rookies only, off the cap.</div>
  ${flashHTML()}${complianceBanner(LIVE.me.team_id)}${myRosterHTML()}
  <h2>Trades</h2>${tradesHTML()}`;
}
function tradeLine(t){
  const items = LIVE.tradeItems.filter(i=>i.trade_id===t.id);
  const side = team=>{ const ps = items.filter(i=>i.from_team===team).map(i=>{const p=LIVE.byId[i.player_id]||{}; return `${esc(p.name)} <span class="mut2 sm">${p.pos||""}</span>`;});
    const pk = team===t.from_team ? t.picks_from : t.picks_to; if(pk) ps.push(`<span class="sm">${esc(pk)}</span>`);
    (LIVE.tradePicks||[]).filter(x=>x.trade_id===t.id && x.from_team===team).forEach(x=>{ const p=LIVE.picks.find(y=>y.id===x.pick_id);
      if(p) ps.push(`<span class="pill b">${esc(pickLabel(p, team))}</span>`); });
    return ps.join(", ")||"—"; };
  return `<b>${esc(LIVE.teamsById[t.from_team])}</b> send ${side(t.from_team)} <span class="mut">↔</span> <b>${esc(LIVE.teamsById[t.to_team])}</b> send ${side(t.to_team)}
    ${t.note?`<div class="sm mut">“${esc(t.note)}”</div>`:""}${t.commish_note?`<div class="sm mut">Commissioner: ${esc(t.commish_note)}</div>`:""}`;
}
function tradesHTML(){
  const me = LIVE.me.team_id, T = LIVE.trades, isC = LIVE.me.role==="commissioner";
  const pill = st=>`<span class="pill ${st==="approved"?"g":st==="accepted"?"y":"b"}">${st}</span>`;
  const incoming = T.filter(t=>t.to_team===me && t.status==="proposed");
  const mine = T.filter(t=>(t.from_team===me||t.to_team===me) && !(t.to_team===me && t.status==="proposed"));
  const toApprove = isC ? T.filter(t=>t.status==="accepted") : [];
  const others = Object.entries(LIVE.teamsById).filter(([id])=>+id!==me).sort((a,b)=>a[1].localeCompare(b[1]));
  const sel = state.tradeTo || (others[0]&&others[0][0]);
  const listFor = (tid, name)=>LIVE.roster26.filter(r=>r.team_id===+tid).map(r=>({...r,p:LIVE.byId[r.player_id]}))
    .sort((a,b)=>(POSORD[a.p.pos]||9)-(POSORD[b.p.pos]||9)||b.salary-a.salary)
    .map(r=>`<label class="sm" style="display:block;padding:2px 0"><input type="checkbox" name="${name}" value="${r.player_id}"> <span class="pos ${r.p.pos}">${r.p.pos}</span> ${esc(r.p.name)} <span class="mut2">${money(r.salary)}${r.status!=="active"?" · "+r.status.toUpperCase():""}</span></label>`).join("");
  const dl = LIVE.tradeDeadline ? `Trade deadline: <b>${fmtPT(LIVE.tradeDeadline)}</b> (kickoff of week 11).` : "";
  return `
  ${toApprove.length?`<div class="card" style="margin-bottom:14px"><h3>Waiting on your approval (commissioner)</h3>${toApprove.map(t=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)">${tradeLine(t)}
    <div class="flex" style="margin-top:6px"><input type="text" id="cn_${t.id}" placeholder="Note to the league (optional)" style="flex:1">
    <button class="btn sm" onclick="decideTrade(${t.id},true)">Approve</button> <button class="btn ghost sm" onclick="decideTrade(${t.id},false)">Reject</button></div></div>`).join("")}</div>`:""}
  ${incoming.length?`<div class="card" style="margin-bottom:14px"><h3>Offers to you</h3>${incoming.map(t=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)">${tradeLine(t)}
    <div style="margin-top:6px"><button class="btn sm" onclick="respondTrade(${t.id},true)">Accept</button> <button class="btn ghost sm" onclick="respondTrade(${t.id},false)">Decline</button></div></div>`).join("")}</div>`:""}
  <div class="card" style="margin-bottom:14px"><h3>Propose a trade</h3>
    <div class="sm mut" style="margin-bottom:8px">${dl} Accepted trades go to the commissioner for approval. Players added in free agency this week can't be traded until next week (Pair of Juggs).</div>
    <div class="flex" style="margin-bottom:10px">Trade with <select onchange="state.tradeTo=this.value;render()">${others.map(([id,n])=>`<option value="${id}" ${+id===+sel?"selected":""}>${esc(n)}</option>`).join("")}</select></div>
    <div class="grid g2">
      <div><div class="sub" style="margin-bottom:6px">You send</div>${listFor(me,"give")}${pickList(me,"givepk")}</div>
      <div><div class="sub" style="margin-bottom:6px">You get from ${esc(LIVE.teamsById[sel])}</div>${listFor(sel,"get")}${pickList(+sel,"getpk")}</div>
    </div>
    <input type="text" id="tr_note" placeholder="Message (optional)" style="width:100%;margin:10px 0">
    <button class="btn" onclick="proposeTrade(${sel})">Send offer</button>
  </div>
  <div class="card"><h3>Your trades & league trade log</h3>
    ${[...mine, ...T.filter(t=>t.status==="approved" && t.from_team!==me && t.to_team!==me)].map(t=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)">
      ${pill(t.status)} <span class="sm mut2">${fmtPT(t.decided_at||t.responded_at||t.created_at)}</span><div>${tradeLine(t)}</div>
      ${t.from_team===me && ["proposed","accepted"].includes(t.status)?`<button class="btn ghost sm" style="margin-top:4px" onclick="cancelTrade(${t.id})">cancel offer</button>`:""}</div>`).join("") || '<div class="sm mut">No trades yet.</div>'}
  </div>`;
}
function pickList(tid, name){
  const ps = (LIVE.picks||[]).filter(p=>p.owner_team===tid);
  if(!ps.length) return "";
  return `<div class="sub" style="margin:8px 0 4px">Draft picks</div><div style="display:flex;flex-wrap:wrap;gap:4px 12px">${ps.map(p=>
    `<label class="sm"><input type="checkbox" name="${name}" value="${p.id}"> ${esc(pickLabel(p, tid))}</label>`).join("")}</div>`;
}
const checked = name=>[...document.querySelectorAll(`input[name=${name}]:checked`)].map(x=>+x.value);
async function proposeTrade(to){
  const give = checked("give"), get = checked("get");
  const {error} = await sb.rpc("propose_trade", {p_to_team:+to, p_give:give, p_get:get, p_give_picks:checked("givepk"), p_get_picks:checked("getpk"), p_note:$("#tr_note").value});
  if(error) return showErr(error); await loadSeason(); flash(`Offer sent to ${LIVE.teamsById[to]}.`);
}
async function respondTrade(id, ok){ const {data,error} = await sb.rpc("respond_trade", {p_trade:id, p_accept:ok}); if(error) return showErr(error); await loadSeason(); flash(data); }
async function cancelTrade(id){ const {data,error} = await sb.rpc("cancel_trade", {p_trade:id}); if(error) return showErr(error); await loadSeason(); flash(data); }
async function decideTrade(id, ok){
  const note = ($("#cn_"+id)||{}).value||null;
  if(!confirm(ok?"Approve this trade? Rosters update immediately.":"Reject this trade?")) return;
  const {data,error} = await sb.rpc("decide_trade", {p_trade:id, p_approve:ok, p_note:note});
  if(error) return showErr(error); await loadSeason(); if(LIVE.roster26.length) build2026(); flash(data);
}

// ---------- FORUM (real) ----------
async function loadForum(){
  const [{data:m}, {data:r}] = await Promise.all([
    sb.from("forum_messages").select("id,team_id,body,media_url,created_at").order("created_at",{ascending:false}).limit(200),
    sb.from("forum_reactions").select("message_id,team_id,emoji")
  ]);
  LIVE.forum = (m||[]).reverse(); LIVE.reacts = r||[];
}
vForum = function(){
  setTimeout(forumScroll, 0);
  const EMO = ["👍","🔥","😂","💀"], me = LIVE.me.team_id;
  return `<h1>League Forum</h1>
  <div class="sub">The SacVerde group chat. Everyone in the league sees the same thread.</div>
  ${flashHTML()}
  <div class="chatwrap">
    <div class="chatlog" id="chatlog">
      ${LIVE.forum.map(m=>{const who=LIVE.teamsById[m.team_id]; const rx=LIVE.reacts.filter(r=>r.message_id===m.id);
      return `<div class="msg ${m.team_id===me?"me":""}"><div class="av">${esc(initials(who))}</div><div class="bub">
        <div class="who">${esc(who)}</div>${m.body?`<div class="txt">${esc(m.body)}</div>`:""}
        ${m.media_url?mediaHTML({type:/\.(mp4|webm|mov)(\?|$)/i.test(m.media_url)?"vid":"img", src:m.media_url}):""}
        <div class="reactrow">${EMO.map(e=>{const a=rx.filter(r=>r.emoji===e); const on=a.some(r=>r.team_id===me);
          return `<span class="react ${on?"on":""}" title="${esc(a.map(r=>LIVE.teamsById[r.team_id]).join(", "))}" onclick="forumReact2(${m.id},'${e}',${on})">${e}${a.length?" "+a.length:""}</span>`;}).join("")}</div>
        <div class="time">${fmtTime(m.created_at)}</div></div></div>`;}).join("") || '<div class="sm mut" style="padding:20px">No messages yet — start the trash talk.</div>'}
    </div>
    ${state.gifUrl?`<div class="mediaprev"><span>Attached: <b>${esc(state.gifUrl)}</b></span><button class="btn ghost sm" onclick="state.gifUrl=null;render()">✕ remove</button></div>`:""}
    ${state.gifOpen?`<div class="gifpanel"><span class="sm mut">Paste a GIF/image/video link (GIPHY/Tenor: right-click → Copy image address).</span>
      <input type="text" id="gifurl" placeholder="https://media.giphy.com/media/…/giphy.gif" onkeydown="if(event.key==='Enter')forumGif2()"><button class="btn sm" onclick="forumGif2()">Attach</button></div>`:""}
    <div class="composer">
      <button class="icobtn ${state.gifOpen?"on":""}" title="Attach a GIF or link" onclick="state.gifOpen=!state.gifOpen;render()">GIF</button>
      <input type="text" id="chatmsg" placeholder="Message the league as ${esc(state.team)}…" onkeydown="if(event.key==='Enter')forumSend2()">
      <button class="btn" onclick="forumSend2()">Send</button>
    </div>
  </div>
  <div class="sm mut2" style="margin-top:8px">Photo and video uploads are coming next; GIF and media links work now. <a onclick="refreshForum()">↻ refresh</a></div>`;
};
function forumGif2(){ const v=($("#gifurl").value||"").trim(); if(!safeSrc(v)||!/^https?:/i.test(v)) return showErr("Paste a direct http(s) link."); state.gifUrl=v; state.gifOpen=false; render(); }
async function forumSend2(){
  const body = ($("#chatmsg").value||"").trim(); if(!body && !state.gifUrl) return;
  const {error} = await sb.from("forum_messages").insert({team_id:LIVE.me.team_id, body:body||null, media_url:state.gifUrl||null});
  if(error) return showErr(error);
  state.gifUrl=null; await refreshForum();
}
async function forumReact2(id, e, on){
  const q = on ? sb.from("forum_reactions").delete().eq("message_id",id).eq("team_id",LIVE.me.team_id).eq("emoji",e)
               : sb.from("forum_reactions").insert({message_id:id, team_id:LIVE.me.team_id, emoji:e});
  const {error} = await q; if(error) return showErr(error); await refreshForum();
}
async function refreshForum(){ await loadForum(); if(state.view==="forum") render(); }

// ---------- FRONT OFFICE: commissioner tools ----------
const _vOffice = vOffice;
vOffice = function(){
  if(LIVE.me.role!=="commissioner") return complianceCard() + `<div style="margin-top:20px">${_vOffice()}</div>`;
  const nextTue = (()=>{ const d=new Date(); const dow=d.getDay(); d.setDate(d.getDate()+((2-dow+7)%7||7)); d.setHours(21,0,0,0);
    const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T21:00`; })();
  const w = LIVE.bidWeek, c = LIVE.closedWeek;
  return `<h1>Commissioner Tools</h1>${flashHTML()}
  <div class="grid g2">
    <div class="card"><h3>Bid Week</h3>
      ${w?`<div class="sm">Week <b>${w.week}</b> is open · closes <b>${fmtPT(w.bids_close_at)}</b>.</div>
           ${new Date(w.bids_close_at)<=new Date()?`<button class="btn" style="margin-top:10px" onclick="revealWeek(${w.id})">Reveal week ${w.week} bids</button>`:`<div class="sm mut" style="margin-top:8px">The reveal button appears once bids close. You can't see bids before then either.</div>`}`
         :`<div class="sm mut" style="margin-bottom:8px">No week open. The site opens one automatically after each reveal (closing Tuesday 9:00 PM PT). To open one now with a custom deadline:</div>
           <div class="flex">closes <input type="datetime-local" id="bw_close" value="${nextTue}"></div>
           <div class="sm mut2" style="margin:6px 0">Time is in your computer's time zone. The week number is set from the NFL schedule.</div>
           <button class="btn" onclick="openWeek()">Open bidding</button>`}
      <div class="sm mut2" style="margin-top:8px">Reveals happen automatically within 5 minutes of the deadline.</div>
      ${c?`<div class="sm" style="margin-top:10px">Week ${c.week} is closed and waiting: <button class="btn sm" onclick="revealWeek(${c.id})">Reveal</button></div>`:""}
    </div>
    <div class="card"><h3>Season</h3><div class="sm" style="line-height:2">Season <b>${LIVE.season.year}</b> · current week <b>${LIVE.season.current_week}</b> · cap <b>$${LIVE.season.salary_cap}</b><br>
      2026 rosters loaded: <b>${LIVE.roster26.length} players</b>${LIVE.roster26.length?"":" — waiting on the Google Sheet import"}</div></div>
  </div>
  <div style="margin-top:14px">${complianceCard()}</div>
  <h2>Admin</h2>${adminHTML()}
  <div style="margin-top:20px">${_vOffice()}</div>`;
};
async function openWeek(){
  const close = new Date($("#bw_close").value);
  if(isNaN(close)) return showErr("Enter a close time.");
  const {data:week, error} = await sb.rpc("open_bid_week", {p_close:close.toISOString()});
  if(error) return showErr(error); await loadSeason(); flash(`Week ${week} bidding is open until ${fmtPT(close)}.`);
}
async function revealWeek(id){
  const {error} = await sb.rpc("reveal_bid_week", {p_week_id:id});
  if(error) return showErr(error); await loadSeason(); state.view="bids"; state.bidTab="reveal"; render();
}

// ---------- COMMISSIONER ADMIN ----------
const NFL_ABBR = ["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS","FA"];
function adminHTML(){
  const tab = state.adminTab || "results";
  const tabs = [["results","Scores"],["players","Players & Rosters"],["picks","Draft Picks"],["logins","Logins"],["backup","Backup"]];
  return `<div class="tabs">${tabs.map(([k,l])=>`<button class="${tab===k?'on':''}" onclick="state.adminTab='${k}';render()">${l}</button>`).join("")}</div>
  <div class="card">${({results:adminResults, players:adminPlayers, picks:adminPicks, logins:adminLogins, backup:adminBackup})[tab]()}</div>`;
}
async function adminCall(fn, args, after){
  const {data, error} = await sb.rpc(fn, args);
  if(error) return showErr(error);
  await loadSeason(); if(LIVE.roster26.length) build2026(); if(after) after(data);
  flash(typeof data==="string" ? data : "Saved.");
}
function adminResults(){
  const weeks = [...new Set(LIVE.m26.filter(m=>!m.playoff).map(m=>m.week))].sort((a,b)=>a-b);
  const firstOpen = (weeks.find(w=>LIVE.m26.some(m=>m.week===w && (m.home_pts==null||m.away_pts==null))) || weeks[weeks.length-1]);
  const wk = +(state.adminWeek || firstOpen);
  return `<div class="flex" style="margin-bottom:10px">Week <select onchange="state.adminWeek=this.value;render()">${weeks.map(w=>`<option ${w===wk?"selected":""}>${w}</option>`).join("")}</select>
    <span class="sm mut">Enter final scores from Yahoo. Standings (and bid tiebreaks) update when all games for the week are in.</span></div>
  <table><tr><th>Home</th><th class="r">Pts</th><th class="r">Pts</th><th>Away</th><th></th></tr>
  ${LIVE.m26.filter(m=>m.week===wk && !m.playoff).map(m=>`<tr><td>${esc(LIVE.teamsById[m.home_team])}</td>
    <td class="r"><input type="number" step="0.01" id="hs_${m.id}" value="${m.home_pts??""}" style="width:80px"></td>
    <td class="r"><input type="number" step="0.01" id="as_${m.id}" value="${m.away_pts??""}" style="width:80px"></td>
    <td>${esc(LIVE.teamsById[m.away_team])}</td><td><button class="btn sm" onclick="saveScore(${m.id})">Save</button></td></tr>`).join("")}</table>`;
}
function saveScore(id){
  const h = parseFloat($("#hs_"+id).value), a = parseFloat($("#as_"+id).value);
  if(isNaN(h)||isNaN(a)) return showErr("Enter both scores.");
  adminCall("set_score", {p_matchup:id, p_home:h, p_away:a});
}
function adminPlayers(){
  const q = (state.adminQ||"").toLowerCase();
  const hits = q.length<2 ? [] : LIVE.players.filter(p=>p.name.toLowerCase().includes(q)).slice(0,12);
  const teamOpts = sel=>`<option value="">— Free agent —</option>`+Object.entries(LIVE.teamsById).sort((a,b)=>a[1].localeCompare(b[1])).map(([id,n])=>`<option value="${id}" ${+id===sel?"selected":""}>${esc(n)}</option>`).join("");
  return `<input type="text" placeholder="Search any player (2+ letters)…" value="${esc(state.adminQ||"")}" style="width:100%"
      oninput="state.adminQ=this.value;render();const i=document.querySelector('#adminq');i.focus();i.setSelectionRange(i.value.length,i.value.length);" id="adminq">
    ${hits.map(p=>{ const r = LIVE.roster26.find(x=>x.player_id===p.id);
      return `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
      <div><span class="pos ${p.pos}">${p.pos}</span> <b>${esc(p.name)}</b> ${p.active?"":'<span class="pill b">inactive</span>'} ${p.rookie?'<span class="badge">R</span>':""}
        <span class="sm mut">· ${r?esc(LIVE.teamsById[r.team_id])+" · "+r.status+" · $"+r.salary:"free agent"}</span></div>
      <div class="flex sm" style="margin-top:6px;flex-wrap:wrap;gap:6px">
        NFL <select id="nfl_${p.id}">${NFL_ABBR.map(a=>`<option ${a===p.nfl_team?"selected":""}>${a}</option>`).join("")}</select>
        List $<input type="number" id="ls_${p.id}" value="${p.salary??""}" style="width:60px">
        <button class="btn ghost sm" onclick="adminCall('admin_set_player',{p_player:${p.id},p_nfl_team:$('#nfl_${p.id}').value,p_list_salary:+$('#ls_${p.id}').value})">Save player</button>
      </div>
      <div class="flex sm" style="margin-top:6px;flex-wrap:wrap;gap:6px">
        Roster <select id="rt_${p.id}">${teamOpts(r?r.team_id:null)}</select>
        <select id="rs_${p.id}">${["active","ir","taxi"].map(x=>`<option ${r&&r.status===x?"selected":""}>${x}</option>`).join("")}</select>
        Salary $<input type="number" id="rsal_${p.id}" value="${r?r.salary:(p.salary??"")}" style="width:60px">
        Contract <input type="text" id="rc_${p.id}" value="${esc(r&&r.contract||"")}" placeholder="e.g. 2, 4F" style="width:60px">
        <button class="btn sm" onclick="adminRoster(${p.id})">Save roster</button>
      </div></div>`; }).join("")}
    <details style="margin-top:12px"><summary class="sm">Add a player missing from the salary list</summary>
      <div class="flex sm" style="margin-top:8px;flex-wrap:wrap;gap:6px">
        <input type="text" id="np_name" placeholder="Name"> <select id="np_pos">${["QB","RB","WR","TE","K","DST"].map(x=>`<option>${x}</option>`).join("")}</select>
        <select id="np_nfl">${NFL_ABBR.map(a=>`<option>${a}</option>`).join("")}</select> $<input type="number" id="np_sal" value="2" style="width:60px">
        <label><input type="checkbox" id="np_rk"> rookie</label>
        <button class="btn sm" onclick="adminCall('admin_add_player',{p_name:$('#np_name').value,p_pos:$('#np_pos').value,p_nfl_team:$('#np_nfl').value,p_list_salary:+$('#np_sal').value,p_rookie:$('#np_rk').checked})">Add</button>
      </div></details>`;
}
function adminRoster(pid){
  const t = $("#rt_"+pid).value;
  if(!t && !confirm(`Release ${LIVE.byId[pid].name} to free agency?`)) return;
  adminCall("admin_set_roster", {p_player:pid, p_team:t?+t:null, p_status:$("#rs_"+pid).value, p_salary:+$("#rsal_"+pid).value, p_contract:$("#rc_"+pid).value});
}
function adminPicks(){
  const tid = +(state.adminPickTeam || LIVE.me.team_id);
  const teams = Object.entries(LIVE.teamsById).sort((a,b)=>a[1].localeCompare(b[1]));
  const ps = LIVE.picks.filter(p=>p.owner_team===tid);
  return `<div class="flex" style="margin-bottom:10px">Picks owned by <select onchange="state.adminPickTeam=this.value;render()">${teams.map(([id,n])=>`<option value="${id}" ${+id===tid?"selected":""}>${esc(n)}</option>`).join("")}</select></div>
  <table><tr><th>Pick</th><th>Move to</th><th></th></tr>${ps.map(p=>`<tr><td>${esc(pickLabel(p,tid))}</td>
    <td><select id="po_${p.id}">${teams.map(([id,n])=>`<option value="${id}" ${+id===tid?"selected":""}>${esc(n)}</option>`).join("")}</select></td>
    <td><button class="btn ghost sm" onclick="adminCall('admin_set_pick',{p_pick:${p.id},p_owner:+$('#po_${p.id}').value})">Save</button></td></tr>`).join("")}</table>`;
}
function adminLogins(){
  const teams = Object.entries(LIVE.teamsById).sort((a,b)=>a[1].localeCompare(b[1]));
  const opts = sel=>teams.map(([id,n])=>`<option value="${id}" ${+id===sel?"selected":""}>${esc(n)}</option>`).join("");
  return `<div class="sm mut" style="margin-bottom:8px">Each email can sign in and act only for its team. Changes are logged for the league. Someone moved to a different team keeps access only after they sign in again.</div>
  <table><tr><th>Email</th><th>Team</th><th>Name</th><th>Signed in?</th><th></th></tr>
  ${(LIVE.members||[]).sort((a,b)=>(LIVE.teamsById[a.team_id]||"").localeCompare(LIVE.teamsById[b.team_id]||"")).map((m,i)=>`<tr><td class="sm">${esc(m.email)}${m.role==="commissioner"?' <span class="pill g">commish</span>':""}</td>
    <td><select id="mt_${i}">${opts(m.team_id)}</select></td><td><input type="text" id="mn_${i}" value="${esc(m.display_name||"")}" style="width:120px"></td>
    <td class="sm">${m.user_id?"yes":"not yet"}</td>
    <td style="white-space:nowrap"><button class="btn ghost sm" onclick="adminCall('admin_set_member',{p_email:'${esc(m.email)}',p_team:+$('#mt_${i}').value,p_name:$('#mn_${i}').value,p_role:'${m.role}'},reloadMembers)">Save</button>
      ${m.role!=="commissioner"?`<button class="btn ghost sm" onclick="if(confirm('Remove ${esc(m.email)}?'))adminCall('admin_set_member',{p_email:'${esc(m.email)}',p_team:${m.team_id},p_remove:true},reloadMembers)">remove</button>`:""}</td></tr>`).join("")}
  </table>
  <div class="flex sm" style="margin-top:10px;flex-wrap:wrap;gap:6px">Add <input type="email" id="nm_email" placeholder="email"> <select id="nm_team">${opts(null)}</select>
    <input type="text" id="nm_name" placeholder="name"> <button class="btn sm" onclick="adminCall('admin_set_member',{p_email:$('#nm_email').value,p_team:+$('#nm_team').value,p_name:$('#nm_name').value},reloadMembers)">Add login</button></div>`;
}
async function reloadMembers(){ const {data} = await sb.from("league_members").select("email,team_id,role,user_id,display_name,phone"); LIVE.members = data||[]; }
function adminBackup(){
  return `<div class="sm" style="margin-bottom:10px">Downloads everything in the league database as one file: rosters, salaries, picks, results, revealed bids, trades, the transaction log and the forum. Sealed bids for an open week are not included. Save it to your SacVerde folder once a week.</div>
  <button class="btn" onclick="downloadBackup()">Download backup</button>`;
}
async function downloadBackup(){
  const {data, error} = await sb.rpc("admin_export");
  if(error) return showErr(error);
  const blob = new Blob([JSON.stringify(data, null, 1)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `sacverde-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  flash("Backup downloaded.");
}

// ---------- header + boot ----------
const _nav = nav;
nav = function(){ _nav(); if(LIVE.me) $("#nav").insertAdjacentHTML("beforeend",
  `<span class="sm mut" style="margin-left:10px;white-space:nowrap">${esc(state.team)}${LIVE.me.role==="commissioner"?" · commish":""} · <a onclick="signOut()">sign out</a></span>`); };

async function boot(){
  $("#app").innerHTML = `<div class="sub" style="padding:40px;text-align:center">Loading SacVerde…</div>`;
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ $("#nav").innerHTML=""; $("#app").innerHTML = vLogin(); return; }
  try{
    const ok = await loadAll();
    if(!ok){ $("#nav").innerHTML=""; $("#app").innerHTML = vLogin(`That email isn't on the SacVerde league list. Ask the commissioner to add it. <a onclick="signOut()">Sign out</a>`); return; }
    render();
  }catch(e){ $("#app").innerHTML = `<div class="note">Couldn't load league data: ${esc(e.message||e)}</div>`; }
}
sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_IN" && !LIVE.me) boot(); });
boot();
