const form = () => document.getElementById("property-inspector");
const fields = () => [...form().querySelectorAll("[name]")];
const field = (n) => form().querySelector(`[name="${n}"]`);
const $ = (id) => document.getElementById(id);
let entities = [];
let loaded = false;

function readForm() {
  const s = {};
  for (const el of fields()) s[el.name] = el.value.trim();
  return s;
}
function fillForm(p) {
  p = p && typeof p === "object" ? p : {};
  for (const el of fields()) el.value = p[el.name] ?? el.dataset.default ?? el.value ?? "";
  update();
  if (!loaded) { loaded = true; if (field("url").value && field("token").value) refresh(); else $UD.sendToPlugin({ cmd: "defaults" }); }
}
function update() {
  document.querySelectorAll("[data-show]").forEach((el) => {
    const [k, v] = el.dataset.show.split("=");
    el.classList.toggle("hidden-row", field(k).value !== v);
  });
  const id = field("entityId").value.trim();
  const e = entities.find((x) => x[0] === id);
  $("entityInfo").textContent = e ? `${e[1] || id} — stan: ${e[2]}` : id && entities.length ? "Nie ma takiej encji na tym serwerze." : "";
  $("entityInfo").className = "uspi-item-value note" + (id && entities.length && !e ? " err" : "");
}
let timer = 0;
function send() { update(); clearTimeout(timer); timer = setTimeout(() => $UD.sendParamFromPlugin(readForm()), 200); }
function status(text, cls) { $("status").textContent = text; $("status").className = "uspi-item-value note " + (cls || ""); }
function refresh() {
  const { url, token } = readForm();
  if (!url || !token) return status("Wpisz adres serwera i token.", "err");
  status("Łączę z Home Assistantem…");
  $UD.sendToPlugin({ cmd: "entities", url, token });
}

// --- własna, ciemna lista encji (zamiast <datalist>, którego nie da się ostylować) ---
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
let comboActive = -1, comboShown = [];
function renderCombo(open) {
  const list = $("entities");
  const q = field("entityId").value.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  comboShown = entities.filter((e) => {
    const hay = (e[0] + " " + (e[1] || "")).toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, 200);
  if (comboShown.length === 1 && comboShown[0][0].toLowerCase() === q) comboShown = [];
  comboActive = -1;
  list.innerHTML = comboShown.length
    ? comboShown.map((e, i) => `<div class="combo-item" data-i="${i}"><div class="eid">${esc(e[0])}</div>${e[1] ? `<div class="ename">${esc(e[1])}</div>` : ""}</div>`).join("")
    : (entities.length && q ? `<div class="combo-empty">Brak pasujących encji</div>` : "");
  if (open !== undefined) list.classList.toggle("open", open && list.innerHTML !== "");
}
function comboOpen() { return $("entities").classList.contains("open"); }
function comboClose() { $("entities").classList.remove("open"); }
function comboPick(i) {
  const e = comboShown[i]; if (!e) return;
  field("entityId").value = e[0]; comboClose(); send();
}
function comboHighlight(d) {
  const items = [...$("entities").querySelectorAll(".combo-item")]; if (!items.length) return;
  comboActive = (comboActive + d + items.length) % items.length;
  items.forEach((el, i) => el.classList.toggle("active", i === comboActive));
  items[comboActive].scrollIntoView({ block: "nearest" });
}
function initCombo() {
  const inp = field("entityId"), list = $("entities");
  inp.addEventListener("focus", () => renderCombo(true));
  inp.addEventListener("click", () => renderCombo(true));
  inp.addEventListener("input", () => renderCombo(true));
  inp.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); if (!comboOpen()) renderCombo(true); comboHighlight(1); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); comboHighlight(-1); }
    else if (ev.key === "Enter") { ev.preventDefault(); if (comboOpen() && comboActive >= 0) comboPick(comboActive); else comboClose(); }
    else if (ev.key === "Escape") comboClose();
  });
  list.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    const it = ev.target.closest(".combo-item"); if (it) comboPick(+it.dataset.i);
  });
  inp.addEventListener("blur", () => setTimeout(comboClose, 100));
}

let picking = "";
$UD.connect();
$UD.onConnected(() => {
  document.querySelector(".uspi-wrapper").classList.remove("hidden");
  form().addEventListener("change", send);
  form().addEventListener("input", send);
  $("connect").addEventListener("click", refresh);
  initCombo();
  form().querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
    picking = b.dataset.pick;
    $UD.selectFileDialog("Obrazy (*.png *.jpg *.jpeg *.gif)");
  }));
  form().querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => { field(b.dataset.clear).value = ""; send(); }));
  update();
});
$UD.onSelectdialog((j) => {
  if (j && j.path && picking) { field(picking).value = j.path.replace(/\//g, "\\"); picking = ""; send(); }
});
$UD.onSendToPropertyInspector((j) => {
  const p = (j && j.payload) || {};
  if (p.cmd === "defaults" && !field("url").value && p.url) {
    field("url").value = p.url; field("token").value = p.token; send(); refresh();
  }
  if (p.cmd === "entities") {
    if (!p.ok) { entities = []; status("Błąd: " + p.error, "err"); update(); return; }
    entities = p.entities || [];
    renderCombo(false);
    status(`Połączono — ${entities.length} encji. Zacznij wpisywać nazwę w polu Encja.`, "ok");
    update();
  }
});
$UD.onAdd((j) => j && fillForm(j.param));
$UD.onParamFromApp((j) => j && fillForm(j.param));
