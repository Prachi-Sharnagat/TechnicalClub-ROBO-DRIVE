// Spreadsheet-style bulk entry for the admin page.
// Type in the grid, paste rows from Excel / Google Sheets, or import a CSV / Excel file.
export function initSheet({ getTeams, saveRows, say }) {
  const $ = (s) => document.querySelector(s);
  const body = $("#sheetBody"), msg = $("#sheetMsg"), file = $("#sheetFile");
  const MIN_ROWS = 8, MAX_ROWS = 400, cols = ["name", "mins", "secs"];

  const rows = () => [...body.rows];
  const val = (tr) => cols.map((c) => tr.querySelector(`[data-c=${c}]`).value.trim());
  const isEmpty = (tr) => val(tr).every((v) => !v);
  const renumber = () => rows().forEach((tr, i) => (tr.cells[0].textContent = i + 1));

  function addRow() {
    const tr = document.createElement("tr");
    const n = document.createElement("td"); n.className = "n"; tr.append(n);
    cols.forEach((c) => {
      const td = document.createElement("td"), inp = document.createElement("input");
      inp.dataset.c = c; inp.autocomplete = "off";
      if (c === "name") { inp.maxLength = 40; inp.placeholder = "Team name"; }
      else { inp.inputMode = "decimal"; inp.placeholder = c === "mins" ? "2" : "35.45"; }
      td.append(inp); tr.append(td);
    });
    const x = document.createElement("td"), b = document.createElement("button");
    b.type = "button"; b.className = "x"; b.textContent = "✕"; b.title = "Remove row"; b.setAttribute("aria-label", "Remove row");
    b.onclick = () => { tr.remove(); renumber(); };
    x.append(b); tr.append(x); body.append(tr); renumber();
    return tr;
  }
  function reset() { body.replaceChildren(); for (let i = 0; i < MIN_ROWS; i++) addRow(); }

  // Accepts "Team <tab/comma> Minutes <tab/comma> Seconds" or "Team <tab/comma> m:ss.xx".
  function parseText(text) {
    const out = [];
    text.replace(/\r/g, "").split("\n").forEach((line) => {
      if (!line.trim()) return;
      const p = (line.includes("\t") ? line.split("\t") : line.split(",")).map((s) => s.trim().replace(/^"|"$/g, ""));
      const [name, a = "", b = ""] = p;
      if (p.length === 2 || (b === "" && a.includes(":"))) {
        const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(a);
        out.push(m ? [name, m[1], m[2]] : [name, a, ""]);
      } else out.push([name, a, b]);
    });
    if (out.length && Number.isNaN(Number(out[0][1]))) out.shift(); // header line
    return out;
  }

  function fill(list, start) {
    if (start + list.length > MAX_ROWS) return say(msg, `Too many rows (max ${MAX_ROWS}).`, "err");
    while (rows().length < start + list.length) addRow();
    const all = rows();
    list.forEach((v, i) => {
      all[start + i].classList.remove("bad");
      all[start + i].querySelectorAll("input").forEach((inp, k) => (inp.value = v[k] ?? ""));
    });
    say(msg, `${list.length} row(s) filled. Review them, then press “Save all”.`, "ok");
  }
  const firstFree = () => { let last = -1; rows().forEach((tr, i) => { if (!isEmpty(tr)) last = i; }); return last + 1; };

  body.addEventListener("paste", (e) => {
    const t = e.clipboardData.getData("text");
    if (!/[\n\t]/.test(t.trim())) return; // single value: normal paste
    e.preventDefault();
    fill(parseText(t), rows().indexOf(e.target.closest("tr")));
  });

  function check(tr) {
    const [name, m, s] = val(tr);
    const mins = Number(m || "0"), secs = Number(s || "0");
    const time = Math.round((mins * 60 + secs) * 100) / 100;
    if (!name) return "Team name is empty";
    if (!Number.isInteger(mins) || mins < 0) return "Minutes must be a whole number";
    if (!Number.isFinite(secs) || secs < 0 || secs >= 60) return "Seconds must be 0–59.99";
    if (!(time > 0)) return "Time must be above 0";
    return { name: name.replace(/\s+/g, " "), time };
  }

  $("#sheetSave").onclick = async () => {
    const used = rows().filter((tr) => !isEmpty(tr));
    if (!used.length) return say(msg, "Nothing to save. Fill in some rows first.", "err");
    const good = []; let bad = 0;
    used.forEach((tr) => {
      const r = check(tr), err = typeof r === "string";
      tr.classList.toggle("bad", err); tr.title = err ? r : "";
      err ? bad++ : good.push(r);
    });
    if (bad) return say(msg, `${bad} row(s) need fixing (highlighted — hover for the reason). Nothing was saved.`, "err");
    try {
      const { added, updated } = await saveRows(good);
      reset(); say(msg, `Saved: ${added} added, ${updated} updated.`, "ok");
    } catch (e) { say(msg, "Save failed: " + (e.code || e.message), "err"); }
  };
  $("#sheetAdd").onclick = () => { if (rows().length < MAX_ROWS) addRow().querySelector("input").focus(); };
  $("#sheetClear").onclick = () => { reset(); say(msg, ""); };

  $("#sheetExport").onclick = () => {
    const lines = ["Team,Minutes,Seconds"];
    getTeams().forEach((t) => { const c = Math.round(t.time * 100); lines.push(`"${t.name.replace(/"/g, '""')}",${Math.floor(c / 6000)},${(c % 6000) / 100}`); });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "robo-drive-results.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  $("#sheetImport").onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      let text;
      if (/\.xlsx?$/i.test(f.name)) {
        if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = no; document.head.append(s); });
        const wb = window.XLSX.read(await f.arrayBuffer());
        text = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }).map((r) => r.join("\t")).join("\n");
      } else text = await f.text();
      fill(parseText(text), firstFree());
    } catch (e) { say(msg, "Could not read that file.", "err"); }
    file.value = "";
  };

  reset();
}
