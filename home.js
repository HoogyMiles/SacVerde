// =====================================================================
// SacVerde League Home (redesign 11/2/2026): live scoreboard on top (current week,
// flips to the next week Wednesday 12:00 AM PT), broadcast-style standings in team
// colors, playoff bracket, franchises, 2025 champion at the bottom.
// Loaded after lineups.js. Works without lineups/live scoring (falls back to finals).
// =====================================================================
document.head.insertAdjacentHTML("beforeend", `<style>
.hm-h2{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.hm-h2 .ttl{display:flex;align-items:center;gap:8px}
/* scoreboard */
.sb-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.sb-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s}
.sb-card:hover{border-color:var(--green-dim);transform:translateY(-2px)}
.sb-card.live{border-color:#5a1914;box-shadow:0 0 0 1px #3a100d inset}
.sb-row{display:grid;grid-template-columns:5px 1fr auto;align-items:center;gap:10px;padding:10px 14px 10px 0;border-bottom:1px solid #202024}
.sb-row .stripe{align-self:stretch;background:var(--c)}
.sb-row .nm{font-weight:700;font-size:14.5px;line-height:1.2}
.sb-row .meta{font-size:11.5px;color:var(--mut2);margin-top:2px}
.sb-row .pts{font-family:Anton,Impact,sans-serif;font-size:26px;letter-spacing:.5px;color:var(--mut)}
.sb-row.lead .pts{color:#fff}
.sb-row.lead .nm{color:#fff}
.sb-row.trail .nm{color:var(--mut)}
.sb-row .bonus{font-size:10px;font-weight:800;color:var(--green);margin-left:6px}
.sb-foot{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mut2);background:#111114}
.sb-foot .st{font-weight:800}
.sb-foot .st.live{color:var(--red)} .sb-foot .st.final{color:#fff}
/* standings: broadcast bars */
.st-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(460px,1fr))}
.st-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.st-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:linear-gradient(90deg,var(--dc1,var(--green)),var(--dc2,#7a120d));font-family:Anton,Impact,sans-serif;font-size:23px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dt,#fff);border-bottom:3px solid var(--dt,transparent);text-shadow:var(--ds,0 2px 0 rgba(0,0,0,.5))}
.st-head span:first-child{-webkit-text-stroke:.6px var(--dk,transparent)}
.st-head span:last-child{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;font-size:10px;font-weight:700;opacity:.9;letter-spacing:1px}
.st-row{display:grid;grid-template-columns:46px minmax(0,1fr) 54px 40px 96px 74px 34px;align-items:center;gap:8px;padding:10px 12px 10px 0;border-top:1px solid var(--line);
  border-left:5px solid var(--c);background:linear-gradient(90deg,var(--b) 0%,transparent 58%);cursor:pointer;transition:transform .15s,background-color .15s}
.st-row:hover{transform:translateX(4px);background-color:#18181b}
.st-rk{font-family:Anton,Impact,sans-serif;font-size:28px;line-height:1;color:var(--c);text-align:center}
.st-nm{display:flex;flex-direction:column;gap:4px;align-items:flex-start;min-width:0}
.st-nm b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.st-rec{font-family:Anton,Impact,sans-serif;font-size:24px;text-align:right;letter-spacing:.5px}
.st-div{color:var(--mut);font-size:13px;text-align:right}
.st-pf{font-size:13px;font-weight:700;text-align:right}
.st-pf .pbar{height:4px;background:#26262b;border-radius:2px;margin-top:4px;overflow:hidden}
.st-pf .pbar i{display:block;height:100%;background:var(--c);border-radius:2px}
.st-dots{white-space:nowrap}
.st-dots i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:3px;background:#3a3a40}
.st-dots i.w{background:#2bdc7a} .st-dots i.t{background:#a9a9af}
.st-stk{font-size:12px;font-weight:800;text-align:center}
.st-stk.w{color:#2bdc7a} .st-stk.l{color:var(--red)} .st-stk.t{color:var(--mut)}
.st-key{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11.5px;color:var(--mut2)}
.tg{display:inline-block;font-size:10px;font-weight:800;letter-spacing:1px;padding:2px 7px;border-radius:4px;white-space:nowrap;line-height:1.3}
.tg.bye{background:var(--green);color:#fff} .tg.dw{background:#fff;color:#000} .tg.wc{border:1px solid #fff;color:#fff;padding:1px 6px}
/* playoff bracket */
.br-wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;overflow-x:auto}
.br{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));column-gap:44px;min-width:760px;position:relative}
.br-col{display:flex;flex-direction:column}
.br-rnd{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--mut2);font-weight:800;margin-bottom:10px}
.br-rnd b{color:var(--txt);display:block;font-size:13px;letter-spacing:1px}
.br-games{flex:1;display:flex;flex-direction:column;justify-content:space-around;gap:22px;position:relative}
.br-g{background:var(--panel2);border:1px solid var(--line);border-radius:10px;position:relative}
.br-g .br-t:first-child .stripe{border-top-left-radius:9px}.br-g .br-t:last-child .stripe{border-bottom-left-radius:9px}
.br-t{display:grid;grid-template-columns:5px 26px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 10px 8px 0;min-height:40px}
.br-t + .br-t{border-top:1px solid var(--line)}
.br-t .stripe{align-self:stretch;background:var(--c,#2b2b30)}
.br-t .sd{font-family:Anton,Impact,sans-serif;font-size:16px;color:var(--c,var(--mut2));text-align:center}
.br-t .nm{font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.br-t .nm.tbd{color:var(--mut2);font-weight:600;font-style:italic}
.br-t .sc{font-weight:800;font-size:14px;display:flex;align-items:center;gap:6px}
.br-t .b5{font-size:9.5px;font-weight:800;color:var(--green);border:1px solid var(--green-dim);border-radius:4px;padding:0 4px}
.br-t.won .nm,.br-t.won .sc{color:#fff} .br-t.lost{opacity:.5}
.br-g.bye{border-style:dashed;background:transparent}
.br-g.bye .br-t{min-height:40px}
.br-g.title{border-color:var(--green-dim);box-shadow:0 0 0 1px #3a100d inset}
.br-lbl{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut2);font-weight:800;margin:0 0 6px}
.br-champ{margin-top:10px;text-align:center;font-size:12px;color:var(--mut)}
.br-champ b{font-family:Anton,Impact,sans-serif;font-size:20px;letter-spacing:1px;color:#fff;display:block}
/* connectors: each game after round 1 draws a line back to the game that feeds it */
.br-g.in:before{content:"";position:absolute;left:-23px;top:50%;width:22px;border-top:2px solid #3a3a40}
.br-g.out:after{content:"";position:absolute;right:-23px;top:50%;width:22px;border-top:2px solid #3a3a40}
.br-join{position:absolute;left:-23px;width:0;border-left:2px solid #3a3a40;pointer-events:none}
.br-note{font-size:12px;color:var(--mut2);margin-top:12px}
@media (max-width:600px){
  .st-grid{grid-template-columns:1fr}
  .st-row{grid-template-columns:36px minmax(0,1fr) 46px 64px 30px;padding-right:8px}
  .st-row .st-div,.st-row .st-dots{display:none}
  .st-rk{font-size:22px} .st-rec{font-size:20px}
  .st-head{font-size:19px} .st-head span:last-child{display:none}
  .sb-grid{grid-template-columns:1fr}
}
</style>`);

