import { DATA_SOURCE, SHEET_CSV_URL, REFRESH_SECONDS } from "./config.js";
import { loadSheet } from "./sheet-source.js";

const $ = (s) => document.querySelector(s);
// Times are stored in Firestore as total seconds and shown as minutes:seconds.centiseconds.
const clock = (t) => { const c = Math.round(Number(t) * 100); return Math.floor(c / 6000) + ":" + ((c % 6000) / 100).toFixed(2).padStart(5, "0"); };
const fmt = (t) => clock(t) + " min";
const gapTxt = (d) => (d < 60 ? "+" + d.toFixed(2) + " s" : "+" + clock(d) + " min");
let prev = {};

function renderPodium(top) {
  document.querySelectorAll(".slot").forEach((slot) => {
    const r = +slot.dataset.r, t = top[r - 1];
    slot.querySelector(".nm").textContent = t ? t.name : "—";
    slot.querySelector(".tm").textContent = t ? fmt(t.time) : "—";
    slot.classList.toggle("crown", r === 1 && !!t);
    const sig = t ? t.id + t.time : "";
    if (prev["p" + r] !== sig) { slot.classList.remove("pop"); void slot.offsetWidth; if (sig) slot.classList.add("pop"); }
    prev["p" + r] = sig;
  });
}

const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function renderRows(rest, startRank, best) {
  const box = $("#rows");
  box.replaceChildren();
  if (!rest.length) { box.append(el("div", "empty", "Ranks 4–10 will appear here.")); return; }
  rest.forEach((t, i) => {
    const row = el("div", "row");
    const sig = t.id + t.time;
    if (prev[t.id] !== sig) { row.classList.add("flash"); row.style.setProperty("--i", i); }
    prev[t.id] = sig;
    const mid = el("div", "mid");
    const bar = el("div", "bar2"), fill = document.createElement("i");
    fill.style.setProperty("--w", Math.max(6, (best / t.time) * 100) + "%");
    bar.append(fill);
    mid.append(el("div", "nm2", t.name), bar);
    const tm = el("div", "tm", fmt(t.time));
    tm.append(el("div", "gap", gapTxt(t.time - best) + " behind #1"));
    row.append(el("span", "rk", String(startRank + i)), mid, tm);
    box.append(row);
  });
}

const status = (t) => ($("#status").textContent = t);
let last = "";
function show(all) {
  const top = [...all].sort((a, b) => a.time - b.time || a.name.localeCompare(b.name)).slice(0, 10);
  const sig = top.map((t) => t.id + t.time).join("|");
  if (sig === last) return;            // nothing changed: keep the page as is
  last = sig;
  renderPodium(top.slice(0, 3));
  renderRows(top.slice(3), 4, top[0]?.time);
}

// Source 1: published Google Sheet, re-read every few seconds.
async function fromSheet() {
  const tick = async () => {
    try {
      const { teams } = await loadSheet(SHEET_CSV_URL);
      show(teams);
      status("Live from Google Sheet · " + new Date().toLocaleTimeString());
    } catch (e) { console.error(e); status("Can't read the Google Sheet — check “Publish to web”"); }
  };
  tick();
  setInterval(tick, REFRESH_SECONDS * 1000);
  document.addEventListener("visibilitychange", () => !document.hidden && tick());
}

// Source 2: Firestore (real-time) — set DATA_SOURCE = "firebase" in config.js.
async function fromFirebase() {
  const [{ db, RESULTS }, fs] = await Promise.all([import("./firebase-config.js"), import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")]);
  const q = fs.query(fs.collection(db, RESULTS), fs.orderBy("time", "asc"), fs.limit(10));
  fs.onSnapshot(q, (snap) => { show(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); status("Live · updates automatically"); },
    (err) => { console.error(err); status("Connection problem — check Firebase config and rules"); });
}

DATA_SOURCE === "firebase" ? fromFirebase() : fromSheet();

$("#fs").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});
document.addEventListener("fullscreenchange", () => {
  $("#fs").textContent = document.fullscreenElement ? "EXIT FULL SCREEN" : "FULL SCREEN";
});
