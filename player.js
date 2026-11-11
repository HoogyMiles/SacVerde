// =====================================================================
// SacVerde player cards + Salary List search (11/2/2026).
// Stats come from /player_stats.json (nflverse, built daily by tools/player_stats.py).
// Click a player name (Salary List, My Team, team pages, Bid Room) to open the card.
// Loaded after forum.js.
// =====================================================================
document.head.insertAdjacentHTML("beforeend", `<style>
a.pl{color:inherit;cursor:pointer;text-decoration:none;border-bottom:1px dotted rgba(255,255,255,.25)}
a.pl:hover{color:#fff;border-bottom-color:var(--green)}
/* salary list */
.sl-top{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 10px}
.sl-search{position:relative;flex:1 1 320px}
.sl-search input{width:100%;padding:12px 40px 12px 40px;font-size:15px;border-radius:10px;background:var(--panel);border:1px solid var(--line);color:#fff}
.sl-search input:focus{outline:none;border-color:var(--green)}
.sl-search .ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--mut2);font-size:15px;pointer-events:none}
.sl-search .x{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--mut2);font-size:16px;cursor:pointer;padding:4px 8px}
.sl-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.sl-chip{background:var(--panel2);border:1px solid var(--line);color:var(--mut);padding:6px 12px;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer;user-select:none}
.sl-chip.on{background:var(--green);border-color:var(--green);color:#fff}
.sl-chip.sep{background:none;border:none;padding:6px 2px;cursor:default;color:var(--line)}
.sl-more{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--mut)}
.sl-more input[type=number]{width:64px;padding:6px 8px}
.sl-more select{padding:6px 8px;font-size:13px}
.sl-count{font-size:12px;color:var(--mut2);margin:10px 0 6px}
.sl-tbl th{cursor:pointer;user-select:none;white-space:nowrap} .sl-tbl th.on{color:#fff} .sl-tbl th .ar{font-size:9px;margin-left:3px}
.sl-tbl tr.pr{cursor:pointer} .sl-tbl tr.pr:hover td{background:#18181b}
.sl-tbl .nm{font-weight:700} .sl-tbl .ln{font-size:11.5px;color:var(--mut2);margin-top:1px}
.sl-tbl .own{display:inline-flex;align-items:center;gap:6px} .sl-tbl .own i{width:4px;height:14px;border-radius:2px;background:var(--c);display:inline-block}
.sl-tbl mark{background:#5a1914;color:#fff;border-radius:2px;padding:0 1px}
.sl-hide{display:table-cell}
@media (max-width:700px){ .sl-hide{display:none} .sl-tbl td,.sl-tbl th{padding:7px 5px} }
/* player card */
.pc-back{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:90;animation:pcf .15s}
.pc{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);background:var(--bg);border-left:1px solid var(--line);z-index:91;overflow-y:auto;animation:pcs .2s ease-out;box-shadow:-20px 0 40px rgba(0,0,0,.5)}
@keyframes pcs{from{transform:translateX(40px);opacity:0}} @keyframes pcf{from{opacity:0}}
.pc-hd{position:relative;padding:22px 20px 16px;background:linear-gradient(135deg,var(--b),#0a0a0b 75%);border-bottom:3px solid var(--c)}
.pc-x{position:absolute;right:12px;top:12px;background:rgba(0,0,0,.4);border:1px solid var(--line);color:#fff;border-radius:8px;width:34px;height:34px;font-size:16px;cursor:pointer}
.pc-row{display:flex;gap:14px;align-items:center}
.pc-av{width:64px;height:64px;border-radius:14px;background:linear-gradient(135deg,var(--b),#000);border:2px solid var(--c);color:var(--c);display:flex;align-items:center;justify-content:center;font-family:Anton,Impact,sans-serif;font-size:24px;flex:none}
.pc-nm{font-family:Anton,Impact,sans-serif;font-size:30px;line-height:1.05;letter-spacing:.5px;text-transform:uppercase;color:#fff;padding-right:36px}
.pc-meta{font-size:13px;color:var(--mut);margin-top:3px}
.pc-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.pc-tag{font-size:11px;font-weight:800;letter-spacing:.5px;padding:3px 9px;border-radius:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.pc-tag.own{background:var(--c);color:#000;border-color:var(--c)} .pc-tag.fa{background:#fff;color:#000}
.pc-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.pc-q{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px}
.pc-q .k{font-size:9.5px;letter-spacing:1.2px;color:var(--mut2);font-weight:800;text-transform:uppercase}
.pc-q .v{font-weight:800;font-size:16px;margin-top:2px}
.pc-tabs{display:flex;gap:4px;padding:10px 14px 0;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:2}
.pc-tabs button{background:none;border:none;color:var(--mut);font-weight:700;font-size:13.5px;padding:10px 12px;border-bottom:2px solid transparent;cursor:pointer}
.pc-tabs button.on{color:#fff;border-bottom-color:var(--green)}
.pc-body{padding:16px 18px 40px}
.pc-body h4{font-size:11px;letter-spacing:1.5px;color:var(--mut2);text-transform:uppercase;margin:18px 0 8px}
.pc-body h4:first-child{margin-top:0}
.pc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px}
.pc-tile{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px}
.pc-tile .v{font-family:Anton,Impact,sans-serif;font-size:24px;line-height:1.1;color:#fff}
.pc-tile .k{font-size:10px;letter-spacing:1px;color:var(--mut2);text-transform:uppercase;font-weight:700}
.pc-tbl{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
.pc-tbl table{font-size:12.5px;min-width:100%} .pc-tbl th,.pc-tbl td{padding:6px 8px;white-space:nowrap}
.pc-tbl tr.tot td{font-weight:800;border-top:2px solid var(--line)}
.pc-fact{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #202024;font-size:13.5px;line-height:1.4}
.pc-fact:last-child{border-bottom:none} .pc-fact span:first-child{flex:none;width:22px;text-align:center}
.pc-kv{display:grid;grid-template-columns:130px 1fr;gap:6px 12px;font-size:13.5px} .pc-kv div:nth-child(odd){color:var(--mut2)}
@media (max-width:600px){ .pc-quick{grid-template-columns:repeat(2,1fr)} .pc-nm{font-size:24px} .pc-hd{padding:18px 16px 14px} .pc-body{padding:14px 14px 40px} }
</style>`);