// ---------- helpers ----------
const HM_ACCENT = {};
function hmColors(name){
  if(HM_ACCENT[name]) return HM_ACCENT[name];
  const a = (typeof TEAM_ART!=="undefined" && TEAM_ART[name]) || null;
  let c = "#ee3a2e", b = "#1c1c1f";
  if(a){ b = a.bg || b;
    const bgm = /background:\s*(#[0-9a-f]{3,6})/i.exec(a.eb||""), cm = /(?:^|;)\s*color:\s*(#[0-9a-f]{3,6})/i.exec(a.eb||"");
    c = (bgm && bgm[1]) || (cm && cm[1]) || c; }
  return HM_ACCENT[name] = {c, b};
}
const hmVars = name=>{ const k = hmColors(name);
  // team image behind the team's row (scoreboard, standings, bracket) once it has one in TEAM_IMG (teams.js)
  const img = typeof TEAM_IMG !== "undefined" && TEAM_IMG[name];
  const pos = (typeof TEAM_IMG_POS!=="undefined"&&TEAM_IMG_POS[name])||"center 40%", y = pos.split(" ")[1]||"40%";
  return `--c:${k.c};--b:${k.b}` + (img ? `;--timg:url('${img}');--tposy:${y}` + ((typeof TEAM_IMG_TINT!=="undefined"&&TEAM_IMG_TINT[name])?`;--tl:${TEAM_IMG_TINT[name][0]};--tr:${TEAM_IMG_TINT[name][1]}`:"") : ""); };
const hmPT = (d, o)=>new Date(d).toLocaleString([], {timeZone:"America/Los_Angeles", ...o});

// Midnight PT at the start of the first Wednesday after time t (handles PST/PDT)
function hmWednesdayAfter(t){
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"numeric",day:"numeric",weekday:"short"})
    .formatToParts(new Date(t)).map(p=>[p.type,p.value]));
  const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday);
  const add = ((3 - wd + 7) % 7) || 7;
  for(const off of [8,7]){ const d = new Date(Date.UTC(+parts.year, +parts.month-1, +parts.day+add, off));
    if(hmPT(d,{hour:"numeric",hour12:false}).replace(/\D/g,"")%24===0) return d; }
  return new Date(Date.UTC(+parts.year, +parts.month-1, +parts.day+add, 8));
}
// The week the Home scoreboard shows: the league's current week, except that last week stays up
// until Wednesday 12:00 AM PT after its final NFL game.
function hmAutoWeek(){
  const m = LIVE.m26||[]; if(!m.length) return null;
  const weeks = [...new Set(m.map(x=>x.week))].filter(w=>w>=1).sort((a,b)=>a-b); if(!weeks.length) return null;
  let cw = LIVE.season.current_week;
  const prev = cw-1, pg = (LIVE.games||[]).filter(g=>g.week===prev);
  if(prev>=1 && pg.length){ const last = Math.max(...pg.map(g=>new Date(g.kickoff_at).getTime()));
    if(Date.now() < hmWednesdayAfter(last).getTime()) cw = prev; }
  if(weeks.includes(cw)) return cw;
  const le = weeks.filter(w=>w<=cw); return le.length ? le[le.length-1] : weeks[0];
}
// Status of one team's starters in a week
function hmSide(tid, wk){
  const out = {pts:null, toPlay:0, playing:0, done:0, firstKo:null, hasLineup:false};
  if(!LIVE.hasLineups || typeof lineupMap!=="function") return out;
  const m = lineupMap(tid, wk), ids = Object.values(m); if(!ids.length) return out;
  out.hasLineup = true; const now = Date.now();
  ids.forEach(pid=>{ const g = gameFor(LIVE.byId[pid], wk); if(!g){ out.done++; return; }
    const t = new Date(g.ko).getTime();
    if(t > now){ out.toPlay++; if(!out.firstKo || t < out.firstKo) out.firstKo = t; }
    else if(now < t + 4*3600e3) out.playing++; else out.done++; });
  if(LIVE.hasScoring) out.pts = teamTotal(tid, wk);
  return out;
}

