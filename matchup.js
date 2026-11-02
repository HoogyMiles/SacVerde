// =====================================================================
// SacVerde Matchup Center (11/2/2026): the old Schedule tab now lives here.
// Tabs: Live (current week by default, same Wednesday 12am PT flip as Home) · Schedule ·
// Team Schedules · Playoffs. Loaded after home.js (uses its helpers).
// =====================================================================
document.head.insertAdjacentHTML("beforeend", `<style>
.mc-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:12px 0 16px}
.mc-mini{background:var(--panel);border:1px solid var(--line);border-radius:10px;cursor:pointer;overflow:hidden;transition:border-color .15s}
.mc-mini:hover{border-color:var(--green-dim)} .mc-mini.on{border-color:var(--green);box-shadow:0 0 0 1px var(--green) inset}
.mc-mini .r{display:grid;grid-template-columns:4px minmax(0,1fr) auto;gap:6px;align-items:center;padding:5px 8px 5px 0;font-size:12px}
.mc-mini .r .stripe{align-self:stretch;background:var(--c)}
.mc-mini .r span:nth-child(2){white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.mc-mini .r b{font-size:12.5px} .mc-mini .r.trail{color:var(--mut)}
.mc-mini .f{font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:var(--mut2);padding:3px 8px;background:#111114;font-weight:800}
.mc-mini .f.live{color:var(--red)} .mc-mini .f.final{color:#fff}
.mc-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.mc-team{padding:18px 20px;background:linear-gradient(90deg,var(--b),transparent 85%);border-left:6px solid var(--c);display:flex;flex-direction:column;gap:4px;min-width:0}
.mc-team.away{background:linear-gradient(270deg,var(--b),transparent 85%);border-left:none;border-right:6px solid var(--c);text-align:right;align-items:flex-end}
.mc-team .tn{font-family:Anton,Impact,sans-serif;font-size:26px;letter-spacing:.5px;text-transform:uppercase;line-height:1.05;color:#fff;cursor:pointer}
.mc-team .tm{font-size:12px;color:var(--mut)}
.mc-team .ts{font-family:Anton,Impact,sans-serif;font-size:52px;line-height:1;margin-top:6px;color:var(--mut)}
.mc-team.lead .ts{color:#fff}
.mc-team .ty{font-size:12px;color:var(--mut)}
.mc-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 18px;gap:6px;text-align:center;min-width:120px}
.mc-mid .st{font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}
.mc-mid .st.live{color:var(--red)} .mc-mid .st.final{color:#fff}
.mc-mid .wk{font-size:11px;color:var(--mut2);letter-spacing:1px}
.mc-wp{height:6px;width:100%;background:#2b2b30;border-radius:4px;overflow:hidden;display:flex}
.mc-wp i{display:block;height:100%}
.mc-lu{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-top:12px;overflow:hidden}
.mc-lr{display:grid;grid-template-columns:minmax(0,1fr) 64px 56px 64px minmax(0,1fr);align-items:center;border-top:1px solid #202024;min-height:52px}
.mc-lr:first-child{border-top:none}
.mc-lr.hd{min-height:0;background:#111114;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--mut2);font-weight:800}
.mc-lr.hd > div{padding:8px 12px}
.mc-p{padding:8px 12px;min-width:0}
.mc-p .n{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-p .g{font-size:11.5px;color:var(--mut2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-p.right{text-align:right}
.mc-pt{font-weight:800;font-size:15px;text-align:center}
.mc-pt.up{color:#fff} .mc-pt.dn{color:var(--mut)} .mc-pt.na{color:var(--mut2);font-weight:600}
.mc-slot{text-align:center;font-size:11px;font-weight:800;color:var(--mut2);background:#18181b;align-self:stretch;display:flex;align-items:center;justify-content:center}
.mc-lr.tot{background:#111114;min-height:46px}
.mc-lr.tot .mc-pt{font-family:Anton,Impact,sans-serif;font-size:20px;font-weight:400}
.mc-wk{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
.mc-wk.now{border-color:var(--green-dim)}
.mc-wk .hd{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.mc-wk .hd h3{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:20px;letter-spacing:1px;text-transform:uppercase;margin:0;color:#fff}
.mc-wk .hd .tagx{font-size:10px;font-weight:800;letter-spacing:1px;padding:2px 7px;border-radius:4px;background:#2b2b30;color:#fff;margin-left:8px;vertical-align:middle;font-family:-apple-system,"Segoe UI",Roboto,sans-serif}
.mc-wk .hd .tagx.now{background:var(--green)}
.mc-games{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:8px}
.mc-g{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:8px 12px;background:var(--panel2);border:1px solid var(--line);border-radius:10px;cursor:pointer;position:relative}
.mc-g:hover{border-color:var(--green-dim)} .mc-g.gotw{border-color:var(--green)}
.mc-g .t{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;min-width:0}
.mc-g .t i{width:4px;height:16px;border-radius:2px;background:var(--c);flex:none}
.mc-g .t span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-g .t em{font-style:normal;font-size:11px;color:var(--mut2);font-weight:400}
.mc-g .s{font-weight:800;font-size:14px;text-align:right}
.mc-g .w{color:#fff} .mc-g .l{color:var(--mut2)}
.mc-g .badge2{position:absolute;top:-8px;right:10px;font-size:9px;font-weight:800;letter-spacing:1px;background:var(--green);color:#fff;padding:1px 7px;border-radius:4px}
.mc-ts td{vertical-align:middle}
.mc-ts .res{font-weight:800} .mc-ts .res.w{color:#2bdc7a} .mc-ts .res.l{color:var(--red)}
.mc-ts tr.now td{background:#1d1315}
@media (max-width:900px){ .mc-strip{grid-template-columns:repeat(3,minmax(0,1fr))} }
@media (max-width:600px){
  .mc-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .mc-head{grid-template-columns:1fr 1fr}
  .mc-mid{grid-column:1 / -1;grid-row:2;flex-direction:row;justify-content:space-between;padding:8px 14px;border-top:1px solid var(--line)}
  .mc-mid .mc-wp{width:90px}
  .mc-team{padding:12px} .mc-team .tn{font-size:18px} .mc-team .ts{font-size:34px}
  .mc-lr{grid-template-columns:minmax(0,1fr) 46px 40px 46px minmax(0,1fr)}
  .mc-p{padding:7px 6px} .mc-p .n{font-size:12.5px} .mc-p .g{font-size:10.5px} .mc-pt{font-size:13px}
  .mc-games{grid-template-columns:1fr}
  .mc-lr.tot .mc-pt{font-size:15px} .mc-lr.tot .mc-p b{font-size:11px;color:var(--mut2)}
}
</style>`);