// ---------- data ----------
let PS = null, psLoading = null;
function loadPS(){
  if(PS || psLoading) return psLoading;
  psLoading = fetch("player_stats.json", {cache:"no-cache"}).then(r=>r.ok?r.json():null).then(d=>{ PS = d || {players:{}}; return PS; })
    .catch(()=>{ PS = {players:{}}; return PS; });
  return psLoading;
}
function psFor(p){
  if(!PS || !p || p.pos==="DST") return null;
  const c = PS.players[nflNorm(p.name)+"|"+p.pos]; if(!c || !c.length) return null;
  if(c.length===1) return c[0];
  return c.find(x=>x.t===p.nfl_team) || c.find(x=>x.log && x.log.length) || c[0];
}
const plOwner = pid=>LIVE.roster26.find(r=>r.player_id===pid) || null;
function plFind(arg, pos){
  if(typeof arg==="number") return LIVE.byId[arg] || null;
  const n = nflNorm(arg), m = LIVE.players.filter(p=>nflNorm(p.name)===n && (!pos || p.pos===pos));
  return m.find(p=>p.active) || m[0] || null;
}
// link helper used by the other views
window.plLink = function(name, pos, id){
  const arg = id!=null ? id : `decodeURIComponent('${encodeURIComponent(name)}'),'${pos||""}'`;
  return `<a class="pl" onclick="event.stopPropagation();openPlayer(${arg})">${esc(name)}</a>`;
};

// ---------- stat helpers ----------
const ST = {cmp:"CMP",att:"ATT",py:"PASS YDS",ptd:"PASS TD",int:"INT",car:"CAR",ry:"RUSH YDS",rtd:"RUSH TD",rec:"REC",tgt:"TGT",rcy:"REC YDS",rctd:"REC TD",fl:"FUM LOST",fgm:"FGM",fga:"FGA",fgl:"LONG",xpm:"XPM",xpa:"XPA",fg50:"50+"};
const COLS = {QB:["cmp","att","py","ptd","int","car","ry","rtd","fl"], RB:["car","ry","rtd","rec","tgt","rcy","rctd","fl"], WR:["rec","tgt","rcy","rctd","car","ry","rtd","fl"],
              TE:["rec","tgt","rcy","rctd","fl"], K:["fgm","fga","fgl","fg50","xpm","xpa"]};
const TILES = {QB:["py","ptd","int","ry","rtd"], RB:["ry","rtd","rec","rcy","rctd"], WR:["rec","rcy","rctd","tgt"], TE:["rec","rcy","rctd","tgt"], K:["fgm","fga","fgl","xpm"]};
const fmtN = v=>v==null||v==="" ? "–" : (+v).toLocaleString();
const sumRows = (rows, cols)=>{ const t = {}; cols.forEach(k=>t[k] = k==="fgl" ? Math.max(0,...rows.map(r=>r[k]||0)) : rows.reduce((s,r)=>s+(r[k]||0),0)); return t; };
function ageOf(b){ if(!b) return null; const d = new Date(b+"T12:00:00Z"), n = new Date(); let a = n.getUTCFullYear()-d.getUTCFullYear();
  if(n.getUTCMonth()<d.getUTCMonth() || (n.getUTCMonth()===d.getUTCMonth() && n.getUTCDate()<d.getUTCDate())) a--; return a; }
const htStr = h=>h ? `${Math.floor(h/12)}'${h%12}"` : "–";

