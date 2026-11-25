// Ulanzi Studio plugin: dowolna encja Home Assistant na przycisku.
// Obraz przycisku zależy od stanu (wł. / wył. / niedostępna), obsługuje PNG/JPG i animowane GIF.
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const { HAClient } = require("./ha");

const UUID = "com.ulanzi.ulanzistudio.halamp";
const [address = "127.0.0.1", port = "3906"] = process.argv.slice(2);
const ROOT = path.join(__dirname, "..");
const LOG = path.join(ROOT, "plugin.log");
const CONFIG = path.join(ROOT, "config.json");

function log(msg) {
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 512 * 1024) fs.renameSync(LOG, LOG + ".old");
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

// --- domyślny serwer (ostatnio użyty), żeby nowe przyciski miały go od razu wpisanego ---
function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { return {}; } }
let config = readConfig();
function saveDefaults(url, token) {
  if (!url || !token || (config.url === url && config.token === token)) return;
  config = { ...config, url, token };
  try { fs.writeFileSync(CONFIG, JSON.stringify(config, null, 1)); } catch (e) { log(`config save: ${e.message}`); }
}

// --- połączenia z serwerami HA (jedno na adres+token) ---
const clients = new Map();
function client(url, token) {
  url = String(url || "").trim().replace(/\/+$/, ""); token = String(token || "").trim();
  if (!url || !token) return null;
  const k = url + "|" + token;
  if (!clients.has(k)) {
    const c = new HAClient(url, token, log);
    c.onChange((id) => { for (const e of keys.values()) if (e.client === c && (!id || id === e.s.entityId)) draw(e); });
    clients.set(k, c);
  }
  return clients.get(k);
}
function dropUnusedClients() {
  const used = new Set([...keys.values()].map((e) => e.client));
  for (const [k, c] of clients) if (!used.has(c) && !c.keep) { c.close(); clients.delete(k); }
}

// --- obrazy ---
// automatyczne ikony (plugin/icons.js + images/icons.pack) — przeładowywane po zmianie plików, bez restartu
const ICON_FILES = [path.join(__dirname, "icons.js"), path.join(__dirname, "png.js"), path.join(ROOT, "images", "icons.pack")];
let iconsMod = null, iconsStamp = "";
function iconsStampNow() { try { return ICON_FILES.map((f) => fs.statSync(f).mtimeMs).join("|"); } catch { return ""; } }
function icons() {
  const st = iconsStampNow();
  if (!iconsMod || st !== iconsStamp) {
    try {
      for (const k of Object.keys(require.cache)) if (/[\\/]plugin[\\/](icons|png)\.js$/.test(k)) delete require.cache[k];
      iconsMod = require("./icons"); iconsStamp = st; log("ikony: załadowano");
    } catch (e) { log(`ikony: ${e.stack || e.message}`); iconsStamp = st; }
  }
  return iconsMod;
}
setInterval(() => { if (iconsMod && iconsStampNow() !== iconsStamp) { icons(); for (const e of keys.values()) { e.lastSig = ""; draw(e); } } }, 5000);
const OFF_STATES = new Set(["off", "closed", "locked", "not_home", "idle", "paused", "standby", "docked", "disarmed", "below_horizon"]);
const OTHER_STATES = new Set(["unavailable", "unknown"]);
const kindOf = (st) => (!st || OTHER_STATES.has(st.state) ? "other" : OFF_STATES.has(st.state) ? "off" : "on");
const BUILTIN = {
  light: { on: "lamp_on.png", off: "lamp_off.png" },
  default: { on: "power_on.png", off: "power_off.png" },
  other: "unavailable.png",
};
const imgCache = new Map();
function loadImage(file) {
  try {
    const st = fs.statSync(file);
    const c = imgCache.get(file);
    if (c && c.mtime === st.mtimeMs) return c.img;
    const ext = path.extname(file).toLowerCase();
    const mime = ext === ".gif" ? "image/gif" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    const img = { gif: ext === ".gif", data: `data:${mime};base64,` + fs.readFileSync(file).toString("base64") };
    imgCache.set(file, { mtime: st.mtimeMs, img });
    return img;
  } catch (e) { log(`obraz ${file}: ${e.message}`); return null; }
}
function imageFor(e, kind, st) {
  const custom = { on: e.s.imgOn, off: e.s.imgOff, other: e.s.imgOther }[kind];
  if (custom) { const img = loadImage(custom); if (img) return img; }
  if ((e.s.icon || "auto") !== "classic" && e.s.entityId) {
    const I = icons();
    if (I) { try { return { gif: false, data: I.iconFor(e.s.entityId, st, { value: e.s.icon !== "plain" }).data }; } catch (err) { log(`ikona ${e.s.entityId}: ${err.stack || err.message}`); } }
  }
  const domain = (e.s.entityId || "").split(".")[0];
  const set = BUILTIN[domain] || BUILTIN.default;
  const file = kind === "other" ? BUILTIN.other : set[kind];
  return loadImage(path.join(ROOT, "images", file));
}