// The Schedule tab moved into Matchup Center
(function(){ const i = VIEWS.findIndex(v=>v[0]==="schedule"); if(i>=0) VIEWS.splice(i,1); })();
const _vMatchPrev = window.vMatch, _vSchedulePrev = window.vSchedule;
window.vSchedule = function(){ state.view = "match"; state.mTab = "sched"; nav(); return vMatch(); };
window.openMatch = function(week, gi){ state.view = "match"; state.mTab = "live"; state.matchWeek = +week; state.mgi = gi; state.week = +week; render(); window.scrollTo(0,0); };

const mcName = id=>LIVE.teamsById[id];
const mcRec = n=>{ const t = DATA.teams[n]; if(!t) return ""; const r = t.info.record; return r[0]+"-"+r[1]+(+r[2]?"-"+r[2]:""); };
const mcFinal = m=>m.home_pts!=null && m.away_pts!=null;
let mcAllGames = null, mcAllLoading = false;
function mcLoadAllGames(){
  if(mcAllGames || mcAllLoading) return; mcAllLoading = true;
  fetchAll(()=>sb.from("nfl_games").select("week,kickoff_at").eq("season",LIVE.season.year).order("week").order("kickoff_at"))
    .then(rows=>{ mcAllGames = {}; rows.forEach(g=>(mcAllGames[g.week]=mcAllGames[g.week]||[]).push(new Date(g.kickoff_at).getTime()));
      if(state.view==="match") render(); }, ()=>{ mcAllGames = {}; });
}
const mcDates = w=>{ const k = (mcAllGames||{})[w]; if(!k||!k.length) return "";
  const f = t=>hmPT(t,{weekday:"short", month:"short", day:"numeric"}); return f(Math.min(...k)) + " – " + f(Math.max(...k)); };