// ---------- auto facts ----------
function plFacts(p, s, sv){
  const F = [], add = (ic, t)=>F.push([ic, t]);
  if(s){
    const b = s.bio||{}, car = s.car||[], cols = COLS[p.pos]||[];
    if(b.dy && b.dr) add("🎯", `Drafted in round ${b.dr}${b.dp?`, #${b.dp} overall,`:""} by ${b.dt||"?"} in ${b.dy}.`);
    else if(b.rk) add("💪", `Went undrafted; NFL rookie season ${b.rk}.`);
    if(b.col && b.col.includes(";")){ const cs = b.col.split(";").map(x=>x.trim()); add("🎓", `Played at ${cs.length} colleges, finishing at ${cs[0]} (also ${cs.slice(1).join(", ")}).`); }
    const H = s.hi||{}, hiTxt = {py:"passing yards",ptd:"passing TDs",ry:"rushing yards",rtd:"rushing TDs",rec:"catches",rcy:"receiving yards",rctd:"receiving TDs",fgm:"field goals",fgl:"yard field goal"};
    const order = {QB:["py","ptd","ry"], RB:["ry","rtd","rcy"], WR:["rcy","rec","rctd"], TE:["rcy","rec","rctd"], K:["fgl","fgm"]}[p.pos]||[];
    order.forEach(k=>{ const h = H[k]; if(h && h[0]>0) add("🔥", k==="fgl" ? `Career long: ${h[0]}-yard field goal (${h[3]}, week ${h[2]} ${h[1]}).` : `Career high: ${h[0]} ${hiTxt[k]} in one game (${h[3]}, week ${h[2]} ${h[1]}).`); });
    if(car.length>1){ const main = TILES[p.pos] && TILES[p.pos].find(k=>["py","ry","rcy","fgm"].includes(k));
      if(main){ const best = car.reduce((a,c)=>(c[main]||0)>(a[main]||0)?c:a, car[0]); if(best[main]) add("📈", `Best season: ${best.y} with ${fmtN(best[main])} ${ST[main].toLowerCase()} (${best.t}).`);
        const tot = car.reduce((x,c)=>x+(c[main]||0),0); if(tot) add("🧮", `Career: ${fmtN(tot)} ${ST[main].toLowerCase()} over ${car.reduce((x,c)=>x+c.g,0)} games.`); } }
    const teams = [...new Set(car.map(c=>c.t).filter(Boolean))];
    if(teams.length>2) add("✈️", `Has played for ${teams.length} NFL teams: ${teams.join(", ")}.`);
    else if(teams.length===1 && car.length>=5) add("🏠", `${car.length} seasons, all with ${teams[0]}.`);
    const cur = car.find(c=>c.y===PS.season), main2 = (TILES[p.pos]||[])[0];
    if(cur && cur.g>=3 && main2 && cur[main2]){ const pace = Math.round(cur[main2]/cur.g*17);
      const prevBest = Math.max(0, ...car.filter(c=>c.y<PS.season).map(c=>c[main2]||0));
      add("⏱️", `${PS.season} pace: ${fmtN(pace)} ${ST[main2].toLowerCase()} over 17 games${prevBest && pace>prevBest?" — that would be a career best":""}.`); }
    if(b.b){ const d = new Date(b.b+"T12:00:00Z"), n = new Date(), next = new Date(Date.UTC(n.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      if(next < n) next.setUTCFullYear(n.getUTCFullYear()+1);
      const days = Math.round((next-n)/864e5); if(days<=30) add("🎂", `Turns ${ageOf(b.b)+1} on ${next.toLocaleDateString([], {month:"short", day:"numeric", timeZone:"UTC"})}.`); }
  }
  if(sv){
    if(sv.bidTeams>=3) add("💰", `${sv.bidTeams} SacVerde teams bid on him this season.`);
    if(sv.topBid) add("🏷️", `Highest SacVerde bid this season: $${sv.topBid.amount} by ${LIVE.teamsById[sv.topBid.team_id]} (week ${sv.topBid.week}).`);
    if(sv.teams && sv.teams.length>1) add("🔁", `Has been on ${sv.teams.length} SacVerde teams this season: ${sv.teams.join(", ")}.`);
  }
  return F;
}

// ---------- bid history from the league's Free Agency sheet (season_archive kind 'fa_bids_sheet') ----------
const plNorm = n=>String(n||"").toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g,"").replace(/[^a-z0-9]/g,"");
async function plSheetBids(p){
  if(!window.__faSheet){
    const {data} = await sb.from("season_archive").select("key,data").eq("season", LIVE.season.year).eq("kind","fa_bids_sheet");
    window.__faSheet = (data||[]).map(r=>r.data);
  }
  const ids = {}; Object.entries(LIVE.teamsById||{}).forEach(([id,n])=>ids[n]=+id);
  const k = plNorm(p.name), out = [];
  window.__faSheet.forEach(w=>(w.players||[]).forEach(([name,pos,bids])=>{
    if(plNorm(name)!==k || pos!==p.pos) return;
    bids.forEach(([rk,team,amt])=>{ if(ids[team]) out.push({week:w.week, team_id:ids[team], amount:amt, rank:rk, src:"sheet"}); });
  }));
  return out;
}

// ---------- the card ----------
let PC = null;    // {p, tab, sv, pts}
window.openPlayer = async function(arg, pos){
  const p = plFind(arg, pos); if(!p) return;
  PC = {p, tab:"season", sv:null, pts:null}; drawPC();
  await loadPS(); if(PC && PC.p===p) drawPC();
  const yr = LIVE.season.year;
  const [pw, bids, bw] = await Promise.all([
    LIVE.hasScoring ? sb.from("player_week_stats").select("week,points").eq("season",yr).eq("player_id",p.id) : Promise.resolve({data:[]}),
    sb.from("bids").select("bid_week_id,team_id,amount").eq("player_id",p.id),
    sb.from("bid_weeks").select("id,week,status").eq("season",yr)]);
  if(!PC || PC.p!==p) return;
  const wk = {}; (bw.data||[]).forEach(w=>wk[w.id]=w);
  const sheetBids = await plSheetBids(p);
  const sheetWeeks = new Set((window.__faSheet||[]).map(w=>w.week));
  const revealed = (bids.data||[]).filter(b=>wk[b.bid_week_id] && wk[b.bid_week_id].status==="revealed" && !sheetWeeks.has(wk[b.bid_week_id].week))
    .map(b=>({...b, week:wk[b.bid_week_id].week})).concat(sheetBids);
  const pts = {}; (pw.data||[]).forEach(r=>pts[r.week]=+r.points);
  const tx = (LIVE.tx||[]).filter(x=>x.player_id===p.id);
  const sheet = []; Object.entries(LIVE.txSheet||{}).forEach(([team, lines])=>(lines||[]).forEach(l=>{ if(String(l).includes(p.name)) sheet.push({team, l}); }));
  const teams = [...new Set([...sheet.map(x=>x.team), ...tx.filter(x=>["add","trade_in","commissioner_roster"].includes(x.kind)).map(x=>LIVE.teamsById[x.team_id])].filter(Boolean))];
  const top = revealed.slice().sort((a,b)=>b.amount-a.amount)[0];
  PC.pts = pts; PC.sv = {bids:revealed, bidTeams:new Set(revealed.map(b=>b.team_id)).size, topBid:top, tx, sheet, teams};
  drawPC();
};
window.closePlayer = function(){ PC = null; const el = document.getElementById("pcRoot"); if(el) el.remove(); document.body.style.overflow = ""; };
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && PC) closePlayer(); });

