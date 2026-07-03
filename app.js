/* Night Watches — offline dream journal engine. No network, no AI: pure keyword logic. */
"use strict";

/* ---------- storage (localStorage with in-memory fallback) ---------- */
const mem = {};
const store = {
  get(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch(e){ return k in mem ? mem[k] : fb; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ mem[k] = v; } }
};

/* ---------- categories & keyword dictionaries ---------- */
const CATS = {
  warfare:   { label:"Warfare & deliverance", color:"var(--warfare)", hex:"#C25048",
    kw:["demon","evil spirit","satan","devil","manifest","deliver","cast out","bind","rebuke","witch","occult","cursed","curse","possessed","oppress","vulture","serpent","medusa","tongues","spirit of","in the name of jesus","idol","dungeon","zombie","warfare","fight","fought","battle"] },
  calling:   { label:"Calling & ministry", color:"var(--calling)", hex:"#D2A94E",
    kw:["prophet","prophetic","preach","ministry","minister","anoint","calling","word of knowledge","worship","sermon","fellowship","pray for","laid hands","lay hands","mentor","pulpit","stage","mic","teacher told me","instruction"] },
  revelation:{ label:"Revelation & heaven", color:"var(--revelation)", hex:"#8B7BD8",
    kw:["vision","realm","heaven","heavenly","portal","angel","telepathy","dimension","outside of","clock","glowing","glow","light came","spirit realm","eclipse","sky","clouds","throne","wheel"] },
  warning:   { label:"Warning & danger", color:"var(--warning)", hex:"#E0913F",
    kw:["gun","shot","shoot","stab","kill","killed","dying","dead","danger","tsunami","crash","chase","chased","rob","robbed","scream","screaming","crying","drown","accident","explosion","burning","burnt","trapped","hunted","kidnap","hostage","warning"] },
  healing:   { label:"Healing & freedom", color:"var(--healing)", hex:"#4FA08B",
    kw:["heal","healed","healing","restored","set free","freedom","delivered her","delivered him","salvation","forgive","forgiveness","hospital","recover"] },
  family:    { label:"Family & relationships", color:"var(--family)", hex:"#5B9BB5",
    kw:["family","wedding","married","marriage","cousin","gathering","mom","dad","brother","sister","fiance","fiancé","wife","divorce","aunty","uncle","ma "] },
  provision: { label:"Provision & work", color:"var(--provision)", hex:"#7FA65A",
    kw:["money","business","contract","promotion","promote","job","salary","billionaire","store","shop","bank account","rich","prosper","interview","hired","role","manager"] },
  growth:    { label:"Growth & humility", color:"var(--growth)", hex:"#9AA5B5",
    kw:["humility","humble","school","classroom","class","teacher","lesson","learn","exam","teachable","training","posture","fasting","obedience"] }
};

const SYMBOLS = {
  "Fire":      ["fire","flame","burning","burnt","ignite"],
  "Water":     ["water","ocean","sea","pool","river","swim","wave","tsunami","kayak","beach","rain"],
  "Vehicles":  ["car","drive","driving","drove","bakkie","polo","golf","mustang","ferrari","porsche","motorbike","bike","bus","train","plane","jet ski","boat","ship","limo","suv","taxi"],
  "Animals":   ["dog","bear","pitbull","vulture","spider","tarantula","rat","snake","serpent","dragon","lion","elephant","pig","shark","german shep","bird","fish"],
  "School":    ["school","classroom","class","teacher","rhodes","varsity","learning centre"],
  "Houses":    ["house","bonteheuwel","home","yard","garage","apartment","room"],
  "Time":      ["clock","12","time","midnight","hour"],
  "Keys & doors":["key","lock","vault","door","gate","open"],
  "Weapons":   ["gun","sword","knife","bomb","chain","shield"],
  "Heaven":    ["angel","heaven","portal","glow","light","cloud","sky","throne","spirit realm"],
  "Money":     ["money","r4000","r82000","r400","bank","rich","gold","contract"],
  "Church":    ["church","pastor","fellowship","ministry","worship","altar","sermon"]
};

const DANGER = ["gun","shot","shoot","stab","kill","dying","dead","danger","attack","chase","rob","scream","crying","drown","accident","crash","tsunami","burning","burnt","beat","kidnap","hunt","hurt","injur","sick","hospital","trapped","divorce","cheat","down","downcast","manifest","spirit"];

const DEFAULT_PEOPLE = ["Renika","Ryan","Dillon","Colby","Shakira","Zante","Raymeon","Darin","Ethan","Kayden","Cairo","Monique","Craig","Quaanita","Tashreeqah","Caleb","Amy","Skyler","Gemma","Ariana","Java","Chazz","Pastor","Aunty Natasha","Uncle Angelo","Aunty Colleen","Uncle Greg","Uncle Laalu","Aunty Rifqah","Uncle Silwyn","Aunty Chantal","Aunty Beryl","Uncle Rodney","Uncle Alfie","Mom","Dad","Ma","Dhelcia","Shiloh"];

/* ---------- state ---------- */
let entries  = store.get("nw_entries", []);
let alerts   = store.get("nw_alerts", []);
let people   = store.get("nw_people", DEFAULT_PEOPLE);
let settings = store.get("nw_settings", { notif:false, lastOpenNotif:"" });
let activeFilter = null; /* {type:'symbol'|'person'|'cat', value} */

