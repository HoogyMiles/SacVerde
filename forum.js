// =====================================================================
// SacVerde Forum redesign (11/2/2026): "Locker Room" — live score ticker on top,
// team-colored chat with day dividers, sidebar with your opponent, quote of the week
// and most active. Loaded after layout.js; uses live.js forum data/actions.
// =====================================================================
document.head.insertAdjacentHTML("beforeend", `<style>
.lr-jumbo{background:#050506;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:12px;background-image:radial-gradient(#1b1b1f 1px,transparent 1px);background-size:6px 6px}
.lr-title{font-family:Anton,Impact,sans-serif;font-size:40px;line-height:1;letter-spacing:3px;color:#fff;text-shadow:0 0 18px rgba(238,58,46,.6)}
.lr-sub{font-size:12px;color:var(--mut2);margin-top:4px}
.lr-tick{display:flex;gap:8px 22px;margin-top:10px;font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;color:#ffb000;flex-wrap:wrap}
.lr-tick .tk{cursor:pointer;white-space:nowrap} .lr-tick .tk:hover{text-decoration:underline}
.lr-tick i{color:var(--mut2);font-style:normal} .lr-tick .wk{color:var(--mut2);white-space:nowrap}
.lr-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
.lr-chat{display:flex;flex-direction:column;height:calc(100vh - 330px);min-height:460px}
.lr-log{flex:1;overflow-y:auto;background:var(--panel);border:1px solid var(--line);border-bottom:none;border-radius:14px 14px 0 0;padding:4px 16px 14px}
.lr-day{display:flex;align-items:center;gap:10px;margin:16px 0 8px;color:var(--mut2);font-size:10.5px;letter-spacing:2px;text-transform:uppercase;font-weight:800}
.lr-day:before,.lr-day:after{content:"";flex:1;border-top:1px solid var(--line)}
.lr-m{display:flex;gap:12px;margin-top:10px;position:relative}
.lr-m.cont{margin-top:4px}
.lr-m .lr-bar{width:4px;border-radius:2px;background:var(--c);flex:none;align-self:stretch}
.lr-m .body{min-width:0;flex:1;padding-right:44px}
.lr-m .who{display:flex;align-items:baseline;gap:8px}
.lr-m .who b{color:var(--c);font-family:Anton,Impact,sans-serif;font-weight:400;font-size:16px;letter-spacing:.5px;text-transform:uppercase;cursor:pointer}
.lr-m .who span{font-size:11px;color:var(--mut2)}
.lr-m .txt{font-size:14.5px;line-height:1.45;word-break:break-word;margin-top:1px}
.lr-m .media{margin-top:6px;max-width:min(100%,420px);max-height:320px;border-radius:8px;display:block;border:1px solid var(--line)}
.lr-m.me .body{background:linear-gradient(90deg,rgba(255,255,255,.035),transparent 70%);border-radius:6px;padding:2px 6px;margin-left:-6px}
.lr-rx{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;align-items:center}
.lr-rx .rx{display:inline-flex;align-items:center;gap:4px;font-size:12px;background:#1f1f23;border:1px solid var(--line);border-radius:14px;padding:1px 9px;cursor:pointer;user-select:none}
.lr-rx .rx b{font-size:11px;color:var(--mut)} .lr-rx .rx.on{border-color:var(--green);background:#38100d} .lr-rx .rx.on b{color:#fff}
.lr-m .add{position:absolute;right:0;top:2px;display:inline-flex;font-size:12px;background:#1f1f23;border:1px solid var(--line);border-radius:14px;padding:1px 9px;cursor:pointer;color:var(--mut2);opacity:0;transition:opacity .15s}
.lr-m:hover .add,.lr-m .add.show{opacity:1}
@media (hover:none){.lr-m .add{opacity:.6}}
.lr-comp{display:flex;gap:8px;padding:12px;background:#111114;border:1px solid var(--line);border-radius:0 0 14px 14px}
.lr-comp input{flex:1;min-width:0;background:#141416;border:1px solid var(--line);border-radius:8px;color:#fff;padding:11px 12px;font-size:14px}
.lr-comp .gif{background:#232327;border:1px solid var(--line);color:var(--mut);font-weight:800;border-radius:8px;padding:0 12px;font-size:12px;cursor:pointer}
.lr-comp .gif.on{border-color:var(--green);color:#fff}
.lr-comp .btn{letter-spacing:1px;padding:0 18px}
.lr-extra{padding:10px 12px;background:#111114;border:1px solid var(--line);border-bottom:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--mut)}
.lr-extra input{flex:1;min-width:200px;background:#141416;border:1px solid var(--line);border-radius:8px;color:#fff;padding:8px 10px}
.lr-side{display:flex;flex-direction:column;gap:12px}
.lr-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}
.lr-k{font-size:10.5px;letter-spacing:2px;color:var(--mut2);font-weight:800;margin-bottom:10px;text-transform:uppercase}
.lr-av{border-radius:10px;background:linear-gradient(135deg,var(--b),#000);border:2px solid var(--c);color:var(--c);display:flex;align-items:center;justify-content:center;font-family:Anton,Impact,sans-serif;flex:none;letter-spacing:.5px}
.lr-opp{display:flex;gap:10px;align-items:center;padding:10px;border-radius:10px;background:linear-gradient(90deg,var(--b),transparent);border-left:4px solid var(--c);cursor:pointer}
.lr-opp b{font-size:15px}
.lr-q{font-size:16.5px;font-style:italic;line-height:1.35;margin-bottom:6px;word-break:break-word}
.lr-ma{display:flex;align-items:center;gap:8px;margin-top:7px;font-size:13px}
.lr-ma span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:900px){
  .lr-grid{grid-template-columns:1fr}
  .lr-side{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
}
@media (max-width:600px){
  .lr-title{font-size:30px}
  .lr-tick{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}
  .lr-chat{height:calc(100vh - 290px);min-height:420px}
  .lr-log{padding:2px 10px 12px}
  .lr-comp{padding:8px}
  .lr-comp .btn{padding:0 12px}
}
</style>`);