// ---------- scoreboard ----------
function hmScoreboard(){
  if(SEASON===2025){
    const wk = state.homeWeek || state.week, games = DATA.weeks[wk]||[];
    const opts = Object.keys(DATA.weeks).map(w=>`<option ${+w===+wk?"selected":""} value="${w}">Week ${w}</option>`).join("");
    return `<h2 class="hm-h2"><span class="ttl">Scoreboard</span><select onchange="state.homeWeek=this.value;render()">${opts}</select></h2>
    <div class="sb-grid">${games.map((g,i)=>{ const hw = g.hs>g.as;
      const row = (n,s,lead)=>`<div class="sb-row ${lead?"lead":"trail"}" style="${hmVars(clean(n))}"><span class="stripe"></span><div><div class="nm">${esc(clean(n))}</div></div><div class="pts">${s.toFixed(2)}</div></div>`;
      return `<div class="sb-card" onclick="openMatch('${wk}',${i})">${row(g.home,g.hs,hw)}${row(g.away,g.as,!hw)}<div class="sb-foot"><span class="st final">Final</span><span></span></div></div>`; }).join("")}</div>`;
  }
  const auto = hmAutoWeek(); if(auto==null) return "";
  const weeks = [...new Set(LIVE.m26.map(x=>x.week))].filter(w=>w>=1).sort((a,b)=>a-b);
  const wk = +(state.homeWeek || auto);
  if(LIVE.hasScoring && !LIVE.pts[wk] && !hmLoading[wk]){ hmLoading[wk]=1; loadPoints(wk).then(()=>{ if(state.view==="home") render(); }); }
  if(LIVE.hasLineups && !(LIVE.games||[]).some(g=>g.week===wk) && !hmLoading["g"+wk]){ hmLoading["g"+wk]=1;
    sb.from("nfl_games").select("week,home,away,kickoff_at").eq("season",LIVE.season.year).eq("week",wk).then(r=>{ if(r.data&&r.data.length){ LIVE.games=(LIVE.games||[]).concat(r.data); if(state.view==="home") render(); } }); }
  const games = LIVE.m26.filter(m=>m.week===wk);
  const recOf = n=>{ const t = DATA.teams[n]; return t ? t.info.record.slice(0, +t.info.record[2] ? 3 : 2).join("-") : ""; };
  const anyLive = games.some(m=>{ const a=hmSide(m.home_team,wk), b=hmSide(m.away_team,wk); return a.playing||b.playing; });
  const cards = games.map((m,i)=>{
    const final = m.home_pts!=null && m.away_pts!=null;
    const A = hmSide(m.home_team, wk), B = hmSide(m.away_team, wk);
    const ha = final ? +m.home_pts : A.pts, aa = final ? +m.away_pts : B.pts;
    const live = !final && (A.playing || B.playing);
    const started = A.playing+A.done+B.playing+B.done > 0;
    let status, cls = "";
    if(final){ status = "Final"; cls = "final"; }
    else if(live){ status = `<span class="live-dot"></span>Live`; cls = "live"; }
    else if(!A.hasLineup && !B.hasLineup){ status = "Scheduled"; }
    else if(!started){ const ko = Math.min(...[A.firstKo, B.firstKo].filter(Boolean));
      status = isFinite(ko) ? "Starts "+hmPT(ko,{weekday:"short", hour:"numeric", minute:"2-digit"}) : "Scheduled"; }
    else if(A.toPlay+B.toPlay>0){ status = "In progress"; }
    else { status = "Done · awaiting Yahoo final"; }
    const lead = (ha??0) > (aa??0) ? "h" : (aa??0) > (ha??0) ? "a" : "";
    const show = v=>v==null ? "–" : (+v).toFixed(2);
    const left = s=>final||!s.hasLineup ? "" : s.toPlay ? ` · ${s.toPlay} yet to play` : (s.playing ? ` · ${s.playing} playing` : " · all played");
    const row = (tid, v, s, isLead)=>{ const n = LIVE.teamsById[tid];
      return `<div class="sb-row ${lead?(isLead?"lead":"trail"):""}" style="${hmVars(n)}"><span class="stripe"></span>
        <div><div class="nm">${esc(n)}</div><div class="meta">${recOf(n)}${left(s)}</div></div><div class="pts">${show(v)}</div></div>`; };
    return `<div class="sb-card ${live?"live":""}" onclick="openMatch(${wk},${i})">
      ${row(m.home_team, ha, A, lead==="h")}${row(m.away_team, aa, B, lead==="a")}
      <div class="sb-foot"><span class="st ${cls}">${status}</span><span>${final?"Yahoo":LIVE.hasScoring&&started?"Live · unofficial":""}</span></div></div>`; }).join("");
  const lf = LIVE.lastFetch;
  return `<h2 class="hm-h2"><span class="ttl">${anyLive?'<span class="live-dot"></span>':""}Scoreboard · Week ${wk}${+wk===+auto?' <span class="sub">· this week</span>':""}</span>
    <select onchange="state.homeWeek=this.value;render()">${weeks.map(w=>`<option value="${w}" ${w===wk?"selected":""}>Week ${w}${w===auto?" (this week)":""}</option>`).join("")}</select></h2>
    <div class="sb-grid">${cards}</div>
    <div class="sm mut2" style="margin-top:8px">Live points come from NFL stats on the site and are unofficial. A game shows the Yahoo score once it's entered as final.${anyLive?" Updates every minute.":""}${lf&&lf.done_at&&LIVE.hasScoring?` Last stats update ${hmPT(lf.done_at,{hour:"numeric",minute:"2-digit"})} PT.`:""} Click a game for both lineups.</div>`;
}
const hmLoading = {};