/* ---------- analysis ---------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hits(lower, kw){
  const m = lower.match(new RegExp("\\b"+esc(kw.toLowerCase()), "g"));
  return m ? m.length : 0;
}
function analyze(text){
  const lower = " " + text.toLowerCase() + " ";
  const scores = {};
  for (const id in CATS){
    let s = 0;
    for (const kw of CATS[id].kw) s += hits(lower, kw);
    if (s > 0) scores[id] = s;
  }
  let primary = "revelation";
  let best = 0;
  for (const id in scores) if (scores[id] > best){ best = scores[id]; primary = id; }
  const cats = Object.keys(scores).sort((a,b)=>scores[b]-scores[a]).slice(0,3);
  if (!cats.length) cats.push(primary);

  const syms = [];
  for (const s in SYMBOLS)
    if (SYMBOLS[s].some(kw => hits(lower, kw) > 0)) syms.push(s);

  const found = people.filter(p => lower.includes(" " + p.toLowerCase()) || lower.includes(p.toLowerCase()+"'") || hits(lower, p) > 0);

  let dangerScore = 0;
  for (const d of DANGER) dangerScore += hits(lower, d);
  const dangerPeople = (dangerScore >= 2) ? found : [];

  return { primary, cats, syms, people: found, dangerPeople, dangerScore };
}

function relatedTo(entry){
  return entries.filter(e => {
    if (e.id === entry.id) return false;
    const sharedSym = e.a.syms.filter(s => entry.a.syms.includes(s)).length;
    const sharedPpl = e.a.people.filter(p => entry.a.people.includes(p)).length;
    return sharedSym >= 2 || (sharedPpl >= 1 && e.a.primary === entry.a.primary);
  }).sort((x,y)=> (y.date > x.date ? -1 : 1)).slice(0,4);
}

/* ---------- saving ---------- */
function makeEntry(dateISO, title, text){
  return { id: Date.now() + "-" + Math.random().toString(36).slice(2,7),
    date: dateISO, title: (title||"").trim(), text: text.trim(),
    confirmed: false, a: analyze(text) };
}
function persist(){
  store.set("nw_entries", entries);
  store.set("nw_alerts", alerts);
  store.set("nw_people", people);
  store.set("nw_settings", settings);
}
function addAlertIfDanger(entry){
  if (!entry.a.dangerPeople.length) return null;
  const al = { id:"al-"+entry.id, entryId:entry.id, date:entry.date,
    people: entry.a.dangerPeople, prayed:false };
  alerts.unshift(al);
  return al;
}

/* ---------- notes-format import parser ---------- */
const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const RE_DMY = /^\s*(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})?\s*(.*)$/i;
const RE_MDY = /^\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})?\s*(.*)$/i;

function cleanTitle(rest){
  let t = (rest||"").trim();
  t = t.replace(/^[-–—:]\s*/, "");
  const par = t.match(/^\((.+)\)\s*$/); if (par) t = par[1];
  return t.trim();
}
function iso(y,m,d){ return y + "-" + String(m+1).padStart(2,"0") + "-" + String(d).padStart(2,"0"); }

function parseNotes(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null, lastYear = null;
  const push = () => { if (cur && cur.body.join("\n").trim()) { cur.text = cur.body.join("\n").trim(); out.push(cur); } else if (cur && cur.title) { cur.text = cur.title; out.push(cur); } };
  for (const raw of lines){
    const line = raw.trimEnd();
    let m = line.match(RE_DMY), day, mon, yr, rest;
    if (m){ day=+m[1]; mon=MONTHS[m[2].slice(0,3).toLowerCase()]; yr=m[3]?+m[3]:null; rest=m[4]; }
    else { m = line.match(RE_MDY); if (m){ mon=MONTHS[m[1].slice(0,3).toLowerCase()]; day=+m[2]; yr=m[3]?+m[3]:null; rest=m[4]; } }
    if (m && day>=1 && day<=31){
      push();
      if (yr) lastYear = yr;
      const useYr = yr || lastYear || new Date().getFullYear();
      cur = { date: iso(useYr, mon, day), title: cleanTitle(rest), body: [] };
    } else if (cur){
      cur.body.push(raw);
    }
  }
  push();
  return out;
}

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
function fmtDate(isoStr){
  const [y,m,d] = isoStr.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString("en-ZA", {day:"numeric", month:"long", year:"numeric"});
}
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.style.display = "block";
  clearTimeout(t._h); t._h = setTimeout(()=> t.style.display="none", 2400);
}

/* ---------- notifications ---------- */
function canNotify(){ return "Notification" in window; }
function notify(title, body){
  if (!settings.notif || !canNotify() || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon:"icon-180.png", badge:"icon-180.png" }); } catch(e){}
}

/* ---------- navigation & sheets ---------- */
function showView(name){
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $("#view-" + name).classList.add("active");
  window.scrollTo({top:0});
}
function openSheet(id){ $("#"+id).classList.add("open"); document.body.style.overflow = "hidden"; }
function closeSheets(){ document.querySelectorAll(".sheet").forEach(s => s.classList.remove("open")); document.body.style.overflow = ""; }