const LR_EMO = ["👍","🔥","😂","💀"];
const lrAv = (n, sz)=>`<div class="lr-av" style="${hmVars(n)};width:${sz}px;height:${sz}px;font-size:${Math.round(sz*.36)}px">${esc(initials(n))}</div>`;
const lrDay = ts=>{ const d = hmPT(ts,{year:"numeric",month:"numeric",day:"numeric"}), now = Date.now();
  if(d===hmPT(now,{year:"numeric",month:"numeric",day:"numeric"})) return "Today";
  if(d===hmPT(now-864e5,{year:"numeric",month:"numeric",day:"numeric"})) return "Yesterday";
  return hmPT(ts, now - new Date(ts).getTime() < 6*864e5 ? {weekday:"long"} : {weekday:"short", month:"short", day:"numeric"}); };
const lrTime = ts=>hmPT(ts,{hour:"numeric",minute:"2-digit"});

function lrTicker(){
  if(typeof hmAutoWeek!=="function" || !LIVE.m26 || !LIVE.m26.length) return "";
  const wk = hmAutoWeek(); if(wk==null) return "";
  const games = LIVE.m26.filter(m=>m.week===wk);
  return `<div class="lr-tick"><span class="wk">WK ${wk}</span>${games.map((m,i)=>{ const s = mcStatus(m, wk), hn = mcName(m.home_team), an = mcName(m.away_team);
    const v = x=>x==null ? "–" : (+x).toFixed(1);
    return `<span class="tk" onclick="openMatch(${wk},${i})">${s.live?'<span class="live-dot"></span>':""}<span style="color:${hmColors(hn).c}">${esc(hn)}</span> ${v(s.hp)} <i>–</i> ${v(s.ap)} <span style="color:${hmColors(an).c}">${esc(an)}</span>${s.fin?' <i>F</i>':""}</span>`; }).join("")}</div>`;
}
function lrSide(){
  const out = [];
  // your opponent this week
  if(LIVE.me && LIVE.m26 && LIVE.m26.length && typeof hmAutoWeek==="function"){
    const wk = hmAutoWeek(), me = LIVE.me.team_id, games = LIVE.m26.filter(m=>m.week===wk), gi = games.findIndex(m=>m.home_team===me || m.away_team===me);
    if(gi>=0){ const m = games[gi], s = mcStatus(m, wk), home = m.home_team===me, opp = mcName(home ? m.away_team : m.home_team);
      const my = home ? s.hp : s.ap, op = home ? s.ap : s.hp;
      const line = my==null && op==null ? "" : (my??0) > (op??0) ? `you lead ${(+my).toFixed(1)} – ${(+(op??0)).toFixed(1)}` : (op??0) > (my??0) ? `leading you ${(+op).toFixed(1)} – ${(+(my??0)).toFixed(1)}` : `tied ${(+(my??0)).toFixed(1)}`;
      out.push(`<div class="lr-card"><div class="lr-k">Your opponent · week ${wk}</div>
        <div class="lr-opp" style="${hmVars(opp)}" onclick="openMatch(${wk},${gi})">${lrAv(opp,44)}<div><b>${esc(opp)}</b><div class="sm mut">${mcRec(opp)}${line?" · "+(s.fin?"final, ":"")+line:""}</div></div></div></div>`); }
  }
  // quote of the week: most reactions in the last 7 days
  const since = Date.now() - 7*864e5, recent = LIVE.forum.filter(m=>new Date(m.created_at).getTime() >= since);
  const count = id=>LIVE.reacts.filter(r=>r.message_id===id).length;
  const best = recent.filter(m=>m.body && count(m.id)>0).sort((a,b)=>count(b.id)-count(a.id) || new Date(b.created_at)-new Date(a.created_at))[0];
  if(best){ const n = LIVE.teamsById[best.team_id], rx = LR_EMO.map(e=>[e, LIVE.reacts.filter(r=>r.message_id===best.id && r.emoji===e).length]).filter(x=>x[1]);
    out.push(`<div class="lr-card"><div class="lr-k">🏆 Quote of the week</div><div class="lr-q">“${esc(best.body.length>160?best.body.slice(0,157)+"…":best.body)}”</div>
      <div class="sm" style="color:${hmColors(n).c}">— ${esc(n)} · ${rx.map(x=>x[0]+" "+x[1]).join(" ")}</div></div>`); }
  // most active (last 7 days)
  const by = {}; recent.forEach(m=>by[m.team_id]=(by[m.team_id]||0)+1);
  const top = Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(top.length) out.push(`<div class="lr-card"><div class="lr-k">Most active · 7 days</div>${top.map(([t,k])=>{ const n = LIVE.teamsById[t];
    return `<div class="lr-ma">${lrAv(n,22)}<span>${esc(n)}</span><b>${k}</b></div>`; }).join("")}</div>`);
  return out.join("") || `<div class="lr-card"><div class="lr-k">Locker room</div><div class="sm mut">Post something. The most-reacted message of the week shows up here.</div></div>`;
}

