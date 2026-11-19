/* Sección Equipos (kick.ai). Menú principal > Equipos > índice de torneos a la izquierda; equipo > partidos a la izquierda. */
(function(){
const BASE=window.EQ_BASE||"equipos/";
let EQ=window.EQ_DATA||null;
/* candado: datos y videos cifrados (AES-GCM, clave derivada de la contraseña); sin contraseña no se pueden leer */
let KEY=null,META=null;const ENC=!window.EQ_DATA;
const B64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function descifrar(url){const r=await fetch(url);if(!r.ok)throw new Error("no file");const b=new Uint8Array(await r.arrayBuffer());return crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(0,12)},KEY,b.slice(12))}
async function abrir(pw){if(!META)META=await (await fetch(BASE+"meta.json")).json();const m=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);
  KEY=await crypto.subtle.deriveKey({name:"PBKDF2",salt:B64(META.salt),iterations:META.iter,hash:"SHA-256"},m,{name:"AES-GCM",length:256},true,["decrypt"]);
  const raw=await descifrar(BASE+"data.enc");EQ=JSON.parse(new TextDecoder().decode(raw))}
function candado(){const w=document.createElement("div");w.className="wrap page eq-lock";w.innerHTML=`<h1>Próximamente</h1><p class="sub">Estamos preparando esta sección. Si tenés la contraseña, entrá.</p><form><input type="password" placeholder="Contraseña" autocomplete="current-password" required><button class="btn sm">Entrar</button></form><p class="eq-err" hidden>Contraseña incorrecta.</p>`;
  const f=w.querySelector("form"),e=w.querySelector(".eq-err");f.onsubmit=async ev=>{ev.preventDefault();e.hidden=true;try{await abrir(f.querySelector("input").value);render()}catch(x){KEY=null;e.hidden=false}};return w}
const T=id=>EQ.teams[id];
const fecha=d=>{const[a,m,z]=d.split("-");return `${z}/${m}/${a}`};
const fc=d=>{const[,m,z]=d.split("-");return `${z}/${m}`};
const dot=(c,k)=>`<span class="eq-dot ${k||""}" style="background:${c}"></span>`;
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const goles=m=>{const n=[0,0];m.goals.forEach(g=>n[g.team===m.home?0:1]++);return n};
const mias=id=>EQ.matches.filter(m=>m.home===id||m.away===id).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
function linea(id){const r={pj:0,g:0,e:0,p:0,gf:0,gc:0,pos:0};
  for(const m of mias(id)){const s=m.home===id?0:1,n=goles(m);r.pj++;r.gf+=n[s];r.gc+=n[1-s];r[n[s]>n[1-s]?"g":n[s]<n[1-s]?"p":"e"]++;r.pos+=m.poss.total[s]}
  r.pos=r.pj?Math.round(r.pos/r.pj):0;return r}
function equiposDe(tid){const s=new Set();EQ.matches.filter(m=>m.tournament===tid).forEach(m=>{s.add(m.home);s.add(m.away)});return[...s]}
const METRICS=[
 {k:"poss",l:"Posesión",u:"%",v:(m,s)=>m.poss.total[s],max:100},
 {k:"gf",l:"Goles a favor",u:"",v:(m,s)=>goles(m)[s]},
 {k:"gc",l:"Goles en contra",u:"",v:(m,s)=>goles(m)[1-s]},
 {k:"dif",l:"Diferencia",u:"",v:(m,s)=>{const n=goles(m);return n[s]-n[1-s]}},
 {k:"shots",l:"Tiros",u:"",v:(m,s)=>m.shots?m.shots[s]:null},
 {k:"corners",l:"Córners",u:"",v:(m,s)=>m.corners?m.corners[s]:null}];
const num=(x,u)=>x==null?"–":(Number.isInteger(x)?x:x.toFixed(1))+u;
/* ejemplo solo para ver el diseño del gráfico: nunca en la versión real */
function demoSerie(k,base){const f={poss:[47,55,42,61,51],gf:[2,0,3,1,2],gc:[1,2,0,3,1],dif:[1,-2,3,-2,1],shots:[9,6,12,5,8],corners:[3,1,5,2,4]}[k]||[];
  return f.map((v,i)=>({date:["2026-08-04","2026-08-11","2026-08-18","2026-08-25","2026-09-01"][i],opp:"Rival de ejemplo",v,demo:true})).concat(base)}