/* ---------- prayer watch ---------- */
function renderPrayerWatch(){
  const box = $("#prayerWatch");
  const open = alerts.filter(a => !a.prayed);
  if (!open.length){ box.innerHTML = ""; return; }
  box.innerHTML = open.slice(0,4).map(a => `
    <div class="pw">
      <div class="muted small">PRAYER WATCH · dream of ${fmtDate(a.date)}</div>
      <div class="who">${a.people.join(", ")}</div>
      <div class="actions">
        <button class="pillbtn" data-pray="${a.id}">Mark as prayed 🙏</button>
        <button class="pillbtn ghost" data-open="${a.entryId}">Read the dream</button>
      </div>
    </div>`).join("");
}

/* ---------- home ---------- */
function renderHome(){
  const now = new Date();
  $("#todayLine").textContent = now.toLocaleDateString("en-ZA", {weekday:"long", day:"numeric", month:"long"});
  const total = entries.length;
  const thisMonth = entries.filter(e => e.date.startsWith(now.toISOString().slice(0,7))).length;
  const conf = entries.filter(e => e.confirmed).length;
  $("#stats").innerHTML = `
    <button class="stat" data-goview="journal"><div class="n">${total}</div><div class="l">dreams</div></button>
    <button class="stat" data-month="${now.toISOString().slice(0,7)}"><div class="n">${thisMonth}</div><div class="l">this month</div></button>
    <button class="stat" data-goview="patterns"><div class="n">${conf}</div><div class="l">confirmed</div></button>`;

  /* interactive donut */
  const catCounts = {};
  for (const e of entries) catCounts[e.a.primary] = (catCounts[e.a.primary]||0)+1;
  const seg = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
  let offset = 25, svg = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--line)" stroke-width="4.5"></circle>`;
  for (const [id,n] of seg){
    const pct = total ? (n/total)*100 : 0;
    svg += `<circle data-cat="${id}" cx="21" cy="21" r="15.9" fill="none" stroke="${CATS[id].hex}" stroke-width="4.5"
      stroke-dasharray="${Math.max(pct-1.2,0.4)} ${100-Math.max(pct-1.2,0.4)}" stroke-dashoffset="${offset}" stroke-linecap="round"><title>${CATS[id].label}</title></circle>`;
    offset -= pct;
  }
  $("#donut").innerHTML = svg;
  $("#donutN").textContent = total;
  $("#legend").innerHTML = seg.map(([id,n]) =>
    `<button class="lchip" data-cat="${id}"><span class="sw" style="background:${CATS[id].hex}"></span>${CATS[id].label} · ${Math.round(n/total*100)}%</button>`).join("");

  /* months */
  const mCounts = {};
  for (let i=11;i>=0;i--){ const d = new Date(now.getFullYear(), now.getMonth()-i, 1); mCounts[d.toISOString().slice(0,7)] = 0; }
  for (const e of entries){ const k = e.date.slice(0,7); if (k in mCounts) mCounts[k]++; }
  const max = Math.max(1, ...Object.values(mCounts));
  $("#months").innerHTML = Object.entries(mCounts).map(([k,n]) => {
    const lbl = new Date(k+"-01").toLocaleDateString("en-ZA",{month:"short"})[0];
    return `<button data-month="${k}" aria-label="${k}: ${n} dreams" style="height:${Math.max(4, n/max*100)}%"><span>${lbl}</span></button>`;
  }).join("");

  /* recent */
  const rec = [...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  $("#recent").innerHTML = rec.length ? rec.map(cardHTML).join("") +
    `<button class="btn" style="width:100%;margin-top:12px" data-goview="journal">Open the journal →</button>`
    : `<div class="muted small">Your first dream will appear here.</div>`;
}

/* ---------- journal ---------- */
function cardHTML(e){
  const c = CATS[e.a.primary];
  return `<article class="ecard" data-open="${e.id}">
    <span class="edot" style="background:${c.hex}"></span>
    <div style="min-width:0">
      <div class="edate">${fmtDate(e.date)} · ${c.label}${e.confirmed ? ' · <span class="confmark">confirmed ✓</span>':''}</div>
      ${e.title ? `<div class="etitle">${e.title}</div>` : ""}
      <div class="eprev">${e.text}</div>
    </div></article>`;
}
function passesFilter(e){
  const q = $("#search").value.trim().toLowerCase();
  if (q && !(e.text.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))) return false;
  if (!activeFilter) return true;
  if (activeFilter.type === "symbol") return e.a.syms.includes(activeFilter.value);
  if (activeFilter.type === "person") return e.a.people.includes(activeFilter.value);
  if (activeFilter.type === "cat")    return e.a.primary === activeFilter.value || e.a.cats.includes(activeFilter.value);
  if (activeFilter.type === "month")  return e.date.startsWith(activeFilter.value);
  return true;
}
function filterLabel(){
  if (!activeFilter) return "";
  if (activeFilter.type === "cat") return CATS[activeFilter.value].label;
  if (activeFilter.type === "month") return new Date(activeFilter.value+"-01").toLocaleDateString("en-ZA",{month:"long",year:"numeric"});
  return activeFilter.value;
}
function renderJournal(){
  const fb = $("#filterbar");
  if (activeFilter){ fb.style.display = "block"; $("#filterlabel").innerHTML = `Showing: <b class="gold">${filterLabel()}</b>`; }
  else fb.style.display = "none";
  const shown = entries.filter(passesFilter).sort((a,b)=> b.date.localeCompare(a.date));
  $("#entryList").innerHTML = !entries.length
    ? `<div class="empty"><div class="m">The record begins tonight.</div>Tap ＋ on the Tonight tab, or import your Notes journal in ⚙︎ Settings.</div>`
    : (shown.length ? shown.map(cardHTML).join("") : `<div class="empty">No dreams match.</div>`);
}