vForum = function(){
  setTimeout(forumScroll, 0);
  const me = LIVE.me.team_id; let lastDay = null, last = null;
  const log = LIVE.forum.map(m=>{
    const n = LIVE.teamsById[m.team_id], day = lrDay(m.created_at), t = new Date(m.created_at).getTime();
    let pre = ""; if(day!==lastDay){ pre = `<div class="lr-day">${esc(day)}</div>`; lastDay = day; last = null; }
    const cont = last && last.team_id===m.team_id && t - new Date(last.created_at).getTime() < 10*60e3; last = m;
    const rx = LIVE.reacts.filter(r=>r.message_id===m.id), open = state.rxOpen===m.id;
    const chips = LR_EMO.map(e=>{ const a = rx.filter(r=>r.emoji===e), on = a.some(r=>r.team_id===me);
      if(!a.length && !open) return "";
      return `<span class="rx ${on?"on":""}" title="${esc(a.map(r=>LIVE.teamsById[r.team_id]).join(", "))}" onclick="state.rxOpen=null;forumReact2(${m.id},'${e}',${on})">${e}${a.length?` <b>${a.length}</b>`:""}</span>`; }).join("");
    return `${pre}<div class="lr-m ${cont?"cont":""} ${m.team_id===me?"me":""}" style="${hmVars(n)}"><div class="lr-bar"></div><div class="body">
      ${cont?"":`<div class="who"><b ${tgo(n)}>${esc(n)}</b><span>${lrTime(m.created_at)}</span></div>`}
      ${m.body?`<div class="txt" title="${cont?lrTime(m.created_at):""}">${esc(m.body)}</div>`:""}
      ${m.media_url?mediaHTML({type:/\.(mp4|webm|mov)(\?|$)/i.test(m.media_url)?"vid":"img", src:m.media_url}):""}
      ${chips?`<div class="lr-rx">${chips}</div>`:""}</div><span class="add ${open?"show":""}" title="React" onclick="state.rxOpen=${open?"null":m.id};render()">${open?"✕":"＋"}</span></div>`;
  }).join("") || '<div class="sm mut" style="padding:20px">No messages yet. Start the trash talk.</div>';
  return `<div class="lr-jumbo"><div class="lr-title">LOCKER ROOM</div><div class="lr-sub">The SacVerde group chat. Everyone in the league sees the same thread.</div>${lrTicker()}</div>
  ${flashHTML()}
  <div class="lr-grid">
    <div class="lr-chat">
      <div class="lr-log" id="chatlog">${log}</div>
      ${state.gifUrl?`<div class="lr-extra"><span>Attached: <b>${esc(state.gifUrl)}</b></span><button class="btn ghost sm" onclick="state.gifUrl=null;render()">✕ remove</button></div>`:""}
      ${state.gifOpen?`<div class="lr-extra"><span>Paste a GIF/image/video link (GIPHY/Tenor: right-click → Copy image address).</span>
        <input type="text" id="gifurl" placeholder="https://media.giphy.com/media/…/giphy.gif" onkeydown="if(event.key==='Enter')forumGif2()"><button class="btn sm" onclick="forumGif2()">Attach</button></div>`:""}
      <div class="lr-comp">
        <button class="gif ${state.gifOpen?"on":""}" title="Attach a GIF or link" onclick="state.gifOpen=!state.gifOpen;render()">GIF</button>
        <input type="text" id="chatmsg" placeholder="Say it to their face, ${esc(LIVE.teamsById[me]||"")}…" onkeydown="if(event.key==='Enter')forumSend2()">
        <button class="btn" onclick="forumSend2()">Send</button>
      </div>
    </div>
    <div class="lr-side">${lrSide()}</div>
  </div>
  <div class="sm mut2" style="margin-top:8px">GIF and media links work now; photo uploads are coming. <a onclick="refreshForum()">↻ refresh</a></div>`;
};
