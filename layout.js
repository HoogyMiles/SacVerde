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
.mt-bg{position:absolute;top:-26px;left:-20px;right:-20px;height:560px;z-index:-1;overflow:hidden;pointer-events:none;border-radius:0 0 18px 18px}
.mt-bg .tbg-stage{opacity:.9}
.mt-bg:after{content:"";position:absolute;inset:0;background:
  linear-gradient(180deg,rgba(10,10,11,.15) 0%,rgba(10,10,11,.35) 45%,var(--bg) 100%),
  linear-gradient(90deg,rgba(10,10,11,.85) 0%,rgba(10,10,11,.35) 45%,transparent 70%)}
.mt-wrap .card{background:rgba(20,20,22,.86);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.mt-wrap > h1{text-shadow:0 2px 12px rgba(0,0,0,.8)}
@media (max-width:600px){ .mt-bg{left:-16px;right:-16px;height:460px} .mt-bg:after{background:linear-gradient(180deg,rgba(10,10,11,.35) 0%,rgba(10,10,11,.6) 50%,var(--bg) 100%)} }
</style>`);
function teamBackdrop(name){
  try{
    const A = TEAM_ART[name], V = TEAM_ART_VALS[name], t = DATA.teams[name]; if(!A || !V || !t) return "";
    const art = tbgRender(A.tpl, V(tbgRoster(t, t.info||{})));
    return `<div class="mt-bg" style="background:${A.bg}"><div class="tbg-stage" aria-hidden="true"><div style="position:absolute;inset:0;background:${A.bg}"></div>${art}</div></div>`;
  }catch(e){ return ""; }
}
const _vMyTeamPrev = window.vMyTeam;
if(typeof _vMyTeamPrev==="function") window.vMyTeam = function(){
  const html = _vMyTeamPrev();
  if(SEASON===2025 || !LIVE.me || !LIVE.me.team_id) return html;
  const bg = teamBackdrop(LIVE.teamsById[LIVE.me.team_id]);
  return bg ? `<div class="mt-wrap">${bg}${html}</div>` : html;
};