// ---------- standings ----------
// Division banner colors (Hoogs 11/2): [banner, banner shade, lettering]
const HM_DIV = {"Sailgating Syndicate":["#46247A","#2c1450","#FFC72C"], "Trojan Tears":["#2D68C4","#1d4a91","#F2A900"],
                "Da Choads":["#F56600","#c44f00","#522D80"], "Thunderdome":["#00274C","#001a33","#FFCB05"]};
// gold on dark: dark drop shadow + soft glow; purple on orange: light edge so it lifts off the orange
const HM_DIV_FX = {"Da Choads":["0 1px 0 rgba(255,255,255,.55),0 2px 6px rgba(255,255,255,.35)","#3a1d5e"]};
const hmDivStyle = d=>{ const c = HM_DIV[d]; if(!c) return ""; const fx = HM_DIV_FX[d] || [`0 2px 0 rgba(0,0,0,.6),0 0 12px ${c[2]}55`, "rgba(0,0,0,.35)"];
  return `--dc1:${c[0]};--dc2:${c[1]};--dt:${c[2]};--ds:${fx[0]};--dk:${fx[1]}`; };
function hmStandings(){
  const pp = (SEASON>2025 && typeof playoffPicture==="function") ? playoffPicture() : null;
  const seedOf = {}; (pp?pp.seeds:[]).forEach(s=>seedOf[s.team]=s.seed);
  const all = Object.values(DATA.divisions).flat(), maxPf = Math.max(1, ...all.map(x=>+x.pts||0));
  const tag = x=>{ const n = clean(x.team);
    if(SEASON===2025) return x.team.startsWith("x")?'<span class="tg dw">DIV</span>':x.team.startsWith("y")?'<span class="tg wc">WC</span>':"";
    const s = seedOf[n]; if(!s) return "";
    return `<span class="tg ${s<=2?"bye":s<=4?"dw":"wc"}">${s<=2?"BYE":s<=4?"DIV":"WC"} · ${s}</span>`; };
  const form = n=>{ const sc = ((DATA.teams[n]||{}).schedule||[]).filter(g=>g.result);
    const last = sc.slice(-5).map(g=>g.result.toLowerCase());
    let k = 0; const r = sc.length ? sc[sc.length-1].result : ""; for(let i=sc.length-1;i>=0 && sc[i].result===r;i--) k++;
    return {dots: last.map(x=>`<i class="${x}"></i>`).join(""), streak: r ? r+k : "", sk: r.toLowerCase()}; };
  const card = (d, ts)=>`<div class="st-card"><div class="st-head" style="${hmDivStyle(d)}"><span>${esc(d)}</span><span>W-L · DIV · PF · LAST 5</span></div>
    ${ts.map(x=>{ const n = clean(x.team), f = form(n), tie = +x.t ? "-"+x.t : "", dtie = +x.dt ? "-"+x.dt : "";
      return `<div class="st-row" style="${hmVars(n)}" ${tgo(T(n))}><div class="st-rk">${x.rank}</div>
        <div class="st-nm"><b>${esc(n)}</b>${tag(x)}</div>
        <div class="st-rec">${x.w}-${x.l}${tie}</div><div class="st-div">${x.dw}-${x.dl}${dtie}</div>
        <div class="st-pf">${(+x.pts).toFixed(1)}<div class="pbar"><i style="width:${Math.round((+x.pts)/maxPf*100)}%"></i></div></div>
        <div class="st-dots">${f.dots}</div><div class="st-stk ${f.sk}">${f.streak}</div></div>`; }).join("")}</div>`;
  const note = SEASON===2025 ? "2025 final" : (pp ? `${SEASON} season · through week ${pp.week}` : `${SEASON} season`);
  return `<h2>Standings <span class="sub">· ${note}</span></h2>
    <div class="st-grid">${Object.entries(DATA.divisions).map(([d,ts])=>card(d,ts)).join("")}</div>
    <div class="st-key">${SEASON===2025?'<span><span class="tg dw">DIV</span> division winner</span><span><span class="tg wc">WC</span> wildcard</span>'
      :'<span><span class="tg bye">BYE</span> seeds 1–2, first-round bye</span><span><span class="tg dw">DIV</span> division leader</span><span><span class="tg wc">WC</span> wildcard</span><span>Seeds are "if the season ended today."</span>'}</div>`;
}

