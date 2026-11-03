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
.mt-bg .tbg-stage{top:auto;bottom:0;transform-origin:bottom right;opacity:.9}
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