/* ---------- detail sheet ---------- */
function openDetail(id){
  const e = entries.find(x => x.id === id); if (!e) return;
  const c = CATS[e.a.primary];
  const rel = relatedTo(e);
  const alert = alerts.find(a => a.entryId === e.id && !a.prayed);
  $("#detailInner").innerHTML = `
    <div class="sheethead"><span class="t">${fmtDate(e.date)}</span><button class="x" data-close="detailSheet">✕</button></div>
    ${e.title ? `<div class="dtitle">${e.title}</div>` : ""}
    <div class="chips">
      ${e.a.cats.map(id => `<button class="chip cat" data-cat="${id}" style="background:${CATS[id].hex}22;color:${CATS[id].hex}">${CATS[id].label}</button>`).join("")}
      ${e.a.syms.map(s => `<button class="chip" data-sym="${s}">${s}</button>`).join("")}
      ${e.a.people.map(p => `<button class="chip" data-person="${p}">👤 ${p}</button>`).join("")}
    </div>
    ${alert ? `<div class="dangerbox">⚠ ${alert.people.join(", ")} flagged for prayer in this dream.
      <div style="margin-top:8px"><button class="pillbtn" data-pray="${alert.id}">Mark as prayed 🙏</button></div></div>` : ""}
    <div class="dtext">${e.text}</div>
    ${rel.length ? `<h2 style="margin-top:22px">This thread recurs</h2>` + rel.map(r =>
      `<button class="relrow" data-open="${r.id}">${r.title || r.text.slice(0,50)+"…"}
        <div class="rd">${fmtDate(r.date)} · shares ${r.a.syms.filter(s=>e.a.syms.includes(s)).slice(0,3).join(", ") || "people"}</div></button>`).join("") : ""}
    <div style="display:flex;gap:8px;margin-top:24px">
      <button class="btn ${e.confirmed?'':'gold'}" data-confirm="${e.id}">${e.confirmed ? "Unmark confirmed" : "Mark confirmed ✓"}</button>
      <button class="btn" data-del="${e.id}" style="color:var(--warfare)">Delete</button>
    </div>`;
  openSheet("detailSheet");
}

/* ---------- patterns ---------- */
function renderPatterns(){
  const counts = {};
  for (const e of entries) for (const s of e.a.syms) counts[s] = (counts[s]||0)+1;
  const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max = rows.length ? rows[0][1] : 1;
  $("#symCloud").innerHTML = rows.length ? rows.map(([s,n]) =>
    `<button data-sym="${s}" style="font-size:${13 + Math.round(n/max*9)}px">${s}<span class="c">${n}</span></button>`).join("")
    : `<div class="muted small">Patterns appear once a few dreams are saved.</div>`;

  const pc = {};
  for (const e of entries) for (const p of e.a.people) pc[p] = (pc[p]||0)+1;
  const prow = Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,14);
  $("#peopleGrid").innerHTML = prow.length ? prow.map(([p,n]) =>
    `<button data-person="${p}">${p}<span>${n}</span></button>`).join("")
    : `<div class="muted small">No people detected yet.</div>`;

  const conf = entries.filter(e => e.confirmed).sort((a,b)=>b.date.localeCompare(a.date));
  $("#confirmedList").innerHTML = conf.length ? conf.map(e =>
    `<button class="relrow" data-open="${e.id}">${e.title || e.text.slice(0,50)+"…"}<div class="rd">${fmtDate(e.date)}</div></button>`).join("")
    : `<div class="muted small">When a dream comes to pass, open it and tap "Mark confirmed".</div>`;
}

function renderAll(){ renderPrayerWatch(); renderHome(); renderJournal(); renderPatterns(); renderPoster(); renderSettings(); }
function renderSettings(){
  $("#peopleBox").value = people.join("\n");
  $("#notifToggle").checked = settings.notif && canNotify() && Notification.permission === "granted";
}

/* ---------- global click handling ---------- */
document.querySelectorAll("nav button").forEach(b => b.onclick = () => { closeSheets(); showView(b.dataset.view); });
$("#gearBtn").onclick = () => openSheet("settingsSheet");
$("#writeBtn").onclick = () => { $("#saveResult").innerHTML=""; openSheet("writeSheet"); setTimeout(()=>$("#nText").focus(), 120); };