// ---------- playoff bracket (constitution: 3v6 and 4v5, then 1 v winner(3/6) and 2 v winner(4/5); higher seed +5 in rounds 1–2) ----------
function hmBracket(){
  if(SEASON===2025 || typeof playoffPicture!=="function") return "";
  const pp = playoffPicture(); if(!pp) return "";
  const S = {}; pp.seeds.forEach(s=>S[s.seed]=s.team);
  const po = (LIVE.m26||[]).filter(m=>m.playoff);
  const rounds = [...new Set(po.map(m=>m.week))].sort((a,b)=>a-b);
  const tid = n=>LIVE.teamId[n];
  // a played (final) playoff game between two teams, if any
  const result = (a, b, bonusTo)=>{ if(!a || !b) return null;
    const g = po.find(m=>(m.home_team===tid(a)&&m.away_team===tid(b))||(m.home_team===tid(b)&&m.away_team===tid(a)));
    if(!g) return null; const pa = g.home_team===tid(a) ? g.home_pts : g.away_pts, pb = g.home_team===tid(a) ? g.away_pts : g.home_pts;
    if(pa==null || pb==null) return {pa, pb, winner:null};
    const ea = +pa + (bonusTo===a?5:0), eb = +pb + (bonusTo===b?5:0);
    return {pa:+pa, pb:+pb, winner: ea>eb ? a : eb>ea ? b : null}; };
  const slot = (team, seed, label, sc, bonus, state_)=>`<div class="br-t ${state_||""}" ${team?`style="${hmVars(team)}"`:""}>
      <span class="stripe"></span><span class="sd">${seed||""}</span>
      <span class="nm ${team?"":"tbd"}">${team?esc(team):label}</span>
      <span class="sc">${bonus?'<span class="b5" title="Higher seed gets 5 bonus points">+5</span>':""}${sc!=null?(+sc).toFixed(2):""}</span></div>`;
  const seedOf = n=>{ const s = pp.seeds.find(x=>x.team===n); return s ? s.seed : ""; };
  const game = (a, b, aLbl, bLbl, bonusTo, cls)=>{ const r = result(a, b, bonusTo);
    const st = n=>!r||!r.winner ? "" : r.winner===n ? "won" : "lost";
    return {html:`<div class="br-g ${cls||""}">${slot(a, a?seedOf(a):"", aLbl, r&&r.pa, bonusTo&&bonusTo===a, a&&st(a))}${slot(b, b?seedOf(b):"", bLbl, r&&r.pb, bonusTo&&bonusTo===b, b&&st(b))}</div>`,
      winner: r&&r.winner, loser: r&&r.winner ? (r.winner===a?b:a) : null}; };
  const live = rounds.length>0;
  // Round 1
  const g36 = game(S[3], S[6], "", "", S[3], "out"), g45 = game(S[4], S[5], "", "", S[4], "out");
  // Semifinals: #1 v winner of 3/6, #2 v winner of 4/5
  const w36 = g36.winner, w45 = g45.winner;
  const s1 = game(S[1], w36, "", "Winner 3 / 6", S[1], "in out"), s2 = game(S[2], w45, "", "Winner 4 / 5", S[2], "in out");
  // Final + consolation
  const fin = game(s1.winner, s2.winner, "Semifinal winner", "Semifinal winner", null, "in title");
  const con = game(s1.loser, s2.loser, "Semifinal loser", "Semifinal loser", null, "");
  const wk = i=>rounds[i] ? `Week ${rounds[i]}` : `Week ${15+i}`;
  const champ = fin.winner ? `<div class="br-champ">🏆 ${SEASON} Champion<b>${esc(fin.winner)}</b></div>` : "";
  return `<h2>Playoff Picture <span class="sub">· ${live?"playoffs":"if the season ended after week "+pp.week}</span></h2>
  <div class="br-wrap"><div class="br" id="hmBracket">
    <div class="br-col"><div class="br-rnd">${wk(0)}<b>Wild Card</b></div><div class="br-games">
      <div class="br-g bye">${slot(S[1],1,"",null,false,"")}<div class="br-t"><span class="stripe"></span><span class="sd"></span><span class="nm tbd">First-round bye</span><span></span></div></div>
      ${g36.html}${g45.html}
      <div class="br-g bye">${slot(S[2],2,"",null,false,"")}<div class="br-t"><span class="stripe"></span><span class="sd"></span><span class="nm tbd">First-round bye</span><span></span></div></div>
    </div></div>
    <div class="br-col"><div class="br-rnd">${wk(1)}<b>Semifinals</b></div><div class="br-games">${s1.html}${s2.html}</div></div>
    <div class="br-col"><div class="br-rnd">${wk(2)}<b>Championship</b></div><div class="br-games" style="justify-content:center">
      <div>${fin.html}${champ}</div>
      <div><div class="br-lbl">Consolation game</div>${con.html}</div></div></div>
  </div>
  <div class="br-note">Four division winners and two wildcards. The two division winners with the best records get first-round byes. The higher seed gets <b>+5 bonus points</b> in the first two rounds. No reseeding.</div></div>`;
}
// Draw the vertical joins between rounds after render (positions depend on layout)
function hmJoin(){
  const br = document.getElementById("hmBracket"); if(!br) return;
  br.querySelectorAll(".br-join").forEach(x=>x.remove());
  const cols = br.querySelectorAll(".br-col"), box = br.getBoundingClientRect();
  const mid = el=>{ const r = el.getBoundingClientRect(); return r.top - box.top + r.height/2; };
  const join = (fromEls, toEl)=>{ const ys = fromEls.map(mid).concat([mid(toEl)]), top = Math.min(...ys), bot = Math.max(...ys);
    const x = toEl.getBoundingClientRect().left - box.left - 23 + 0;
    const d = document.createElement("div"); d.className = "br-join"; d.style.cssText = `left:${x}px;top:${top}px;height:${bot-top}px`; br.appendChild(d); };
  const c0 = cols[0].querySelectorAll(".br-g"), c1 = cols[1].querySelectorAll(".br-g"), c2 = cols[2].querySelectorAll(".br-g");
  if(c0.length===4 && c1.length===2){ join([c0[0], c0[1]], c1[0]); join([c0[2], c0[3]], c1[1]); }
  if(c1.length===2 && c2.length){ join([c1[0], c1[1]], c2[0]); }
  // byes feed the semifinal directly
  [c0[0], c0[3]].forEach(b=>b && b.classList.add("out"));
}
new MutationObserver(()=>{ if(document.getElementById("hmBracket")) requestAnimationFrame(hmJoin); }).observe(document.querySelector("main")||document.body, {childList:true});
window.addEventListener("resize", ()=>{ if(document.getElementById("hmBracket")) hmJoin(); });

