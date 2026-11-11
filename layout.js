// =====================================================================
// SacVerde nav order (Hoogs 11/2/2026) and Financials moved into Teams.
// Loaded last.
// =====================================================================
(function(){
  const order = [["home","League Home"],["myteam","My Team"],["bids","Bid Room"],["salary","Salary List"],["match","Matchup Center"],
                 ["forum","Forum"],["teams","Teams"],["draft","Draft"],["history","History"],["rules","Rules"],["office","Front Office"]];
  const have = new Map(VIEWS.map(v=>[v[0], v[1]]));
  VIEWS.splice(0, VIEWS.length, ...order.filter(([k])=>have.has(k)).map(([k,l])=>[k, have.get(k) || l]));
})();

const _vTeamsPrev = window.vTeams, _vFinPrev = window.vFinancials;
window.vTeams = function(){
  const tab = state.teamsTab || "teams";
  const tabs = `<div class="tabs" style="margin:0 0 14px"><button class="${tab==="teams"?"on":""}" onclick="state.teamsTab='teams';render()">Team Pages</button>
    <button class="${tab==="fin"?"on":""}" onclick="state.teamsTab='fin';render()">Financials</button></div>`;
  return tabs + (tab==="fin" ? _vFinPrev() : _vTeamsPrev());
};
// Old Financials links land on Teams → Financials
window.vFinancials = function(){ state.view = "teams"; state.teamsTab = "fin"; nav(); return window.vTeams(); };
// Clicking a team name always opens its team page (not the Financials tab)
const _goTeamPrev = window.goTeam;
window.goTeam = function(t){ state.teamsTab = "teams"; return _goTeamPrev(t); };

// ---------- My Team: the team's art as a page backdrop ----------
document.head.insertAdjacentHTML("beforeend", `<style>
.mt-wrap{position:relative;isolation:isolate}
.mt-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.mt-bg .tbg-stage{top:auto;bottom:0;transform-origin:bottom right;opacity:.9;-webkit-mask-image:radial-gradient(ellipse 58% 62% at 50% 50%,#000 60%,transparent 100%);mask-image:radial-gradient(ellipse 58% 62% at 50% 50%,#000 60%,transparent 100%)}
.mt-bg:after{content:"";position:absolute;inset:0;background:
  linear-gradient(180deg,rgba(10,10,11,.55) 0%,rgba(10,10,11,.2) 55%,rgba(10,10,11,.35) 100%),
  linear-gradient(90deg,rgba(10,10,11,.6) 0%,rgba(10,10,11,.2) 45%,transparent 70%)}
.mt-wrap .card{background:rgba(12,12,14,var(--mt-a,.22));backdrop-filter:blur(var(--mt-blur,1px)) saturate(1.15);-webkit-backdrop-filter:blur(var(--mt-blur,1px)) saturate(1.15);border-color:rgba(255,255,255,.14)}
.mt-wrap .card,.mt-wrap .note{text-shadow:0 0 2px #000,0 0 4px #000,0 1px 3px #000}
.mt-wrap .card h3{color:var(--mt-txt)}
.mt-wrap .lu-p a.pl,.mt-wrap .card td a.pl{color:var(--mt-txt);font-weight:700;border-bottom-color:transparent}
.mt-wrap .lu-sal,.mt-wrap .lu-pts{color:#fff;font-weight:800}
.mt-wrap .lu-sub,.mt-wrap .mut,.mt-wrap .sm{color:#e4e4e8}
.mt-wrap .lu-slot{color:var(--mt-txt)}
.mt-wrap .btn.ghost{background:rgba(10,10,11,.75)}
.mt-wrap .note{background:rgba(29,19,21,.7)}
.mt-wrap .lu-row{border-bottom-color:rgba(255,255,255,.1)}
.mt-wrap .card select,.mt-wrap .card input{background:rgba(20,20,22,.9)}
.mt-wrap > h1{text-shadow:0 2px 12px rgba(0,0,0,.8)}
@media (max-width:600px){ .mt-bg:after{background:linear-gradient(180deg,rgba(10,10,11,.6) 0%,rgba(10,10,11,.45) 60%,rgba(10,10,11,.3) 100%)} }
</style>`);
function teamBackdrop(name){
  try{
    if(typeof TEAM_IMG!=="undefined" && TEAM_IMG[name]) return `<div class="mt-bg" style="background:#0a0a0b"><img src="${TEAM_IMG[name]}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9"></div>`;
    const A = TEAM_ART[name], V = TEAM_ART_VALS[name], t = DATA.teams[name]; if(!A || !V || !t) return "";
    const art = tbgRender(A.tpl, V(tbgRoster(t, t.info||{})));
    return `<div class="mt-bg" style="background:${A.bg}"><div class="tbg-stage" aria-hidden="true"><div style="position:absolute;inset:0;background:${A.bg}"></div>${art}</div></div>`;
  }catch(e){ return ""; }
}
// Team accent for text on My Team: the team's eyebrow/label color, lightened if it's too dark to read
function mtText(name){
  const c = (typeof hmColors==="function" ? hmColors(name).c : "#fff");
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c); if(!m) return "#fff";
  let [r,g,b] = m.slice(1).map(h=>parseInt(h,16)); const lum = (0.2126*r+0.7152*g+0.0722*b)/255;
  if(lum < 0.55){ const k = (0.62-lum)/(1-lum); r = Math.round(r+(255-r)*k); g = Math.round(g+(255-g)*k); b = Math.round(b+(255-b)*k); }
  return `rgb(${r},${g},${b})`;
}
const _vMyTeamPrev = window.vMyTeam;
if(typeof _vMyTeamPrev==="function") window.vMyTeam = function(){
  const html = _vMyTeamPrev();
  if(SEASON===2025 || !LIVE.me || !LIVE.me.team_id) return html;
  const bg = teamBackdrop(LIVE.teamsById[LIVE.me.team_id]);
  return bg ? `<div class="mt-wrap" style="--mt-txt:${mtText(LIVE.teamsById[LIVE.me.team_id])}">${bg}${html}</div>` : html;
};