function serie(id,mt){return mias(id).map(m=>{const s=m.home===id?0:1;return{date:m.date,opp:T(s?m.home:m.away).name,v:mt.v(m,s),href:`#/equipo/${id}/p/${m.id}`}})}
function promLiga(mt,id){const a=[];EQ.matches.forEach(m=>[0,1].forEach(s=>{const v=mt.v(m,s);if(v!=null)a.push(v)}));return Object.keys(EQ.teams).length>2&&a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function grafico(c,id){const W=720,H=260,L=38,R=16,B=34,TP=16;let k=0;
  const tabs=METRICS.map((m,i)=>`<button data-m="${i}" aria-pressed="${i===0}">${m.l}${m.k==="shots"||m.k==="corners"?" (est.)":""}</button>`).join("");
  c.innerHTML=`${window.EQ_DEMO?'<p class="eq-demo">Datos de ejemplo para ver el diseño: los puntos grises no son partidos reales.</p>':""}<div class="eq-tabs">${tabs}</div><div class="eq-chart"><div id="pl-c"></div><div class="eq-tip"></div><div class="eq-leg" id="lg"></div></div><details class="eq-more"><summary>Ver tabla</summary><div id="tb"></div></details>`;
  const box=c.querySelector("#pl-c"),tip=c.querySelector(".eq-tip");
  function draw(){const mt=METRICS[k];let P=serie(id,mt).filter(p=>p.v!=null);if(window.EQ_DEMO)P=demoSerie(mt.k,P);
    const lg=promLiga(mt,id);const vals=P.map(p=>p.v);const av=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    const hi=mt.max||Math.max(1,...vals,lg||0,av||0),lo=mt.max?0:Math.min(0,...vals);
    const X=i=>P.length<2?(L+W-R)/2:L+(W-R-L)*i/(P.length-1),Y=v=>H-B-(H-B-TP)*(v-lo)/((hi-lo)||1);
    const ticks=mt.max?[0,50,100]:[lo,Math.round((lo+hi)/2),hi];
    let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${mt.l} por partido">`;
    [...new Set(ticks)].forEach(v=>s+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#2b2f33" stroke-width="1"/><text x="${L-8}" y="${Y(v)+4}" text-anchor="end" fill="#9aa0a4" font-size="12">${v}${mt.u}</text>`);
    if(lg!=null)s+=`<line x1="${L}" x2="${W-R}" y1="${Y(lg)}" y2="${Y(lg)}" stroke="#9aa0a4" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"/>`;
    if(av!=null)s+=`<line x1="${L}" x2="${W-R}" y1="${Y(av)}" y2="${Y(av)}" stroke="#f4f4f2" stroke-width="2" stroke-dasharray="6 5"/>`;
    if(P.length>1)s+=`<polyline fill="none" stroke="#ff6b1f" stroke-width="2" stroke-linejoin="round" points="${P.map((p,i)=>X(i)+","+Y(p.v)).join(" ")}"/>`;
    P.forEach((p,i)=>{s+=`<circle cx="${X(i)}" cy="${Y(p.v)}" r="5.5" fill="${p.demo?"#6b7075":"#ff6b1f"}" stroke="#131517" stroke-width="2"/>`;
      s+=`<text x="${X(i)}" y="${H-12}" text-anchor="middle" fill="#9aa0a4" font-size="12">${fc(p.date)}</text>`;
      s+=`<rect class="hit" data-i="${i}" x="${X(i)-22}" y="${TP-6}" width="44" height="${H-B-TP+12}" fill="transparent" style="cursor:${p.href?"pointer":"default"}"/>`});
    if(P.length)s+=`<text x="${Math.min(X(P.length-1),W-R-6)}" y="${Y(P[P.length-1].v)-11}" text-anchor="middle" fill="#f4f4f2" font-size="13" font-weight="500">${num(P[P.length-1].v,mt.u)}</text>`;
    box.innerHTML=s+"</svg>";
    c.querySelector("#lg").innerHTML=`<span><i></i>${mt.l}</span><span><i class="a"></i>Promedio del equipo: ${num(av,mt.u)}</span>`+(lg!=null?`<span><i class="l"></i>Promedio de todos los equipos: ${num(lg,mt.u)}</span>`:"");
    c.querySelector("#tb").innerHTML=`<table><tr><th>Fecha</th><th>Rival</th><th>${mt.l}</th></tr>${P.map(p=>`<tr><td>${fc(p.date)}</td><td>${esc(p.opp)}</td><td>${num(p.v,mt.u)}</td></tr>`).join("")}</table>`;
    box.querySelectorAll(".hit").forEach(r=>{const p=P[+r.dataset.i];
      r.onmouseenter=()=>{const b=box.getBoundingClientRect(),z=b.width/W,ch=c.querySelector(".eq-chart").getBoundingClientRect();tip.style.left=(b.left-ch.left+X(+r.dataset.i)*z)+"px";tip.style.top=(b.top-ch.top+Y(p.v)*z-8)+"px";tip.innerHTML=`${fc(p.date)} · vs ${esc(p.opp)}<br><b>${num(p.v,mt.u)}</b>`;tip.style.opacity=1};
      r.onmouseleave=()=>tip.style.opacity=0;
      r.onclick=()=>{if(p.href)location.hash=p.href}})}
  c.querySelectorAll(".eq-tabs button").forEach(b=>b.onclick=()=>{k=+b.dataset.m;c.querySelectorAll(".eq-tabs button").forEach(x=>x.setAttribute("aria-pressed",x===b));draw()});
  draw()}
function lado(id,mid){return `<aside class="eq-side"><a href="#/equipos/${(mias(id)[0]||{}).tournament||""}">‹ Equipos</a><div class="gap"></div><h4>${esc(T(id).name)}</h4><a href="#/equipo/${id}" class="${mid?"":"on"}"><b>Resumen</b></a><div class="gap"></div><h4>Partidos</h4>${mias(id).map(m=>{const o=m.home===id?m.away:m.home,n=goles(m),s=m.home===id?0:1;return `<a href="#/equipo/${id}/p/${m.id}" class="${m.id===mid?"on":""}"><b>vs ${esc(T(o).name)}</b>${fc(m.date)} · ${n[s]}-${n[1-s]}</a>`}).join("")}</aside>`}
function vistaTorneos(tid){const ts=EQ.tournaments;const t=ts.find(x=>x.id===tid)||ts[0];
  const L=equiposDe(t.id).map(id=>{const r=linea(id);return `<a class="eq-row" href="#/equipo/${id}">${dot(T(id).color)}<span class="nm">${esc(T(id).name)}</span><span class="eq-r"><b>${r.g}-${r.e}-${r.p}</b><br>${r.gf} GF · ${r.gc} GC</span></a>`}).join("");
  return `<div class="eq"><aside class="eq-side"><h4>Torneos</h4>${ts.map(x=>`<a href="#/equipos/${x.id}" class="${x.id===t.id?"on":""}"><b>${esc(x.name)}</b></a>`).join("")}</aside><div class="eq-main"><h1>Equipos</h1><p class="sub">${esc(t.name)}</p>${L}</div></div>`}
function vistaEquipo(id){const r=linea(id);return `<div class="eq">${lado(id)}<div class="eq-main"><h1>${esc(T(id).name)}</h1><p class="sub">${esc((EQ.tournaments.find(t=>t.id===(mias(id)[0]||{}).tournament)||{}).name||"")}</p>
  <div class="eq-stats"><div><b>${r.pj}</b><span>Partidos</span></div><div><b>${r.g}-${r.e}-${r.p}</b><span>G-E-P</span></div><div><b>${r.gf}/${r.gc}</b><span>Goles a favor / en contra</span></div><div><b>${r.pos}%</b><span>Posesión promedio</span></div></div>
  <h2 class="eq-h2">Cómo viene el equipo</h2><div id="gr"></div></div></div>`}
function vistaPartido(id,mid){const m=EQ.matches.find(x=>x.id===mid);if(!m||!T(id))return null;const n=goles(m),a=T(m.home),b=T(m.away),p=m.poss;
  const fav=m.goals.filter(g=>g.team===id),con=m.goals.filter(g=>g.team!==id);
  const chip=k=>g=>`<button class="eq-chip ${k}" data-g="${g.clip}" aria-pressed="false">${g.when}</button>`;
  const grupo=(t,L,v,k)=>`<h2 class="eq-h2 ${k}">${t} (${L.length})</h2>${L.length?`<div class="eq-chips">${L.map(chip(k)).join("")}</div>`:`<p class="eq-none">${v}</p>`}`;
  const barra=(x,y)=>`<div class="eq-bar"><span style="width:${x}%;background:${a.color}"></span><span style="width:${y}%;background:${b.color}"></span></div>`;
  const mleg=[m.home,m.away].map(x=>`<span>${x===id?dot(T(x).color,"me"):dot(T(x).color)}${x===id?`<b>${esc(T(x).name)}</b>`:esc(T(x).name)}</span>`).join("");
  return `<div class="eq">${lado(id,mid)}<div class="eq-main">
  <div class="eq-score"><span class="t">${dot(a.color)}${esc(a.name)}</span><span class="n">${n[0]} - ${n[1]}</span><span class="t b">${esc(b.name)}${dot(b.color)}</span></div>
  <p class="eq-meta">${fecha(m.date)} · ${m.time} hs · ${esc(m.field)} · ${esc(m.fmt)}</p>
  <h2 class="eq-h2">Estadísticas</h2>
  <div class="eq-st"><b>${n[0]}</b><span class="c">Goles</span><b>${n[1]}</b></div>
  ${m.corners?`<div class="eq-st"><b>${m.corners[0]}</b><span class="c">Córners (est.)</span><b>${m.corners[1]}</b></div>`:""}
  <div class="eq-st"><b>${p.total[0]}%</b><span class="c">Posesión${barra(p.total[0],p.total[1])}</span><b>${p.total[1]}%</b></div>
  <div class="eq-st"><b>${p.h1[0]}%</b><span class="c">Primer tiempo${barra(p.h1[0],p.h1[1])}</span><b>${p.h1[1]}%</b></div>
  <div class="eq-st"><b>${p.h2[0]}%</b><span class="c">Segundo tiempo${barra(p.h2[0],p.h2[1])}</span><b>${p.h2[1]}%</b></div>
  <h2 class="eq-h2">Mirá el gol</h2>
  <div class="eq-player" id="pl"><div class="eq-stage"><div class="eq-vid" id="vd"><video id="v" playsinline muted preload="auto"></video><canvas id="ov"></canvas></div><div class="eq-map"><canvas id="mp"></canvas><div class="eq-mleg">${mleg}</div></div></div>
  <div class="eq-ctl"><button id="pp" aria-label="Reproducir">▶</button><button id="fb" aria-label="Cuadro anterior">‹</button><div class="eq-track"><input id="sc" type="range" min="0" max="1" step="0.001" value="0" aria-label="Recorrer el video"><i class="eq-mark" id="mk"></i></div><button id="ff" aria-label="Cuadro siguiente">›</button><span class="eq-time" id="tm">0:00</span><button id="fs" aria-label="Pantalla completa">⛶</button></div><div class="eq-opt"><span>Mostrar</span><button id="tj" aria-pressed="true">Jugadores</button><button id="tc" aria-pressed="true">Cancha</button><button id="tb" aria-pressed="false">Pelota</button><button id="tg" aria-pressed="false">Arcos</button><a class="eq-dl" id="dl" href="#" download>⬇ Descargar el gol</a></div></div>
  ${grupo("Goles a favor",fav,"No hizo goles en este partido.","fav")}${grupo("Goles en contra",con,"No recibió goles en este partido.","con")}</div></div>`}
function cargar(k,cb){window.CLIPDATA=window.CLIPDATA||{};if(CLIPDATA[k])return cb();if(ENC){descifrar(`${BASE}enc/data/${k}.enc`).then(b=>{CLIPDATA[k]=JSON.parse(new TextDecoder().decode(b));cb()});return}const e=document.createElement("script");e.src=`${BASE}data/${k}.js`;e.onload=cb;document.head.appendChild(e)}
function iniciar(m,G,yo){const $=s=>document.querySelector(s),v=$("#v"),sc=$("#sc"),pp=$("#pp"),tm=$("#tm"),mk=$("#mk"),ov=$("#ov"),mp=$("#mp"),pl=$("#pl"),vd=$("#vd");
  let dur=1,arrastra=false,D=null,verBall=false,verArcos=false,verJug=true,verCancha=true;if(window._eqAC)_eqAC.abort();const ac=window._eqAC=new AbortController(),opt={signal:ac.signal};
  const col=[T(m.home).color,T(m.away).color],mio=yo===m.home?0:1,cx=ov.getContext("2d"),mx=mp.getContext("2d");
  const reloj=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  const elegir=g=>{document.querySelectorAll(".eq-chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.g===g.clip));const dl=$("#dl");dl.setAttribute("download",`kickai_${g.clip}.mp4`);if(ENC){dl.href="#";dl.onclick=async ev=>{ev.preventDefault();const t=dl.textContent;dl.textContent="Preparando…";const b=await descifrar(`${BASE}enc/raw/${g.clip}.enc`),u=URL.createObjectURL(new Blob([b],{type:"video/mp4"})),a=document.createElement("a");a.href=u;a.download=`kickai_${g.clip}.mp4`;a.click();dl.textContent=t;setTimeout(()=>URL.revokeObjectURL(u),6e4)}}else dl.href=`${BASE}raw/${g.clip}.mp4`;
    D=null;cargar(g.clip,async()=>{D=CLIPDATA[g.clip];if(ENC){const b=await descifrar(`${BASE}enc/clips/${g.clip}.enc`);v.src=URL.createObjectURL(new Blob([b],{type:"video/mp4"}))}else v.src=window.clipUrl?clipUrl(g.clip):`${BASE}clips/${g.clip}.mp4`;v.load();medir()})};
  const anillo=(c,x,y,r)=>{c.beginPath();c.arc(x,y,r,0,7);c.fill();c.stroke()};
  function medir(){const fs=document.fullscreenElement===pl||pl.classList.contains("max"),st=pl.querySelector(".eq-stage");
    if(fs){const ch=pl.querySelector(".eq-ctl").offsetHeight+pl.querySelector(".eq-opt").offsetHeight,W=innerWidth,H=innerHeight-ch,al=W>H,sw=Math.max(200,Math.min(340,W*.24));st.style.gridTemplateColumns=al?`minmax(0,1fr) ${sw}px`:"minmax(0,1fr)";const aw=al?W-sw:W,ah=al?H:H*.68,w=Math.min(aw,ah*16/9);vd.style.width=w+"px";vd.style.height=(w*9/16)+"px"}
    else{st.style.gridTemplateColumns="";vd.style.width="";vd.style.height=""}
    const dp=devicePixelRatio||1,r=vd.getBoundingClientRect();ov.width=Math.round(r.width*dp);ov.height=Math.round(r.height*dp);const mw=mp.getBoundingClientRect().width||240,ra=D?D.ratio:.62,mh=mw*(ra+.18)/1.18;mp.style.height=mh+"px";mp.width=Math.round(mw*dp);mp.height=Math.round(mh*dp);dibujar()}
  function dibujar(){if(!D)return;let f=Math.round(v.currentTime*D.fps);f=Math.max(0,Math.min(D.n-1,f));const d=D.F[f];if(!d)return;
    const k=ov.width/1920;cx.clearRect(0,0,ov.width,ov.height);cx.lineCap="round";cx.lineJoin="round";cx.strokeStyle="rgba(255,70,60,.9)";cx.lineWidth=Math.max(1.5,2.2*k);
    if(verCancha)for(const r of d.o){cx.beginPath();cx.moveTo(r[0]*k,r[1]*k);for(let i=2;i<r.length;i+=2)cx.lineTo(r[i]*k,r[i+1]*k);cx.stroke()}
    cx.lineWidth=Math.max(1.5,2.5*k);if(verJug)for(const p of d.p){cx.strokeStyle=col[p[0]];cx.beginPath();cx.ellipse(p[1]*k,p[2]*k,p[3]*k,Math.max(p[3]/3,4)*k,0,0,7);cx.stroke()}
    if(verArcos){cx.strokeStyle="#ffe45c";cx.lineWidth=Math.max(2,3*k);for(const g of d.g){cx.beginPath();cx.moveTo(g[0]*k,g[1]*k);for(let i=2;i<8;i+=2)cx.lineTo(g[i]*k,g[i+1]*k);cx.stroke()}}
    if(verBall&&d.b){cx.strokeStyle="#ff6b1f";cx.lineWidth=Math.max(2,3*k);cx.beginPath();cx.arc(d.b[0]*k,d.b[1]*k,15*k,0,7);cx.stroke()}
    const W=mp.width,H=mp.height,dp=devicePixelRatio||1,sx=W*.5/1.09,sy=sx*D.ratio,X=s=>W/2+s/1000*sx,Y=c=>H/2-c/1000*sy;mx.clearRect(0,0,W,H);mx.fillStyle="#17402a";mx.fillRect(0,0,W,H);mx.strokeStyle="rgba(255,255,255,.8)";mx.lineWidth=1.2*dp;mx.beginPath();D.out.forEach((q,i)=>i?mx.lineTo(X(q[0]),Y(q[1])):mx.moveTo(X(q[0]),Y(q[1])));mx.closePath();mx.stroke();mx.beginPath();mx.moveTo(X(0),Y(1000));mx.lineTo(X(0),Y(-1000));mx.stroke();
    const o=d.p.filter(p=>p.length>4).sort((a,b)=>(a[0]===mio)-(b[0]===mio));for(const p of o){const me=p[0]===mio;mx.fillStyle=col[p[0]];mx.strokeStyle=me?"#fff":"rgba(0,0,0,.55)";mx.lineWidth=(me?1.6:1)*dp;anillo(mx,X(p[4]),Y(p[5]),(me?7.5:4)*dp)}
    if(verBall&&d.m){mx.fillStyle="#ff6b1f";mx.strokeStyle="#000";mx.lineWidth=1*dp;anillo(mx,X(d.m[0]),Y(d.m[1]),5*dp)}}
  const pos=()=>{if(!arrastra)sc.value=v.currentTime/dur;tm.textContent=reloj(v.currentTime);dibujar()};
  const cuadro=()=>{dibujar();if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(cuadro);else if(!v.paused)requestAnimationFrame(cuadro)};
  v.addEventListener("loadedmetadata",()=>{dur=v.duration||1;sc.step=1/(30*dur);mk.style.left=`calc(9px + (100% - 18px)*${D?D.at/dur:.5})`;pos()});v.addEventListener("timeupdate",pos);v.addEventListener("seeked",pos);
  v.addEventListener("play",()=>{pp.textContent="❚❚";if(!v.requestVideoFrameCallback)requestAnimationFrame(cuadro)});v.addEventListener("pause",()=>pp.textContent="▶");v.addEventListener("ended",()=>pp.textContent="▶");if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(cuadro);
  pp.onclick=()=>v.paused?v.play():v.pause();v.onclick=pp.onclick;const paso=d=>{v.pause();v.currentTime=Math.max(0,Math.min(dur,v.currentTime+d/30))};$("#fb").onclick=()=>paso(-1);$("#ff").onclick=()=>paso(1);
  sc.addEventListener("pointerdown",()=>{arrastra=true;v.pause()});addEventListener("pointerup",()=>{arrastra=false},opt);sc.addEventListener("input",()=>{v.pause();v.currentTime=sc.value*dur;tm.textContent=reloj(sc.value*dur)});
  $("#tj").onclick=e=>{verJug=!verJug;e.currentTarget.setAttribute("aria-pressed",verJug);dibujar()};$("#tc").onclick=e=>{verCancha=!verCancha;e.currentTarget.setAttribute("aria-pressed",verCancha);dibujar()};$("#tb").onclick=e=>{verBall=!verBall;e.currentTarget.setAttribute("aria-pressed",verBall);dibujar()};$("#tg").onclick=e=>{verArcos=!verArcos;e.currentTarget.setAttribute("aria-pressed",verArcos);dibujar()};
  $("#fs").onclick=()=>{if(document.fullscreenElement===pl)return document.exitFullscreen();if(pl.classList.contains("max")){pl.classList.remove("max");return medir()}const fn=pl.requestFullscreen||pl.webkitRequestFullscreen;if(fn)fn.call(pl);else{pl.classList.add("max");medir()}};
  addEventListener("fullscreenchange",()=>setTimeout(medir,60),opt);addEventListener("resize",medir,opt);
  document.querySelectorAll(".eq-chip").forEach(c=>c.onclick=()=>elegir(G.find(g=>g.clip===c.dataset.g)));medir();if(G.length)elegir(G[0])}
window.equiposPagina=function(h){if(!EQ)return candado();const w=document.createElement("div");w.className="wrap page";const p=h.replace(/^#\/?/,"").split("/");let html,after=null;
  if(p[0]==="equipo"&&T(p[1])){const id=p[1];if(p[2]==="p"){html=vistaPartido(id,p[3]);const m=EQ.matches.find(x=>x.id===p[3]);if(m)after=()=>iniciar(m,[...m.goals.filter(g=>g.team===id),...m.goals.filter(g=>g.team!==id)],id)}else{html=vistaEquipo(id);after=()=>grafico(document.getElementById("gr"),id)}}
  if(!html)html=vistaTorneos(p[1]);w.innerHTML=html;if(after)requestAnimationFrame(after);return w};
})();