function textFor(e, st) {
  const mode = e.s.text || "none";
  if (mode === "none") return "";
  const name = (st && st.attributes && st.attributes.friendly_name) || e.s.entityId || "";
  const unit = (st && st.attributes && st.attributes.unit_of_measurement) || "";
  const state = st ? `${st.state}${unit ? " " + unit : ""}` : "?";
  if (mode === "state") return state;
  if (mode === "name") return name;
  return String(e.s.customText || "")
    .replace(/\{state\}/g, st ? st.state : "?").replace(/\{unit\}/g, unit).replace(/\{name\}/g, name)
    .replace(/\{attr\.([\w]+)\}/g, (_, a) => (st && st.attributes && st.attributes[a] != null ? st.attributes[a] : ""));
}

function draw(e) {
  if (!e.active || !ws || ws.readyState !== WebSocket.OPEN) return;
  const st = e.client && e.client.ready ? e.client.states.get(e.s.entityId) : null;
  const kind = e.client && e.client.ready ? kindOf(st) : "other";
  const img = imageFor(e, kind, st);
  const text = textFor(e, st);
  const sig = `${kind}|${img && img.data.length}|${img && img.data.slice(-48)}|${text}`;
  if (sig === e.lastSig) return;
  e.lastSig = sig;
  const item = { uuid: e.uuid, key: e.key, actionid: e.actionid, textData: text, showtext: !!text };
  if (img && img.gif) Object.assign(item, { type: 3, gifdata: img.data });
  else Object.assign(item, { type: 1, data: img ? img.data : "" });
  ws.send(JSON.stringify({ cmd: "state", uuid: UUID, key: "", actionid: "", param: { statelist: [item] } }));
}

// --- akcja po naciśnięciu ---
function serviceFor(e, st) {
  const id = e.s.entityId; const domain = id.split(".")[0];
  const a = e.s.action || "toggle";
  if (a === "none") return null;
  if (a === "custom") {
    const [d, s] = String(e.s.customService || "").split(".");
    let data = {};
    if (e.s.customData) { try { data = JSON.parse(e.s.customData); } catch { throw new Error("dane usługi to nie poprawny JSON"); } }
    if (!d || !s) throw new Error("wpisz usługę w formie domena.usługa");
    if (!("entity_id" in data) && id) data.entity_id = id;
    return [d, s, data];
  }
  if (a === "turn_on" || a === "turn_off") return [domain, a, { entity_id: id }];
  // przełącz — encje tylko do odczytu: nic nie rób
  if (READONLY.has(domain)) return null;
  if (["scene", "script"].includes(domain)) return [domain, "turn_on", { entity_id: id }];
  if (["button", "input_button"].includes(domain)) return [domain, "press", { entity_id: id }];
  if (domain === "automation") return [domain, "trigger", { entity_id: id }];
  if (domain === "lock") return [domain, st && st.state === "locked" ? "unlock" : "lock", { entity_id: id }];
  return ["homeassistant", "toggle", { entity_id: id }];
}

const READONLY = new Set(["sensor", "binary_sensor", "weather", "sun", "person", "device_tracker", "zone", "event", "image", "calendar", "air_quality", "proximity", "tag", "stt", "tts", "conversation", "wake_word", "todo", "date", "datetime", "time", "text", "select", "number", "input_number", "input_select", "input_text", "input_datetime", "counter", "update", "camera", "plant", "geo_location", "notify", "ai_task", "assist_satellite"]);

async function run(e) {
  try {
    if (!e.client) throw new Error("brak adresu serwera lub tokenu");
    if (!e.s.entityId) throw new Error("nie wybrano encji");
    if (!e.client.ready) throw new Error(`brak połączenia z HA (${e.client.error || "łączenie…"})`);
    const call = serviceFor(e, e.client.states.get(e.s.entityId));
    if (!call) return;
    await e.client.callService(...call);
    log(`run ${e.s.entityId} -> ${call[0]}.${call[1]} ok`);
  } catch (err) {
    log(`run ${e.s.entityId || "-"}: ${err.message}`);
    send({ cmd: "showAlert", uuid: e.uuid, key: e.key, actionid: e.actionid });
  }
}

