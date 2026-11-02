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
