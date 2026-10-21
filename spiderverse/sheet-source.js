// Reads the published Google Sheet (CSV) and turns it into teams. No DOM, no Firebase.
export function parseCSV(t) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// "2:35.45" -> m:ss ; "0:02:35" -> h:mm:ss (Sheets duration) ; "2.5" / "2.5 min" -> minutes ; "155 s" -> seconds
function toSeconds(s, plainIsSeconds) {
  s = s.trim().toLowerCase();
  let m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (m) return +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
  m = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (m) return +m[2] < 60 && +m[3] < 60 ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
  m = /^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds|m|min|mins|minutes)?$/.exec(s);
  if (m) { const sec = m[2] ? m[2][0] === "s" : plainIsSeconds; return +m[1] * (sec ? 1 : 60); }
  return null;
}

export function parseSheet(text) {
  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim()));
  const teams = [], issues = [];
  if (!rows.length) return { teams, issues };
  const head = rows[0].map((c) => c.trim().toLowerCase());
  const find = (re) => head.findIndex((h) => re.test(h));
  const hasHead = head.some((h) => /team|name|min|sec|time|duration|result/.test(h));
  let nameI = 0, minI = -1, secI = -1, timeI = -1, start = 0, unitSec = false;
  const num = (v) => v !== undefined && v.trim() !== "" && Number.isFinite(Number(v));
  if (hasHead) {
    start = 1;
    const n = find(/team|name/); if (n >= 0) nameI = n;
    minI = find(/^min/); secI = find(/^sec/); timeI = find(/time|duration|result|completion/);
    if (minI < 0 && secI < 0 && timeI < 0) timeI = nameI === 0 ? 1 : 0;
    if (timeI >= 0) unitSec = /sec/.test(head[timeI]);
  } else if (rows[0].length >= 3 && num(rows[0][1]) && num(rows[0][2])) { minI = 1; secI = 2; }
  else timeI = 1;

  const seen = new Map();
  for (let r = start; r < rows.length; r++) {
    const row = rows[r], line = r + 1, name = (row[nameI] || "").trim().replace(/\s+/g, " ");
    let raw, secs = null;
    if (minI >= 0 || secI >= 0) {
      const m = (minI >= 0 ? row[minI] || "" : "").trim(), s = (secI >= 0 ? row[secI] || "" : "").trim();
      raw = m + s;
      if (raw) { const mn = m === "" ? 0 : Number(m), sc = s === "" ? 0 : Number(s); if (Number.isFinite(mn) && Number.isFinite(sc) && mn >= 0 && sc >= 0 && sc < 60) secs = mn * 60 + sc; }
    } else { raw = (row[timeI] || "").trim(); if (raw) secs = toSeconds(raw, unitSec); }
    if (!raw) { if (name) continue; else continue; }          // not played yet (or empty row)
    if (!name) { issues.push({ line, msg: "Team name is empty" }); continue; }
    if (secs === null || !(secs > 0)) { issues.push({ line, msg: `Invalid time for “${name}”` }); continue; }
    secs = Math.round(secs * 100) / 100;
    const key = name.toLowerCase();
    if (seen.has(key)) { issues.push({ line, msg: `Duplicate team “${name}” — the best time is used` }); const t = seen.get(key); if (secs < t.time) t.time = secs; continue; }
    const t = { id: key, name, time: secs }; seen.set(key, t); teams.push(t);
  }
  return { teams, issues };
}

export async function loadSheet(url) {
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return parseSheet(await res.text());
}
