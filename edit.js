const $ = s => document.querySelector(s);
const LABELS = { allergies: "Allergy", conditions: "Condition", meds: "Medication" };
let bid = "", bcode = "";   // the bracelet ID and code, kept only in memory while this page is open

/* ---------- form rows ---------- */
function addRow(kind, item = {}) {
  const hasNote = kind !== "meds";
  const d = document.createElement("div");
  d.className = "item";
  // Labels are fixed text; user data is set through .value below, never through innerHTML.
  d.innerHTML =
    `<label>${LABELS[kind]} (English)<input data-k="en"></label>` +
    `<label>${LABELS[kind]} (Filipino, optional)<input data-k="fil"></label>` +
    (hasNote
      ? `<label>What should responders know or do? (English)<input data-k="noteEn"></label>` +
        `<label>Same, in Filipino (optional)<input data-k="noteFil"></label>`
      : "") +
    `<button type="button" class="btn quiet rm">Remove</button>`;
  const set = (k, v) => { const e = d.querySelector(`[data-k="${k}"]`); if (e) e.value = v || ""; };
  set("en", item.en); set("fil", item.fil);
  if (hasNote) { set("noteEn", item.note && item.note.en); set("noteFil", item.note && item.note.fil); }
  $("#" + kind).append(d);
}

function collect(kind) {
  return [...document.querySelectorAll(`#${kind} .item`)].map(d => {
    const v = k => { const e = d.querySelector(`[data-k="${k}"]`); return e ? e.value.trim() : ""; };
    const o = { en: v("en"), fil: v("fil") };
    if (kind !== "meds") o.note = { en: v("noteEn"), fil: v("noteFil") };
    return o;
  }).filter(o => o.en);
}

const blank = () => ({ name: "", age: "", blood: "Unknown", contacts: [], allergies: [], conditions: [], meds: [] });

function fill(p) {
  $("#name").value = p.name || "";
  $("#age").value = p.age || "";
  $("#blood").value = p.blood || "Unknown";
  $("#contacts").innerHTML = "";
  const cs = contactsOf(p).slice(0, MAX_CONTACTS);
  (cs.length ? cs : [{}]).forEach(c => addContact(c));      // always show at least one contact row
  ["allergies", "conditions", "meds"].forEach(k => {
    $("#" + k).innerHTML = "";
    (p[k] || []).forEach(item => addRow(k, item));
  });
}

/* ---------- emergency contacts ---------- */
const MAX_CONTACTS = 5;

function renumber() {
  document.querySelectorAll("#contacts .contact").forEach((d, i) => {
    d.querySelector(".rowtitle").textContent = i === 0 ? "Primary contact (called first)" : `Contact ${i + 1}`;
    d.querySelector(".up").hidden = i === 0;
  });
}

function addContact(c = {}) {
  if (document.querySelectorAll("#contacts .contact").length >= MAX_CONTACTS) {
    say(`You can add up to ${MAX_CONTACTS} contacts.`, false); return;
  }
  const d = document.createElement("div");
  d.className = "item contact";
  // Labels are fixed text; user data is set through .value below, never through innerHTML.
  d.innerHTML =
    `<p class="rowtitle"></p>` +
    `<label>Contact name<input data-k="name" autocomplete="off"></label>` +
    `<div class="two"><label>Relationship (English)<input data-k="relEn" placeholder="sister"></label>` +
    `<label>Relationship (Filipino, optional)<input data-k="relFil" placeholder="kapatid"></label></div>` +
    `<label>Phone number<input data-k="phone" type="tel" inputmode="tel"></label>` +
    `<div class="two"><button type="button" class="btn quiet up">Make primary</button>` +
    `<button type="button" class="btn quiet rmc">Remove</button></div>`;
  const set = (k, v) => { d.querySelector(`[data-k="${k}"]`).value = v || ""; };
  const rel = c.rel || {};
  set("name", c.name); set("relEn", rel.en); set("relFil", rel.fil); set("phone", c.phone);
  $("#contacts").append(d);
  renumber();
}

function collectContacts() {
  const list = [];
  const rows = [...document.querySelectorAll("#contacts .contact")];
  for (let i = 0; i < rows.length; i++) {
    const v = k => rows[i].querySelector(`[data-k="${k}"]`).value.trim();
    const name = v("name"), phone = v("phone");
    if (!name && !phone) continue;                              // an empty row is ignored
    const digits = phone.replace(/\D/g, "");
    const who = i === 0 ? "the primary contact" : `contact ${i + 1}`;
    if (!name) return { error: `Please enter a name for ${who}.` };
    if (digits.length < 7 || digits.length > 15) return { error: `Please enter a valid phone number for ${who}.` };
    list.push({ name, rel: { en: v("relEn"), fil: v("relFil") }, phone });
  }
  if (!list.length) return { error: "Please add at least one emergency contact." };
  return { list };
}