// one game's status for the strip / header
function mcStatus(m, wk){
  const A = hmSide(m.home_team, wk), B = hmSide(m.away_team, wk), fin = mcFinal(m);
  const live = !fin && (A.playing || B.playing), started = A.playing+A.done+B.playing+B.done > 0;
  let label, cls = "";
  if(fin){ label = "Final"; cls = "final"; }
  else if(live){ label = "Live"; cls = "live"; }
  else if(!A.hasLineup && !B.hasLineup) label = "Scheduled";
  else if(!started){ const ko = Math.min(...[A.firstKo, B.firstKo].filter(Boolean)); label = isFinite(ko) ? hmPT(ko,{weekday:"short", hour:"numeric", minute:"2-digit"}) : "Scheduled"; }
  else if(A.toPlay+B.toPlay>0) label = "In progress";
  else label = "Awaiting final";
  const hp = fin ? +m.home_pts : A.pts, ap = fin ? +m.away_pts : B.pts;
  return {A, B, fin, live, started, label, cls, hp, ap};
}

// ---------- Live tab ----------
function mcLive(){
  const weeks = [...new Set(LIVE.m26.map(x=>x.week))].filter(w=>w>=1).sort((a,b)=>a-b);
  const auto = hmAutoWeek(), wk = +(state.matchWeek || auto);
  if(LIVE.hasScoring && !LIVE.pts[wk] && !hmLoading[wk]){ hmLoading[wk]=1; loadPoints(wk).then(()=>{ if(state.view==="match") render(); }); }
  if(LIVE.hasLineups && !(LIVE.games||[]).some(g=>g.week===wk) && !hmLoading["g"+wk]){ hmLoading["g"+wk]=1;
    sb.from("nfl_games").select("week,home,away,kickoff_at").eq("season",LIVE.season.year).eq("week",wk).then(r=>{ if(r.data&&r.data.length){ LIVE.games=(LIVE.games||[]).concat(r.data); if(state.view==="match") render(); } }); }
  const games = LIVE.m26.filter(m=>m.week===wk);
  if(!games.length) return `<div class="note">No games in week ${wk}.</div>`;
  const mine = LIVE.me ? games.findIndex(m=>m.home_team===LIVE.me.team_id || m.away_team===LIVE.me.team_id) : -1;
  let gi = state.mgi!=null && games[state.mgi] ? +state.mgi : (mine>=0 ? mine : 0);
  const st = games.map(m=>mcStatus(m, wk)), anyLive = st.some(s=>s.live);
  const show = v=>v==null ? "–" : (+v).toFixed(2);
  const strip = games.map((m,i)=>{ const s = st[i], hl = (s.hp??0) > (s.ap??0), al = (s.ap??0) > (s.hp??0);
    const r = (id, v, lead, trail)=>`<div class="r ${trail?"trail":""}" style="${hmVars(mcName(id))}"><span class="stripe"></span><span>${esc(mcName(id))}</span><b>${show(v)}</b></div>`;
    return `<div class="mc-mini ${i===gi?"on":""}" onclick="state.mgi=${i};render()">${r(m.home_team, s.hp, hl, al)}${r(m.away_team, s.ap, al, hl)}
      <div class="f ${s.cls}">${s.live?'<span class="live-dot"></span>':""}${s.label}</div></div>`; }).join("");
  const m = games[gi], s = st[gi], hn = mcName(m.home_team), an = mcName(m.away_team);
  const lead = (s.hp??0) > (s.ap??0) ? "h" : (s.ap??0) > (s.hp??0) ? "a" : "";
  const left = x=>!x.hasLineup ? "" : s.fin ? "" : x.toPlay ? `${x.toPlay} yet to play` : x.playing ? `${x.playing} playing` : "all played";
  const siteLine = (id, x)=>s.fin && LIVE.hasScoring && x.hasLineup ? `Site live: ${teamTotal(id, wk).toFixed(2)} (unofficial)` : left(x);
  const tot = (s.hp||0)+(s.ap||0), hw = tot ? Math.round((s.hp||0)/tot*100) : 50;
  const head = `<div class="mc-head">
    <div class="mc-team ${lead==="h"?"lead":""}" style="${hmVars(hn)}"><div class="tn" ${tgo(hn)}>${esc(hn)}</div><div class="tm">${mcRec(hn)}</div>
      <div class="ts">${show(s.hp)}</div><div class="ty">${siteLine(m.home_team, s.A)}</div></div>
    <div class="mc-mid"><div class="st ${s.cls}">${s.live?'<span class="live-dot"></span>':""}${s.fin?"Final · Yahoo":s.label}</div>
      <div class="mc-wp"><i style="width:${hw}%;background:${hmColors(hn).c}"></i><i style="width:${100-hw}%;background:${hmColors(an).c}"></i></div>
      <div class="wk">WEEK ${wk}</div></div>
    <div class="mc-team away ${lead==="a"?"lead":""}" style="${hmVars(an)}"><div class="tn" ${tgo(an)}>${esc(an)}</div><div class="tm">${mcRec(an)}</div>
      <div class="ts">${show(s.ap)}</div><div class="ty">${siteLine(m.away_team, s.B)}</div></div></div>`;
  let lu = "";
  if(LIVE.hasLineups && LIVE.lineups.some(l=>l.week===wk)){
    const H = teamSections(m.home_team, wk).starters, Aw = teamSections(m.away_team, wk).starters;
    const cell = (x, right)=>{ if(!x.r) return `<div class="mc-p ${right?"right":""}"><div class="n red">Empty</div></div>`;
      const p = x.r.p, g = gameFor(p, wk), lv = playerLive(p, wk);
      const gt = p.nfl_team==="FA" ? "no NFL team" : !g ? `${p.nfl_team} · BYE` : `${p.pos} · ${p.nfl_team} ${g.opp} · ${new Date(g.ko).getTime() > Date.now() ? hmPT(g.ko,{weekday:"short", hour:"numeric", minute:"2-digit"}) : lv ? "playing" : "final"}`;
      return `<div class="mc-p ${right?"right":""}"><div class="n">${right?"":(lv?'<span class="live-dot"></span>':"")}${esc(p.name)}${right&&lv?' <span class="live-dot" style="margin:0 0 0 4px"></span>':""}</div><div class="g">${gt}</div></div>`; };
    const pts = x=>x.r && LIVE.hasScoring ? ptsOf(x.r.player_id, wk) : null;
    lu = `<div class="mc-lu"><div class="mc-lr hd"><div>${esc(hn)}</div><div style="text-align:center">Pts</div><div style="text-align:center">Slot</div><div style="text-align:center">Pts</div><div style="text-align:right">${esc(an)}</div></div>
      ${SLOTS.map(([slot,lbl],i)=>{ const a = H[i], b = Aw[i], pa = pts(a), pb = pts(b);
        const c = (v,o)=>v==null?"na":(o!=null&&v>o?"up":o!=null&&v<o?"dn":"");
        return `<div class="mc-lr">${cell(a,false)}<div class="mc-pt ${c(pa,pb)}">${fmtPts(pa)}</div><div class="mc-slot">${lbl}</div><div class="mc-pt ${c(pb,pa)}">${fmtPts(pb)}</div>${cell(b,true)}</div>`; }).join("")}
      ${LIVE.hasScoring?`<div class="mc-lr tot"><div class="mc-p"><b>Site total</b></div><div class="mc-pt">${teamTotal(m.home_team,wk).toFixed(2)}</div><div class="mc-slot">TOT</div><div class="mc-pt">${teamTotal(m.away_team,wk).toFixed(2)}</div><div class="mc-p right"><b>Site total</b></div></div>`:""}</div>`;
  } else if(LIVE.hasLineups){
    lu = `<div class="sm mut2" style="margin-top:12px">Lineups are tracked on the site starting week ${Math.min(...LIVE.lineups.map(l=>l.week).concat([LIVE.season.current_week]))}.</div>`;
  }
  const lf = LIVE.lastFetch;
  return `<div class="spread" style="margin-top:6px"><h2 style="margin:0">${anyLive?'<span class="live-dot"></span>':""}Live Scoring · Week ${wk}${wk===auto?' <span class="sub">· this week</span>':""}</h2>
      <select onchange="state.matchWeek=+this.value;state.mgi=null;render()">${weeks.map(w=>`<option value="${w}" ${w===wk?"selected":""}>Week ${w}${w===auto?" (this week)":""}</option>`).join("")}</select></div>
    <div class="mc-strip">${strip}</div>${head}${lu}
    <div class="sm mut2" style="margin-top:8px">${LIVE.hasScoring?`Live points come from NFL stats on the site (SacVerde scoring) and are unofficial; the Yahoo final is official.${anyLive?" Updates every minute.":""}${lf&&lf.done_at?` Last stats update ${hmPT(lf.done_at,{hour:"numeric",minute:"2-digit"})} PT.`:""}`:"Player points fill in here once live scoring is connected."}</div>`;
}