// ---------- franchises + champion (bottom) ----------
function hmBottom(){
  let high={s:0}; Object.entries(DATA.weeks).forEach(([w,gs])=>gs.forEach(g=>{ if(g.hs>high.s)high={s:g.hs,t:g.home,w}; if(g.as>high.s)high={s:g.as,t:g.away,w}; }));
  const byPts = TEAMS.map(t=>({t,p:+DATA.teams[t].info.pf||0})).sort((a,b)=>b.p-a.p);
  return `<h2>Franchises</h2>
  <div class="teamgrid">${TEAMS.map(t=>{const i=DATA.teams[t].info;return `<div class="tcard" ${tgo(t)}>
    <div class="tn">${esc(t)}</div><div class="sm mut">${rec(t)} · ${i.standing||""} ${i.division?("· "+i.division):""}</div>
    <div class="sm mut2">${(+i.pf||0).toFixed(0)} PF</div></div>`;}).join("")}</div>
  <div class="hero" style="margin-top:26px">
    <div class="champ"><span class="trophy">🏆</span><div>
      <div class="sub">2025 SACVERDE CHAMPION</div>
      <div class="name">Alligator Arms</div>
      <div class="sm mut">def. Juggernauts 112.94 – 86.72 in the Championship</div>
    </div></div>
    ${high.t?`<div class="grid g3" style="min-width:280px">
      <div class="stat"><span class="lbl">${SEASON} Top Single-Week Score</span><span class="big grn">${high.s.toFixed(2)}</span><span class="sm mut">${esc(clean(high.t))} · Week ${high.w}</span></div>
      <div class="stat"><span class="lbl">${SEASON} Most Points For</span><span class="big">${byPts[0].p.toFixed(0)}</span><span class="sm mut">${esc(byPts[0].t)}</span></div>
    </div>`:""}
  </div>`;
}

window.vHome = function(){
  if(!DATA || !DATA.divisions) return "";
  return hmScoreboard() + hmStandings() + hmBracket() + hmBottom();
};

// Refresh live points every minute on Home while games are on
setInterval(async ()=>{
  try{
    if(state.view!=="home" || !LIVE.season || !LIVE.hasScoring || SEASON===2025) return;
    const wk = +(state.homeWeek || hmAutoWeek()); if(!gamesLive(wk)) return;
    const a = document.activeElement; if(a && /SELECT|INPUT|TEXTAREA/.test(a.tagName)) return;
    await loadPoints(wk); render();
  }catch(e){}
}, 60000);
