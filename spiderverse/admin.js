import { db, auth, RESULTS, ADMIN_EMAIL } from "./firebase-config.js";
import { collection, doc, addDoc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { initSheet } from "./sheet.js";
const $ = (s) => document.querySelector(s);
const fmtTime = (t) => { const c = Math.round(Number(t) * 100); return Math.floor(c / 6000) + ":" + ((c % 6000) / 100).toFixed(2).padStart(5, "0") + " min"; };
let editId = null, pendingDel = null, unsub = null, teams = [];

function say(el, text, kind) { el.textContent = text; el.className = "msg " + (kind || ""); }

// ---------- Auth ----------
$("#loginBtn").addEventListener("click", async () => {
  say($("#loginMsg"), "");
  try { const u = $("#email").value.trim().toLowerCase();
    await signInWithEmailAndPassword(auth, u === "technical@club" ? ADMIN_EMAIL : u, $("#pass").value); }
  catch (e) { say($("#loginMsg"), "Login failed. Check your email and password.", "err"); }
});
$("#pass").addEventListener("keydown", (e) => e.key === "Enter" && $("#loginBtn").click());
$("#logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user && user.email !== ADMIN_EMAIL) { signOut(auth); say($("#loginMsg"), "This account is not the admin.", "err"); return; }
  $("#login").classList.toggle("hidden", !!user);
  $("#dash").classList.toggle("hidden", !user);
  if (user) {
    $("#who").textContent = user.email;
    unsub = onSnapshot(query(collection(db, RESULTS), orderBy("time", "asc")), (snap) => {
      teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
      renderList();
    }, () => say($("#msg"), "Cannot read results. This account may not be the authorised admin.", "err"));
  } else { unsub?.(); unsub = null; resetForm(); }
});

// ---------- List ----------
function renderList() {
  const list = $("#list");
  list.replaceChildren();
  if (!teams.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "No results yet. Add the first team above."; list.append(p); return; }
  teams.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "arow" + (i >= 10 ? " dim" : "");
    const r = document.createElement("span"); r.className = "r"; r.textContent = "#" + (i + 1);
    const n = document.createElement("span"); n.textContent = t.name;
    const tm = document.createElement("span"); tm.className = "t"; tm.textContent = fmtTime(t.time);
    const ab = document.createElement("span"); ab.className = "ab";
    const e = document.createElement("button"); e.className = "btn blue sm"; e.type = "button"; e.textContent = "Edit";
    e.onclick = () => startEdit(t);
    const d = document.createElement("button"); d.className = "btn sm"; d.type = "button"; d.textContent = "Delete";
    d.onclick = () => askDelete(t);
    ab.append(e, " ", d);
    row.append(r, n, tm, ab);
    list.append(row);
  });
}

// ---------- Add / edit ----------
function resetForm() {
  editId = null; $("#name").value = ""; $("#mins").value = ""; $("#secs").value = "";
  $("#formTitle").textContent = "Add team result";
  $("#cancel").classList.add("hidden");
}
function startEdit(t) {
  editId = t.id; const c = Math.round(t.time * 100); $("#name").value = t.name; $("#mins").value = Math.floor(c / 6000); $("#secs").value = (c % 6000) / 100;
  $("#formTitle").textContent = "Edit team result";
  $("#cancel").classList.remove("hidden");
  say($("#msg"), ""); $("#name").focus(); scrollTo({ top: 0, behavior: "smooth" });
}
$("#cancel").addEventListener("click", () => { resetForm(); say($("#msg"), ""); });

$("#save").addEventListener("click", async () => {
  const name = $("#name").value.trim().replace(/\s+/g, " ");
  const mins = Number($("#mins").value.trim() || "0"), secs = Number($("#secs").value.trim() || "0");
  const time = mins * 60 + secs;
  if (!name) return say($("#msg"), "Enter a team name.", "err");
  if (name.length > 40) return say($("#msg"), "Team name must be 40 characters or fewer.", "err");
  if (!Number.isInteger(mins) || mins < 0 || !Number.isFinite(secs) || secs < 0 || secs >= 60 || !(time > 0) || time >= 100000)
    return say($("#msg"), "Enter minutes (whole number) and seconds (0–59.99). Total time must be above 0.", "err");
  const data = { name, time: Math.round(time * 100) / 100, updatedAt: serverTimestamp() };
  try {
    if (editId) await setDoc(doc(db, RESULTS, editId), data);
    else await addDoc(collection(db, RESULTS), data);
    say($("#msg"), editId ? "Result updated." : "Result saved.", "ok");
    resetForm();
  } catch (e) { say($("#msg"), "Save failed: " + (e.code || e.message), "err"); }
});
["name", "mins", "secs"].forEach((id) => $("#" + id).addEventListener("keydown", (e) => e.key === "Enter" && $("#save").click()));

// ---------- Delete with confirmation ----------
function askDelete(t) {
  pendingDel = t;
  $("#delText").textContent = `Remove "${t.name}" (${fmtTime(t.time)}) from the leaderboard? This cannot be undone.`;
  $("#modal").classList.add("on");
}
$("#delNo").addEventListener("click", () => { pendingDel = null; $("#modal").classList.remove("on"); });
$("#delYes").addEventListener("click", async () => {
  if (!pendingDel) return;
  try { await deleteDoc(doc(db, RESULTS, pendingDel.id)); say($("#msg"), "Result deleted.", "ok"); if (editId === pendingDel.id) resetForm(); }
  catch (e) { say($("#msg"), "Delete failed: " + (e.code || e.message), "err"); }
  pendingDel = null; $("#modal").classList.remove("on");
});

// ---------- Spreadsheet bulk save ----------
async function saveRows(list) {
  if (list.length > 400) throw new Error("Max 400 rows at a time");
  const byName = new Map(teams.map((t) => [t.name.trim().toLowerCase(), t.id]));
  const batch = writeBatch(db);
  let added = 0, updated = 0;
  for (const r of list) {
    const key = r.name.toLowerCase(), id = byName.get(key);
    const ref = id ? doc(db, RESULTS, id) : doc(collection(db, RESULTS));
    batch.set(ref, { name: r.name, time: r.time, updatedAt: serverTimestamp() });
    if (id) updated++; else { added++; byName.set(key, ref.id); }
  }
  await batch.commit();
  return { added, updated };
}
initSheet({ getTeams: () => teams, saveRows, say });
