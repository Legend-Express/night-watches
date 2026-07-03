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
  clearTimeout(t._h); t._h = setTimeout(()=> t.style.display="none", 2600);
}
function catChip(id){
  const c = CATS[id];
  return `<span class="chip cat" style="background:${c.hex}22;color:${c.hex}">${c.label}</span>`;
}

/* ---------- notifications ---------- */
function canNotify(){ return "Notification" in window; }
function notify(title, body){
  if (!settings.notif || !canNotify() || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon:"icon-180.png", badge:"icon-180.png" }); } catch(e){}
}

/* ---------- prayer watch ---------- */
function renderPrayerWatch(){
  const box = $("#prayerWatch");
  const open = alerts.filter(a => !a.prayed);
  if (!alerts.length){ box.innerHTML = ""; return; }
  const items = alerts.slice(0, open.length ? 6 : 2).map(a => `
    <div class="alert ${a.prayed ? "prayed":""}">
      <div class="who">${a.people.join(", ")}</div>
      <div class="muted small">Flagged in your dream of ${fmtDate(a.date)}${a.prayed ? " · prayed ✓" : ""}</div>
      ${a.prayed ? "" : `<div style="margin-top:8px" class="row">
        <button class="btn small" data-pray="${a.id}">Mark as prayed</button>
        <button class="btn small ghost" data-openentry="${a.entryId}">Read the dream</button>
      </div>`}
    </div>`).join("");
  box.innerHTML = `<div class="card" style="border-color:var(--gold-dim)">
    <h2>Prayer watch <span class="count">${open.length ? open.length + " waiting" : "all prayed"}</span></h2>
    ${items}</div>`;
}

/* ---------- journal ---------- */
function passesFilter(e){
  const q = $("#search").value.trim().toLowerCase();
  if (q && !(e.text.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))) return false;
  if (!activeFilter) return true;
  if (activeFilter.type === "symbol") return e.a.syms.includes(activeFilter.value);
  if (activeFilter.type === "person") return e.a.people.includes(activeFilter.value);
  if (activeFilter.type === "cat")    return e.a.cats.includes(activeFilter.value);
  return true;
}
function renderJournal(){
  const list = $("#entryList");
  const fi = $("#filterinfo");
  if (activeFilter){
    fi.style.display = "block";
    fi.innerHTML = `<div class="row"><span>Showing dreams with <b class="gold">${activeFilter.value}</b></span>
      <button class="btn small ghost" id="clearFilter">Clear</button></div>`;
    $("#clearFilter").onclick = () => { activeFilter = null; renderJournal(); };
  } else fi.style.display = "none";

  const shown = entries.filter(passesFilter).sort((a,b)=> b.date.localeCompare(a.date));
  if (!entries.length){
    list.innerHTML = `<div class="empty"><div class="m">The record begins tonight.</div>
      Add your first dream, or paste your existing Notes journal under Settings → Import.</div>`;
    return;
  }
  if (!shown.length){ list.innerHTML = `<div class="empty">No dreams match.</div>`; return; }
  list.innerHTML = shown.map(e => {
    const c = CATS[e.a.primary];
    return `<article class="entry" style="border-left-color:${c.hex}" data-id="${e.id}">
      <div class="date">${fmtDate(e.date)} ${e.confirmed ? '<span class="confirmedmark">· confirmed ✓</span>':''}</div>
      ${e.title ? `<div class="title">${e.title}</div>` : ""}
      <div class="body">${e.text}</div>
      <div class="meta">${e.a.cats.map(catChip).join("")}
        ${e.a.syms.slice(0,5).map(s=>`<span class="chip">${s}</span>`).join("")}</div>
      <div class="related" data-rel="${e.id}"></div>
      <div class="tools">
        <button class="btn small secondary" data-confirm="${e.id}">${e.confirmed ? "Unmark confirmed" : "Mark confirmed"}</button>
        <button class="btn small ghost" data-del="${e.id}">Delete</button>
      </div>
    </article>`;
  }).join("");
}
function openEntryCard(card){
  card.classList.toggle("open");
  if (!card.classList.contains("open")) return;
  const id = card.dataset.id;
  const e = entries.find(x => x.id === id);
  const relBox = card.querySelector("[data-rel]");
  const rel = relatedTo(e);
  relBox.innerHTML = rel.length
    ? `<div class="small gold" style="margin-bottom:4px">This thread recurs — related dreams:</div>` +
      rel.map(r => `<div class="small muted">• ${fmtDate(r.date)}${r.title ? " — " + r.title : ""} <span class="gold">(shares ${r.a.syms.filter(s=>e.a.syms.includes(s)).slice(0,3).join(", ") || "people"})</span></div>`).join("")
    : `<div class="small muted">No related dreams yet.</div>`;
}

