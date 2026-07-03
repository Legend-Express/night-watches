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

function renderAll(){ renderPrayerWatch(); renderHome(); renderJournal(); renderPatterns(); renderSettings(); }
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