document.body.addEventListener("click", ev => {
  const t = ev.target.closest("[data-close],[data-pray],[data-open],[data-confirm],[data-del],[data-cat],[data-sym],[data-person],[data-month],[data-goview]");
  if (!t) return;
  if (t.dataset.close){ closeSheets(); return; }
  if (t.dataset.goview){ closeSheets(); activeFilter = null; showView(t.dataset.goview); renderJournal(); return; }
  if (t.dataset.pray){
    const a = alerts.find(x => x.id === t.dataset.pray);
    if (a){ a.prayed = true; persist(); renderPrayerWatch(); closeSheets(); toast("Marked as prayed 🙏"); }
    return;
  }
  if (t.dataset.open){ openDetail(t.dataset.open); return; }
  if (t.dataset.confirm){
    const e = entries.find(x => x.id === t.dataset.confirm);
    e.confirmed = !e.confirmed; persist(); renderAll(); openDetail(e.id); return;
  }
  if (t.dataset.del){
    if (confirm("Delete this dream? This cannot be undone.")){
      entries = entries.filter(x => x.id !== t.dataset.del);
      alerts = alerts.filter(a => a.entryId !== t.dataset.del);
      persist(); closeSheets(); renderAll();
    }
    return;
  }
  if (t.dataset.cat)   { activeFilter = {type:"cat",   value:t.dataset.cat};   closeSheets(); showView("journal"); renderJournal(); return; }
  if (t.dataset.sym)   { activeFilter = {type:"symbol",value:t.dataset.sym};   closeSheets(); showView("journal"); renderJournal(); return; }
  if (t.dataset.person){ activeFilter = {type:"person",value:t.dataset.person};closeSheets(); showView("journal"); renderJournal(); return; }
  if (t.dataset.month) { activeFilter = {type:"month", value:t.dataset.month}; closeSheets(); showView("journal"); renderJournal(); return; }
});
$("#clearFilter").onclick = () => { activeFilter = null; renderJournal(); };
$("#search").addEventListener("input", renderJournal);

/* ---------- save ---------- */
$("#saveEntry").onclick = () => {
  const text = $("#nText").value.trim();
  if (!text){ toast("Write the dream first."); return; }
  const e = makeEntry($("#nDate").value || new Date().toISOString().slice(0,10), $("#nTitle").value, text);
  entries.unshift(e);
  const al = addAlertIfDanger(e);
  persist();
  $("#nText").value = ""; $("#nTitle").value = "";
  const c = CATS[e.a.primary];
  $("#saveResult").innerHTML = `<div class="panel" style="border-left:3px solid ${c.hex}">
    <div class="small gold">Saved & filed</div>
    <div class="chips">
      ${e.a.cats.map(id => `<span class="chip cat" style="background:${CATS[id].hex}22;color:${CATS[id].hex}">${CATS[id].label}</span>`).join("")}
      ${e.a.syms.map(s => `<span class="chip">${s}</span>`).join("")}
    </div>
    ${e.a.people.length ? `<div class="small muted" style="margin-top:8px">People: ${e.a.people.join(", ")}</div>` : ""}
    ${al ? `<div class="dangerbox">⚠ Added to Prayer Watch: ${al.people.join(", ")}</div>` : ""}
    <button class="btn gold" data-close="writeSheet" style="margin-top:14px;width:100%">Done</button>
  </div>`;
  if (al) notify("Prayer watch 🙏", "Your dream flagged " + al.people.join(", ") + ". Take a moment to pray for them.");
  renderAll();
};

/* ---------- import ---------- */
let parsedPreview = null;
$("#parseBtn").onclick = () => {
  const raw = $("#importText").value;
  if (!raw.trim()){ $("#importResult").textContent = "Paste your journal text first."; return; }
  parsedPreview = parseNotes(raw);
  if (!parsedPreview.length){ $("#importResult").textContent = "No dated entries found — check the date format."; return; }
  const dates = parsedPreview.map(p => p.date).sort();
  $("#importResult").innerHTML = `Found <b class="gold">${parsedPreview.length} dreams</b> from ${fmtDate(dates[0])} to ${fmtDate(dates[dates.length-1])}. Tap Import to add them.`;
  $("#importBtn").style.display = "inline-block";
};
$("#importBtn").onclick = () => {
  if (!parsedPreview) return;
  const existing = new Set(entries.map(e => e.date + "|" + (e.title || e.text.slice(0,40))));
  let added = 0;
  for (const p of parsedPreview){
    const key = p.date + "|" + (p.title || p.text.slice(0,40));
    if (existing.has(key)) continue;
    existing.add(key);
    const e = makeEntry(p.date, p.title, p.text);
    entries.push(e); addAlertIfDanger(e); added++;
  }
  const cutoff = new Date(Date.now() - 14*86400000).toISOString().slice(0,10);
  alerts = alerts.map(a => (a.date < cutoff && !a.prayed) ? {...a, prayed:true} : a);
  persist(); renderAll();
  $("#importResult").innerHTML = `Imported <b class="gold">${added}</b> dreams (${parsedPreview.length - added} duplicates skipped).`;
  $("#importBtn").style.display = "none"; $("#importText").value = ""; parsedPreview = null;
  toast(added + " dreams imported.");
};

/* ---------- settings ---------- */
$("#notifToggle").onchange = async ev => {
  if (ev.target.checked){
    if (!canNotify()){ toast("Add the app to your Home Screen first."); ev.target.checked = false; return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted"){ ev.target.checked = false; toast("Permission not granted."); return; }
    settings.notif = true; persist(); toast("Prayer notifications on.");
  } else { settings.notif = false; persist(); }
};
$("#testNotif").onclick = () => {
  if (settings.notif){ notify("Night Watches", "Notifications are working. Rest well tonight."); toast("Test sent."); }
  else toast("Turn notifications on first.");
};
$("#savePeople").onclick = () => {
  people = $("#peopleBox").value.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  entries = entries.map(e => ({...e, a: analyze(e.text)}));
  persist(); renderAll(); toast("Watchlist saved & dreams re-analyzed.");
};
$("#exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify({entries, alerts, people, settings}, null, 1)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "night-watches-backup-" + new Date().toISOString().slice(0,10) + ".json";
  a.click();
};
$("#restoreBtn").onclick = () => $("#restoreFile").click();
$("#restoreFile").onchange = ev => {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.entries)) throw 0;
      entries = d.entries; alerts = d.alerts || []; people = d.people || people;
      persist(); renderAll(); toast("Backup restored — " + entries.length + " dreams.");
    } catch(e){ toast("That file isn't a Night Watches backup."); }
  };
  r.readAsText(f);
};