// Center the team art in the visible area (each design sits in a different spot on its 1200x520 canvas)
function mtCenter(){
  const bg = document.querySelector(".mt-bg"), st = bg && bg.querySelector(".tbg-stage"); if(!st) return;
  st.style.cssText = "left:0;top:0;right:auto;bottom:auto;transform:none;transform-origin:0 0";
  const base = st.getBoundingClientRect(); let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  st.querySelectorAll("*").forEach((el, i)=>{ if(el.parentElement===st && i===0) return;   // skip the full-canvas background layer
    const r = el.getBoundingClientRect(); if(!r.width || !r.height || r.width>=base.width*0.98) return;
    const l = Math.max(r.left, base.left), t = Math.max(r.top, base.top), rr = Math.min(r.right, base.right), b = Math.min(r.bottom, base.bottom);
    if(rr<=l || b<=t) return; x1 = Math.min(x1, l); y1 = Math.min(y1, t); x2 = Math.max(x2, rr); y2 = Math.max(y2, b); });
  if(x1>x2){ x1 = base.left; y1 = base.top; x2 = base.right; y2 = base.bottom; }
  const hdr = document.querySelector("header"), top = hdr ? hdr.getBoundingClientRect().bottom : 0;
  const W = window.innerWidth, H = window.innerHeight - top, bw = x2-x1, bh = y2-y1;
  const s = Math.min(1.15, (W*0.92)/bw, (H*0.9)/bh);
  const cx = (x1+x2)/2 - base.left, cy = (y1+y2)/2 - base.top;
  st.style.transform = `translate(${W/2 - cx*s}px, ${top + H/2 - cy*s}px) scale(${s})`;
  const m = `radial-gradient(ellipse ${Math.round(bw/2*1.15)}px ${Math.round(bh/2*1.2)}px at ${Math.round(cx)}px ${Math.round(cy)}px,#000 62%,transparent 100%)`;
  st.style.webkitMaskImage = m; st.style.maskImage = m;
}
new MutationObserver(()=>{ if(document.querySelector(".mt-bg")) requestAnimationFrame(mtCenter); }).observe(document.querySelector("main")||document.body, {childList:true});
window.addEventListener("resize", ()=>{ if(document.querySelector(".mt-bg")) mtCenter(); });

// ---------- Sac Verde logo (full version) — League Home backdrop ----------
function sacLogoSVG(tagline){
  const G="#1FA05A", CR="#F2EBDA", SI="#C8CDD3", CH="#1A1C1E";
  const lines = Array.from({length:9}, (_,k)=>`<rect x="${40+k*65}" y="40" width="3" height="300" fill="${SI}"/>`).join("");
  const laces = [-14,-5,5,14].map(x=>`<line x1="${x}" y1="-5" x2="${x}" y2="5" stroke="${CH}" stroke-width="2.5" stroke-linecap="round"/>`).join("");
  return `<svg viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sac Verde"><g opacity=".14">${lines}</g><g transform="translate(300,0)">
    <text x="-205" y="92" font-family="Graduate,Georgia,serif" font-size="44" fill="${CR}" letter-spacing="6">SAC</text>
    <g transform="translate(-10,78)"><path d="M-38,0 Q0,-28 38,0 Q0,28 -38,0Z" fill="${SI}"/><line x1="-17" y1="0" x2="17" y2="0" stroke="${CH}" stroke-width="2.5" stroke-linecap="round"/>${laces}</g>
    <g transform="rotate(-6)"><text x="0" y="250" text-anchor="middle" font-family="Yellowtail,'Brush Script MT',cursive" font-size="190" fill="${G}" stroke="${CR}" stroke-width="5" paint-order="stroke">Verde</text>
    <path d="M-200,300 C-80,270 60,268 230,250 C150,280 40,300 -60,312Z" fill="${G}" stroke="${CR}" stroke-width="3"/></g>
    ${tagline?`<text x="0" y="380" text-anchor="middle" font-family="Oswald,Impact,sans-serif" font-weight="700" font-size="18" fill="${SI}" letter-spacing="9">${tagline}</text>`:""}</g></svg>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>
.hm-wrap{position:relative;isolation:isolate}
.hm-bg{position:fixed;inset:0;z-index:-1;pointer-events:none;display:flex;align-items:center;justify-content:center;padding-top:80px;
  background:radial-gradient(ellipse at 50% 55%,#151a17 0%,#0a0a0b 70%)}
.hm-bg svg{width:min(1100px,92vw);height:auto;opacity:.16;filter:saturate(.9)}
.hm-wrap .card,.hm-wrap .sb-card,.hm-wrap .st-card,.hm-wrap .br-wrap,.hm-wrap .tcard{background-color:rgba(20,20,22,.86);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
@media (max-width:600px){ .hm-bg svg{width:130vw;opacity:.13} }
</style>`);
(function(){ const prev = window.vHome; window.vHome = function(){ const html = prev(); if(!html) return html;
  return `<div class="hm-wrap"><div class="hm-bg" aria-hidden="true">${sacLogoSVG("FANTASY FOOTBALL · EST. 2003")}</div>${html}</div>`; }; })();