/* ---------- messages ---------- */
function say(msg, ok) { const s = $("#status"); s.textContent = msg; s.className = ok ? "ok" : "err"; }
function loginSay(msg, ok) { const s = $("#loginStatus"); s.textContent = msg; s.className = ok ? "ok" : "err"; }
function reasonMsg(r) {
  if (r === "locked") return "Too many wrong tries. This bracelet is locked for 15 minutes.";
  if (r === "missing") return "We couldn't find a bracelet with that ID. Check the ID and try again.";
  if (r === "bad") return "That code doesn't match this bracelet.";
  return "Something went wrong. Please try again.";
}

/* ---------- screens ---------- */
function scanLink() { return new URL("index.html?id=" + encodeURIComponent(bid), location.href).href; }
function updateShare() {
  const on = !backend.demo && !!bid;
  $("#shareBox").hidden = !on;
  if (on) $("#shareLink").value = scanLink();
}
function showLock(msg) {
  bcode = "";
  $("#f").hidden = true; $("#login").hidden = false; $("#lock").hidden = true;
  $("#code").value = "";
  loginSay(msg || "", !msg);
}
function enter(data) {
  $("#login").hidden = true; $("#f").hidden = false;
  $("#lock").hidden = backend.demo;
  $("#reset").hidden = !backend.demo;
  fill(validProfile(data) ? data : blank());   // a bracelet not set up yet starts with a blank form
  updateShare();
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const add = e.target.closest("[data-add]");
  if (add) { if (add.dataset.add === "contacts") addContact(); else addRow(add.dataset.add); return; }
  const up = e.target.closest(".up");
  if (up) { const row = up.closest(".contact"); row.parentNode.prepend(row); renumber(); return; }
  const rmc = e.target.closest(".rmc");
  if (rmc) {
    if (document.querySelectorAll("#contacts .contact").length <= 1) return say("Keep at least one emergency contact.", false);
    rmc.closest(".contact").remove(); renumber(); return;
  }
  const rm = e.target.closest(".rm");
  if (rm) rm.closest(".item").remove();
});

$("#unlockForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("#bid").value.trim().toLowerCase(), code = $("#code").value;
  if (!id) return loginSay("Please enter the bracelet ID.", false);
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 12)
    return loginSay("The code has 12 letters and numbers, like ABCD-EFGH-JKMN.", false);
  const btn = e.submitter; if (btn) btn.disabled = true;
  loginSay("Checking…", true);
  try {
    const r = await backend.unlock(id, code);
    if (!r || !r.ok) loginSay(reasonMsg(r && r.reason), false);
    else { bid = id; bcode = code; loginSay("", true); enter(r.data); }
  } catch (err) { loginSay("Could not connect. Check your internet and try again.", false); }
  if (btn) btn.disabled = false;
});

$("#lock").addEventListener("click", () => location.reload());

$("#f").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#name").value.trim();
  const age = $("#age").value ? Number($("#age").value) : "";
  if (!name) return say("Please enter your name.", false);
  if (age !== "" && (age < 0 || age > 120)) return say("Please enter a valid age.", false);
  const cs = collectContacts();
  if (cs.error) return say(cs.error, false);

  const profile = {
    name, age, blood: $("#blood").value,
    updated: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    contact: cs.list[0],          // also kept so older copies of the scan page still work
    contacts: cs.list,
    allergies: collect("allergies"), conditions: collect("conditions"), meds: collect("meds")
  };

  say("Saving…", true);
  try {
    const r = await backend.save(bid, bcode, profile);
    if (r && r.ok) say(backend.demo ? "Saved on this browser. Open the scan page to see your changes."
                                    : "Saved. Anyone who scans your bracelet now sees the updated profile.", true);
    else if (r && (r.reason === "bad" || r.reason === "locked")) showLock("Your code no longer works. " + reasonMsg(r.reason));
    else say("Could not save. Please try again.", false);
  } catch (err) { say("Could not save: " + ((err && err.message) || "unknown error"), false); }
});

$("#copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#shareLink").value); say("Link copied.", true); }
  catch (e) { $("#shareLink").select(); say("Press and hold the link to copy it.", true); }
});

$("#reset").addEventListener("click", () => {
  if (!confirm("Replace everything with the demo profile?")) return;
  backend.reset();
  backend.unlock().then(r => { fill(r.data); say("Demo profile restored.", true); });
});

/* ---------- start ---------- */
(async () => {
  $("#demoBanner").hidden = !backend.demo;
  const qid = new URLSearchParams(location.search).get("id");
  if (qid) $("#bid").value = qid;
  if (backend.demo) { bid = "demo"; const r = await backend.unlock(); enter(r.data); }
  else showLock("");
})();