/* ---------- init ---------- */
$("#nDate").value = new Date().toISOString().slice(0,10);
renderAll();

const today = new Date().toISOString().slice(0,10);
const openAlerts = alerts.filter(a => !a.prayed);
if (openAlerts.length && settings.lastOpenNotif !== today){
  settings.lastOpenNotif = today; persist();
  const names = [...new Set(openAlerts.flatMap(a => a.people))].slice(0,4).join(", ");
  notify("Prayer watch 🙏", "Still on your watch: " + names);
}
if ("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

/* ================= LIVING POSTER ================= */
const SYMBOL_MEANING = {
  "Fire":"Presence of God, calling, purification, warning",
  "Water":"Cleansing, the Holy Spirit, overwhelming emotions, transition",
  "Vehicles":"Journey, direction, acceleration, assignment",
  "Animals":"Spirits, enemies, instincts, protection, warnings",
  "School":"Training, testing, being taught",
  "Houses":"Assignment areas, spiritual states, seasons",
  "Time":"Kairos time, divine appointments, urgency",
  "Keys & doors":"Access, revelation, authority, hidden solutions",
  "Weapons":"Spiritual battles, authority, protection, deliverance",
  "Heaven":"Revelation, God's realm, angelic activity",
  "Money":"Provision, stewardship, favour",
  "Church":"Ministry, calling, the fellowship"
};
const PHASE_NAME = {
  warfare:"Warfare & discernment", calling:"Calling & commissioning",
  revelation:"Revelation & awakening", warning:"Testing & warning",
  healing:"Healing & freedom", family:"Family & foundations",
  provision:"Provision & open doors", growth:"Refining & humility"
};
/* the ascent path control points (x,y in a 360x230 viewBox) */
const ASCENT = [[26,208],[70,196],[112,168],[150,162],[190,128],[228,108],[262,78],[292,52]];
function ascentPoint(t){ /* linear interpolation by cumulative length */
  const segs = []; let total = 0;
  for (let i=0;i<ASCENT.length-1;i++){
    const dx=ASCENT[i+1][0]-ASCENT[i][0], dy=ASCENT[i+1][1]-ASCENT[i][1];
    const L=Math.hypot(dx,dy); segs.push(L); total+=L;
  }
  let d = t*total;
  for (let i=0;i<segs.length;i++){
    if (d<=segs[i]){ const f=d/segs[i];
      return [ASCENT[i][0]+(ASCENT[i+1][0]-ASCENT[i][0])*f, ASCENT[i][1]+(ASCENT[i+1][1]-ASCENT[i][1])*f]; }
    d-=segs[i];
  }
  return ASCENT[ASCENT.length-1];
}
function notableScore(e){
  return (e.confirmed?100:0) + e.a.dangerScore*2 + e.a.syms.length*3 + (e.title?15:0);
}
function monthName(isoStr, short){
  return new Date(isoStr+"T00:00").toLocaleDateString("en-ZA",{month: short?"short":"long"});
}
function renderPoster(){
  const root = $("#posterRoot"); if (!root) return;
  if (!entries.length){
    root.innerHTML = `<div class="empty"><div class="m">Your poster is waiting.</div>It draws itself from your dreams — add or import some first.</div>`;
    return;
  }
  const sorted = [...entries].sort((a,b)=>a.date.localeCompare(b.date));
  const first = sorted[0].date, last = sorted[sorted.length-1].date;
  const range = (monthName(first) + " " + first.slice(0,4) + " – " + monthName(last) + " " + last.slice(0,4)).toUpperCase();
  const total = entries.length;
  const conf = entries.filter(e=>e.confirmed).length;

  /* themes */
  const catCounts = {};
  for (const e of entries) catCounts[e.a.primary] = (catCounts[e.a.primary]||0)+1;
  const seg = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
  const themesHTML = seg.map(([id,n]) =>
    `<div class="prow"><span class="sw" style="background:${CATS[id].hex}"></span>${CATS[id].label}<span class="pct">${Math.round(n/total*100)}%</span></div>`).join("");

  /* three phases of the journey */
  const third = Math.ceil(sorted.length/3);
  const phases = [0,1,2].map(i => {
    const slice = sorted.slice(i*third, (i+1)*third);
    if (!slice.length) return null;
    const cc = {}; for (const e of slice) cc[e.a.primary] = (cc[e.a.primary]||0)+1;
    const dom = Object.entries(cc).sort((a,b)=>b[1]-a[1])[0][0];
    const y1 = slice[0].date.slice(0,4), y2 = slice[slice.length-1].date.slice(0,4);
    return { years: y1===y2 ? y1 : y1+"–"+y2, label: PHASE_NAME[dom] };
  }).filter(Boolean);

  /* milestones for the mountain: most significant dreams, in time order */
  const milestones = [...entries].sort((a,b)=>notableScore(b)-notableScore(a)).slice(0,8)
    .sort((a,b)=>a.date.localeCompare(b.date));
  let mSvg = "";
  milestones.forEach((e,i) => {
    const [x,y] = ascentPoint((i+1)/(milestones.length+1));
    mSvg += `<g data-open="${e.id}" style="cursor:pointer">
      <circle cx="${x}" cy="${y}" r="9" fill="#0A111F" opacity="0"></circle>
      <circle cx="${x}" cy="${y}" r="5" fill="${CATS[e.a.primary].hex}" stroke="#0A111F" stroke-width="1.5">
        <title>${fmtDate(e.date)}${e.title? " — "+e.title : ""}</title></circle>
      ${e.confirmed ? `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="#D2A94E" stroke-width="1"></circle>`:""}
    </g>`;
  });
  const mountainHTML = `
  <svg viewBox="0 0 360 230" width="100%" role="img" aria-label="Your dream journey ascent map">
    <polygon points="0,230 82,168 148,198 232,102 292,50 318,84 360,158 360,230" fill="#10192B"></polygon>
    <polygon points="120,230 200,170 260,196 320,140 360,178 360,230" fill="#0D1524"></polygon>
    <path d="M${ASCENT.map(p=>p.join(" ")).join(" L")}" fill="none" stroke="#D2A94E" stroke-width="1.2" stroke-dasharray="4 4" opacity=".8"></path>
    <text x="292" y="40" text-anchor="middle" font-size="15" fill="#D2A94E">♛</text>
    <text x="26" y="224" text-anchor="middle" font-size="9" fill="#8592A6">base camp</text>
    <text x="292" y="228" text-anchor="middle" font-size="9" fill="#8592A6">the summit</text>
    ${mSvg}
  </svg>`;

  /* year timelines */
  const byYear = {};
  for (const e of entries){ const y = e.date.slice(0,4); (byYear[y] = byYear[y]||[]).push(e); }
  const yearsHTML = Object.keys(byYear).sort().map(y => {
    const top = byYear[y].sort((a,b)=>notableScore(b)-notableScore(a)).slice(0,6)
      .sort((a,b)=>a.date.localeCompare(b.date));
    return `<div class="yearlabel">${y} <span class="muted small">· ${byYear[y].length} dreams</span></div>
      <div class="yeardots">${top.map(e =>
        `<button class="ydot" data-open="${e.id}">
          <div class="mc" style="background:${CATS[e.a.primary].hex}">${monthName(e.date,true).toUpperCase()}</div>
          <div class="tt">${e.title || e.text.slice(0,34)+"…"}</div>
        </button>`).join("")}</div>`;
  }).join("");

  /* glossary with live counts */
  const symCounts = {};
  for (const e of entries) for (const s of e.a.syms) symCounts[s] = (symCounts[s]||0)+1;
  const glosHTML = Object.entries(symCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([s,n]) =>
    `<div class="grow"><span class="gname">${s}</span><span class="muted">${SYMBOL_MEANING[s]||""}</span><span class="gcount">×${n}</span></div>`).join("");

  /* generated key insight */
  const months = Math.max(1, Math.round((new Date(last) - new Date(first)) / (30.44*86400000)));
  const topCat = seg[0], topSym = Object.entries(symCounts).sort((a,b)=>b[1]-a[1])[0];
  const openWatch = alerts.filter(a=>!a.prayed).length;
  let insight = `This record spans ${total} dreams across ${months} months. ${CATS[topCat[0]].label} leads your night watches at ${Math.round(topCat[1]/total*100)}%.`;
  if (topSym) insight += ` ${topSym[0]} recurs in ${topSym[1]} dreams — a thread worth watching.`;
  if (conf) insight += ` ${conf} dream${conf>1?"s have":" has"} already been confirmed in waking life.`;
  insight += openWatch ? ` ${openWatch} name${openWatch>1?"s":""} on the prayer watch tonight.` : ` The prayer watch is clear tonight.`;

  root.innerHTML = `<div class="poster">
    <div class="crown">♛</div>
    <h1>Keanen's<br>Prophetic Dream Journal</h1>
    <div class="range">${range}</div>
    <div class="quote">"In the last days, God says, I will pour out my Spirit on all people. Your young men shall see visions, your old men shall dream dreams." — Joel 2:28</div>
    <div class="psec"><h3>Theme distribution</h3><div class="pthemes">${themesHTML}</div></div>
    <div class="psec"><h3>The journey arc</h3>${mountainHTML}
      <div class="phases">${phases.map(p=>`<div><div class="py">${p.years}</div><div class="pl">${p.label}</div></div>`).join("")}</div>
      <div class="muted small" style="text-align:center;margin-top:10px">Each dot is a significant dream — tap it. Gold rings are confirmed.</div></div>
    <div class="psec"><h3>Visual timeline</h3>${yearsHTML}</div>
    <div class="psec"><h3>Recurring symbols</h3><div class="pglos">${glosHTML}</div>
      <div class="muted small" style="text-align:center;margin-top:10px;font-style:italic">Symbols repeat to reveal patterns. Patterns reveal purpose.</div></div>
    <div class="psec"><h3>Key insight</h3><div class="pinsight">${insight}</div></div>
    <div class="pfoot">This is not just a journal.<br>This is your story with God.</div>
    <button class="cta" id="posterExport" style="margin-top:22px">Save poster as image</button>
  </div>`;
  const ex = $("#posterExport"); if (ex) ex.onclick = () => exportPosterPNG({range, seg, total, conf, months, symCounts, milestones, phases});
}

/* ---------- PNG export of the poster ---------- */
function exportPosterPNG(d){
  try{
    const W = 1080, H = 1700, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    const GOLD = "#D2A94E", CREAM = "#EAE2CF", MUTED = "#8592A6";
    x.fillStyle = "#0A111F"; x.fillRect(0,0,W,H);
    x.strokeStyle = GOLD; x.lineWidth = 2; x.strokeRect(28,28,W-56,H-56);
    x.textAlign = "center";
    x.fillStyle = GOLD; x.font = "40px Georgia"; x.fillText("♛", W/2, 110);
    x.font = "500 66px Georgia"; x.fillText("KEANEN'S", W/2, 190);
    x.font = "500 44px Georgia"; x.fillText("PROPHETIC DREAM JOURNAL", W/2, 248);
    x.fillStyle = CREAM; x.font = "26px Georgia";
    x.fillText(d.range.split("").join("\u200a\u200a"), W/2, 300);
    x.fillStyle = MUTED; x.font = "italic 25px Georgia";
    x.fillText('"Your young men shall see visions,', W/2, 360);
    x.fillText('your old men shall dream dreams." — Joel 2:28', W/2, 396);
    /* donut */
    const cx = 300, cy = 610, r = 130; let a = -Math.PI/2;
    for (const [id,n] of d.seg){
      const frac = n/d.total;
      x.beginPath(); x.strokeStyle = CATS[id].hex; x.lineWidth = 52;
      x.arc(cx, cy, r, a+0.02, a + frac*2*Math.PI - 0.02); x.stroke();
      a += frac*2*Math.PI;
    }
    x.fillStyle = CREAM; x.font = "500 72px Georgia"; x.fillText(String(d.total), cx, cy+14);
    x.fillStyle = MUTED; x.font = "20px Georgia"; x.fillText("DREAMS", cx, cy+48);
    x.textAlign = "left";
    let ly = 500;
    for (const [id,n] of d.seg.slice(0,8)){
      x.fillStyle = CATS[id].hex; x.fillRect(520, ly-16, 18, 18);
      x.fillStyle = CREAM; x.font = "26px Georgia";
      x.fillText(CATS[id].label + "  ·  " + Math.round(n/d.total*100) + "%", 552, ly);
      ly += 42;
    }
    /* mountain */
    const mx = t => 80 + t*(W-160), sc = p => [80 + (p[0]-20)/(300-20)*(W-160), 900 + (p[1]-40)/(215-40)*330];
    x.fillStyle = "#10192B"; x.beginPath();
    [[0,230],[82,168],[148,198],[232,102],[292,50],[318,84],[360,158],[360,230]].forEach((p,i)=>{
      const q = [80 + p[0]/360*(W-160), 900 + (p[1]-40)/(230-40)*350];
      i ? x.lineTo(q[0],q[1]) : x.moveTo(q[0],q[1]);
    });
    x.closePath(); x.fill();
    x.strokeStyle = GOLD; x.lineWidth = 3; x.setLineDash([10,10]); x.beginPath();
    ASCENT.forEach((p,i)=>{ const q = sc(p); i ? x.lineTo(q[0],q[1]) : x.moveTo(q[0],q[1]); });
    x.stroke(); x.setLineDash([]);
    d.milestones.forEach((e,i)=>{
      const q = sc(ascentPoint((i+1)/(d.milestones.length+1)));
      x.beginPath(); x.fillStyle = CATS[e.a.primary].hex;
      x.arc(q[0], q[1], 12, 0, 7); x.fill();
      if (e.confirmed){ x.beginPath(); x.strokeStyle = GOLD; x.lineWidth = 2.5; x.arc(q[0], q[1], 19, 0, 7); x.stroke(); }
    });
    const summit = sc(ASCENT[ASCENT.length-1]);
    x.fillStyle = GOLD; x.font = "44px Georgia"; x.textAlign = "center";
    x.fillText("♛", summit[0], summit[1]-26);
    /* phases */
    let px = 120, pw = (W-240)/d.phases.length;
    x.font = "500 30px Georgia";
    d.phases.forEach(p => {
      x.fillStyle = GOLD; x.fillText(p.years, px+pw/2, 1330);
      x.fillStyle = MUTED; x.font = "22px Georgia"; x.fillText(p.label, px+pw/2, 1364);
      x.font = "500 30px Georgia"; px += pw;
    });
    /* symbols line */
    const syms = Object.entries(d.symCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([s,n]) => s.toUpperCase() + " ×" + n).join("   ·   ");
    x.fillStyle = CREAM; x.font = "24px Georgia"; x.fillText(syms, W/2, 1450);
    x.fillStyle = MUTED; x.font = "italic 22px Georgia";
    x.fillText("Symbols repeat to reveal patterns. Patterns reveal purpose.", W/2, 1492);
    x.fillStyle = GOLD; x.font = "italic 30px Georgia";
    x.fillText("This is not just a journal. This is your story with God.", W/2, 1590);
    const a2 = document.createElement("a");
    a2.href = cv.toDataURL("image/png");
    a2.download = "night-watches-poster-" + new Date().toISOString().slice(0,10) + ".png";
    a2.click();
    toast("Poster image saved.");
  } catch(e){ toast("Couldn't render the image on this device."); }
}