// ---------- Schedule tab ----------
function mcSchedule(){
  mcLoadAllGames();
  const weeks = [...new Set(LIVE.m26.filter(m=>!m.playoff).map(m=>m.week))].filter(w=>w>=1).sort((a,b)=>a-b);
  const auto = hmAutoWeek(), fw = state.mcSchedWeek || "ALL", ft = state.mcSchedTeam || "ALL";
  const teams = LIVE.teamRows.map(t=>t.name).sort((a,b)=>a.localeCompare(b));
  const div = {}; LIVE.teamRows.forEach(t=>div[t.id]=t.division_id);
  const show = fw==="ALL" ? weeks : [+fw];
  const body = show.map(w=>{
    let games = LIVE.m26.filter(m=>m.week===w && !m.playoff);
    if(ft!=="ALL") games = games.filter(m=>mcName(m.home_team)===ft || mcName(m.away_team)===ft);
    if(!games.length) return "";
    const done = games.every(mcFinal), isNow = w===auto;
    const scores = LIVE.m26.filter(m=>m.week===w && mcFinal(m)).flatMap(m=>[{t:mcName(m.home_team),p:+m.home_pts},{t:mcName(m.away_team),p:+m.away_pts}]).sort((a,b)=>b.p-a.p);
    const gotw = done && games.length>1 ? games.reduce((a,b)=>(+a.home_pts + +a.away_pts) >= (+b.home_pts + +b.away_pts) ? a : b) : null;
    const tag = isNow ? '<span class="tagx now">THIS WEEK</span>' : done ? '<span class="tagx">FINAL</span>' : w<auto ? "" : '<span class="tagx">UPCOMING</span>';
    return `<div class="mc-wk ${isNow?"now":""}"><div class="hd"><h3>Week ${w}${tag}</h3>
      <div class="sm mut">${mcDates(w)}${scores.length?` · High score <b class="grn">${scores[0].p.toFixed(2)}</b> (${esc(scores[0].t)})`:""}</div></div>
      <div class="mc-games">${games.map(m=>{ const s = isNow ? mcStatus(m, w) : {fin:mcFinal(m), hp:mcFinal(m)?+m.home_pts:null, ap:mcFinal(m)?+m.away_pts:null};
        const gi = LIVE.m26.filter(x=>x.week===w).indexOf(m), hn = mcName(m.home_team), an = mcName(m.away_team);
        const hw = s.hp!=null && s.ap!=null && s.hp>s.ap, aw = s.hp!=null && s.ap!=null && s.ap>s.hp;
        const dv = div[m.home_team]===div[m.away_team] ? " · div" : "";
        const sc = v=>v==null ? "" : (+v).toFixed(2);
        return `<div class="mc-g ${m===gotw?"gotw":""}" onclick="openMatch(${w},${gi})">${m===gotw?'<span class="badge2">GAME OF THE WEEK</span>':""}
          <div class="t ${hw?"w":aw?"l":""}" style="${hmVars(hn)}"><i></i><span>${esc(hn)}</span><em>${s.fin||s.started?"":mcRec(hn)}</em></div><div class="s ${hw?"w":aw?"l":""}">${sc(s.hp)}</div>
          <div class="t ${aw?"w":hw?"l":""}" style="${hmVars(an)}"><i></i><span>${esc(an)}</span><em>${s.fin||s.started?"":mcRec(an)}</em></div><div class="s ${aw?"w":hw?"l":""}">${sc(s.ap)}</div>
          <div class="sm mut2" style="grid-column:1/-1;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase">${s.fin?"Final":isNow&&s.live?'<span class="live-dot"></span>Live':isNow&&s.started?"In progress · live "+(s.hp||0).toFixed(2)+" – "+(s.ap||0).toFixed(2):"Scheduled"}${dv}</div></div>`; }).join("")}</div></div>`; }).join("");
  return `<div class="flex" style="margin:6px 0 14px">
      <select onchange="state.mcSchedWeek=this.value;render()"><option value="ALL">All weeks</option>${weeks.map(w=>`<option value="${w}" ${String(w)===String(fw)?"selected":""}>Week ${w}${w===auto?" (this week)":""}</option>`).join("")}</select>
      <select onchange="state.mcSchedTeam=this.value;render()"><option value="ALL">All teams</option>${teams.map(t=>`<option ${t===ft?"selected":""}>${esc(t)}</option>`).join("")}</select></div>
    ${body || '<div class="note">No games match.</div>'}
    <div class="sm mut2">${weeks.length}-week regular season. Playoffs weeks 15–17: see the Playoffs tab.</div>`;
}