function drawPC(){
  if(!PC) return;
  let root = document.getElementById("pcRoot");
  if(!root){ root = document.createElement("div"); root.id = "pcRoot"; document.body.appendChild(root); document.body.style.overflow = "hidden"; }
  const keep = root.querySelector(".pc") ? root.querySelector(".pc").scrollTop : 0;
  root.innerHTML = `<div class="pc-back" onclick="closePlayer()"></div><div class="pc" role="dialog" aria-label="${esc(PC.p.name)}">${pcHTML()}</div>`;
  root.querySelector(".pc").scrollTop = keep;
}
function pcHTML(){
  const p = PC.p, s = PS ? psFor(p) : null, own = plOwner(p.id), ownName = own ? LIVE.teamsById[own.team_id] : null;
  const col = ownName ? hmColors(ownName) : {c:"#ee3a2e", b:"#241012"};
  const b = (s&&s.bio)||{}, age = ageOf(b.b);
  const minB = typeof minBid==="function" ? minBid(p.salary) : Math.round(p.salary/2);
  const tags = [`<span class="pc-tag">${p.pos}</span>`, `<span class="pc-tag">${esc(p.nfl_team||"FA")}${b.no?" · #"+esc(b.no):""}</span>`,
    p.rookie?'<span class="pc-tag">ROOKIE</span>':"",
    own ? `<span class="pc-tag own">${esc(ownName)}${own.status!=="active"?" · "+own.status.toUpperCase():""}</span>` : '<span class="pc-tag fa">FREE AGENT</span>',
    p.active===false?'<span class="pc-tag">INACTIVE</span>':""].join("");
  const quick = [["List $", money(p.salary)], own ? ["Paid", money(own.salary)] : ["Min bid", money(minB)], ["Age", age??"–"], ["Exp", b.exp!=null ? (b.exp? b.exp+" yr" : "Rookie") : "–"]];
  const T = [["season", `${PS?PS.season:LIVE.season.year}`], ["career","Career"], ["sv","SacVerde"], ["bio","Bio & Facts"]];
  return `<div class="pc-hd" style="--c:${col.c};--b:${col.b}"><button class="pc-x" onclick="closePlayer()" aria-label="Close">✕</button>
    <div class="pc-row"><div class="pc-av">${esc(initials(p.name))}</div><div><div class="pc-nm">${esc(p.name)}</div>
      <div class="pc-meta">${[b.ht?htStr(b.ht):"", b.wt?b.wt+" lb":"", b.col?esc(b.col.split(";")[0].trim()):""].filter(Boolean).join(" · ")}</div></div></div>
    <div class="pc-tags">${tags}</div>
    <div class="pc-quick">${quick.map(([k,v])=>`<div class="pc-q"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div></div>
  <div class="pc-tabs">${T.map(([k,l])=>`<button class="${PC.tab===k?"on":""}" onclick="PC.tab='${k}';drawPC()">${l}</button>`).join("")}</div>
  <div class="pc-body">${!PS ? '<div class="sm mut">Loading stats…</div>' : PC.tab==="career" ? pcCareer(p, s) : PC.tab==="sv" ? pcSV(p, own) : PC.tab==="bio" ? pcBio(p, s) : pcSeason(p, s)}</div>`;
}
const noStats = p=>p.pos==="DST" ? `<div class="note">Team defense stats aren't in the player stats feed yet. SacVerde points still show on the SacVerde tab.</div>` : `<div class="note">No NFL stats found for ${esc(p.name)}. He may not have played a regular-season snap yet.</div>`;
function pcSeason(p, s){
  const yr = PS.season, cols = COLS[p.pos]||[], log = s ? s.log||[] : [], pts = PC.pts||{};
  const cur = s ? (s.car||[]).find(c=>c.y===yr) : null;
  const svWeeks = Object.keys(pts).map(Number);
  if(!s && !svWeeks.length) return noStats(p);
  const tiles = cur ? `<div class="pc-tiles"><div class="pc-tile"><div class="v">${cur.g}</div><div class="k">Games</div></div>${(TILES[p.pos]||[]).map(k=>`<div class="pc-tile"><div class="v">${fmtN(cur[k]||0)}</div><div class="k">${ST[k]}</div></div>`).join("")}
    ${svWeeks.length?`<div class="pc-tile"><div class="v">${svWeeks.reduce((a,w)=>a+pts[w],0).toFixed(1)}</div><div class="k">SacVerde pts</div></div>`:""}</div>` : `<div class="sm mut">No ${yr} regular-season games yet.</div>`;
  const weeks = [...new Set([...log.map(g=>g.w), ...svWeeks])].sort((a,b)=>a-b);
  const rows = weeks.map(w=>{ const g = log.find(x=>x.w===w)||{};
    return `<tr><td><b>${w}</b></td><td class="mut">${g.o||""}</td>${cols.map(k=>`<td class="r">${g.o?fmtN(g[k]||0):""}</td>`).join("")}<td class="r"><b>${pts[w]!=null?pts[w].toFixed(2):"–"}</b></td></tr>`; }).join("");
  return `<h4>${yr} season · regular season</h4>${tiles}
    <h4>Game log</h4>${weeks.length?`<div class="pc-tbl"><table><tr><th>Wk</th><th>Opp</th>${cols.map(k=>`<th class="r">${ST[k]}</th>`).join("")}<th class="r">SV pts</th></tr>${rows}</table></div>
    <div class="sm mut2" style="margin-top:6px">SV pts = SacVerde scoring from the site's live stats (unofficial; Yahoo is official).${svWeeks.length && Math.min(...svWeeks)>1?` Site points start week ${Math.min(...svWeeks)}.`:""}</div>`:'<div class="sm mut">No games yet.</div>'}
    <div class="sm mut2" style="margin-top:10px">NFL stats: nflverse · updated ${esc(PS.updated||"")}</div>`;
}
function pcCareer(p, s){
  if(!s || !(s.car||[]).length) return noStats(p);
  const cols = COLS[p.pos]||[], car = s.car, tot = sumRows(car, cols);
  const H = s.hi||{}, hk = Object.keys(H).filter(k=>(COLS[p.pos]||[]).includes(k) || (p.pos!=="K" && ["ry","rcy","py","ptd","rtd","rctd","rec"].includes(k)));
  return `<h4>Career · regular season</h4><div class="pc-tbl"><table><tr><th>Year</th><th>Team</th><th class="r">G</th>${cols.map(k=>`<th class="r">${ST[k]}</th>`).join("")}</tr>
    ${car.map(c=>`<tr><td><b>${c.y}</b></td><td class="mut">${c.t}</td><td class="r">${c.g}</td>${cols.map(k=>`<td class="r">${fmtN(c[k]||0)}</td>`).join("")}</tr>`).join("")}
    <tr class="tot"><td>Total</td><td></td><td class="r">${car.reduce((a,c)=>a+c.g,0)}</td>${cols.map(k=>`<td class="r">${fmtN(tot[k])}</td>`).join("")}</tr></table></div>
    ${hk.length?`<h4>Single-game career highs</h4><div class="pc-tbl"><table><tr><th>Stat</th><th class="r">Best</th><th>Game</th></tr>
      ${hk.map(k=>`<tr><td>${ST[k]}</td><td class="r"><b>${fmtN(H[k][0])}</b></td><td class="mut">${H[k][3]} · wk ${H[k][2]}, ${H[k][1]}</td></tr>`).join("")}</table></div>
      <div class="sm mut2" style="margin-top:6px">Highs include playoff games. Career table starts in 2005.</div>`:""}`;
}
function pcSV(p, own){
  const sv = PC.sv;
  const status = own ? `<b>${esc(LIVE.teamsById[own.team_id])}</b> · ${own.status==="active"?"active roster":own.status.toUpperCase()} · paid ${money(own.salary)}${own.contract?` · contract year ${own.contract}`:""}` : `<b>Free agent</b> · min bid ${money(typeof minBid==="function"?minBid(p.salary):Math.round(p.salary/2))}`;
  if(!sv) return `<h4>Status</h4><div>${status}</div><div class="sm mut" style="margin-top:10px">Loading SacVerde history…</div>`;
  const tline = x=>{ const t = LIVE.teamsById[x.team_id], k = {add:`Added by ${t} for $${x.amount}`, drop:`Dropped by ${t}`, forced_drop:`Penalty drop (${t})`, ir_on:`${t} moved him to IR`, ir_off:`${t} activated him from IR`,
      taxi_add:`${t} put him on the taxi squad`, taxi_promote:`${t} promoted him from the taxi squad`, trade_in:`Traded to ${t}`, trade_out:`Traded away by ${t}`,
      commissioner_roster:`Commissioner placed him on ${t} ($${x.amount})`, commissioner_release:`Commissioner released him from ${t}`}[x.kind]; return k ? {w:x.week, t:k} : null; };
  const lines = [...sv.sheet.map(x=>({w:null, t:`${x.team}: ${x.l}`})), ...sv.tx.map(tline).filter(Boolean)];
  const bids = sv.bids.slice().sort((a,b)=>b.week-a.week || b.amount-a.amount);
  const byWeek = {}; bids.forEach(b=>(byWeek[b.week]=byWeek[b.week]||[]).push(b));
  return `<h4>Status</h4><div>${status}</div>
    <h4>Revealed bids · ${LIVE.season.year}</h4>${bids.length?`<div class="pc-tbl"><table><tr><th>Week</th><th>Team</th><th class="r">Bid</th></tr>
      ${Object.keys(byWeek).sort((a,b)=>b-a).map(w=>byWeek[w].map((b,i)=>`<tr><td>${i?"":"<b>"+w+"</b>"}</td><td><span style="display:inline-block;width:4px;height:12px;border-radius:2px;background:${hmColors(LIVE.teamsById[b.team_id]).c};margin-right:6px"></span>${esc(LIVE.teamsById[b.team_id])}</td><td class="r">${i?"":"<b>"}${money(b.amount)}${i?"":"</b>"}</td></tr>`).join("")).join("")}</table></div>
      <div class="sm mut2" style="margin-top:6px">Weeks from the league's Free Agency sheet, plus site bids after each Tuesday reveal.</div>`:'<div class="sm mut">No revealed bids on him this season.</div>'}
    <h4>Transactions · ${LIVE.season.year}</h4>${lines.length?lines.map(l=>`<div class="pc-fact"><span>•</span><span>${esc(l.t)}${l.w?` <span class="mut2">(wk ${l.w})</span>`:""}</span></div>`).join(""):'<div class="sm mut">No moves this season.</div>'}`;
}
function pcBio(p, s){
  const b = (s&&s.bio)||{}, facts = plFacts(p, s, PC.sv);
  const draft = b.dy && b.dr ? `${b.dy} · round ${b.dr}${b.dp?", #"+b.dp+" overall":""} · ${b.dt||""}` : b.rk ? `Undrafted (${b.rk})` : "–";
  const kv = [["Born", b.b ? new Date(b.b+"T12:00:00Z").toLocaleDateString([], {month:"long", day:"numeric", year:"numeric", timeZone:"UTC"})+(ageOf(b.b)!=null?` (age ${ageOf(b.b)})`:"") : "–"],
    ["Height / weight", `${htStr(b.ht)} · ${b.wt?b.wt+" lb":"–"}`], ["College", b.col ? (()=>{ const cs = b.col.split(";").map(x=>x.trim()); return esc(cs[0]) + (cs.length>1 ? ` <span class="mut">(also ${esc(cs.slice(1).join(", "))})</span>` : ""); })() : "–"], ["Draft", esc(draft)],
    ["NFL experience", b.exp!=null ? (b.exp ? b.exp+" season"+(b.exp>1?"s":"") : "Rookie") : "–"], ["NFL team", esc(p.nfl_team||"FA")+(b.no?" · #"+esc(b.no):"")]];
  return `<h4>Bio</h4><div class="pc-kv">${kv.map(([k,v])=>`<div>${k}</div><div>${v}</div>`).join("")}</div>
    <h4>Fun facts</h4>${facts.length?facts.map(([i,t])=>`<div class="pc-fact"><span>${i}</span><span>${esc(t)}</span></div>`).join(""):'<div class="sm mut">Nothing yet.</div>'}
    <div class="sm mut2" style="margin-top:10px">Facts are generated from the stats and SacVerde records, so they're always true. High school isn't in the data feed.</div>`;
}

// ---------- Salary List with search ----------
const SLF = (()=>{ try{ return JSON.parse(localStorage.getItem("sv_salary_f")||"null") || {}; }catch(e){ return {}; } })();
const slSave = ()=>{ try{ localStorage.setItem("sv_salary_f", JSON.stringify({pos:SLF.pos, own:SLF.own, nfl:SLF.nfl, min:SLF.min, max:SLF.max, sort:SLF.sort, dir:SLF.dir, rook:SLF.rook})); }catch(e){} };
SLF.pos = SLF.pos || "ALL"; SLF.own = SLF.own || "ALL"; SLF.nfl = SLF.nfl || "ALL"; SLF.sort = SLF.sort || "salary"; SLF.dir = SLF.dir || -1; SLF.q = ""; SLF.limit = 150;
const slNorm = s=>String(s||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
function slRows(){
  const q = slNorm(SLF.q), qWords = String(SLF.q||"").toLowerCase().split(/\s+/).map(slNorm).filter(Boolean);
  const own = {}; LIVE.roster26.forEach(r=>own[r.player_id]=r);
  const mine = LIVE.me && LIVE.me.team_id, myBids = LIVE.myBids || {};
  let rows = LIVE.players.filter(p=>p.active && p.salary!=null).map(p=>({p, o:own[p.id]||null}));
  if(SLF.pos!=="ALL") rows = rows.filter(r=>r.p.pos===SLF.pos);
  if(SLF.own==="FA") rows = rows.filter(r=>!r.o); else if(SLF.own==="OWNED") rows = rows.filter(r=>r.o);
  else if(SLF.own==="MINE") rows = rows.filter(r=>r.o && r.o.team_id===mine);
  else if(SLF.own!=="ALL") rows = rows.filter(r=>r.o && String(r.o.team_id)===String(SLF.own));
  if(SLF.nfl!=="ALL") rows = rows.filter(r=>r.p.nfl_team===SLF.nfl);
  if(SLF.rook) rows = rows.filter(r=>r.p.rookie);
  if(SLF.min!=null && SLF.min!=="") rows = rows.filter(r=>r.p.salary>=+SLF.min);
  if(SLF.max!=null && SLF.max!=="") rows = rows.filter(r=>r.p.salary<=+SLF.max);
  const teamCode = q && q.length<=3 && LIVE.players.some(p=>slNorm(p.nfl_team)===q) ? q : null;
  if(teamCode) rows = rows.filter(r=>slNorm(r.p.nfl_team)===teamCode);
  else if(q){ rows = rows.filter(r=>{ const n = slNorm(r.p.name), t = slNorm(r.p.nfl_team), ow = r.o ? slNorm(LIVE.teamsById[r.o.team_id]) : "";
      const ini = r.p.name.split(/[\s\-]+/).map(w=>(w[0]||"").toLowerCase()).join("");
      return qWords.every(w=>n.includes(w) || t===w || ow.includes(w)) || ini===q || ini.startsWith(q) && q.length>=3; }); }
  const key = {salary:r=>r.p.salary, name:r=>r.p.name.toLowerCase(), pos:r=>(POSORD[r.p.pos]||9)*1000-r.p.salary, nfl:r=>r.p.nfl_team, owner:r=>r.o?LIVE.teamsById[r.o.team_id]:"~", paid:r=>r.o?r.o.salary:-1, min:r=>r.p.salary,
    stat:r=>{ const s = psFor(r.p), c = s && (s.car||[]).find(x=>x.y===PS.season); const k = (TILES[r.p.pos]||[])[0]; return c && k ? (c[k]||0) : -1; }}[SLF.sort] || (r=>r.p.salary);
  rows.sort((a,b)=>{ const x = key(a), y = key(b); return (x<y?-1:x>y?1:0)*SLF.dir || b.p.salary-a.p.salary || a.p.name.localeCompare(b.p.name); });
  return {rows, mine, myBids};
}
function slStatLine(p){
  if(!PS) return ""; const s = psFor(p); if(!s) return ""; const c = (s.car||[]).find(x=>x.y===PS.season); if(!c) return "";
  const f = {QB:c=>`${fmtN(c.py||0)} pass yds · ${c.ptd||0} TD · ${c.int||0} INT`, RB:c=>`${fmtN(c.ry||0)} rush yds · ${(c.rtd||0)+(c.rctd||0)} TD · ${c.rec||0} rec`,
    WR:c=>`${c.rec||0} rec · ${fmtN(c.rcy||0)} yds · ${c.rctd||0} TD`, TE:c=>`${c.rec||0} rec · ${fmtN(c.rcy||0)} yds · ${c.rctd||0} TD`, K:c=>`${c.fgm||0}/${c.fga||0} FG · long ${c.fgl||0} · ${c.xpm||0} XP`}[p.pos];
  return f ? `${PS.season}: ${f(c)} · ${c.g} G` : "";
}
function slHi(name){
  const ws = String(SLF.q||"").trim().split(/\s+/).filter(w=>w.length>=2); let h = esc(name);
  ws.forEach(w=>{ const re = new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"); h = h.replace(re, "<mark>$1</mark>"); }); return h;
}
function slBody(){
  const {rows, mine, myBids} = slRows(), shown = rows.slice(0, SLF.limit);
  const body = shown.map(({p,o})=>{ const on = o ? LIVE.teamsById[o.team_id] : null, mb = typeof minBid==="function" ? minBid(p.salary) : Math.round(p.salary/2);
    const tag = o && o.status!=="active" ? ` <span class="badge">${o.status.toUpperCase()}</span>` : "";
    return `<tr class="pr" onclick="openPlayer(${p.id})"><td><span class="pos ${p.pos}">${p.pos}</span></td>
      <td><div class="nm">${slHi(p.name)}${p.rookie?' <span class="badge">R</span>':""}${tag}${myBids[p.id]?' <span class="badge" style="background:#38100d">BID $'+myBids[p.id].amount+'</span>':""}</div><div class="ln">${slStatLine(p)}</div></td>
      <td class="mut">${esc(p.nfl_team||"")}</td>
      <td>${on?`<span class="own" style="--c:${hmColors(on).c}"><i></i>${esc(on)}</span>`:'<span class="mut2">Free agent</span>'}</td>
      <td class="r"><b>${money(p.salary)}</b></td><td class="r sl-hide">${o?money(o.salary):'<span class="mut2">—</span>'}</td><td class="r mut sl-hide">${o?"—":money(mb)}</td></tr>`; }).join("");
  const more = rows.length>shown.length ? `<tr><td colspan="7" style="text-align:center;padding:14px"><button class="btn ghost sm" onclick="SLF.limit+=300;slUpdate()">Show ${Math.min(300, rows.length-shown.length)} more (${rows.length-shown.length} left)</button></td></tr>` : "";
  return {html: body + more || '<tr><td colspan="7" class="mut" style="padding:20px;text-align:center">No players match. Try fewer filters.</td></tr>', n: rows.length};
}
window.slUpdate = function(){ const b = slBody(), t = document.getElementById("slBody"), c = document.getElementById("slCount");
  if(t) t.innerHTML = b.html; if(c) c.textContent = slCountText(b.n); };
const slCountText = n=>`${n.toLocaleString()} player${n===1?"":"s"}${SLF.q?` matching “${SLF.q}”`:""} · click a player for stats, bio and SacVerde history`;
window.slSet = function(k, v){ SLF[k] = v; SLF.limit = 150; slSave(); render(); };
window.slSort = function(k){ if(SLF.sort===k) SLF.dir = -SLF.dir; else { SLF.sort = k; SLF.dir = ["name","nfl","owner"].includes(k) ? 1 : -1; } slSave(); render(); };

const _vSalaryPrev = window.vSalary;
window.vSalary = function(){
  if(SEASON===2025 || !LIVE.players || !LIVE.players.length) return _vSalaryPrev();
  if(!PS){ loadPS().then(()=>{ if(state.view==="salary") slUpdate(); }); }
  const nflTeams = [...new Set(LIVE.players.filter(p=>p.active).map(p=>p.nfl_team).filter(Boolean))].sort();
  const teams = LIVE.teamRows.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const chip = (k, v, l)=>`<span class="sl-chip ${String(SLF[k])===String(v)?"on":""}" onclick="slSet('${k}','${v}')">${l}</span>`;
  const th = (k, l, cls)=>`<th class="${cls||""} ${SLF.sort===k?"on":""}" onclick="slSort('${k}')">${l}${SLF.sort===k?`<span class="ar">${SLF.dir>0?"▲":"▼"}</span>`:""}</th>`;
  const team = SLF.own!=="ALL" && !["FA","OWNED"].includes(SLF.own) ? (SLF.own==="MINE" ? LIVE.me && LIVE.me.team_id : +SLF.own) : null;
  const capCard = team ? (()=>{ const c = capInfo(team), n = LIVE.teamsById[team];
    return `<div class="card" style="margin-bottom:12px;border-left:5px solid ${hmColors(n).c}"><div class="spread"><b>${esc(n)}</b><span class="sm mut">${c.count}/${LIVE.season.roster_size} active · ${money(c.used)} of $${LIVE.season.salary_cap} · ${money(LIVE.season.salary_cap - c.used)} space</span></div>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, c.used/LIVE.season.salary_cap*100)}%"></i></div></div>`; })() : "";
  const b = slBody();
  return `<h1>Salary List</h1>
  <div class="sub">${LIVE.season.year} official list · $${LIVE.season.salary_cap} cap · min bid = half the list salary, rounded</div>
  <div class="sl-top">
    <div class="sl-search"><span class="ic">🔍</span><input id="slQ" type="search" autocomplete="off" placeholder="Search players, NFL teams or SacVerde teams…" value="${esc(SLF.q)}"
      oninput="SLF.q=this.value;SLF.limit=150;slUpdate();document.getElementById('slX').style.display=this.value?'':'none'">
      <button id="slX" class="x" style="display:${SLF.q?"":"none"}" onclick="SLF.q='';const i=document.getElementById('slQ');i.value='';this.style.display='none';slUpdate();i.focus()" aria-label="Clear">✕</button></div>
  </div>
  <div class="sl-chips">${chip("pos","ALL","All")}${["QB","RB","WR","TE","K","DST"].map(x=>chip("pos",x,x==="DST"?"DEF":x)).join("")}<span class="sl-chip sep">|</span>
    ${chip("own","ALL","Everyone")}${chip("own","FA","Free agents")}${chip("own","OWNED","Rostered")}${LIVE.me?chip("own","MINE","My team"):""}<span class="sl-chip sep">|</span>
    <span class="sl-chip ${SLF.rook?"on":""}" onclick="slSet('rook',${SLF.rook?"false":"true"})">Rookies</span></div>
  <div class="sl-more">
    <select onchange="slSet('own',this.value)"><option value="ALL">Any SacVerde team</option>${teams.map(t=>`<option value="${t.id}" ${String(SLF.own)===String(t.id)?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
    <select onchange="slSet('nfl',this.value)"><option value="ALL">Any NFL team</option>${nflTeams.map(t=>`<option ${SLF.nfl===t?"selected":""}>${esc(t)}</option>`).join("")}</select>
    Salary $<input type="number" min="0" placeholder="min" value="${SLF.min??""}" onchange="slSet('min',this.value)"> to $<input type="number" min="0" placeholder="max" value="${SLF.max??""}" onchange="slSet('max',this.value)">
    ${(SLF.pos!=="ALL"||SLF.own!=="ALL"||SLF.nfl!=="ALL"||SLF.rook||SLF.min||SLF.max)?`<a onclick="Object.assign(SLF,{pos:'ALL',own:'ALL',nfl:'ALL',rook:false,min:'',max:''});slSave();render()">Reset filters</a>`:""}
  </div>
  <div class="sl-count" id="slCount">${slCountText(b.n)}</div>
  ${capCard}
  <div class="card" style="padding:6px 10px"><table class="sl-tbl"><thead><tr>${th("pos","Pos")}${th("name","Player")}${th("nfl","NFL")}${th("owner","SacVerde")}${th("salary","List $","r")}${th("paid","Paid","r sl-hide")}${th("min","Min bid","r sl-hide")}</tr></thead>
    <tbody id="slBody">${b.html}</tbody></table></div>`;
};
// keep focus in the search box across full re-renders
document.addEventListener("keydown", e=>{ if(state.view==="salary" && e.key==="/" && document.activeElement && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); const i = document.getElementById("slQ"); if(i) i.focus(); } });