// --- przyciski ---
const keys = new Map();
const ctxOf = (d) => `${d.uuid}___${d.key}___${d.actionid}`;
const FIELDS = ["url", "token", "entityId", "action", "customService", "customData", "imgOn", "imgOff", "imgOther", "text", "customText", "icon"];

function upsert(d, param) {
  const ctx = ctxOf(d);
  let e = keys.get(ctx);
  if (!e) { e = { uuid: d.uuid, key: d.key, actionid: d.actionid, active: true, s: {} }; keys.set(ctx, e); }
  if (param && typeof param === "object" && Object.keys(param).length) {
    const s = {};
    for (const f of FIELDS) if (param[f] != null) s[f] = String(param[f]);
    e.s = s;
  }
  // nowy przycisk bez serwera: wpisz ostatnio używany i zapisz w ustawieniach przycisku
  if (!e.s.url && !e.s.token && config.url && config.token) {
    e.s.url = config.url; e.s.token = config.token;
    send({ cmd: "paramfromplugin", uuid: e.uuid, key: e.key, actionid: e.actionid, param: { ...e.s } });
  }
  saveDefaults(e.s.url, e.s.token);
  e.client = client(e.s.url, e.s.token);
  e.lastSig = "";
  dropUnusedClients();
  return e;
}

// --- panel ustawień: lista encji ---
async function toPI(d, payload) {
  send({ cmd: "sendToPropertyInspector", uuid: d.uuid, key: d.key, actionid: d.actionid, payload });
}
async function entitiesFor(d, url, token) {
  const c = client(url, token);
  if (!c) return toPI(d, { cmd: "entities", ok: false, error: "Wpisz adres serwera i token." });
  c.keep = true;
  for (let i = 0; i < 50 && !c.ready && !c.closed; i++) await new Promise((r) => setTimeout(r, 200));
  c.keep = false;
  if (!c.ready) { toPI(d, { cmd: "entities", ok: false, error: c.error || "Nie udało się połączyć." }); dropUnusedClients(); return; }
  const entities = [...c.states.values()]
    .map((s) => [s.entity_id, (s.attributes && s.attributes.friendly_name) || "", s.state])
    .sort((a, b) => a[0].localeCompare(b[0]));
  toPI(d, { cmd: "entities", ok: true, entities });
  try { const I = icons(); if (I) fs.writeFileSync(path.join(ROOT, "icons_report.tsv"), I.report([...c.states.values()]).map((r) => r.map((x) => String(x).replace(/[\t\n]/g, " ")).join("\t")).join("\n")); } catch (err) { log(`raport: ${err.message}`); }
  dropUnusedClients();
}

// --- połączenie z Ulanzi Studio ---
let ws;
function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function connect() {
  ws = new WebSocket(`ws://${address}:${port}`);
  ws.on("open", () => { log(`connected ws://${address}:${port}`); send({ code: 0, cmd: "connected", uuid: UUID }); });
  ws.on("message", (raw) => {
    let d;
    try { d = JSON.parse(raw.toString()); } catch { return; }
    if (!d || (d.code !== undefined && d.cmdType !== "REQUEST")) return;
    send({ cmd: d.cmd, uuid: d.uuid, key: d.key, actionid: d.actionid, code: 0, ...d });
    try {
      switch (d.cmd) {
        case "add": case "paramfromapp": case "paramfromplugin":
          draw(upsert(d, d.param)); break;
        case "setactive": {
          const e = upsert(d); e.active = d.active !== false && d.active !== "false"; e.lastSig = ""; draw(e); break;
        }
        case "run": {
          const known = keys.get(ctxOf(d));
          const e = known || upsert(d, d.param);
          run(e); break;
        }
        case "sendToPlugin": {
          const p = d.payload || {};
          if (p.cmd === "entities") entitiesFor(d, p.url, p.token);
          if (p.cmd === "defaults") toPI(d, { cmd: "defaults", url: config.url || "", token: config.token || "" });
          break;
        }
        case "clear":
          for (const p of Array.isArray(d.param) ? d.param : []) keys.delete(ctxOf(p));
          dropUnusedClients();
          break;
      }
    } catch (e) { log(`error ${d.cmd}: ${e.stack || e.message}`); }
  });
  ws.on("close", () => { log("disconnected"); setTimeout(connect, 3000); });
  ws.on("error", (e) => log(`ws error: ${e.message}`));
}
log(`start, args: ${process.argv.slice(2).join(" ")}`);
connect();
