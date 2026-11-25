// Minimalny klient WebSocket API Home Assistanta: logowanie tokenem, stany na żywo, wywoływanie usług.
const WebSocket = require("ws");

class HAClient {
  constructor(url, token, log) {
    this.url = String(url || "").trim().replace(/\/+$/, "");
    this.token = String(token || "").trim();
    this.log = log || (() => {});
    this.states = new Map();
    this.listeners = new Set();
    this.pending = new Map();
    this.nextId = 1;
    this.ready = false;
    this.error = "";
    this.closed = false;
    this.retry = 2000;
    this.connect();
  }

  get wsUrl() { return this.url.replace(/^http/i, "ws") + "/api/websocket"; }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(entityId) { for (const fn of this.listeners) { try { fn(entityId); } catch (e) { this.log(`listener error: ${e.message}`); } } }

  connect() {
    if (this.closed) return;
    if (!/^https?:\/\//i.test(this.url) || !this.token) { this.error = "brak adresu lub tokenu"; this.emit(null); return; }
    let ws;
    try { ws = new WebSocket(this.wsUrl, { handshakeTimeout: 10000 }); }
    catch (e) { this.fail(e.message); return; }
    this.ws = ws;
    ws.on("message", (raw) => this.onMessage(raw));
    ws.on("error", (e) => { this.error = e.message; this.log(`HA ${this.url} error: ${e.message}`); });
    ws.on("close", () => {
      clearInterval(this.pinger);
      const was = this.ready; this.ready = false;
      for (const [, p] of this.pending) p.reject(new Error("rozłączono"));
      this.pending.clear();
      if (was) this.log(`HA ${this.url} rozłączono`);
      this.emit(null);
      if (!this.closed) { setTimeout(() => this.connect(), this.retry); this.retry = Math.min(this.retry * 2, 60000); }
    });
  }

  fail(msg) { this.error = msg; this.log(`HA ${this.url}: ${msg}`); this.emit(null); }

  send(obj) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error(this.error || "brak połączenia z HA"));
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, ...obj }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("HA nie odpowiada")); } }, 10000);
    });
  }

  async onMessage(raw) {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.type === "auth_required") return this.ws.send(JSON.stringify({ type: "auth", access_token: this.token }));
    if (m.type === "auth_invalid") { this.closed = true; this.fail("nieprawidłowy token"); this.ws.close(); return; }
    if (m.type === "auth_ok") {
      this.ready = true; this.error = ""; this.retry = 2000;
      this.log(`HA ${this.url} połączono (HA ${m.ha_version})`);
      try {
        await this.send({ type: "subscribe_events", event_type: "state_changed" });
        const list = await this.send({ type: "get_states" });
        this.states.clear();
        for (const s of list || []) this.states.set(s.entity_id, s);
        this.emit(null);
      } catch (e) { this.log(`HA init error: ${e.message}`); }
      this.pinger = setInterval(() => this.send({ type: "ping" }).catch(() => { try { this.ws.terminate(); } catch {} }), 30000);
      return;
    }
    if (m.type === "result" || m.type === "pong") {
      const p = this.pending.get(m.id); if (!p) return;
      this.pending.delete(m.id);
      if (m.type === "pong" || m.success) p.resolve(m.result); else p.reject(new Error((m.error && m.error.message) || "błąd HA"));
      return;
    }
    if (m.type === "event" && m.event && m.event.event_type === "state_changed") {
      const d = m.event.data || {};
      if (d.new_state) this.states.set(d.entity_id, d.new_state); else this.states.delete(d.entity_id);
      this.emit(d.entity_id);
    }
  }

  callService(domain, service, data) {
    return this.send({ type: "call_service", domain, service, service_data: data || {} });
  }

  close() { this.closed = true; clearInterval(this.pinger); try { this.ws && this.ws.close(); } catch {} }
}

module.exports = { HAClient };
