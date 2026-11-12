const SHOW_TABLE = false;   // owner 2026-11-11: no standings table yet
/* kick.ai · Equipos v2 (2026-11-11). Port of the approved prototype (docs/rediseno_1111/sitio/equipos.html) on our real data.
   Flow (owner): Liga (JAG, Liga Olivos) -> Torneo (tabla + resultados + goles) -> Equipo (tendencias) -> Partido.
   Data: window.EQ_DATA (preview) or data.enc (AES-GCM, key from the password, same lock as the live site). Clips: clips/ or enc/clips/. */
(function(){
"use strict";
const BASE = window.EQ_BASE || "";
let EQ = window.EQ_DATA || null, KEY = null, META = null;
const ENC = !window.EQ_DATA;
const KEYSTORE = "kickai-eq-key";

/* ================= HELPERS ================= */
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const icon = (id, cls="ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const tip = text => `<button class="tip" type="button" data-tip="${esc(text)}" aria-label="Qué significa">${icon("info")}</button>`;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lum = hex => { const v = parseInt(hex.slice(1), 16); return (0.299 * (v >> 16) + 0.587 * (v >> 8 & 255) + 0.114 * (v & 255)) / 255; };
const B64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const DIAS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const ddmm = d => { const [, m, z] = d.split("-"); return `${z}/${m}`; };
const largo = d => { const [a, m, z] = d.split("-"); return `${DIAS[new Date(+a, +m - 1, +z).getDay()]} ${z}/${m}`; };
// Crests the clubs published (owner's sisters' package). Others get a drawn shield with initials.
const CRESTS = {"manchester-city":"mancity", carioca:"carioca", liverpool:"liverpool", "ultimo-minuto":"ultimo", juventus:"juventus", "tirame-un-centro":"tirame",
  "tirame-un-centro-fc":"tirame", "tinto-de-verano-fc":"tinto", "ascendente-en-leo":"leo", "manchester-united":"united", "mal-clima-fc":"malclima", "play-futbol-fc":"playfutbol", psg:"psg", tinto:"tinto", "mal-clima":"malclima", "play-futbol":"playfutbol"};
const COPA_JAG = n => /copa\s*jag/i.test(n);

/* ================= DATA (real) ================= */
let TEAMS = {}, MATCHES = [], TOURN = [], ORGS = [];
function prepare(){
  TEAMS = {};
  for (const [id, t] of Object.entries(EQ.teams)){
    const w = t.name.replace(/\b(fc|club|cf)\b/ig, "").trim().split(/\s+/);
    const c1 = t.color || "#9AA0A4";
    TEAMS[id] = {name: t.name, c1, c2: "#FFFFFF", ini: (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase(), pat: "diag",
      hero: lum(c1) < .2 ? "#6B7280" : null, crest: CRESTS[id] || null};
  }
  TOURN = EQ.tournaments.map(t => ({...t, org: t.group || "JAG"}));
  const orgs = [...new Set(TOURN.map(t => t.org))];
  ORGS = orgs.map(o => ({id: slug(o), name: o, t: TOURN.filter(t => t.org === o)}));
  MATCHES = EQ.matches.map(m => {
    const n = [0, 0]; m.goals.forEach(g => n[g.team === m.home ? 0 : 1]++);
    const goals = m.goals.map((g, i) => {
      const [mm, half] = g.when.split(" · "), [a, b] = mm.split(":").map(Number);
      return {i, team: g.team, clip: g.clip, half: half === "2T" ? 2 : 1, sec: g.sec != null ? g.sec : a * 60 + b, min: a + 1};
    }).sort((x, y) => x.half - y.half || x.sec - y.sec);
    goals.forEach((g, k) => g.n = k);
    return {...m, hs: n[0], as: n[1], goals};
  });
  TOURN.forEach(t => {
    const ds = [...new Set(MATCHES.filter(m => m.tournament === t.id).map(m => m.date))].sort();
    t.fechas = ds.map((d, k) => {
      const f = MATCHES.find(m => m.tournament === t.id && m.date === d && m.fecha != null);
      return {key: d, n: f ? f.fecha : null, idx: k, date: ddmm(d), long: largo(d)};
    });
    t.teams = [...new Set(MATCHES.filter(m => m.tournament === t.id).flatMap(m => [m.home, m.away]))];
  });
  MATCHES.forEach(m => { const t = TOURN.find(x => x.id === m.tournament); m.F = t.fechas.find(f => f.key === m.date); m.T = t; });
}
const fLabel = F => F.n != null ? `Fecha ${F.n}` : F.date;          // no fixture yet: the day is the 'fecha'
const fShort = F => F.n != null ? `F${F.n}` : F.date;

/* ================= SHIELD ================= */
let shieldSeq = 0;
function shield(id, size=40){
  const t = TEAMS[id], u = "s" + (shieldSeq++);
  if (t.crest) return `<img class="shield crest" src="${BASE}escudos/${t.crest}.webp" width="${size}" height="${size}" alt="Escudo de ${esc(t.name)}" loading="lazy">`;
  const P = "M32 3 L57 11 V30 C57 46 46 56 32 61 C18 56 7 46 7 30 V11 Z";
  return `<svg class="shield" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="Escudo de ${esc(t.name)}">
    <defs><clipPath id="${u}"><path d="${P}"/></clipPath><linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <g clip-path="url(#${u})"><rect width="64" height="64" fill="${t.c1}"/><path d="M-4 46 L46 -4 H62 L4 62 H-4Z" fill="rgba(255,255,255,.22)"/><rect width="64" height="64" fill="url(#${u}g)"/></g>
    <path d="${P}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
    <text x="32" y="38" text-anchor="middle" font-family="Figtree, sans-serif" font-weight="800" font-size="17" fill="#fff" stroke="rgba(8,8,10,.8)" stroke-width="3.4" paint-order="stroke" letter-spacing=".5">${esc(t.ini)}</text>
  </svg>`;
}
const tcol = id => lum(TEAMS[id].c1) < .2 ? "#9AA0A4" : TEAMS[id].c1;   // DESIGN.md: very dark team colours read grey on the dark page

/* ================= STATS ================= */
function outcome(m, id){
  const home = m.home === id, gf = home ? m.hs : m.as, ga = home ? m.as : m.hs;
  return {gf, ga, rival: home ? m.away : m.home, cls: gf > ga ? "w" : gf === ga ? "d" : "l", L: gf > ga ? "G" : gf === ga ? "E" : "P"};
}
function teamStats(id, tid){
  const s = {id, played:0, w:0, d:0, l:0, gf:0, ga:0, poss:[], matches:[], goals:[]};
  MATCHES.filter(m => (!tid || m.tournament === tid) && (m.home === id || m.away === id)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach(m => {
    const o = outcome(m, id);
    s.played++; s.gf += o.gf; s.ga += o.ga; s[o.cls]++;
    s.poss.push(m.home === id ? m.poss.total[0] : m.poss.total[1]); s.matches.push(m);
    m.goals.forEach(g => { if (g.team === id) s.goals.push({m, g}); });
  });
  s.pts = s.w * 3 + s.d; s.gd = s.gf - s.ga;
  s.possAvg = s.poss.length ? Math.round(s.poss.reduce((a, b) => a + b, 0) / s.poss.length) : 0;
  return s;
}
const formHTML = s => s.matches.slice(-3).map(m => { const o = outcome(m, s.id); return `<i class="${o.cls}">${o.L}</i>`; }).join("");
// Group tables when the organiser's fixture (groups) is loaded: EQ.tournaments[].groups = {A:[team ids], ...};
// without groups: one position table of every team that played in the tournament (owner 2026-11-11).
const groupsOf = T => T.groups || {"": T.teams};
function groupRows(T, g){
  return groupsOf(T)[g].map(id => teamStats(id, T.id)).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || TEAMS[a.id].name.localeCompare(TEAMS[b.id].name))
    .map((s, i) => ({...s, rank: i + 1}));
}
function groupTable(T, g, highlight){
  const rows = groupRows(T, g);
  const dg = n => n > 0 ? "+" + n : String(n);
  return `<div class="group">${g ? `<h3 class="gname">Grupo ${g}</h3>` : ""}<div class="table full">
      <div class="thead"><span>#</span><span></span><span>Equipo</span><span class="r" title="Partidos jugados">PJ</span><span class="r" title="Diferencia de gol">DG</span><span class="r">Forma</span><span class="r">Pts</span></div>
      ${rows.map(s => `<a class="row ${s.id === highlight ? "me" : ""}" href="#equipo/${T.id}/${s.id}">
        <span class="rank"><b class="num">${s.rank}</b></span>${shield(s.id, 30)}
        <span class="tname">${esc(TEAMS[s.id].name)}</span><span class="r num">${s.played}</span><span class="r num">${dg(s.gd)}</span><span class="form">${formHTML(s)}</span><span class="pts num">${s.pts}</span></a>`).join("")}
    </div></div>`;
}

/* ================= STATE / HEADER ================= */
const app = $("#app");
const state = {fecha: {}, goal: 0, pendingGoal: null, chart: "goals", mtab: "played", stab: 0, from: null};
let player = null;
function setCtx(F){
  const el = $("#ctx");
  if (!F){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = F.n != null ? `${icon("calendar")}<span>Fecha <b>${F.n}</b> · ${F.date}</span>` : `${icon("calendar")}<span><b>${F.date}</b></span>`;
}

/* ================= BANNERS ================= */
function jagBanner(title, kicker, tags){
  return `<section class="jag">
      <svg class="jag-swoosh" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="gw" x1="0" x2="1"><stop offset="0" stop-color="#F1DDA6" stop-opacity="0"/><stop offset=".6" stop-color="#F1DDA6" stop-opacity=".9"/><stop offset="1" stop-color="#F1DDA6" stop-opacity="0"/></linearGradient></defs>
        <g fill="none" stroke="url(#gw)" stroke-width="1"><path d="M180 310 C 260 220, 330 180, 420 170"/><path d="M200 310 C 270 230, 340 195, 420 186" opacity=".6"/><path d="M220 310 C 285 240, 345 210, 420 202" opacity=".35"/><path d="M-20 40 C 60 30, 120 10, 170 -20" opacity=".5"/><path d="M300 -10 C 330 40, 370 70, 420 80" opacity=".45"/></g>
      </svg>
      <span class="jag-kicker">${esc(kicker)}</span>
      <svg class="jag-mono" viewBox="0 0 120 130" aria-hidden="true">
        <defs><linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6E6B8"/><stop offset="1" stop-color="#B8924A"/></linearGradient></defs>
        <g fill="url(#gm)" font-family="Cinzel, serif" font-weight="700" text-anchor="middle">
          <text x="60" y="88" font-size="92">A</text><text x="70" y="104" font-size="58">G</text><text x="48" y="56" font-size="54">J</text>
        </g>
      </svg>
      <h1>${esc(title)}</h1>
      ${tags && tags.length ? `<div class="jag-tags">${tags.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
    </section>`;
}
function plainBanner(title, kicker){
  return `<section class="tban"><span class="tban-k">${esc(kicker)}</span><h1>${esc(title)}</h1></section>`;
}
const isJag = org => /^jag$/i.test(org);
function orgBanner(o){ return isJag(o.name) ? jagBanner(o.name, "Liga", []) : plainBanner(o.name, "Liga"); }
function tBanner(T){
  if (COPA_JAG(T.name)) return jagBanner(T.name, `Una copa. ${T.teams.length} equipos. Un campeón`, ["Edición I", "#MásQueFútbol"]);
  return isJag(T.org) ? jagBanner(T.name, T.org, []) : plainBanner(T.name, T.org);
}

/* ================= LIGAS / TORNEOS ================= */
function viewOrgs(){
  return `<div class="view">
    <div class="intro rise"><h1>Elegí tu <em>liga</em></h1><p>Resultados, goles y videos de cada fecha.</p></div>
    <div class="tgrid">
      ${ORGS.map((o, i) => { const n = new Set(o.t.flatMap(t => t.teams)).size, last = o.t.flatMap(t => t.fechas).sort((a, b) => a.key.localeCompare(b.key)).pop();
        return `<a class="tcard rise" style="--i:${i + 1}" href="#liga/${o.id}" aria-label="Entrar a ${esc(o.name)}">${orgBanner(o)}
        <div class="tcard-foot"><span class="pill">${icon("trophy")}${o.t.length} ${o.t.length === 1 ? "torneo" : "torneos"}</span><span class="pill">${icon("users")}${n} equipos</span>
        ${last ? `<span class="pill">${icon("calendar")}Último: ${last.date}</span>` : ""}<span class="go">Entrar${icon("next")}</span></div></a>`; }).join("")}
      <div class="tcard soon rise" style="--i:${ORGS.length + 1}"><span class="art">${icon("trophy")}</span><h3>Más ligas pronto</h3><p>Cuando tu liga grabe con kick.ai, aparece acá.</p></div>
    </div></div>`;
}
function viewOrg(oid){
  const o = ORGS.find(x => x.id === oid); if (!o) return viewNotFound();
  return `<div class="view">
    <a class="back" href="#">${icon("back")}Ligas</a>
    <div class="intro rise"><h1>${esc(o.name)} · elegí tu <em>torneo</em></h1><p>Resultados, goles y videos de cada fecha.</p></div>
    <div class="tgrid">
      ${o.t.map((T, i) => { const last = T.fechas[T.fechas.length - 1];
        return `<a class="tcard rise" style="--i:${i + 1}" href="#t/${T.id}" aria-label="Entrar a ${esc(T.name)}">${tBanner(T)}
        <div class="tcard-foot"><span class="pill">${icon("users")}${T.teams.length} equipos${T.groups ? ` · ${Object.keys(T.groups).length} grupos` : ""}</span>
        ${last ? `<span class="pill">${icon("calendar")}${fLabel(last)}${last.n != null ? ` · ${last.date}` : ""}</span>` : `<span class="pill"><span class="live-dot"></span>Arranca hoy</span>`}
        <span class="go">Entrar${icon("next")}</span></div></a>`; }).join("")}
      <div class="tcard soon rise" style="--i:${o.t.length + 1}"><span class="art">${icon("trophy")}</span><h3>Más torneos pronto</h3><p>Los próximos torneos de ${esc(o.name)} aparecen acá.</p></div>
    </div></div>`;
}

/* ================= TORNEO ================= */
function matchCard(m, i = 0){
  const team = (id, lost) => `<span class="rt ${lost ? "lost" : ""}">${shield(id, 44)}<span>${esc(TEAMS[id].name)}</span></span>`;
  const hw = m.hs > m.as, aw = m.as > m.hs;
  return `<a class="result rise" style="--i:${i}" href="#partido/${m.id}">${team(m.home, aw)}
    <span class="rs"><b class="num">${m.hs}<i>–</i>${m.as}</b><span class="vid">${icon("film")}${m.goals.length ? "Ver goles" : "Ver partido"}</span><span>${esc(m.field)} · ${m.time} h</span></span>${team(m.away, hw)}
  </a>`;
}
function resultsHTML(T, key){
  const list = MATCHES.filter(m => m.tournament === T.id && m.date === key).sort((a, b) => a.time.localeCompare(b.time));
  return list.length ? list.map(matchCard).join("") : `<div class="empty" style="grid-column:1/-1"><span class="art">${icon("calendar")}</span><h3>Sin partidos cargados</h3><p>Los partidos aparecen cuando se procesan.</p></div>`;
}
function goalCards(list){
  return list.map((x, i) => `<button class="hl rise" style="--i:${i}" type="button" data-goto="${x.m.id}" data-goal="${x.g.n}">
      <span class="hl-thumb" style="--c:${tcol(x.g.team)}"><span class="kind">Gol</span><span class="play">${icon("play")}</span>
        <span class="shields">${shield(x.m.home, 26)}${shield(x.m.away, 26)}</span><span class="dur">${x.g.min}' · ${x.g.half}T</span></span>
      <strong>Gol de ${esc(TEAMS[x.g.team].name)}</strong>
      <span class="meta">${esc(TEAMS[x.m.home].name)} ${x.m.hs}–${x.m.as} ${esc(TEAMS[x.m.away].name)} · ${fShort(x.m.F)}</span>
    </button>`).join("");
}
function viewTournament(tid){
  const T = TOURN.find(x => x.id === tid); if (!T) return viewNotFound();
  const o = ORGS.find(x => x.name === T.org);
  if (!T.fechas.find(f => f.key === state.fecha[tid])) state.fecha[tid] = (T.fechas[T.fechas.length - 1] || {}).key;
  const fechaBtns = T.fechas.map(F => `<button class="fecha" type="button" data-fecha="${F.key}" aria-pressed="${F.key === state.fecha[tid]}" aria-label="${fLabel(F)}, ${F.long}">${fLabel(F)}</button>`).join("");
  const lastF = MATCHES.filter(m => m.tournament === tid && m.date === state.fecha[tid]);
  const gl = lastF.flatMap(m => m.goals.map(g => ({m, g})));
  const table = T.groups
    ? `<div class="groups">${Object.keys(T.groups).map(g => groupTable(T, g)).join("")}</div>`
    : groupTable(T, "");
  return `<div class="view">
    <a class="back" href="#liga/${o ? o.id : ""}">${icon("back")}${esc(T.org)}</a>
    <div class="rise">${tBanner(T)}</div>
    ${SHOW_TABLE ? `<section class="section">
      <div class="sh"><h2>${icon("list")}${T.groups ? "Grupos" : "Tabla de posiciones"}</h2><span class="aside">${tip("Ganar suma <b>3</b>, empatar <b>1</b>, perder <b>0</b>. Empate en puntos: diferencia de gol, después goles a favor. <b>PJ</b> partidos jugados, <b>DG</b> diferencia de gol. En Forma: <b>G</b> ganó, <b>E</b> empató, <b>P</b> perdió.")}</span></div>
      ${table}
    </section>` : ""}
    <section class="section">
      <div class="sh"><h2>${icon("ball")}Resultados</h2></div>
      <div class="fechas" role="group" aria-label="Elegí la fecha">${fechaBtns}</div>
      <div class="results" id="results">${resultsHTML(T, state.fecha[tid])}</div>
    </section>
    <section class="section">
      <div class="sh"><h2>${icon("film")}Goles de la fecha</h2><span class="aside" id="hlCount">${gl.length} ${gl.length === 1 ? "gol" : "goles"}</span></div>
      <div id="hlBox">${gl.length ? `<div class="hl-strip">${goalCards(gl)}</div>` : `<div class="empty"><span class="art">${icon("film")}</span><h3>Sin goles en esta fecha</h3><p>Los goles de cada fecha aparecen acá.</p></div>`}</div>
    </section>
  </div>`;
}

/* ================= EQUIPO ================= */
function lineChart(id, vals, x, y, grid, fmt, W, H, L, R, labels, aria, ref){
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
  const c = tcol(id), n = vals.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
    ${grid.map(([gy, t]) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}"/><text x="${L - 8}" y="${gy + 4}" text-anchor="end">${t}</text>`).join("")}
    ${ref != null ? `<line x1="${L}" x2="${W - R}" y1="${ref}" y2="${ref}" stroke="rgba(255,255,255,.28)" stroke-dasharray="4 4"/>` : ""}
    <path class="line" d="${d}" stroke="${c}" style="--len:${Math.ceil(len) + 1}"/>
    ${pts.map((p, i) => `<g class="pt" style="--i:${i}"><circle cx="${p[0]}" cy="${p[1]}" r="${i === n - 1 ? 4.5 : 3}" fill="${i === n - 1 ? "#FF6B1F" : c}" stroke="#131517" stroke-width="1.5"/><text class="val" x="${p[0]}" y="${p[1] - 12}" text-anchor="middle">${fmt(vals[i])}</text></g>`).join("")}
    ${pts.map((p, i) => `<text x="${p[0]}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`).join("")}
  </svg>`;
}
function chartPoss(s){
  const W = 320, H = 170, L = 48, R = 18, T = 24, B = 26, n = s.poss.length;
  const x = i => L + (W - L - R) * (n > 1 ? i / (n - 1) : .5), y = v => T + (H - T - B) * (1 - (v - 20) / 60);
  return lineChart(s.id, s.poss, x, y, [[y(80), "80%"], [y(50), "50%"], [y(20), "20%"]], v => v + "%", W, H, L, R, s.matches.map(m => fShort(m.F)),
    `Posesión por partido: ${s.poss.map((v, i) => `${fLabel(s.matches[i].F)}, ${v}%`).join("; ")}`, y(50));
}
function chartGoals(s){
  const W = 320, H = 190, L = 14, R = 14, n = s.matches.length;
  const maxF = Math.max(1, ...s.matches.map(m => outcome(m, s.id).gf)), maxA = Math.max(1, ...s.matches.map(m => outcome(m, s.id).ga));
  const top = 22, bottom = H - 40, scale = (bottom - top) / (maxF + maxA), mid = top + maxF * scale;
  const step = (W - L - R) / n, bw = Math.min(16, step * .3);
  const bars = s.matches.map((m, i) => {
    const o = outcome(m, s.id), cx = L + step * (i + .5);
    return `${o.gf ? `<rect class="barg" style="--i:${i}" x="${cx - bw/2}" y="${mid - o.gf * scale}" width="${bw}" height="${o.gf * scale}" rx="4" fill="#34D399"/><text class="val" x="${cx}" y="${mid - o.gf * scale - 6}" text-anchor="middle">${o.gf}</text>` : `<text class="val" x="${cx}" y="${mid - 6}" text-anchor="middle" style="fill:var(--faint)">0</text>`}
      ${o.ga ? `<rect class="barc" style="--i:${i}" x="${cx - bw/2}" y="${mid + 2}" width="${bw}" height="${o.ga * scale}" rx="4" fill="#F87171"/><text class="val" x="${cx}" y="${mid + o.ga * scale + 16}" text-anchor="middle">${o.ga}</text>` : ""}
      <text x="${cx}" y="${H - 4}" text-anchor="middle">${fShort(m.F)}</text>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Goles a favor y en contra por partido">
    <line class="grid" x1="${L}" x2="${W - R}" y1="${mid + 1}" y2="${mid + 1}"/>${bars}</svg>
    <div class="legend"><span><i style="--c:#34D399"></i>A favor</span><span><i style="--c:#F87171"></i>En contra</span></div>`;
}
const MIN_TREND = 3;   // HANDOFF: configurable
// EXAMPLE mode (owner 2026-11-11, only with ?ejemplo in the link): 4 invented earlier matches per team so the Evolución chart can be seen. Labelled on the page; real numbers untouched.
const DEMO = /[?&]ejemplo\b/.test(location.search);
function demoStats(s){
  if (!DEMO || !s.matches.length) return s;
  let r = 0; for (const ch of s.id) r = (r * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => (r = (r * 1103515245 + 12345) >>> 0) / 4294967296, others = Object.keys(TEAMS).filter(k => k !== s.id);
  const first = s.matches[0], d0 = new Date(first.date + "T12:00:00"), fake = [];
  for (let k = 4; k >= 1; k--){
    const d = new Date(d0.getTime() - k * 7 * 864e5), key = d.toISOString().slice(0, 10), gf = Math.floor(rnd() * 5), ga = Math.floor(rnd() * 4), pp = 35 + Math.round(rnd() * 30);
    fake.push({id: "", date: key, home: s.id, away: others[Math.floor(rnd() * others.length)], hs: gf, as: ga, poss: {total: [pp, 100 - pp]}, goals: [], F: {key, n: null, date: ddmm(key), long: largo(key)}});
  }
  const ms = fake.concat(s.matches);
  return {...s, matches: ms, poss: fake.map(m => m.poss.total[0]).concat(s.poss), played: ms.length};
}
function chartFor(s){ s = demoStats(s); return (DEMO ? `<p class="demo-tag">Ejemplo — los partidos anteriores al ${s.matches[s.matches.length - 1].F.date} son inventados</p>` : "") + (state.chart === "poss" ? chartPoss(s) : chartGoals(s)); }
function teamMatchesHTML(id, s){
  if (state.mtab === "next") return `<div class="empty"><span class="art">${icon("calendar")}</span><h3>Próximo partido a confirmar</h3><p>Cuando la organización lo programe, aparece acá.</p></div>`;
  if (!s.played) return `<div class="empty"><span class="art">${icon("whistle")}</span><h3>Todavía sin partidos</h3><p>Su primer partido aparece acá.</p></div>`;
  return `<div class="formstrip">${s.matches.map((m, i) => { const o = outcome(m, id); return `
    <a class="fm ${o.cls} rise" style="--i:${i}" href="#partido/${m.id}" aria-label="${fLabel(m.F)}: ${o.gf} a ${o.ga} contra ${esc(TEAMS[o.rival].name)}">
      <small>${fLabel(m.F)}</small>${shield(o.rival, 76)}<span class="sc num">${o.gf}-${o.ga}</span></a>`; }).join("")}</div>`;
}
// Heat map (owner 2026-11-11, Sofascore style): smoothed density from web_heat.py, attack to the right, colours from transparent green to red.
function drawHeat(m){
  const cv = $("#heat"); if (!cv || !m.heat) return;
  const H = m.heat, team = H.teams[state.hteam] ? state.hteam : m.home, half = H.teams[team][state.hhalf] ? state.hhalf : "all", G = H.teams[team][half];
  const dp = devicePixelRatio || 1, w = cv.getBoundingClientRect().width || 600, h = w * H.ratio;
  cv.style.height = h + "px"; cv.width = Math.round(w * dp); cv.height = Math.round(h * dp);
  const g = cv.getContext("2d"), W = cv.width, Hh = cv.height, lw = Math.max(1, W / 320);
  g.fillStyle = "#123a26"; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 12; i++) if (i % 2){ g.fillStyle = "rgba(255,255,255,.03)"; g.fillRect(i * W / 12, 0, W / 12, Hh); }
  // density -> colour (transparent at low values), drawn small then scaled up smooth
  const o = document.createElement("canvas"); o.width = H.nx; o.height = H.ny; const ox = o.getContext("2d"), im = ox.createImageData(H.nx, H.ny);
  const stops = [[0, [40, 160, 90]], [.35, [120, 200, 60]], [.6, [250, 220, 50]], [.8, [250, 140, 30]], [1, [230, 40, 30]]];
  for (let k = 0; k < G.length; k++){
    const v = G[k] / 255; let a = stops[0], b = stops[stops.length - 1];
    for (let j = 1; j < stops.length; j++) if (v <= stops[j][0]){ a = stops[j - 1]; b = stops[j]; break; }
    const t = (v - a[0]) / Math.max(1e-6, b[0] - a[0]);
    for (let c = 0; c < 3; c++) im.data[4 * k + c] = Math.round(a[1][c] + (b[1][c] - a[1][c]) * t);
    im.data[4 * k + 3] = v < .06 ? 0 : Math.round(255 * Math.min(.85, .15 + v * .8));
  }
  ox.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(o, 0, 0, W, Hh);
  // pitch lines on top
  g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = lw; const p = lw;
  g.strokeRect(p, p, W - 2 * p, Hh - 2 * p);
  g.beginPath(); g.moveTo(W / 2, p); g.lineTo(W / 2, Hh - p); g.stroke();
  g.beginPath(); g.arc(W / 2, Hh / 2, Hh * .13, 0, 7); g.stroke();
  const bw = W * .15, bh = Hh * .48; g.strokeRect(p, (Hh - bh) / 2, bw, bh); g.strokeRect(W - p - bw, (Hh - bh) / 2, bw, bh);
  cv.setAttribute("aria-label", `Mapa de calor de ${TEAMS[team].name}, ${half === "all" ? "todo el partido" : half + "º tiempo"}, atacando hacia la derecha`);
}
function viewTeam(tid, id){
  const t = TEAMS[id], T = TOURN.find(x => x.id === tid); if (!t || !T) return viewNotFound();
  const s = teamStats(id, tid), g = T.groups ? Object.keys(T.groups).find(k => T.groups[k].includes(id)) : T.teams.includes(id) ? "" : null;
  const rank = g != null ? groupRows(T, g).find(x => x.id === id).rank : null, lastF = s.matches.length ? s.matches[s.matches.length - 1].F : null;
  state.from = id;
  const goals = s.goals.length ? `<div class="goal-strip">${s.goals.slice().reverse().map(x => `
      <button class="gcard" type="button" data-goto="${x.m.id}" data-goal="${x.g.n}">
        <span class="gthumb"><span class="f">${fShort(x.m.F)}${x.m.F.n != null ? " · " + x.m.F.date : ""}</span><span class="play">${icon("play")}</span></span>
        <strong>vs ${esc(TEAMS[x.m.home === id ? x.m.away : x.m.home].name)}</strong>
        <span>Min ${x.g.min} · ${x.g.half}T</span>
      </button>`).join("")}</div>`
    : `<div class="empty"><span class="art">${icon("ball")}</span><h3>Todavía sin goles</h3><p>El primero va a aparecer acá.</p></div>`;
  const trend = demoStats(s).played >= MIN_TREND;
  if (state.teamSeen !== id){ state.teamSeen = id; state.mtab = "played"; }
  const seg = (k, l) => `<button type="button" data-chart="${k}" aria-pressed="${state.chart === k}">${l}</button>`;
  const mseg = (k, l) => `<button type="button" data-mtab="${k}" aria-pressed="${state.mtab === k}">${l}</button>`;
  return `<div class="view">
    <a class="back" href="#t/${tid}">${icon("back")}${esc(T.name)}</a>
    <div class="view tight">
      <section class="club rise" style="--tc:${t.hero || t.c1}">
        <div class="club-id">${shield(id, 64)}<h1>${esc(t.name)}</h1><p>${esc(T.name)}${g ? ` · Grupo ${g}` : ""}</p></div>
        ${rank && SHOW_TABLE ? `<div class="pos"><b class="num">${rank}<sup>º</sup></b><span>${g ? `Grupo ${g}` : "En la tabla"}${lastF ? " · " + fShort(lastF) : ""}</span></div>`
          : `<div class="pos"><b class="num" style="font-size:clamp(56px,16vw,84px)" data-count="${s.played}">${s.played}</b><span>${s.played === 1 ? "partido jugado" : "partidos jugados"}</span></div>`}
      </section>
      <div class="big4 rise" style="--i:1">
        <div><strong class="num" data-count="${s.pts}">${s.pts}</strong><span>Puntos</span></div>
        <div class="gf"><strong class="num" data-count="${s.gf}">${s.gf}</strong><span>Goles a favor</span></div>
        <div class="ga"><strong class="num" data-count="${s.ga}">${s.ga}</strong><span>Goles en contra</span></div>
        <div><strong class="num">${s.played ? `<span data-count="${s.possAvg}">${s.possAvg}</span>%` : "–"}</strong><span>Posesión de pelota</span></div>
      </div>
    </div>
    <div class="two">
      <div class="view">
        <section class="section">
          <div class="sh"><h2>${icon("whistle")}Partidos</h2><div class="seg" role="group" aria-label="Partidos">${mseg("played","Jugados")}${mseg("next","Próximos")}</div></div>
          <div id="mBox" class="mbox">${teamMatchesHTML(id, s)}</div>
        </section>
        <section class="section">
          <div class="sh"><h2>${icon("chart")}Evolución</h2>${trend ? `<div class="seg" role="group" aria-label="Qué mostrar">${seg("goals","Goles")}${seg("poss","Posesión")}</div>` : ""}</div>
          ${trend ? `<div class="chart-card"><div id="chartBox">${chartFor(s)}</div></div>`
            : `<div class="empty"><span class="art">${icon("chart")}</span><h3>Faltan partidos</h3><p>Con ${MIN_TREND} partidos jugados ves la evolución. Van ${s.played} de ${MIN_TREND}.</p></div>`}
        </section>
        <section class="section">
          <div class="sh"><h2>${icon("film")}Goles</h2><span class="aside">${s.goals.length} en ${s.played} ${s.played === 1 ? "partido" : "partidos"}</span></div>
          ${goals}
        </section>
      </div>
      <div class="view">
        ${SHOW_TABLE ? `<section class="section">
          <div class="sh"><h2>${icon("list")}Posición</h2><a class="aside" href="#t/${tid}">Todos${icon("next")}</a></div>
          ${g != null ? groupTable(T, g, id) : `<div class="empty"><span class="art">${icon("list")}</span><h3>La tabla llega con el fixture</h3><p>Cuando la organización cargue grupos y fechas.</p></div>`}
        </section>` : ""}
      </div>
    </div>
  </div>`;
}

/* ================= PARTIDO ================= */
function statsHTML(m){
  const H = TEAMS[m.home], A = TEAMS[m.away], k = state.stab;
  const half = k === 1 ? 1 : k === 2 ? 2 : 0;
  const gh = m.goals.filter(g => g.team === m.home && (!half || g.half === half)).length, ga = m.goals.filter(g => g.team === m.away && (!half || g.half === half)).length;
  const poss = [m.poss.total, m.poss.h1, m.poss.h2][k];
  const row = (label, h, a, pct, tipTxt) => {
    const tot = h + a, hp = pct ? h : tot ? Math.round(h / tot * 100) : 50;
    const fmt = v => pct ? v + "%" : v;
    return `<div class="srow"><span class="lbl">${label}${tipTxt ? tip(tipTxt) : ""}</span>
      <b class="num ${h > a ? "lead" : ""}">${fmt(h)}</b>
      <div class="bar" role="img" aria-label="${label}: ${esc(H.name)} ${fmt(h)}, ${esc(A.name)} ${fmt(a)}">${tot || pct ? `<i style="--c:${tcol(m.home)};--w:${hp}%"></i><i style="--c:${tcol(m.away)};--w:${100 - hp}%"></i>` : `<i style="--c:var(--surface-3);--w:100%"></i>`}</div>
      <b class="num ${a > h ? "lead" : ""}">${fmt(a)}</b></div>`;
  };
  let s = row("Posesión", poss[0], poss[1], true, "Qué parte del tiempo tuvo la pelota cada equipo.") + row("Goles", gh, ga);
  if (m.shots) s += half ? "" : row("Tiros al arco", m.shots[0], m.shots[1], false, "Remates que iban adentro del arco.");
  const co = half && m.corners_h ? m.corners_h[half - 1] : !half ? m.corners : null;
  if (co) s += row("Tiros de esquina", co[0], co[1], false, "Córners.");
  return s;
}
function viewMatch(mid){
  const m = MATCHES.find(x => x.id === mid); if (!m) return viewNotFound();
  const H = TEAMS[m.home], A = TEAMS[m.away], F = m.F;
  if (state.hmatch !== mid){ state.hmatch = mid; state.hteam = state.from === m.away ? m.away : m.home; state.hhalf = "all"; }
  const hw = m.hs > m.as, aw = m.as > m.hs, winner = hw ? m.home : aw ? m.away : null;
  if (state.pendingGoal != null){ state.goal = state.pendingGoal; state.pendingGoal = null; }
  else if (state.match !== m.id) state.goal = 0;
  if (state.match !== m.id) state.stab = 0;
  state.match = m.id;
  const confetti = winner ? `<div class="confetti" aria-hidden="true">${Array.from({length:24}, (_, k) => {
      const a = (k / 24) * Math.PI * 2, d = 80 + (k % 5) * 28;
      return `<i style="--c:${[tcol(winner), "#FF6B1F", "#fff", "#FBBF24"][k % 4]};--x:${Math.round(Math.cos(a) * d * 1.6)}px;--y:${Math.round(Math.sin(a) * d)}px;--r:${(k * 47) % 360}deg;--d:${(k % 6) * 30}ms"></i>`;
    }).join("")}</div>` : "";
  const chips = m.goals.map((g, i) => `<button class="gchip" type="button" data-goal="${i}" aria-pressed="${i === state.goal}" style="--c:${tcol(g.team)}"><i></i>Gol ${i + 1}<small>${g.min}'</small></button>`).join("");
  const pl = !m.goals.length
    ? `<div class="empty"><span class="art">${icon("ball")}</span><h3>Partido sin goles</h3><p>Terminó ${m.hs} a ${m.as}.</p></div>`
    : `<div class="player">
      <div class="stage" id="stage"><video id="v" playsinline muted preload="auto"></video><canvas id="ov" aria-hidden="true"></canvas><div class="slabel" id="slabel"></div><div class="gol" id="gol">¡GOL!</div><span class="sload" id="sload">Cargando…</span><canvas id="mp" class="minimap" aria-label="Mapa de la jugada visto desde arriba"></canvas>
        <div class="vtoggles" role="group" aria-label="Qué mostrar sobre el video">
          <button type="button" class="vt" data-layer="players" aria-pressed="true">Jugadores</button><button type="button" class="vt" data-layer="lines" aria-pressed="true">Cancha</button><button type="button" class="vt" data-layer="map" aria-pressed="true">Mapa</button>
        </div><button class="fsbtn" type="button" id="fsG" aria-label="Pantalla completa">${icon("expand")}</button></div>
      <div class="controls">
        <button class="ibtn" type="button" id="prevG" aria-label="Gol anterior">${icon("prev")}</button>
        <button class="playb" type="button" id="playG" aria-label="Reproducir">${icon("play")}</button>
        <button class="ibtn" type="button" id="nextG" aria-label="Gol siguiente">${icon("next")}</button>
        <input class="scrub" id="scrub" type="range" min="0" max="1000" value="0" aria-label="Avance del video">
      </div>
      <div class="gchips" role="group" aria-label="Elegí un gol">${chips}</div>
      <div class="actions">
        <button class="btn btn-primary" type="button" id="dlG">${icon("download")}Descargar</button>
        <button class="btn btn-ghost" type="button" id="shG">${icon("share")}Compartir</button>
      </div>
    </div>`;
  const L1 = (m.len && m.len[0]) || 1500, L2 = (m.len && m.len[1]) || 1500;
  const last = {home:-99, away:-99}, lvl = {home:1, away:1};
  const lanes = m.goals.map((g, i) => {
    const pos = Math.min(97, Math.max(3, m.single ? 100 * g.sec / L1 : g.half === 1 ? 50 * g.sec / L1 : 50 + 50 * g.sec / L2));
    const side = g.team === m.home ? "home" : "away";
    const lv = pos - last[side] < 9 ? 1 - lvl[side] : 0; last[side] = pos; lvl[side] = lv;
    return `<button class="tgoal ${side} ${i === state.goal ? "sel" : ""}" type="button" data-goal="${i}" style="left:${pos}%;--lv:${lv ? 38 : 4}px;--stem:${lv ? 9 : 43}px;--c:${tcol(g.team)};--i:${i}" aria-label="Gol ${i + 1} de ${esc(TEAMS[g.team].name)}, minuto ${g.min}, ${g.half}T">${icon("ball")}</button>`;
  }).join("");
  const lines = `<svg class="pitchlines" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#FF6B1F" stroke-width="1"><rect x="-60" y="30" width="140" height="240"/><rect x="-60" y="95" width="70" height="110"/><rect x="320" y="30" width="140" height="240"/><rect x="390" y="95" width="70" height="110"/></g></svg>`;
  const stab = (i, l) => `<button type="button" data-stab="${i}" aria-pressed="${state.stab === i}">${l}</button>`;
  return `<div class="view">
    <a class="back" href="#" data-back>${icon("back")}Volver</a>
    <section class="mhero" style="--hc:${tcol(m.home)};--ac:${tcol(m.away)}">
      ${lines}${confetti}
      <span class="fecha-ctx">${icon("calendar")}${F.n != null ? `Fecha ${F.n} · ` : ""}${F.long} · ${esc(m.T.name)}</span>
      <div class="duel">
        <a class="side ${aw ? "lost" : ""}" href="#equipo/${m.tournament}/${m.home}">${shield(m.home, 72)}<strong>${esc(H.name)}</strong></a>
        <div class="score num" aria-label="Final ${m.hs} a ${m.as}"><span data-count="${m.hs}">${m.hs}</span><i></i><span data-count="${m.as}">${m.as}</span></div>
        <a class="side ${hw ? "lost" : ""}" href="#equipo/${m.tournament}/${m.away}">${shield(m.away, 72)}<strong>${esc(A.name)}</strong></a>
      </div>
      <div class="hpills"><span class="pill">${icon("whistle")}Finalizado</span></div>
      <div class="hmeta"><span>${icon("clock")}${m.time} h</span><span>${icon("pin")}${esc(m.field)}</span></div>
    </section>
    <div class="two">
      <section class="section">
        <div class="sh"><h2>${icon("chart")}Resumen</h2><div class="seg" role="group" aria-label="Tiempo">${stab(0,"Global")}${m.single ? "" : stab(1,"T1") + stab(2,"T2")}</div></div>
        <div class="stats" id="stats">
          <div class="stats-head"><span class="who">${shield(m.home, 22)}${esc(H.name)}</span><span class="who">${esc(A.name)}${shield(m.away, 22)}</span></div>
          <div id="statRows" style="display:grid;gap:16px">${statsHTML(m)}</div>
        </div>
      </section>
      ${m.goals.length ? `<section class="section">
        <div class="sh"><h2>${icon("clock")}Minuto a minuto</h2></div>
        <div class="timeline">
          <div class="lanes"><span><i style="--c:${tcol(m.home)}"></i>${esc(H.name)}</span><span>${esc(A.name)}<i style="--c:${tcol(m.away)}"></i></span></div>
          <div class="track"><span class="lane"></span>${m.single ? "" : `<span class="ht"><span>Entretiempo</span></span>`}<span class="end" style="left:0">Inicio</span><span class="end" style="right:0">Final</span>${lanes}</div>
        </div>
      </section>` : ""}
    </div>
    ${m.heat ? `<section class="section">
      <div class="sh"><h2>${icon("chart")}Mapa de calor</h2><span class="aside">${tip("Dónde estuvieron los jugadores de cada equipo durante el partido (cada medio segundo de juego). Rojo = donde más estuvieron. Siempre atacando hacia la derecha.")}</span></div>
      <div class="heat-card">
        <div class="heat-ctl">
          <div class="seg" role="group" aria-label="Equipo">${[m.home, m.away].map(k => `<button type="button" data-hteam="${k}" aria-pressed="${state.hteam === k}"><i class="hdot" style="--c:${tcol(k)}"></i>${esc(TEAMS[k].name)}</button>`).join("")}</div>
          <div class="seg" role="group" aria-label="Tiempo">${["all","1","2"].filter(h => h === "all" || m.heat.halves.includes(h)).map(h => `<button type="button" data-hhalf="${h}" aria-pressed="${state.hhalf === h}">${h === "all" ? "Global" : "T" + h}</button>`).join("")}</div>
        </div>
        <canvas id="heat" class="heat" aria-label="Mapa de calor"></canvas>
        <div class="heat-foot"><span>Arco propio</span><span class="att">Ataca ${icon("next")}</span></div>
      </div>
    </section>` : ""}
    <section class="section">
      <div class="sh"><h2>${icon("film")}Goles</h2><span class="aside">${m.goals.length}</span></div>
      <div class="player-wrap">${pl}</div>
    </section>
  </div>`;
}
function viewNotFound(){
  return `<div class="view"><div class="empty" style="padding-block:44px"><span class="art">${icon("ball")}</span><h3>Página no encontrada</h3><p>El link puede estar mal copiado.</p><a class="btn btn-primary" href="#">Ir a las ligas</a></div></div>`;
}

/* ================= LOCK (same AES lock as the live site) ================= */
async function descifrar(url){ const r = await fetch(BASE + url); if (!r.ok) throw new Error("no file"); const b = new Uint8Array(await r.arrayBuffer()); return crypto.subtle.decrypt({name:"AES-GCM", iv:b.slice(0, 12)}, KEY, b.slice(12)); }
async function cargarDatos(){ EQ = JSON.parse(new TextDecoder().decode(await descifrar("data.enc"))); prepare(); }
async function abrir(pw){
  if (!META) META = await (await fetch(BASE + "meta.json")).json();
  const m = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  KEY = await crypto.subtle.deriveKey({name:"PBKDF2", salt:B64(META.salt), iterations:META.iter, hash:"SHA-256"}, m, {name:"AES-GCM", length:256}, true, ["decrypt"]);
  await cargarDatos();
  try { const raw = new Uint8Array(await crypto.subtle.exportKey("raw", KEY)); sessionStorage.setItem(KEYSTORE, JSON.stringify({salt: META.salt, k: btoa(String.fromCharCode(...raw))})); } catch {}
}
async function reabrir(){   // same browser tab: no password again after a reload
  try {
    const s = JSON.parse(sessionStorage.getItem(KEYSTORE) || "null"); if (!s) return false;
    META = await (await fetch(BASE + "meta.json")).json(); if (META.salt !== s.salt) return false;   // password or data changed
    KEY = await crypto.subtle.importKey("raw", B64(s.k), {name:"AES-GCM"}, false, ["decrypt"]); await cargarDatos(); return true;
  } catch { KEY = null; return false; }
}
function viewGate(){
  return `<div class="view"><section class="gate rise">
    <h1>Próximamente</h1>
    <p>Estamos preparando esta sección. Si tenés la contraseña, entrá.</p>
    <form id="gateForm" class="gate-form" novalidate>
      <label for="gatePass" class="sr">Contraseña</label>
      <input id="gatePass" type="password" placeholder="Contraseña" autocomplete="current-password" required>
      <button class="btn btn-primary" type="submit">Entrar</button>
    </form>
    <p class="gate-err" id="gateErr" role="alert" hidden>Contraseña incorrecta. Probá de nuevo.</p>
  </section></div>`;
}
function mountGate(){
  const f = $("#gateForm"), inp = $("#gatePass"), err = $("#gateErr");
  inp.focus();
  f.addEventListener("submit", async e => {
    e.preventDefault(); err.hidden = true;
    try { await abrir(inp.value); route(); } catch { KEY = null; err.hidden = false; inp.select(); }
  });
}

/* ================= GOAL PLAYER (real clip + overlays, from the live site's player) ================= */
window.CLIPDATA = window.CLIPDATA || {};
function clipData(k){
  if (CLIPDATA[k]) return Promise.resolve(CLIPDATA[k]);
  if (ENC) return descifrar(`enc/data/${k}.enc`).then(b => CLIPDATA[k] = JSON.parse(new TextDecoder().decode(b)));
  return new Promise(ok => { const e = document.createElement("script"); e.src = `${BASE}data/${k}.js`; e.onload = () => ok(CLIPDATA[k]); document.head.appendChild(e); });
}
async function clipURL(k, raw){
  if (!ENC) return `${BASE}${raw ? "raw" : "clips"}/${k}.mp4`;
  const b = await descifrar(`enc/${raw ? "raw" : "clips"}/${k}.enc`);
  return URL.createObjectURL(new Blob([b], {type:"video/mp4"}));
}
function Player(m){
  const v = $("#v"), ov = $("#ov"), mp = $("#mp"), stage = $("#stage"), scrub = $("#scrub"), playBtn = $("#playG"), label = $("#slabel"), flash = $("#gol"), load = $("#sload");
  const cx = ov.getContext("2d"), mx = mp.getContext("2d"), col = [tcol(m.home), tcol(m.away)];
  const mio = state.from === m.home ? 0 : state.from === m.away ? 1 : -1;
  const L = {players:true, ball:false, lines:true, goals:false, map:true};
  let gi = 0, D = null, dur = 1, seq = 0, flashed = false, urls = [];
  const ac = new AbortController(), opt = {signal: ac.signal};
  const setIcon = () => { playBtn.innerHTML = icon(v.paused ? (v.ended ? "replay" : "play") : "pause"); playBtn.setAttribute("aria-label", v.paused ? "Reproducir" : "Pausar"); };
  function size(){
    const dp = devicePixelRatio || 1, r = stage.getBoundingClientRect();
    ov.width = Math.round(r.width * dp); ov.height = Math.round(r.height * dp);
    // map in the video's top-right corner: ~32 % of the video width (owner 2026-11-11)
    const ra = D ? D.ratio : .62, mw = Math.max(70, Math.min(160, r.width * .13)), mh = mw * (ra + .06) / 1.06;
    mp.style.width = mw + "px"; mp.style.height = mh + "px"; mp.width = Math.round(mw * dp); mp.height = Math.round(mh * dp); draw();
  }
  function draw(){
    cx.clearRect(0, 0, ov.width, ov.height); if (!D) return;
    let f = Math.round(v.currentTime * D.fps); f = Math.max(0, Math.min(D.n - 1, f)); const d = D.F[f]; if (!d) return;
    const k = ov.width / 1920; cx.lineCap = "round"; cx.lineJoin = "round";
    if (L.lines){ cx.strokeStyle = "rgba(255,70,60,.9)"; cx.lineWidth = Math.max(1.5, 2.2 * k); for (const r of d.o){ cx.beginPath(); cx.moveTo(r[0] * k, r[1] * k); for (let i = 2; i < r.length; i += 2) cx.lineTo(r[i] * k, r[i + 1] * k); cx.stroke(); } }
    cx.lineWidth = Math.max(1.5, 2.5 * k);
    if (L.players) for (const p of d.p){ cx.strokeStyle = col[p[0]]; cx.beginPath(); cx.ellipse(p[1] * k, p[2] * k, p[3] * k, Math.max(p[3] / 3, 4) * k, 0, 0, 7); cx.stroke(); }
    if (L.goals){ cx.strokeStyle = "#ffe45c"; cx.lineWidth = Math.max(2, 3 * k); for (const g of d.g){ cx.beginPath(); cx.moveTo(g[0] * k, g[1] * k); for (let i = 2; i < 8; i += 2) cx.lineTo(g[i] * k, g[i + 1] * k); cx.stroke(); } }
    if (L.ball && d.b){ cx.strokeStyle = "#ff6b1f"; cx.lineWidth = Math.max(2, 3 * k); cx.beginPath(); cx.arc(d.b[0] * k, d.b[1] * k, 15 * k, 0, 7); cx.stroke(); }
    if (!L.map) return;
    drawMap(d);
  }
  // Map seen like the camera: same left/right and near/far as the video (Porto clips are filmed from the other side).
  function orient(D){
    let a = 0, b = 0;
    for (let f = 0; f < D.n; f += 5) for (const p of (D.F[f] || {p: []}).p) if (p.length > 4){ a += (p[1] - 960) * p[4]; b += (p[2] - 540) * p[5]; }
    D.fx = a < 0 ? -1 : 1; D.fy = b > 0 ? -1 : 1;
  }
  function drawMap(d){
    const W = mp.width, H = mp.height, dp = devicePixelRatio || 1, pad = W * .03, sx = (W / 2 - pad), sy = sx * D.ratio;
    const X = s => W / 2 + D.fx * s / 1000 * sx, Y = c => H / 2 - D.fy * c / 1000 * sy, lw = Math.max(1, W / 260);
    mx.clearRect(0, 0, W, H);
    // grass with mowing stripes
    const x0 = W / 2 - sx, x1 = W / 2 + sx, y0 = H / 2 - sy, y1 = H / 2 + sy;
    // grass only inside our pitch outline (owner: the limit is the pitch), very see-through
    mx.save(); mx.beginPath(); D.out.forEach((q, i) => i ? mx.lineTo(X(q[0]), Y(q[1])) : mx.moveTo(X(q[0]), Y(q[1]))); mx.closePath(); mx.clip();
    mx.fillStyle = "rgba(14,52,32,.32)"; mx.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) if (i % 2){ mx.fillStyle = "rgba(255,255,255,.03)"; mx.fillRect(x0 + i * (x1 - x0) / 10, 0, (x1 - x0) / 10, H); }
    mx.restore();
    mx.strokeStyle = "rgba(255,255,255,.75)"; mx.lineWidth = lw;
    mx.beginPath(); D.out.forEach((q, i) => i ? mx.lineTo(X(q[0]), Y(q[1])) : mx.moveTo(X(q[0]), Y(q[1]))); mx.closePath(); mx.stroke();
    mx.beginPath(); mx.moveTo(X(0), y0); mx.lineTo(X(0), y1); mx.stroke();
    mx.beginPath(); mx.arc(X(0), H / 2, sy * .26, 0, 7); mx.stroke();
    mx.fillStyle = "rgba(255,255,255,.75)"; mx.beginPath(); mx.arc(X(0), H / 2, lw * 1.4, 0, 7); mx.fill();
    // penalty areas + goals at each end, centred on our real goal mouths
    for (const e of [-1, 1]){
      const g = (D.goals || []).find(q => q[0] === e), gm = g ? (g[1] + g[2]) / 2 : 0, gw = g ? Math.abs(g[2] - g[1]) / 2 : 130;
      const bx = X(e * 1000), dx = X(e * 1000 - e * 300) - bx;
      const pa = Y(gm + 480), pb = Y(gm - 480); mx.strokeRect(Math.min(bx, bx + dx), Math.min(pa, pb), Math.abs(dx), Math.abs(pb - pa));
      const gx = X(e * 1000 + e * 40) - bx, ya = Y(gm + gw), yb = Y(gm - gw);
      mx.fillStyle = "rgba(255,255,255,.18)"; mx.fillRect(Math.min(bx, bx + gx), Math.min(ya, yb), Math.abs(gx), Math.abs(yb - ya));
      mx.strokeStyle = "rgba(255,255,255,.95)"; mx.lineWidth = lw * 1.6; mx.strokeRect(Math.min(bx, bx + gx), Math.min(ya, yb), Math.abs(gx), Math.abs(yb - ya));
      mx.strokeStyle = "rgba(255,255,255,.75)"; mx.lineWidth = lw;
    }
    // players: own team (when coming from a team page) drawn last and bigger
    const R = Math.max(3, W / 52), o = d.p.filter(p => p.length > 4).sort((a, b) => (a[0] === mio) - (b[0] === mio));
    for (const p of o){ const me = p[0] === mio, r = me ? R * 1.35 : R;
      mx.fillStyle = "rgba(0,0,0,.35)"; mx.beginPath(); mx.arc(X(p[4]) + lw * .6, Y(p[5]) + lw, r, 0, 7); mx.fill();
      mx.fillStyle = col[p[0]]; mx.strokeStyle = me ? "#fff" : "rgba(255,255,255,.7)"; mx.lineWidth = (me ? 2 : 1.2) * lw;
      mx.beginPath(); mx.arc(X(p[4]), Y(p[5]), r, 0, 7); mx.fill(); mx.stroke(); }
    if (L.ball && d.m){ mx.fillStyle = "#fff"; mx.strokeStyle = "#ff6b1f"; mx.lineWidth = 1.5 * lw; mx.beginPath(); mx.arc(X(d.m[0]), Y(d.m[1]), R * .8, 0, 7); mx.fill(); mx.stroke(); }
  }
  const tick = () => { scrub.value = Math.round(1000 * v.currentTime / dur); draw();
    if (D && !flashed && v.currentTime >= D.at && !v.paused){ flashed = true; if (!reduced){ flash.classList.remove("on"); void flash.offsetWidth; flash.classList.add("on"); } } };
  const loop = () => { tick(); if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(loop); else if (!v.paused) requestAnimationFrame(loop); };
  v.addEventListener("loadedmetadata", () => { dur = v.duration || 1; load.hidden = true; size(); tick(); }, opt);
  v.addEventListener("timeupdate", tick, opt); v.addEventListener("seeked", tick, opt);
  v.addEventListener("play", () => { setIcon(); if (!v.requestVideoFrameCallback) requestAnimationFrame(loop); }, opt);
  v.addEventListener("pause", setIcon, opt); v.addEventListener("ended", setIcon, opt);
  if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(loop);
  async function select(i, auto){
    gi = (i + m.goals.length) % m.goals.length; state.goal = gi; const g = m.goals[gi], my = ++seq;
    document.querySelectorAll(".gchip").forEach(el => { const on = +el.dataset.goal === gi; el.setAttribute("aria-pressed", on); if (on){ const row = el.parentElement; row.scrollTo({left: Math.max(0, el.offsetLeft - row.offsetLeft - 8)}); } });
    document.querySelectorAll(".tgoal").forEach(el => el.classList.toggle("sel", +el.dataset.goal === gi));
    label.innerHTML = `<span><i class="dot" style="--c:${tcol(g.team)}"></i>${esc(TEAMS[g.team].name)}</span><span>Min ${g.min} · ${g.half}T</span>`;
    D = null; flashed = false; load.hidden = false; v.pause(); scrub.value = 0; draw();
    try {
      const [d, u] = await Promise.all([clipData(g.clip), clipURL(g.clip)]);
      if (my !== seq) return; D = d; if (D.fx == null) orient(D); if (ENC) urls.push(u); v.src = u; v.load();
      if (auto && !reduced) v.play().catch(() => {}); else setIcon();
    } catch { load.textContent = "No se pudo cargar el video"; }
  }
  scrub.addEventListener("input", () => { v.pause(); v.currentTime = scrub.value / 1000 * dur; draw(); }, opt);
  playBtn.addEventListener("click", () => v.paused ? v.play() : v.pause(), opt);
  v.addEventListener("click", () => v.paused ? v.play() : v.pause(), opt);
  $("#prevG").addEventListener("click", () => select(gi - 1, true), opt);
  $("#nextG").addEventListener("click", () => select(gi + 1, true), opt);
  $("#fsG").addEventListener("click", () => { const el = $(".player"); if (document.fullscreenElement) return document.exitFullscreen(); const fn = el.requestFullscreen || el.webkitRequestFullscreen; if (fn) fn.call(el); else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); }, opt);
  document.querySelectorAll(".vt[data-layer]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); const k = b.dataset.layer; L[k] = !L[k]; b.setAttribute("aria-pressed", L[k]); mp.hidden = !L.map; size(); }, opt));
  addEventListener("resize", size, opt); addEventListener("fullscreenchange", () => setTimeout(size, 60), opt);
  $("#dlG").addEventListener("click", async () => {
    const g = m.goals[gi], b = $("#dlG"), t = b.innerHTML; b.disabled = true; b.innerHTML = `${icon("download")}Preparando…`;
    try { const u = await clipURL(g.clip, false), a = document.createElement("a"); a.href = u; a.download = `kickai_${g.clip}.mp4`; document.body.appendChild(a); a.click(); a.remove(); if (ENC) setTimeout(() => URL.revokeObjectURL(u), 6e4); }
    catch { toast("No se pudo descargar"); }
    b.disabled = false; b.innerHTML = t;
  }, opt);
  $("#shG").addEventListener("click", async () => {
    const url = location.href.split("#")[0] + `#partido/${m.id}/${gi + 1}`, text = `Gol de ${TEAMS[m.goals[gi].team].name} · ${TEAMS[m.home].name} ${m.hs}-${m.as} ${TEAMS[m.away].name}`;
    if (navigator.share){ try { await navigator.share({title: "kick.ai", text, url}); return; } catch (e){ if (e && e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch { toast("Copiá el link desde la barra del navegador"); }
  }, opt);
  size();
  return {select, destroy(){ ac.abort(); v.pause(); v.removeAttribute("src"); v.load(); urls.forEach(u => URL.revokeObjectURL(u)); }, get idx(){ return gi; }};
}

/* ================= TOOLTIP ================= */
const tipBox = $("#tipBox"); let tipOwner = null;
const canHover = () => matchMedia("(hover:hover)").matches;
function showTip(btn){
  if (tipOwner && tipOwner !== btn) tipOwner.setAttribute("aria-expanded", "false");
  tipOwner = btn; btn.setAttribute("aria-expanded", "true");
  tipBox.innerHTML = btn.dataset.tip; tipBox.classList.add("on");
  const r = btn.getBoundingClientRect(), bw = tipBox.offsetWidth, bh = tipBox.offsetHeight;
  const x = Math.max(12, Math.min(innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
  let y = r.bottom + 8; if (y + bh > innerHeight - 12) y = r.top - bh - 8;
  tipBox.style.left = x + "px"; tipBox.style.top = y + "px";
}
function hideTip(){ tipBox.classList.remove("on"); if (tipOwner) tipOwner.setAttribute("aria-expanded", "false"); tipOwner = null; }
document.addEventListener("click", e => {
  const b = e.target.closest(".tip");
  if (b){ e.preventDefault(); e.stopPropagation(); (tipOwner === b && !canHover()) ? hideTip() : showTip(b); return; }
  hideTip();
}, true);
document.addEventListener("mouseover", e => { const b = e.target.closest(".tip"); if (b && canHover()) showTip(b); });
document.addEventListener("mouseout", e => { if (e.target.closest(".tip") && canHover()) hideTip(); });
document.addEventListener("focusin", e => { const b = e.target.closest(".tip"); b ? showTip(b) : hideTip(); });
addEventListener("scroll", hideTip, {passive:true});
document.addEventListener("keydown", e => { if (e.key === "Escape") hideTip(); });

/* ================= ROUTER ================= */
let prevRoute = null, lastRoute = null;
function countUp(root){
  root.querySelectorAll("[data-count]").forEach(el => {
    const to = +el.dataset.count; if (reduced || !to){ el.textContent = to; return; }
    const t0 = performance.now(), dur = 850;
    const step = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    el.textContent = "0"; requestAnimationFrame(step);
  });
}
function toast(msg){ const el = $("#toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600); }
const TITLE = "kick.ai · Equipos";
function route(keepScroll){
  const h = location.hash.replace(/^#\/?/, ""), p = h.split("/");
  if (player){ player.destroy(); player = null; }
  hideTip();
  if (h !== lastRoute){ prevRoute = lastRoute; lastRoute = h; }
  if (!EQ){ setCtx(null); app.innerHTML = viewGate(); window.scrollTo({top:0}); mountGate(); return; }
  let html, F = null, title = TITLE;
  if (!h) html = viewOrgs();
  else if (p[0] === "liga") { html = viewOrg(p[1]); const o = ORGS.find(x => x.id === p[1]); if (o) title = `${o.name} · kick.ai`; }
  else if (p[0] === "t"){ const T = TOURN.find(x => x.id === p[1]); html = viewTournament(p[1]); if (T){ F = T.fechas.find(f => f.key === state.fecha[T.id]); title = `${T.name} · kick.ai`; } }
  else if (p[0] === "equipo"){ html = viewTeam(p[1], p[2]); const s = TEAMS[p[2]] && teamStats(p[2], p[1]); if (s && s.matches.length) F = s.matches[s.matches.length - 1].F; if (TEAMS[p[2]]) title = `${TEAMS[p[2]].name} · kick.ai`; }
  else if (p[0] === "partido"){ const m = MATCHES.find(x => x.id === p[1]); if (m){ F = m.F; title = `${TEAMS[m.home].name} ${m.hs}-${m.as} ${TEAMS[m.away].name} · kick.ai`; if (p[2]) state.pendingGoal = Math.max(0, +p[2] - 1); } html = viewMatch(p[1]); }
  else html = viewNotFound();
  document.title = title; setCtx(F);
  app.innerHTML = html;
  if (!keepScroll) window.scrollTo({top:0});
  mount(p);
}
function mount(p){
  countUp(app);
  app.querySelectorAll(".formstrip").forEach(r => { r.scrollLeft = r.scrollWidth; });
  requestAnimationFrame(() => requestAnimationFrame(() => { const s = $("#stats"); if (s) s.classList.add("is-in"); }));
  const swap = (sel, key, attr, render) => app.querySelectorAll(`[${attr}]`).forEach(b => b.addEventListener("click", () => {
    state[key] = isNaN(+b.dataset[sel]) || /-/.test(b.dataset[sel]) ? b.dataset[sel] : +b.dataset[sel];
    app.querySelectorAll(`[${attr}]`).forEach(x => x.setAttribute("aria-pressed", x === b));
    render();
  }));
  if (p[0] === "t"){
    const T = TOURN.find(x => x.id === p[1]);
    if (T) app.querySelectorAll("[data-fecha]").forEach(b => b.addEventListener("click", () => {
      state.fecha[T.id] = b.dataset.fecha; app.querySelectorAll("[data-fecha]").forEach(x => x.setAttribute("aria-pressed", x === b));
      $("#results").innerHTML = resultsHTML(T, b.dataset.fecha); setCtx(T.fechas.find(f => f.key === b.dataset.fecha));
      const gl = MATCHES.filter(m => m.tournament === T.id && m.date === b.dataset.fecha).flatMap(m => m.goals.map(g => ({m, g})));
      $("#hlCount").textContent = `${gl.length} ${gl.length === 1 ? "gol" : "goles"}`;
      $("#hlBox").innerHTML = gl.length ? `<div class="hl-strip">${goalCards(gl)}</div>` : `<div class="empty"><span class="art">${icon("film")}</span><h3>Sin goles en esta fecha</h3><p>Los goles de cada fecha aparecen acá.</p></div>`;
      bindGoto();
    }));
  }
  if (p[0] === "equipo" && TEAMS[p[2]]){
    const s = teamStats(p[2], p[1]);
    swap("chart", "chart", "data-chart", () => { $("#chartBox").innerHTML = chartFor(s); });
    swap("mtab", "mtab", "data-mtab", () => { $("#mBox").innerHTML = teamMatchesHTML(p[2], s); const r = $("#mBox .formstrip"); if (r) r.scrollLeft = r.scrollWidth; });
  }
  const mm = p[0] === "partido" ? MATCHES.find(x => x.id === p[1]) : null;
  if (mm && mm.heat){ const hd = () => drawHeat(mm); swap("hteam", "hteam", "data-hteam", hd); swap("hhalf", "hhalf", "data-hhalf", hd); hd(); addEventListener("resize", hd); }
  if (mm) swap("stab", "stab", "data-stab", () => { const st = $("#stats"); st.classList.remove("is-in"); $("#statRows").innerHTML = statsHTML(mm); requestAnimationFrame(() => requestAnimationFrame(() => st.classList.add("is-in"))); });
  bindGoto();
  const back = app.querySelector("[data-back]");
  if (back) back.addEventListener("click", e => { e.preventDefault(); prevRoute != null ? history.back() : (location.hash = mm ? `t/${mm.tournament}` : ""); });
  if (mm && mm.goals.length){
    player = Player(mm); player.select(Math.min(state.goal || 0, mm.goals.length - 1), false);
    app.querySelectorAll(".tgoal,.gchip").forEach(b => b.addEventListener("click", () => {
      player.select(+b.dataset.goal, true);
      if (b.classList.contains("tgoal")) $("#stage").scrollIntoView({behavior: reduced ? "auto" : "smooth", block:"center"});
    }));
  }
}
function bindGoto(){ app.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => { state.pendingGoal = +b.dataset.goal; location.hash = "partido/" + b.dataset.goto; }); }
addEventListener("hashchange", () => route());
(async () => { if (EQ) prepare(); else if (await reabrir()) {} route(); })();
})();