/* ---------- patterns ---------- */
function renderPatterns(){
  const counts = {};
  for (const e of entries) for (const s of e.a.syms) counts[s] = (counts[s]||0)+1;
  const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  $("#symList").innerHTML = rows.length ? rows.map(([s,n]) =>
    `<div class="symrow" data-sym="${s}"><span>${s}</span><span class="c">${n} dream${n>1?"s":""}</span></div>`).join("")
    : `<div class="muted small">Patterns appear once you have a few dreams saved.</div>`;

  const pc = {};
  for (const e of entries) for (const p of e.a.people) pc[p] = (pc[p]||0)+1;
  const prow = Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,15);
  $("#peopleList").innerHTML = prow.length ? prow.map(([p,n]) =>
    `<div class="symrow" data-person="${p}"><span>${p}</span><span class="c">${n}</span></div>`).join("")
    : `<div class="muted small">No people detected yet.</div>`;

  const conf = entries.filter(e => e.confirmed).sort((a,b)=>b.date.localeCompare(a.date));
  $("#confirmedList").innerHTML = conf.length ? conf.map(e =>
    `<div class="symrow" data-openentry="${e.id}"><span>${e.title || e.text.slice(0,40)+"…"}</span><span class="c">${fmtDate(e.date)}</span></div>`).join("")
    : `<div class="muted small">When a dream comes to pass, open it and tap "Mark confirmed".</div>`;
}

/* ---------- dashboard ---------- */
function renderDash(){
  const total = entries.length;
  const conf = entries.filter(e=>e.confirmed).length;
  const now = new Date();
  const thisMonth = entries.filter(e => e.date.startsWith(now.toISOString().slice(0,7))).length;
  const prayed = alerts.filter(a=>a.prayed).length;
  $("#stats").innerHTML = `
    <div class="stat"><div class="n">${total}</div><div class="l">dreams recorded</div></div>
    <div class="stat"><div class="n">${thisMonth}</div><div class="l">this month</div></div>
    <div class="stat"><div class="n">${conf}</div><div class="l">confirmed</div></div>
    <div class="stat"><div class="n">${prayed}</div><div class="l">prayers answered to watch</div></div>`;

  const catCounts = {};
  for (const e of entries) catCounts[e.a.primary] = (catCounts[e.a.primary]||0)+1;
  const seg = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
  const donut = $("#donut");
  let offset = 25, svg = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--line)" stroke-width="5"></circle>`;
  for (const [id,n] of seg){
    const pct = total ? (n/total)*100 : 0;
    svg += `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${CATS[id].hex}" stroke-width="5"
      stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="${offset}"></circle>`;
    offset -= pct;
  }
  donut.innerHTML = svg;
  $("#legend").innerHTML = seg.map(([id,n]) =>
    `<div class="li"><span class="sw" style="background:${CATS[id].hex}"></span>${CATS[id].label}
     <span class="pct">${total ? Math.round(n/total*100) : 0}%</span></div>`).join("") || `<div class="muted small">No dreams yet.</div>`;

  const mCounts = {};
  for (let i=11; i>=0; i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    mCounts[d.toISOString().slice(0,7)] = 0;
  }
  for (const e of entries){ const k = e.date.slice(0,7); if (k in mCounts) mCounts[k]++; }
  const max = Math.max(1, ...Object.values(mCounts));
  $("#months").innerHTML = Object.entries(mCounts).map(([k,n]) => {
    const lbl = new Date(k+"-01").toLocaleDateString("en-ZA",{month:"short"});
    return `<div class="b" style="height:${Math.max(3, n/max*100)}%"><span>${lbl[0]}</span></div>`;
  }).join("");
}

/* ---------- settings ---------- */
function renderSettings(){
  $("#peopleBox").value = people.join("\n");
  $("#notifToggle").checked = settings.notif && canNotify() && Notification.permission === "granted";
}

/* ---------- render all ---------- */
function renderAll(){
  renderPrayerWatch(); renderJournal(); renderPatterns(); renderDash(); renderSettings();
}

/* ---------- events ---------- */
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  b.classList.add("active");
  $("#view-"+b.dataset.view).classList.add("active");
  window.scrollTo({top:0});
});

document.body.addEventListener("click", ev => {
  const t = ev.target;
  if (t.dataset.pray){
    const a = alerts.find(x=>x.id===t.dataset.pray);
    if (a){ a.prayed = true; persist(); renderPrayerWatch(); renderDash(); toast("Marked as prayed 🙏"); }
    return;
  }
  if (t.dataset.openentry){
    activeFilter = null; $("#search").value = "";
    document.querySelector('nav button[data-view="journal"]').click();
    renderJournal();
    const card = document.querySelector(`.entry[data-id="${t.dataset.openentry}"]`);
    if (card){ openEntryCard(card); card.scrollIntoView({block:"center"}); }
    return;
  }
  if (t.dataset.confirm){
    const e = entries.find(x=>x.id===t.dataset.confirm);
    e.confirmed = !e.confirmed; persist(); renderAll(); return;
  }
  if (t.dataset.del){
    if (confirm("Delete this dream? This cannot be undone.")){
      entries = entries.filter(x=>x.id!==t.dataset.del);
      alerts = alerts.filter(a=>a.entryId!==t.dataset.del);
      persist(); renderAll();
    }
    return;
  }
  const sym = t.closest("[data-sym]");
  if (sym){ activeFilter = {type:"symbol", value:sym.dataset.sym};
    document.querySelector('nav button[data-view="journal"]').click(); renderJournal(); return; }
  const per = t.closest("[data-person]");
  if (per){ activeFilter = {type:"person", value:per.dataset.person};
    document.querySelector('nav button[data-view="journal"]').click(); renderJournal(); return; }
  const card = t.closest(".entry");
  if (card && !t.closest("button")) openEntryCard(card);
});

