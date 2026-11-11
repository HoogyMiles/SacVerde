// =====================================================================
// Teams tab: a grid of clickable team cards (Hoogs 11/10/2026).
// Clicking the Teams tab shows the grid; a card opens that team's page.
// Loaded after teambg.js, before layout.js (layout adds the Team Pages · Financials tabs).
// =====================================================================

// Drop a generated image into img/teams/ and list it here to replace the drawn art on that team's card
// (and behind its team page header). Leave a team out to keep its drawn art.
const TEAM_IMG = {
  // "Pool Boy": "img/teams/pool-boy.jpg",
};

document.head.insertAdjacentHTML("beforeend", `<style>
.tc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
@media (max-width:900px){.tc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}
@media (max-width:560px){.tc-grid{grid-template-columns:1fr}}
.tc-card{position:relative;display:block;aspect-ratio:16/10;border-radius:14px;overflow:hidden;cursor:pointer;isolation:isolate;
  border:1px solid rgba(255,255,255,.12);background:var(--tc-bg);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;outline:none}
.tc-card:hover,.tc-card:focus-visible{transform:translateY(-3px);border-color:var(--tc-acc);box-shadow:0 10px 30px rgba(0,0,0,.55),0 0 0 1px var(--tc-acc),0 0 24px color-mix(in srgb,var(--tc-acc) 35%,transparent)}
.tc-art{position:absolute;top:0;right:0;width:1200px;height:520px;transform-origin:top right;pointer-events:none}
.tc-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.tc-card:hover .tc-art,.tc-card:hover .tc-img{filter:brightness(1.12) saturate(1.1)}
.tc-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.35) 55%,rgba(0,0,0,.88) 100%)}
.tc-txt{position:absolute;left:0;right:0;bottom:0;padding:12px 14px 12px;display:flex;flex-direction:column;gap:3px;text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,.8)}
.tc-bar{width:44px;height:4px;border-radius:2px;background:var(--tc-acc)}
.tc-name{margin:0;line-height:1;font-size:clamp(22px,2.4vw,30px)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tc-meta{font-size:12px;color:#e6e6ea;display:flex;gap:8px;flex-wrap:wrap}
.tc-meta b{color:#fff}
.tc-back{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;background:transparent;border:1px solid var(--line);color:var(--fg,#eee);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer}
.tc-back:hover{border-color:#888}
</style>`);

const tcSlug = t => String(t).toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function tcArt(name){
  if(TEAM_IMG[name]) return `<img class="tc-img" src="${TEAM_IMG[name]}" alt="" loading="lazy">`;
  const A = typeof TEAM_ART !== "undefined" && TEAM_ART[name], V = typeof TEAM_ART_VALS !== "undefined" && TEAM_ART_VALS[name], t = DATA.teams[name];
  if(!A || !V || !t) return "";
  try{
    // SVG ids are unique per team but repeat if the same art is drawn twice; prefix them for the card copy
    let art = tbgRender(A.tpl, V(tbgRoster(t, t.info || {})));
    const p = "tc" + tcSlug(name).replace(/-/g, "") + "_";
    art = art.replace(/\bid="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`).replace(/href="#([^"]+)"/g, `href="#${p}$1"`);
    return `<div class="tc-art"><div style="position:absolute;inset:0;background:${A.bg}"></div>${art}</div>`;
  }catch(e){ console.error("team card art", name, e); return ""; }
}

// Fit the 1200×520 art into each card: scale so the picture (right ~680px of the stage) fills the card.
function tcFit(){
  document.querySelectorAll(".tc-card").forEach(c=>{
    const a = c.querySelector(".tc-art"); if(!a) return;
    const w = c.clientWidth, h = c.clientHeight;
    const s = Math.max(w / 680, h / 520);
    a.style.transform = `scale(${s})`;
    a.style.top = `${Math.min(0, (h - 520 * s) / 2)}px`;
  });
}
window.addEventListener("resize", ()=>{ clearTimeout(tcFit._t); tcFit._t = setTimeout(tcFit, 80); });

function tcGrid(){
  const order = (DATA.divisions && Object.values(DATA.divisions).flat().filter(t=>TEAMS.includes(t))) || [];
  const teams = [...new Set([...order, ...TEAMS])];
  const cards = teams.map(name=>{
    const t = DATA.teams[name] || {}, i = t.info || {}, A = (typeof TEAM_ART !== "undefined" && TEAM_ART[name]) || {};
    const acc = (String(A.eb||"").match(/color: ([^;]+);/)||[])[1] || "var(--green)";
    const h1 = String(A.h1||"").replace(/font-size:[^;]+;/, "");
    return `<div class="tc-card" role="button" tabindex="0" data-team="${esc(name)}" style="--tc-bg:${A.bg||"#151518"};--tc-acc:${acc}"
        onclick="goTeam(this.dataset.team)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goTeam(this.dataset.team)}" aria-label="Open ${esc(name)}">
      ${tcArt(name)}<div class="tc-shade"></div>
      <div class="tc-txt"><div class="tc-bar"></div>
        <h3 class="tc-name" style="${h1}">${esc(name)}</h3>
        <div class="tc-meta"><b>${rec(name)}</b>${i.owners?`<span>${esc(i.owners)}</span>`:""}${i.division?`<span>${esc(i.division)}</span>`:""}</div>
      </div></div>`;
  }).join("");
  setTimeout(tcFit, 0); setTimeout(tcFit, 400);
  return `<div class="tc-grid">${cards}</div>`;
}

// Team page header uses the generated image too, once one is listed in TEAM_IMG
if(typeof teamHero === "function"){
  const _heroPrev = teamHero;
  window.teamHero = function(name, ...rest){
    const html = _heroPrev(name, ...rest);
    if(!html || !TEAM_IMG[name]) return html;
    return html.replace(/<div class="tbg-stage" aria-hidden="true">[\s\S]*?<\/div>\s*<div class="tbg-shade">/,
      `<div class="tbg-stage" aria-hidden="true" style="width:100%;transform:none"><img src="${TEAM_IMG[name]}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:right center"></div>
    <div class="tbg-shade" style="display:block;opacity:.85">`);
  };
}

(function(){
  const _vTeamPage = window.vTeams, _goPrev = window.go, _goTeamPrev = window.goTeam;
  // Clicking the Teams tab (or any go('teams')) lands on the grid; goTeam(t) opens a team page.
  window.go = function(v){ if(v === "teams" && !window._tcOpening) state.teamsGrid = true; return _goPrev(v); };
  window.goTeam = function(t){ window._tcOpening = true; state.teamsGrid = false; try{ return _goTeamPrev(t); } finally { window._tcOpening = false; } };
  window.vTeams = function(){
    if(state.teamsGrid !== false) return tcGrid();
    return `<button class="tc-back" onclick="state.teamsGrid=true;render();window.scrollTo(0,0)">← All Teams</button>` + _vTeamPage();
  };
})();