// ---------- Team Schedules tab ----------
function mcTeamSched(){
  mcLoadAllGames();
  const teams = LIVE.teamRows.map(t=>t.name).sort((a,b)=>a.localeCompare(b));
  const tn = state.mcTeam || (LIVE.me ? mcName(LIVE.me.team_id) : teams[0]), tid = LIVE.teamId[tn], auto = hmAutoWeek();
  const div = {}; LIVE.teamRows.forEach(t=>div[t.id]=t.division_id);
  const games = LIVE.m26.filter(m=>!m.playoff && m.week>=1 && (m.home_team===tid || m.away_team===tid)).sort((a,b)=>a.week-b.week);
  let w=0,l=0,t=0;
  const rows = games.map(m=>{ const home = m.home_team===tid, opp = home ? m.away_team : m.home_team, on = mcName(opp);
    const my = home ? m.home_pts : m.away_pts, op = home ? m.away_pts : m.home_pts, fin = mcFinal(m);
    let res = ""; if(fin){ if(+my>+op){ w++; res="W"; } else if(+my<+op){ l++; res="L"; } else { t++; res="T"; } }
    const gi = LIVE.m26.filter(x=>x.week===m.week).indexOf(m);
    return `<tr class="${m.week===auto?"now":""}" style="cursor:pointer" onclick="openMatch(${m.week},${gi})"><td><b>${m.week}</b></td><td class="sm mut">${mcDates(m.week)}</td>
      <td><span style="display:inline-block;width:4px;height:14px;border-radius:2px;background:${hmColors(on).c};vertical-align:middle;margin-right:8px"></span>${home?"vs":"@"} <b>${esc(on)}</b>${div[opp]===div[tid]?' <span class="pill b">div</span>':""}</td>
      <td class="res ${res.toLowerCase()}">${res||(m.week===auto?'<span class="sm grn">This week</span>':"")}</td>
      <td class="r">${fin?`${(+my).toFixed(2)} – ${(+op).toFixed(2)}`:""}</td><td class="r mut">${fin?`${w}-${l}${t?"-"+t:""}`:""}</td></tr>`; }).join("");
  return `<div class="flex" style="margin:6px 0 14px">Team <select onchange="state.mcTeam=this.value;render()">${teams.map(x=>`<option ${x===tn?"selected":""}>${esc(x)}</option>`).join("")}</select>
      <a class="sm" ${tgo(tn)}>Team page →</a></div>
    <div class="card" style="border-left:5px solid ${hmColors(tn).c}"><table class="mc-ts"><tr><th>Wk</th><th>Dates</th><th>Opponent</th><th>Result</th><th class="r">Score</th><th class="r">Record</th></tr>${rows}</table></div>`;
}