$("#search").addEventListener("input", renderJournal);

$("#saveEntry").onclick = () => {
  const text = $("#nText").value.trim();
  if (!text){ toast("Write the dream first."); return; }
  const e = makeEntry($("#nDate").value || new Date().toISOString().slice(0,10), $("#nTitle").value, text);
  entries.unshift(e);
  const al = addAlertIfDanger(e);
  persist();
  $("#nText").value = ""; $("#nTitle").value = "";
  const c = CATS[e.a.primary];
  $("#saveResult").innerHTML = `<div class="card" style="border-left:3px solid ${c.hex};margin-bottom:0">
    <div class="small gold">Saved & filed</div>
    <div style="margin-top:6px">${e.a.cats.map(catChip).join("")}</div>
    ${e.a.syms.length ? `<div style="margin-top:6px">${e.a.syms.map(s=>`<span class="chip">${s}</span>`).join("")}</div>`:""}
    ${e.a.people.length ? `<div class="small muted" style="margin-top:6px">People: ${e.a.people.join(", ")}</div>`:""}
    ${al ? `<div class="small" style="margin-top:8px;color:var(--warning)">⚠ Added to Prayer Watch: ${al.people.join(", ")}</div>`:""}
  </div>`;
  if (al) notify("Prayer watch 🙏", "Your dream flagged " + al.people.join(", ") + ". Take a moment to pray for them.");
  renderAll();
  toast("Dream saved.");
};

/* import */
let parsedPreview = null;
$("#parseBtn").onclick = () => {
  const raw = $("#importText").value;
  if (!raw.trim()){ $("#importResult").textContent = "Paste your journal text first."; return; }
  parsedPreview = parseNotes(raw);
  if (!parsedPreview.length){ $("#importResult").textContent = "No dated entries found — check the date format."; return; }
  const dates = parsedPreview.map(p=>p.date).sort();
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
    entries.push(e);
    addAlertIfDanger(e);
    added++;
  }
  /* only keep unprayed alerts from the last 14 days after a bulk import, so old dreams don't flood the watch */
  const cutoff = new Date(Date.now() - 14*86400000).toISOString().slice(0,10);
  alerts = alerts.map(a => (a.date < cutoff && !a.prayed) ? {...a, prayed:true} : a);
  persist(); renderAll();
  $("#importResult").innerHTML = `Imported <b class="gold">${added}</b> dreams (${parsedPreview.length - added} duplicates skipped). Older danger flags were auto-archived; new ones will appear as you journal.`;
  $("#importBtn").style.display = "none"; $("#importText").value = ""; parsedPreview = null;
  toast(added + " dreams imported.");
};

/* notifications */
$("#notifToggle").onchange = async ev => {
  if (ev.target.checked){
    if (!canNotify()){ toast("Notifications aren't supported here. Add the app to your Home Screen first."); ev.target.checked = false; return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted"){ ev.target.checked = false; toast("Permission not granted."); return; }
    settings.notif = true; persist(); toast("Prayer notifications on.");
  } else { settings.notif = false; persist(); }
};
$("#testNotif").onclick = () => {
  if (settings.notif) { notify("Night Watches", "Notifications are working. Rest well tonight."); toast("Test sent."); }
  else toast("Turn notifications on first.");
};

/* people watchlist */
$("#savePeople").onclick = () => {
  people = $("#peopleBox").value.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
  entries = entries.map(e => ({...e, a: analyze(e.text)}));
  persist(); renderAll(); toast("Watchlist saved & dreams re-analyzed.");
};

/* backup */
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
      entries = d.entries; alerts = d.alerts||[]; people = d.people||people;
      persist(); renderAll(); toast("Backup restored — " + entries.length + " dreams.");
    } catch(e){ toast("That file isn't a Night Watches backup."); }
  };
  r.readAsText(f);
};

/* ---------- init ---------- */
$("#nDate").value = new Date().toISOString().slice(0,10);
renderAll();

/* on-open reminder: if unprayed alerts exist, fire one summary notification per day */
const today = new Date().toISOString().slice(0,10);
const openAlerts = alerts.filter(a=>!a.prayed);
if (openAlerts.length && settings.lastOpenNotif !== today){
  settings.lastOpenNotif = today; persist();
  const names = [...new Set(openAlerts.flatMap(a=>a.people))].slice(0,4).join(", ");
  notify("Prayer watch 🙏", "Still on your watch: " + names);
}

/* offline: register service worker when served over http(s) */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
