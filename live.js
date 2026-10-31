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
async function loadAll(){
  const [{data:mem}, {data:teams}, {data:seasons}, arch, {data:mt}] = await Promise.all([
    sb.from("league_members").select("email,team_id,role,user_id,display_name"),
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
  await loadForum();
  return true;
}
async function loadSeason(){
  const yr = LIVE.season.year;
  const [ps, sal, rs, bw, st] = await Promise.all([
    fetchAll(()=>sb.from("players").select("id,name,pos,nfl_team,rookie,active").order("id")),
    fetchAll(()=>sb.from("player_salaries").select("player_id,list_salary").eq("season",yr).order("player_id")),
    fetchAll(()=>sb.from("roster_spots").select("team_id,player_id,status,salary,contract").eq("season",yr).order("id")),
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
  ${state.bidTab!=='rules' ? myRosterHTML() : ""}
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
function myRosterHTML(){
  const me = LIVE.me.team_id, cap = capInfo(me);
  const rows = LIVE.roster26.filter(r=>r.team_id===me).map(r=>({...r, p:LIVE.byId[r.player_id]}))
    .sort((a,b)=>(POSORD[a.p.pos]||9)-(POSORD[b.p.pos]||9) || b.salary-a.salary);
  if(!rows.length) return "";
  return `<div class="card" style="margin-top:14px"><h3>Your ${LIVE.season.year} Roster · ${cap.count}/${LIVE.season.roster_size} active · ${money(cap.used)} of $${LIVE.season.salary_cap}</h3>
    <table><tr><th>Pos</th><th>Player</th><th>NFL</th><th class="r">Salary</th><th></th></tr>
    ${rows.map(r=>`<tr><td><span class="pos ${r.p.pos}">${r.p.pos}</span></td><td>${esc(r.p.name)}${r.status!=="active"?` <span class="badge">${r.status.toUpperCase()}</span>`:""}</td><td class="mut">${r.p.nfl_team}</td>
      <td class="r">${money(r.salary)}</td><td class="r"><button class="btn ghost sm" onclick="dropPlayer(${r.player_id})">drop</button></td></tr>`).join("")}
    </table></div>`;
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
  if(LIVE.me.role!=="commissioner") return _vOffice();
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