window.vMatch = function(){
  if(SEASON===2025 || !LIVE.m26 || !LIVE.m26.length){
    const tabs = `<div class="tabs"><button class="${state.mTab!=="sched"?"on":""}" onclick="state.mTab='live';render()">Matchups</button><button class="${state.mTab==="sched"?"on":""}" onclick="state.mTab='sched';render()">Schedule</button></div>`;
    return tabs + (state.mTab==="sched" ? _vSchedulePrev() : _vMatchPrev());
  }
  const tab = state.mTab || "live", auto = hmAutoWeek();
  const T_ = [["live",`Live · Week ${state.matchWeek||auto}`],["sched","Schedule"],["team","Team Schedules"],["playoffs","Playoffs"]];
  const body = tab==="sched" ? mcSchedule() : tab==="team" ? mcTeamSched() : tab==="playoffs" ? (hmBracket() || '<div class="note">The playoff picture appears once week 1 is final.</div>') : mcLive();
  return `<h1>Matchup Center</h1>
    <div class="tabs">${T_.map(([k,l])=>`<button class="${tab===k?"on":""}" onclick="state.mTab='${k}';render()">${l}</button>`).join("")}</div>${body}`;
};

// Refresh live points every minute while games are on (Live and Schedule tabs)
setInterval(async ()=>{
  try{
    if(state.view!=="match" || !LIVE.season || !LIVE.hasScoring || SEASON===2025 || !["live","sched",undefined].includes(state.mTab)) return;
    const wk = state.mTab==="sched" ? hmAutoWeek() : +(state.matchWeek || hmAutoWeek()); if(!gamesLive(wk)) return;
    const a = document.activeElement; if(a && /SELECT|INPUT|TEXTAREA/.test(a.tagName)) return;
    await loadPoints(wk); render();
  }catch(e){}
}, 60000);
