// Admin page in Google-Sheet mode: entries are typed in the spreadsheet; this page checks them.
import { SHEET_CSV_URL, SHEET_EDIT_URL, REFRESH_SECONDS } from "./config.js";
import { loadSheet } from "./sheet-source.js";

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const fmt = (t) => { const c = Math.round(t * 100); return Math.floor(c / 6000) + ":" + ((c % 6000) / 100).toFixed(2).padStart(5, "0") + " min"; };

$("#login").classList.add("hidden");
$("#dash").classList.add("hidden");
$("#sheetMode").classList.remove("hidden");
if (SHEET_EDIT_URL) { const a = $("#openSheet"); a.href = SHEET_EDIT_URL; a.classList.remove("hidden"); }

async function refresh() {
  const status = $("#sheetStatus"), list = $("#sheetList"), issues = $("#sheetIssues");
  try {
    const { teams, issues: bad } = await loadSheet(SHEET_CSV_URL);
    teams.sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
    list.replaceChildren(); issues.replaceChildren();
    if (!teams.length) list.append(el("p", "empty", "No valid results in the sheet yet."));
    teams.forEach((t, i) => {
      const row = el("div", "arow" + (i >= 10 ? " dim" : ""));
      row.append(el("span", "r", "#" + (i + 1)), el("span", "", t.name), el("span", "t", fmt(t.time)));
      list.append(row);
    });
    if (!bad.length) issues.append(el("p", "empty", "No problems found."));
    bad.forEach((b) => { const row = el("div", "arow"); row.append(el("span", "r", "Row " + b.line), el("span", "", b.msg)); issues.append(row); });
    status.textContent = `${teams.length} team(s) · ${bad.length} issue(s) · checked ${new Date().toLocaleTimeString()}`;
    status.className = "msg " + (bad.length ? "err" : "ok");
  } catch (e) {
    status.textContent = "Can't read the sheet. In Google Sheets use File > Share > Publish to web, choose Sheet1 + CSV, and publish.";
    status.className = "msg err";
  }
}
$("#refresh").onclick = refresh;
refresh();
setInterval(refresh, REFRESH_SECONDS * 1000);
