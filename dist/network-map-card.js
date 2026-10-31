/* Network Map Card — a live map of every device on your network, for Home Assistant.
 * Rings view (router → access points → devices), per-hub zoom, link-type filters (Ethernet / Wi-Fi / Zigbee / Z-Wave /
 * Sonos / Lutron), a slideshow, and a House view on a floor plan YOU provide (your own image + rooms you draw).
 * Everything is worked out in the browser from device_tracker.* and the device registry: no add-on, no feed.
 * https://github.com/Vansmak/network-map-card */
const VERSION = "0.3.1";

const ICONS = {"globe": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18\"/>", "wifi": "<path d=\"M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.7 16a5 5 0 0 1 6.6 0\"/><path d=\"M12 19.5v.01\"/>", "link": "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>", "term": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 9l3 3-3 3M12 15h5\"/>", "tv": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M8 21h8\"/>", "speaker": "<rect x=\"6\" y=\"3\" width=\"12\" height=\"18\" rx=\"2\"/><circle cx=\"12\" cy=\"14\" r=\"3\"/><path d=\"M12 7v.01\"/>", "phone": "<path d=\"M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z\"/>", "xplay": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M10 8.5v5l4.5-2.5z\"/><path d=\"M8 21h8\"/>", "image": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"8.5\" cy=\"9.5\" r=\"1.5\"/><path d=\"M21 16l-5-5-9 9\"/>", "cam": "<rect x=\"3\" y=\"7\" width=\"13\" height=\"10\" rx=\"2\"/><path d=\"M16 11l5-3v8l-5-3\"/>", "bot": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>", "temp": "<path d=\"M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z\"/>", "plug": "<path d=\"M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5\"/>", "gauge": "<path d=\"M4 18a8 8 0 1 1 16 0\"/><path d=\"M12 18l4-6\"/>", "bulb": "<path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z\"/>", "lock": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>", "spark": "<path d=\"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z\"/><path d=\"M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z\"/>", "more": "<circle cx=\"5\" cy=\"12\" r=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\"/><circle cx=\"19\" cy=\"12\" r=\"1.5\"/>", "x": "<path d=\"M6 6l12 12M18 6L6 18\"/>"};
const KI = { gateway: "globe", deco: "wifi", ap: "wifi", router: "link", server: "term", pi: "term", tv: "tv", speaker: "speaker", phone: "phone", pc: "term", console: "xplay", printer: "image", cam: "cam", vacuum: "bot", thermostat: "temp", plug: "plug", sensor: "gauge", light: "bulb", lock: "lock", radio: "spark", other: "more" };
// [kind, name regex, sleepy by default (no "it dropped" alerts)]
const KINDS = [
  ["ap", /\bdeco\b|access.?point|\bap\b|unifi|eero|orbi|mesh/i, false], ["router", /edgerouter|ubnt|router|gateway/i, false],
  ["server", /\bnas\b|server|proxmox|unraid/i, false], ["pi", /\bpi\b|pi4|raspberry|homeassistant|home-assistant/i, false],
  ["tv", /\btv\b|webos|shield|roku|chromecast|fire.?(tv|stick)|bravia|oled|vizio|google-tv|appletv|apple-tv/i, true],
  ["speaker", /sonos|echo|homepod|speaker|beam|alexa|nest.?(mini|hub|audio)/i, true],
  ["phone", /phone|iphone|ipad|galaxy|pixel|watch|android|tablet/i, true], ["pc", /desktop|laptop|macbook|\bpc\b|-pc|surface|imac|windows/i, true],
  ["console", /xbox|playstation|ps[45]\b|nintendo|quest|steam.?deck/i, true], ["printer", /canon|epson|brother|printer|laserjet/i, true],
  ["cam", /\bcam\b|camera|doorbell|reolink|wyze|argus|ring-/i, false], ["vacuum", /irobot|roomba|vacuum|braava|roborock/i, true],
  ["thermostat", /thermostat|ecobee|nest/i, false], ["lock", /\block\b|deadbolt/i, false],
  ["light", /bulb|light|\bled\b|lamp|dimmer|strip/i, false], ["plug", /plug|shelly|wemo|kasa|outlet|tasmota|esp[-_0-9]|tuya/i, false],
  ["sensor", /sensor|weather|rachio|sprinkler|ups\b/i, false],
];
const RADIO_NAME = { zigbee: "Zigbee", zwave: "Z-Wave", lutron: "Lutron", thread: "Thread" };
const LINK_NAME = { eth: "Ethernet", wifi: "Wi-Fi", zigbee: "Zigbee", zwave: "Z-Wave", sonos: "Sonos", lutron: "Lutron", thread: "Thread" };
const LINK_COL = { eth: "#3b82f6", wifi: "var(--nm-ok)", zigbee: "#ec4899", zwave: "#f97316", lutron: "#a3a3a3", sonos: "#14b8a6", thread: "#eab308" };
const BAND = { band2_4: "2.4 GHz", band5: "5 GHz", band6: "6 GHz", wifi: "Wi-Fi", wired: "Wired", mesh: "Wireless link", zigbee: "Zigbee", zwave: "Z-Wave", lutron: "Lutron Clear Connect", thread: "Thread", radio: "Radio" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ago = (t) => { if (!t) return ""; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); return h < 24 ? h + " h ago" : Math.round(h / 24) + " d ago"; };
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[KI[k]] || ICONS.more}</svg>`;
const macNorm = (m) => String(m || "").toLowerCase().replace(/[^0-9a-f]/g, "").replace(/(..)(?=.)/g, "$1:");
const kindOf = (name) => { for (const [k, rx, sl] of KINDS) if (rx.test(name || "")) return [k, sl]; return ["other", false]; };

const CSS = `
:host{display:block;--nm-fg:var(--primary-text-color,#e5e7eb);--nm-muted:var(--secondary-text-color,#9ca3af);--nm-faint:color-mix(in srgb,var(--nm-muted) 55%,transparent);
  --nm-panel:var(--ha-card-background,var(--card-background-color,#1b2337));--nm-panel2:var(--secondary-background-color,#222b42);--nm-line:var(--divider-color,#374151);
  --nm-ok:var(--success-color,#34d399);--nm-warn:var(--warning-color,#f59e0b);--nm-bad:var(--error-color,#f87171);--nm-cool:var(--info-color,#60a5fa);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
ha-card{padding:10px;overflow:hidden;position:relative}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;padding:2px 4px 6px}.top b{font-size:18px;color:var(--nm-fg)}.top span{color:var(--nm-muted);font-size:12px}
.wrap{position:relative;display:flex;flex-direction:column}.body{display:flex;gap:10px;min-height:0}
svg.map{flex:1 1 auto;min-width:0;width:100%;display:block;user-select:none;-webkit-user-select:none}
svg.map text{font-family:inherit}svg.map [data-act],svg.map [data-nm]{cursor:pointer}svg.house [data-nm]{cursor:grab}svg.house.draw{cursor:crosshair;touch-action:none}svg.house [data-nm],.side .row{touch-action:none}.body.col{flex-direction:column}.body.col .side{flex:none;max-height:260px}
.nml{stroke-width:1.4}.nml.hub{stroke-width:2.4}.nml.live{stroke-dasharray:5 7;animation:nmflow 1.6s linear infinite}@keyframes nmflow{to{stroke-dashoffset:-24}}
.nml.t-zigbee,.nml.t-zwave,.nml.t-lutron,.nml.t-thread{stroke-dasharray:2 6;stroke-linecap:round;stroke-width:1.8}.nml.t-eth{stroke-width:2}.nml.t-sonos{stroke-width:1.8}
@media (prefers-reduced-motion:reduce){.nml.live{animation:none}}
.key{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center;font-size:11.5px;color:var(--nm-muted);padding:6px 0 0}
.key span{display:inline-flex;align-items:center;gap:5px}.dot{display:inline-block;width:8px;height:8px;border-radius:50%}
.seg{display:inline-flex;gap:4px;flex-wrap:wrap}
.b{border:1px solid var(--nm-line);border-radius:10px;padding:4px 10px;font-size:12px;font-weight:600;background:var(--nm-panel2);color:var(--nm-fg);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px}
.b.on{border-color:var(--nm-ok);color:var(--nm-ok)}.b.big{padding:8px 12px;font-size:13px;border-radius:12px}
.card{position:absolute;right:6px;top:6px;width:min(320px,calc(100% - 12px));background:var(--nm-panel2);border:1px solid var(--nm-line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 12px 40px rgba(0,0,0,.35);z-index:5;color:var(--nm-fg)}
.card .h{display:flex;justify-content:space-between;align-items:center;gap:8px}.card .h b{font-size:16px}.card .x{background:none;border:0;color:var(--nm-muted);font-size:18px;cursor:pointer}
.card .r{display:flex;align-items:center;gap:8px;color:var(--nm-muted);font-size:13px}.grid{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px}.grid small{color:var(--nm-faint)}.mono{font-family:ui-monospace,monospace;font-size:12px}
.btns{display:flex;flex-wrap:wrap;gap:8px}.rooms{display:flex;flex-direction:column;gap:4px;max-height:240px;overflow:auto}.rooms div{display:flex;flex-wrap:wrap;gap:4px}
.side{flex:0 0 190px;max-height:var(--nm-h,720px);overflow:auto;font-size:12px;color:var(--nm-fg)}.side h4{margin:6px 0 4px;font-size:12px;color:var(--nm-muted);font-weight:600}
.side .row{display:flex;align-items:center;gap:6px;padding:3px 2px;cursor:grab;touch-action:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.side .row svg{width:14px;height:14px;flex:none}
.edit{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 4px;font-size:12px;color:var(--nm-muted)}.edit select{background:var(--nm-panel2);color:var(--nm-fg);border:1px solid var(--nm-line);border-radius:8px;padding:4px 6px}
.room{fill:color-mix(in srgb,var(--nm-cool) 7%,transparent);stroke:color-mix(in srgb,var(--nm-fg) 55%,transparent);stroke-width:2}.roomt{fill:var(--nm-fg);font-size:13px;font-weight:600;paint-order:stroke;stroke:var(--nm-panel);stroke-width:4px}
.ghost{fill:color-mix(in srgb,var(--nm-ok) 35%,transparent);stroke:var(--nm-ok);stroke-width:2;pointer-events:none}.empty{padding:40px;text-align:center;color:var(--nm-muted)}
.hubt{fill:var(--nm-fg);font-weight:600;paint-order:stroke;stroke:var(--nm-panel);stroke-width:4px;stroke-linejoin:round}.hubs{fill:var(--nm-muted);font-weight:400}
`;

class NetworkMapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._links = new Set(["eth", "wifi", "sonos"]); this._view = "ring"; this._floor = 0; this._edit = false;
    this._S = { names: {}, sleep: {}, rooms: {}, pos: {}, known: {}, hidden: {}, plan: { rooms: {} }, conn: {}, parent: {}, baseline: false };
    this._reg = { dev: [], ent: [], area: [] }; this._img = {}; this._last = 0; this._nodes = [];
  }
  static getStubConfig() { return { type: "custom:network-map-card" }; }
  getCardSize() { return 10; }
  setConfig(c) {
    this._cfg = { gateway_name: "Router", height: 720, sync_areas: false, floors: [{ name: "Home" }], storage_key: "network_map", hubs: [], ignore: [], radios: ["zigbee", "zwave", "lutron"], ...c };
    if (!this._cfg.floors.length) this._cfg.floors = [{ name: "Home" }];
    this._html = ""; if (this._hass) this._draw();
  }
  set hass(h) {
    this._hass = h;
    if (!this._booted) { this._booted = true; this._boot(); }
    else if (Date.now() - this._last > 4000) this._rebuild();
  }
  connectedCallback() { this._ro = new ResizeObserver(() => { const n = this.clientWidth > 0 && this.clientWidth < 600; if (n !== this._nar) { this._nar = n; this._html = ""; this._draw(); } }); this._ro.observe(this); this._reg_t = setInterval(() => this._loadReg(), 300000); }
  disconnectedCallback() { if (this._ro) this._ro.disconnect(); clearInterval(this._reg_t); this._showStop(true); }

  /* ---------- data ---------- */
  async _boot() {
    try { const r = await this._hass.callWS({ type: "frontend/get_user_data", key: this._cfg.storage_key }); if (r && r.value) this._S = { ...this._S, ...r.value, plan: { rooms: {}, ...(r.value.plan || {}) }, conn: r.value.conn || {}, parent: r.value.parent || {} }; } catch (_) { try { Object.assign(this._S, JSON.parse(localStorage.getItem("nm_" + this._cfg.storage_key) || "{}")); } catch (__) { /* */ } }
    await this._loadReg(); this._rebuild();
  }
  async _loadReg() {
    const w = (t) => this._hass.callWS({ type: t }).catch(() => []);
    const [dev, ent, area] = await Promise.all([w("config/device_registry/list"), w("config/entity_registry/list"), w("config/area_registry/list")]);
    this._reg = { dev, ent, area }; this._rebuilt = false;
  }
  _save() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      this._hass.callWS({ type: "frontend/set_user_data", key: this._cfg.storage_key, value: this._S }).catch(() => { try { localStorage.setItem("nm_" + this._cfg.storage_key, JSON.stringify(this._S)); } catch (_) { /* */ } });
    }, 400);
  }
  _rebuild() {
    this._last = Date.now();
    try { this._nodes = this._build(); } catch (e) { console.error("network-map-card", e); this._nodes = []; }
    if (!this._hold && !this._edit) this._draw();
  }
  _build() {
    const H = this._hass, S = this._S, C = this._cfg, st = H.states, nodes = [], seen = new Set();
    const gw = { i: "gw", n: C.gateway_name, k: "gateway", hub: 1, s: "on", main: 1, a: S.rooms.gw || null };
    nodes.push(gw);
    const areaByMac = {}, areaOfDev = {};
    for (const d of this._reg.dev) { if (d.area_id) areaOfDev[d.id] = d.area_id; for (const [t, v] of d.connections || []) if (t === "mac" && d.area_id) areaByMac[macNorm(v)] = d.area_id; }
    const trackers = Object.values(st).filter((s) => s.entity_id.startsWith("device_tracker.") && !C.ignore.includes(s.entity_id) && (s.attributes.mac || s.attributes.ip || s.attributes.source_type === "router"));
    const mac = (a) => macNorm(a.mac || a.mac_address || ""), ctOf = (a) => (Array.isArray(a.connection_type) ? a.connection_type[0] : a.connection_type), clean = (x) => String(x || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
    const hubDef = (s) => C.hubs.find((h) => h.entity === s.entity_id || (h.mac && macNorm(h.mac) === mac(s.attributes)));
    // integration awareness: whatever the router integration exposes about "which access point is this client on" is used as-is.
    // Known keys: TP-Link Deco (deco_mac / deco_device), UniFi (ap_mac, essid), others that expose an AP mac or name. Integrations that
    // expose nothing (NETGEAR/Orbi, Omada, Fritz!Box, pfSense, ...) keep clients on the router; assign an AP per device in the card.
    const AP_MAC_KEYS = ["ap_mac", "deco_mac", "access_point_mac", "conn_ap_mac", "connected_ap_mac", "parent_mac", "uplink_mac"], AP_NAME_KEYS = ["deco_device", "ap_name", "access_point", "connected_ap", "parent", "ap"];
    const plat = {}; for (const e of this._reg.ent) plat[e.entity_id] = e.platform;
    const apRefs = (a) => ({ m: AP_MAC_KEYS.filter((k) => a[k]).map((k) => macNorm(a[k])), nm: AP_NAME_KEYS.filter((k) => typeof a[k] === "string" && a[k]).map((k) => clean(a[k]).toLowerCase()) });
    const aliasOf = (a) => Object.entries(a).filter(([k, v]) => !AP_MAC_KEYS.includes(k) && /bssid|mac/i.test(k) && typeof v === "string" && /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(v)).map(([, v]) => macNorm(v));
    const refd = new Set(); for (const t of trackers) for (const m of apRefs(t.attributes).m) refd.add(m);
    const isHub = (t) => { const a = t.attributes; return a.device_type === "deco" || a.device_type === "ap" || !!hubDef(t) || (mac(a) && refd.has(mac(a))) || aliasOf(a).some((m) => refd.has(m)); };
    const hubKey = {}; // mac / lowercase name -> hub id
    const mk = (s, extra) => {
      const a = s.attributes, id = mac(a) || s.entity_id; let fn = clean(a.friendly_name || a.host_name || s.entity_id);
      if (a.deco_device) fn = fn.replace(new RegExp("^" + clean(a.deco_device).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " Deco ", "i"), ""); // the Deco integration prefixes clients with their Deco
      const name = S.names[id] || fn;
      const on = s.state === "home" || s.state === "on", ls = Date.parse(s.last_changed) / 1000, ageH = (Date.now() / 1000 - ls) / 3600;
      const [k, sl0] = kindOf(`${fn} ${a.host_name || ""}`);
      const sl = S.sleep[id] != null ? !!S.sleep[id] : sl0;
      const nn = !S.names[id] && /^(android|desktop|esp|wlan|device|host|unknown|lt|phone|galaxy|iphone|ipad)?[-_ ]?[\w-]*\d{2,}[\w-]*$/i.test(String(a.friendly_name || a.host_name || "")) && !/ /.test(String(name));
      return { i: id, n: String(name), k, ip: a.ip || a.ip_address || null, v: a.vendor || a.manufacturer || "", s: on ? "on" : ageH < 24 ? "day" : "off", ls, sl, nn, nw: !S.known[id], a: S.rooms[id] || areaByMac[id] || null, ...extra };
    };
    for (const s of trackers) { // pass 1: access points / mesh nodes
      const a = s.attributes, def = hubDef(s);
      if (!isHub(s)) continue;
      const n = mk(s, { hub: 1, k: "ap" });
      n.n = clean(n.n).replace(/_/g, " ").replace(/ Deco$/i, ""); if (def && def.name) n.n = def.name; if (S.names[n.i]) n.n = S.names[n.i];
      const ct = ctOf(a); n.b = ct === "wired" || a.is_wired === true || a.wired === true || (def && def.wired) ? "wired" : a.master === true || (def && def.main) ? "wired" : ct ? "mesh" : (def && def.wired === false ? "mesh" : "wired");
      n.p = "gw"; n.nn = false; n.nw = false; n.s = n.s; n.main = (def && def.main) || a.master === true || a.is_main || 0; n._up = macNorm(a.deco_mac || a.ap_mac || "");
      n.src = plat[s.entity_id] || ""; for (const m of aliasOf(a)) hubKey[m] = n.i;
      nodes.push(n); seen.add(n.i); hubKey[n.i] = n.i; hubKey[String(n.n).toLowerCase()] = n.i; hubKey[clean(a.friendly_name).toLowerCase()] = n.i; hubKey[clean(a.friendly_name).replace(/ Deco$/i, "").toLowerCase()] = n.i;
    }
    for (const m of refd) {
      if (hubKey[m] || !m) continue;
      const d = this._reg.dev.find((x) => (x.connections || []).some(([t, v]) => t === "mac" && macNorm(v) === m));
      const n = { i: m, n: S.names[m] || (d && (d.name_by_user || d.name)) || "Access point " + m.slice(-5), k: "ap", hub: 1, s: "on", b: "wired", p: "gw", a: S.rooms[m] || (d && d.area_id) || null, v: (d && d.model) || "", src: "registry" };
      nodes.push(n); hubKey[m] = m; hubKey[String(n.n).toLowerCase()] = m;
    }
    for (const n of nodes) if (n.hub && n._up && hubKey[n._up] && hubKey[n._up] !== n.i) { n.p = hubKey[n._up]; }
    for (const s of trackers) { // pass 2: clients
      const a = s.attributes, id = mac(a) || s.entity_id;
      if (seen.has(id) || S.hidden[id]) continue; seen.add(id);
      const ct = ctOf(a), refs = apRefs(a), ap = refs.m.map((m) => hubKey[m]).find(Boolean) || refs.nm.map((x) => hubKey[x]).find(Boolean);
      const hasWifi = !!(a.essid || a.ssid || a.radio || a.signal || a.rssi || a.signal_strength || refs.m.length || refs.nm.length);
      let b = ct === "wired" || a.is_wired === true || a.wired === true ? "wired" : typeof ct === "string" && /^band/.test(ct) ? ct : "wifi";
      if (S.conn[id]) b = S.conn[id] === "wired" ? "wired" : b === "wired" ? "wifi" : b;
      const n = mk(s, { b, p: (S.parent[id] && hubKey[S.parent[id]]) || (S.parent[id] === "gw" ? "gw" : ap) || "gw", src: plat[s.entity_id] || "", cu: !hasWifi && b !== "wired" });
      nodes.push(n);
    }
    // Zigbee / Z-Wave / Lutron / Thread from the device registry
    const entsOf = {}; for (const e of this._reg.ent) if (e.device_id) (entsOf[e.device_id] = entsOf[e.device_id] || []).push(e.entity_id);
    const radioOf = (d) => {
      const ids = (d.identifiers || []).map((x) => x[0] + ":" + x[1]), doms = new Set((d.identifiers || []).map((x) => x[0]));
      if (doms.has("zha") || ids.some((x) => /zigbee2mqtt/i.test(x)) || (d.manufacturer && /zigbee/i.test(d.model || ""))) return "zigbee";
      if (doms.has("zwave_js")) return "zwave"; if (doms.has("lutron_caseta") || doms.has("lutron")) return "lutron"; if (doms.has("thread") || doms.has("otbr")) return "thread"; return null;
    };
    const made = {};
    for (const d of this._reg.dev) {
      const r = radioOf(d); if (!r || !C.radios.includes(r) || d.entry_type === "service" || d.disabled_by) continue;
      const name = d.name_by_user || d.name || "device";
      if (/coordinator|zigbee2mqtt bridge|z-?wave.*(stick|controller)|zst\d/i.test(name + " " + (d.model || ""))) continue;
      const es = (entsOf[d.id] || []).map((e) => st[e]).filter(Boolean), avail = es.filter((x) => x.state !== "unavailable");
      let on = avail.length > 0; const ns = es.find((x) => /_node_status$/.test(x.entity_id)); if (r === "zwave" && ns) on = ["alive", "asleep", "awake"].includes(ns.state);
      const bat = es.find((x) => x.attributes.device_class === "battery" && x.attributes.unit_of_measurement === "%"), id = "r:" + d.id;
      const last = Math.max(0, ...avail.map((x) => Date.parse(x.last_reported || x.last_updated) / 1000 || 0)), nm = S.names[id] || name;
      (made[r] = made[r] || []).push({ i: id, n: nm, k: kindOf(nm)[0] === "other" ? "sensor" : kindOf(nm)[0], p: r, b: r, s: on ? "on" : (Date.now() / 1000 - last) < 86400 ? "day" : "off", ls: last, sl: S.sleep[id] != null ? !!S.sleep[id] : false, v: d.model || "", bt: bat && !isNaN(+bat.state) ? Math.round(+bat.state) : null, a: S.rooms[id] || d.area_id || null, nw: false, nn: false });
    }
    for (const [r, ls] of Object.entries(made)) { nodes.push({ i: r, n: RADIO_NAME[r], k: "radio", hub: 1, s: "on", b: "radio", p: "gw", a: null }, ...ls); }
    if (!S.baseline) { for (const n of nodes) S.known[n.i] = 1; S.baseline = true; this._save(); nodes.forEach((n) => (n.nw = false)); }
    return nodes;
  }

  /* rings view: wired-looking Sonos speakers get a SonosNet hub of their own (SonosNet = Sonos's own wireless mesh) */
  _ring(nodes) {
    const sn = (n) => !n.hub && n.k === "speaker" && n.b === "wired" && /sonos/i.test(n.n);
    if (!nodes.some(sn)) return nodes;
    return [...nodes.map((n) => (sn(n) ? { ...n, p: "sonosnet" } : n)), { i: "sonosnet", n: "SonosNet", k: "speaker", hub: 1, s: "on", b: "sonos", p: "gw" }];
  }
  _col(n) { return n.nw ? "#a78bfa" : n.s === "on" ? "var(--nm-ok)" : n.sl ? "var(--nm-faint)" : n.s === "day" ? "var(--nm-warn)" : "var(--nm-bad)"; }
  _ltype(n, by) { const b = n.k === "radio" ? n.i : n.b === "sonos" ? "sonos" : n.b || (by[n.p] || {}).b || ""; return b === "wired" ? (n.k === "speaker" && /sonos/i.test(n.n) ? "sonos" : "eth") : ["zigbee", "zwave", "lutron", "thread", "sonos"].includes(b) ? b : "wifi"; }

  /* ---------- render ---------- */
  _draw() {
    if (!this._cfg || !this._hass) return;
    const narrow = this.clientWidth && this.clientWidth < 600;
    let nodes = this._nodes;
    const planRooms = this._roomsOn(this._floor);
    const house = this._view === "house";
    if (!house) nodes = this._ring(nodes);
    const real = nodes.filter((n) => !n.hub).length;
    const online = nodes.filter((n) => !n.hub && n.s === "on").length, bad = nodes.filter((n) => !n.hub && n.s !== "on" && !n.sl).length;
    const by = Object.fromEntries(nodes.map((n) => [n.i, n]));
    let body = !real && nodes.length <= 1 ? `<div class="empty">No devices found yet. This card reads <b>device_tracker</b> entities (your router integration) and your Zigbee / Z-Wave devices.</div>` : this._map(nodes, by, house, narrow);
    const h = Number(this._cfg.height) || 720;
    const html = `<ha-card style="--nm-h:${h}px"><div class="top"><b>${esc(this._cfg.title || "Network")} <span style="color:var(--nm-ok)">${online} online</span></b><span>${bad ? `<span style="color:var(--nm-bad)">${bad} need a look</span> · ` : ""}${nodes.filter((n) => !n.hub && n.nn).length ? `<span style="color:var(--nm-cool)">${nodes.filter((n) => !n.hub && n.nn).length} need a name</span> · ` : ""}updated ${esc(ago(this._last))}</span></div>${body}</ha-card>`;
    if (html === this._html) return; this._html = html;
    this.shadowRoot.innerHTML = `<style>${CSS}</style>${html}`;
    this._wire();
  }
  _wire() {
    const r = this.shadowRoot;
    r.querySelectorAll("[data-act]").forEach((e) => e.addEventListener("click", (ev) => { ev.stopPropagation(); this._act(e, ev); }));
    r.querySelectorAll("svg.house [data-nm],.side [data-nm]").forEach((e) => e.addEventListener("pointerdown", (ev) => this._drag(ev, e)));
    r.querySelectorAll("select[data-act=areapick]").forEach((e) => e.addEventListener("change", () => { this._pickArea = e.value || null; this._html = ""; this._draw(); }));
    const svg = r.querySelector("svg.house.draw"); if (svg) svg.addEventListener("pointerdown", (ev) => this._drawRoom(ev, svg));
  }
  _vb() { return this._vbox || [-60, -40, 1120, 1080]; }
  _link(x1, y1, x2, y2, n, by, hub) {
    const lt = this._ltype(n, by);
    if (!this._links.has(lt) && !(this._focus && (this._focus === n.p || this._focus === n.i))) return "";
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="nml t-${lt}${n.s === "on" && lt === "wifi" ? " live" : ""}${hub ? " hub" : ""}" stroke="${n.s === "on" ? (hub ? LINK_COL[lt] : `color-mix(in srgb,${LINK_COL[lt]} 70%,transparent)`) : "var(--nm-line)"}"/>`;
  }
  _dot(n, x, y, r, extra = "") {
    const c = this._col(n);
    return `<g data-act="nm" data-nm="${esc(n.i)}"${extra}><circle cx="${x}" cy="${y}" r="${r}" fill="var(--nm-panel2)" stroke="${c}" stroke-width="${n.hub ? 3 : 2}"/><svg x="${x - r * .55}" y="${y - r * .55}" width="${r * 1.1}" height="${r * 1.1}" viewBox="0 0 24 24" fill="none" stroke="${n.hub ? "var(--nm-fg)" : c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[KI[n.k]] || ICONS.more}</svg>${n.nn ? `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="var(--nm-cool)" stroke-width="1.5" stroke-dasharray="3 3"/>` : ""}${n.nw ? `<circle cx="${x + r * .75}" cy="${y - r * .75}" r="${r * .28}" fill="#a78bfa"/>` : ""}${this._sel === n.i ? `<circle cx="${x}" cy="${y}" r="${r + 6}" fill="none" stroke="var(--nm-fg)" stroke-width="2"/>` : ""}</g>`;
  }
  _label(n, x, y, ang, fs) {
    const deg = ang * 180 / Math.PI, left = Math.cos(ang) < 0, rot = left ? deg + 180 : deg;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" text-anchor="${left ? "end" : "start"}" dominant-baseline="middle" font-size="${fs}" fill="${n.nn ? "var(--nm-cool)" : n.s === "on" ? "var(--nm-fg)" : this._col(n)}" data-act="nm" data-nm="${esc(n.i)}">${esc(n.n.length > 24 ? n.n.slice(0, 23) + "…" : n.n)}</text>`;
  }
  _map(nodes, by, house, narrow) {
    const kids = (id) => nodes.filter((n) => n.p === id && !n.hub).sort((a, b) => (a.k + a.n).localeCompare(b.k + b.n));
    const hubs = nodes.filter((n) => n.hub && n.k !== "gateway").sort((a, b) => (b.k === "radio") - (a.k === "radio") || (b.main || 0) - (a.main || 0) || a.n.localeCompare(b.n));
    const focus = this._focus && by[this._focus] ? this._focus : null, SY = narrow && !this._focus && !house ? 1.7 : 1, C = 500, ln = (x1, y1, x2, y2, n, hub) => this._link(x1, y1, x2, y2, n, by, hub);
    let lines = "", dots = "", texts = "", vb = null, side = "", edit = "";
    if (house) ({ lines, dots, texts, vb, side, edit } = this._house(nodes, by));
    else if (focus) {
      const h = by[focus], ks = kids(focus), R = 300, fs = narrow ? 30 : 22, r = narrow ? 22 : 17;
      ks.forEach((n, i) => { const ang = -Math.PI / 2 + (i / Math.max(1, ks.length)) * Math.PI * 2, x = C + Math.cos(ang) * R, y = C + Math.sin(ang) * R; lines += ln(C, C, x, y, n); dots += this._dot(n, x, y, r); texts += this._label(n, C + Math.cos(ang) * (R + r + 8), C + Math.sin(ang) * (R + r + 8), ang, fs); });
      dots += this._dot(h, C, C, 40);
      texts += `<text x="${C}" y="${C + 66}" text-anchor="middle" font-size="26" font-weight="600" fill="var(--nm-fg)">${esc(h.n)}</text><text x="${C}" y="${C + 94}" text-anchor="middle" font-size="20" fill="var(--nm-muted)">${ks.filter((n) => n.s === "on").length} of ${ks.length} online · tap the middle to go back</text>`;
      vb = [-40, -10, 1080, 1020];
    } else {
      const groups = [{ h: by.gw, ks: kids("gw") }, ...hubs.map((h) => ({ h, ks: kids(h.i) }))].filter((g) => g.h);
      const tot = groups.reduce((s, g) => s + g.ks.length + 2, 0), R1 = 190, R2 = 360, pos = { gw: [C, C] };
      let a0 = -Math.PI / 2 - Math.PI * 2 * ((groups[0].ks.length + 2) / tot) / 2;
      for (const g of groups) {
        const span = Math.PI * 2 * (g.ks.length + 2) / tot, mid = a0 + span / 2;
        if (g.h.i !== "gw") pos[g.h.i] = [C + Math.cos(mid) * R1, C + Math.sin(mid) * R1 * SY];
        const [hx, hy] = pos[g.h.i];
        g.ks.forEach((n, i) => {
          const ang = a0 + span * (i + 1.5) / (g.ks.length + 2), rr = R2 + (g.ks.length > 14 && i % 2 ? 26 : 0), x = C + Math.cos(ang) * rr, y = C + Math.sin(ang) * rr * SY;
          lines += ln(hx, hy, x, y, n); dots += this._dot(n, x, y, narrow ? 17 : 11);
          if (!narrow) texts += this._label(n, C + Math.cos(ang) * (rr + 17), C + Math.sin(ang) * (rr + 17), ang, 12.5);
        });
        a0 += span;
      }
      for (const h of hubs) { const par = pos[h.p] || pos.gw, [x, y] = pos[h.i]; lines += ln(par[0], par[1], x, y, h, true); }
      for (const h of hubs) {
        const [x, y] = pos[h.i], ks = kids(h.i);
        dots += this._dot(h, x, y, 24);
        texts += `<text x="${x}" y="${y + 40}" text-anchor="middle" font-size="${narrow ? 24 : 15}" class="hubt" data-act="nm" data-nm="${esc(h.i)}">${esc(h.n.replace(/ Deco$/, ""))}</text><text x="${x}" y="${y + (narrow ? 64 : 56)}" text-anchor="middle" font-size="${narrow ? 20 : 12}" class="hubs">${ks.filter((n) => n.s === "on").length}/${ks.length}${h.main ? " · main" : h.b === "mesh" ? " · wireless" : h.k === "radio" ? " · radio" : h.i === "sonosnet" ? " · wireless mesh" : ""}</text>`;
      }
      dots += this._dot(by.gw, C, C, 30); texts += `<text x="${C}" y="${C + 48}" text-anchor="middle" font-size="${narrow ? 24 : 15}" class="hubt">${esc(by.gw.n)}</text>`;
      vb = SY > 1 ? [-40, C - 430 * SY, 1080, 860 * SY] : [-60, -40, 1120, 1080];
    }
    this._vbox = vb;
    const sel = this._sel && by[this._sel], h = Number(this._cfg.height) || 720;
    const showSlides = this._cfg.slideshow === true || (this._cfg.slideshow !== false && !narrow);
    const types = ["eth", "wifi", "zigbee", "zwave", "sonos", "lutron", "thread"].filter((t) => ["eth", "wifi", "sonos"].includes(t) || nodes.some((n) => !n.hub && this._ltype(n, by) === t));
    const key = `<span><i class="dot" style="background:var(--nm-ok)"></i>online</span><span><i class="dot" style="background:var(--nm-warn)"></i>gone &lt;24 h</span><span><i class="dot" style="background:var(--nm-bad)"></i>gone 24 h+</span><span><i class="dot" style="background:var(--nm-faint)"></i>asleep</span><span><i class="dot" style="background:#a78bfa"></i>new</span><span><i class="dot" style="background:var(--nm-cool)"></i>needs a name</span>
      <span class="seg">${types.map((t) => `<button class="b${this._links.has(t) ? " on" : ""}" data-act="lt" data-v="${t}"><i class="dot" style="background:${LINK_COL[t]}"></i>${LINK_NAME[t]}</button>`).join("")}</span>
      ${`<span class="seg"><button class="b${house ? "" : " on"}" data-act="view" data-v="ring">Rings</button><button class="b${house ? " on" : ""}" data-act="view" data-v="house">House</button></span>`}
      ${showSlides ? `${this._showT && this._cap ? `<b style="color:var(--nm-fg)">${esc(this._cap)}</b>` : ""}<button class="b${this._showT ? " on" : ""}" data-act="show">${this._showT ? "■ Stop show" : "▶ Slideshow"}</button>` : ""}`;
    return `<div class="wrap">${edit}<div class="body${narrow ? " col" : ""}"><svg class="map${house ? " house" : ""}${house && this._edit && this._pickArea ? " draw" : ""}" style="height:${narrow ? "auto" : h + "px"}" viewBox="${vb.join(" ")}" preserveAspectRatio="xMidYMid meet" data-act="nm" data-nm="">${lines}${dots}${texts}</svg>${side}</div><div class="key">${key}</div>${sel ? this._card(sel, by, house) : ""}</div>`;
  }
  _card(sel, by, house) {
    const par = by[sel.p], seen = sel.s === "on" ? "Online now" : sel.ls ? `Last seen ${ago(sel.ls * 1000)}` : "Not seen since tracking started";
    const areas = this._areaList(), cur = areas.find((a) => a.id === sel.a);
    return `<div class="card"><div class="h"><b>${esc(sel.n)}</b><button class="x" data-act="nm" data-nm="">✕</button></div>
      <div class="r"><i class="dot" style="background:${this._col(sel)}"></i>${esc(seen)}</div>
      <div class="grid">${sel.ip ? `<small>IP</small><span>${esc(sel.ip)}</span>` : ""}<small>On</small><span>${esc(par ? par.n : "—")}${BAND[sel.b] ? " · " + BAND[sel.b] : ""}</span>${sel.bt != null ? `<small>Battery</small><span style="color:${sel.bt <= 15 ? "var(--nm-bad)" : sel.bt <= 30 ? "var(--nm-warn)" : "inherit"}">${sel.bt}%</span>` : ""}<small>Type</small><span>${esc(sel.k)}${sel.v ? " · " + esc(sel.v) : ""}</span>${sel.src ? `<small>Source</small><span>${esc(sel.src)}</span>` : ""}${sel.hub || String(sel.i).startsWith("r:") ? "" : `<small>MAC</small><span class="mono">${esc(sel.i)}</span>`}${sel.hub ? "" : `<small>Room</small><span>${esc(cur ? cur.name : "not set")}</span>`}</div>
      ${sel.hub ? `<button class="b big" data-act="zoom" data-nm="${esc(sel.i)}">Show its devices</button>` : `<div class="btns">
        <button class="b${sel.sl ? "" : " on"}" data-act="sleep" data-m="${esc(sel.i)}">${sel.sl ? "Alert me if it drops" : "Alerts on · tap to let it sleep"}</button>
        <button class="b${sel.nn ? " on" : ""}" data-act="rename" data-m="${esc(sel.i)}">${sel.nn ? "Give it a name" : "Rename"}</button>
        ${sel.nw ? `<button class="b" data-act="known" data-m="${esc(sel.i)}">I know this one</button>` : ""}
        <button class="b${sel.a ? "" : " on"}" data-act="pick" data-m="${esc(sel.i)}">${sel.a ? "Move to a room" : "Set its room"}</button>
        ${house && this._S.pos[sel.i] ? `<button class="b" data-act="unpos" data-m="${esc(sel.i)}">Auto spot</button>` : ""}
        ${String(sel.i).startsWith("r:") ? "" : `<button class="b" data-act="conn" data-m="${esc(sel.i)}">${sel.b === "wired" ? "Set to Wi-Fi" : "Set to Ethernet"}</button>${Object.values(by).some((h) => h.hub && h.k === "ap") ? `<button class="b" data-act="pickap" data-m="${esc(sel.i)}">Move to an access point</button>` : ""}`}
        <button class="b" data-act="hide" data-m="${esc(sel.i)}">Hide</button></div>`}
      ${this._pickAp === sel.i ? `<div class="rooms"><div>${Object.values(by).filter((h) => h.hub && (h.k === "ap" || h.k === "gateway")).map((h) => `<button class="b${sel.p === h.i ? " on" : ""}" data-act="setap" data-m="${esc(sel.i)}" data-v="${esc(h.i)}">${esc(h.n)}</button>`).join("")}</div></div>` : ""}
      ${this._pick === sel.i ? `<div class="rooms"><div>${areas.map((a) => `<button class="b${sel.a === a.id ? " on" : ""}" data-act="room" data-m="${esc(sel.i)}" data-v="${esc(a.id)}">${esc(a.name)}</button>`).join("")}<button class="b" data-act="room" data-m="${esc(sel.i)}" data-v="">Not set</button></div></div>` : ""}</div>`;
  }
  _areaList() {
    const out = new Map(); for (const a of this._reg.area) out.set(a.area_id, a.name);
    for (const [id, r] of Object.entries(this._S.plan.rooms)) if (!out.has(id)) out.set(id, r.name);
    return [...out].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /* ---------- house view (your own floor plan) ---------- */
  _floors() { return this._S.plan.floors && this._S.plan.floors.length ? this._S.plan.floors : this._cfg.floors; }
  _floorCfg(i) { const f = this._floors(); return f[i] || f[0]; }
  _roomsOn(f) { return Object.entries(this._S.plan.rooms).filter(([, r]) => (r.floor || 0) === f); }
  _dims(f) {
    const fl = this._floorCfg(f);
    if (fl.width && fl.height) return [fl.width, fl.height];
    if (fl.image) { const d = this._img[fl.image]; if (d) return d; if (d === undefined) { this._img[fl.image] = null; const im = new Image(); im.onload = () => { this._img[fl.image] = [im.naturalWidth, im.naturalHeight]; this._html = ""; this._draw(); }; im.src = fl.image; } }
    return [1200, 800];
  }
  _house(nodes, by) {
    const f = this._floor, [W, H] = this._dims(f), fl = this._floorCfg(f), rooms = this._roomsOn(f), S = this._S;
    const tabs = this._floors().length > 1 ? `<span class="seg">${this._floors().map((x, i) => `<button class="b${i === f ? " on" : ""}" data-act="floor" data-v="${i}">${esc(x.name || "Floor " + (i + 1))}</button>`).join("")}</span>` : "";
    const edit = `<div class="edit">${tabs}<button class="b${this._edit ? " on" : ""}" data-act="edit">${this._edit ? "Done editing rooms" : "Edit rooms"}</button>${this._edit ? `<button class="b" data-act="img">${fl.image ? "Change floor plan image" : "Add a floor plan image"}</button>${fl.image ? `<button class="b" data-act="noimg">Remove image</button>` : ""}<button class="b" data-act="addfloor">Add a floor</button>${this._areaPicker(f)}<span>${this._pickArea ? "Drag a box on the map for this room (repeat for L-shaped rooms)." : "Pick a room, then drag a box on the map."}</span>${rooms.map(([id, r]) => `<button class="b" data-act="delroom" data-v="${esc(id)}" title="Remove this room from the plan">${esc(r.name)} ✕</button>`).join("")}` : !rooms.length ? `<span>${fl.image ? "No rooms on this floor yet." : "No floor plan yet."} Click “Edit rooms”, add a picture of your home (a photo, sketch or screenshot), then pick a room and drag a box over it.</span>` : ""}</div>`;
    const inRoom = (x, y) => { const h = rooms.find(([, r]) => r.rects.some(([rx, ry, w, hh]) => x >= rx && x <= rx + w && y >= ry && y <= ry + hh)); return h ? h[0] : null; };
    this._roomAt = inRoom; this._pdims = [W, H];
    const placed = {}, tray = [];
    const toPlace = nodes.filter((n) => !(n.hub && n.k === "radio"));
    for (const n of toPlace) {
      const p = S.pos[n.i];
      if (p && (p[2] || 0) === f) placed[n.i] = [p[0], p[1]];
      else if (p) continue; // pinned on another floor
      else if (n.a && rooms.some(([id]) => id === n.a)) continue; // auto spot below
      else if (n.a && this._roomsOnAny(n.a)) continue; // its room is on another floor
      else tray.push(n);
    }
    for (const [id, r] of rooms) {
      const ns = toPlace.filter((n) => !placed[n.i] && n.a === id && !(S.pos[n.i] && (S.pos[n.i][2] || 0) !== f)).sort((a, b) => (b.hub ? 1 : 0) - (a.hub ? 1 : 0) || (a.k + a.n).localeCompare(b.k + b.n));
      if (!ns.length) continue;
      let cells = [];
      for (const sp of [64, 52, 42, 34, 28, 22, 18, 15]) {
        cells = [];
        { const m = this._nar ? 1.7 : 1; for (const [x, y, w, h] of r.rects) for (let cy = y + 44 * m; cy <= y + h - 20 * m; cy += sp * m) for (let cx = x + 24 * m; cx <= x + w - 20 * m; cx += sp * m) cells.push([cx, cy]); }
        if (cells.length >= ns.length) break;
      }
      ns.forEach((n, i) => { placed[n.i] = cells.length ? cells[Math.min(cells.length - 1, Math.floor(i * cells.length / ns.length))] : [r.rects[0][0] + 20, r.rects[0][1] + 30]; });
    }
    const sc = (Math.max(W, H) / 1000) * (this._nar ? 1.7 : 1); // bigger dots + labels on a phone
    let bg = fl.image ? `<image href="${esc(fl.image)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>` : `<rect x="0" y="0" width="${W}" height="${H}" fill="color-mix(in srgb,var(--nm-fg) 4%,transparent)" stroke="var(--nm-line)"/>`;
    for (const [id, r] of rooms) { for (const [x, y, w, h] of r.rects) bg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="room" stroke-width="${2 * sc}"/>`; const [x, y] = r.rects[0]; bg += `<text x="${x + 8 * sc}" y="${y + 18 * sc}" class="roomt" font-size="${13 * sc}">${esc(r.name)}</text>`; }
    let lines = "", dots = "";
    for (const n of toPlace) {
      if (!placed[n.i] || n.hub || !by[n.p]) continue;
      const par = by[n.p], to = par.k === "radio" ? by[par.p] : par; if (!to || !placed[to.i]) continue;
      lines += this._link(...placed[to.i], ...placed[n.i], n, by);
    }
    for (const n of toPlace) if (placed[n.i]) dots += this._dot(n, placed[n.i][0], placed[n.i][1], (n.hub ? 18 : 11) * sc);
    const trayHtml = tray.filter((n) => !n.hub || n.k !== "radio").sort((a, b) => a.n.localeCompare(b.n)).map((n) => `<div class="row" data-nm="${esc(n.i)}" data-act="nm" style="color:${this._col(n)}">${icon(n.k)}<span>${esc(n.n)}</span></div>`).join("");
    const side = `<div class="side"><h4>Not placed · ${tray.length}</h4>${trayHtml || `<div style="color:var(--nm-muted)">Everything has a spot.</div>`}<h4 style="margin-top:12px">Drag a dot to move it</h4></div>`;
    return { lines: bg + lines, dots, texts: "", vb: [0, 0, W, H], side, edit };
  }
  _setFloor(i, patch) { const fl = this._floors().map((x) => ({ ...x })); fl[i] = { ...fl[i], ...patch }; if (patch.image === "") { delete fl[i].image; delete fl[i].width; delete fl[i].height; } this._S.plan.floors = fl; this._save(); }
  _pickImage() { // a picture from the user's device, shrunk and stored with their other settings (no file hosting needed)
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1500 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
        const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url); this._setFloor(this._floor, { image: c.toDataURL("image/jpeg", 0.82), width: w, height: h }); this._html = ""; this._draw();
      };
      im.onerror = () => alert("Couldn't read that image."); im.src = url;
    };
    inp.click();
  }
  _roomsOnAny(a) { return !!this._S.plan.rooms[a]; }
  _areaPicker(f) {
    const have = new Set(this._roomsOn(f).map(([id]) => id)), opts = this._areaList().map((a) => `<option value="${esc(a.id)}"${this._pickArea === a.id ? " selected" : ""}>${esc(a.name)}${have.has(a.id) ? " ✓" : ""}</option>`).join("");
    return `<select data-act="areapick"><option value="">Room…</option>${opts}</select>`;
  }

  /* ---------- actions ---------- */
  _act(e, ev) {
    const d = e.dataset, a = d.act, id = d.m || d.nm;
    if (this._suppress && a === "nm") return;
    if (a !== "show") this._showStop(true);
    if (a === "nm") { if (d.nm === "") this._sel = null; else { const n = this._ring(this._nodes).find((x) => x.i === d.nm); if (n && n.hub && this._view !== "house") { this._focus = this._focus === d.nm ? null : d.nm; this._sel = null; } else this._sel = this._sel === d.nm ? null : d.nm; } this._pick = null; }
    else if (a === "zoom") { this._focus = d.nm; this._sel = null; }
    else if (a === "lt") { this._links.has(d.v) ? this._links.delete(d.v) : this._links.add(d.v); }
    else if (a === "view") { this._view = d.v; this._focus = null; this._edit = false; }
    else if (a === "floor") this._floor = +d.v;
    else if (a === "edit") { this._edit = !this._edit; this._pickArea = null; }
    else if (a === "delroom") { delete this._S.plan.rooms[d.v]; this._save(); }
    else if (a === "areapick") return;
    else if (a === "img") { this._pickImage(); return; }
    else if (a === "noimg") { this._setFloor(this._floor, { image: "" }); }
    else if (a === "addfloor") { const nm = prompt("Name for the new floor", "Upstairs"); if (nm && nm.trim()) { const fl = this._floors().map((x) => ({ ...x })); fl.push({ name: nm.trim().slice(0, 24) }); this._S.plan.floors = fl; this._floor = fl.length - 1; this._save(); } }
    else if (a === "show") { this._showT ? this._showStop() : this._showStart(); return; }
    else if (a === "sleep") { const n = this._nodes.find((x) => x.i === id); this._S.sleep[id] = n && n.sl ? 0 : 1; this._save(); this._rebuild(); }
    else if (a === "rename") { const n = this._nodes.find((x) => x.i === id), v = prompt("Name for this device", n ? n.n : ""); if (v && v.trim()) { this._S.names[id] = v.trim().slice(0, 40); this._save(); this._rebuild(); } }
    else if (a === "known") { this._S.known[id] = 1; this._save(); this._rebuild(); }
    else if (a === "hide") { if (confirm("Hide this device from the map?")) { this._S.hidden[id] = 1; this._sel = null; this._save(); this._rebuild(); } }
    else if (a === "pick") { this._pick = this._pick === id ? null : id; this._pickAp = null; }
    else if (a === "pickap") { this._pickAp = this._pickAp === id ? null : id; this._pick = null; }
    else if (a === "setap") { this._S.parent[id] = d.v; this._pickAp = null; this._save(); this._rebuild(); }
    else if (a === "conn") { const n = this._nodes.find((x) => x.i === id); this._S.conn[id] = n && n.b === "wired" ? "wifi" : "wired"; this._save(); this._rebuild(); }
    else if (a === "room") { this._setRoom(id, d.v || null); this._pick = null; }
    else if (a === "unpos") { delete this._S.pos[id]; this._save(); }
    this._html = ""; this._draw();
  }
  _setRoom(id, area) {
    this._S.rooms[id] = area; if (!area) delete this._S.rooms[id]; delete this._S.pos[id]; this._save(); this._syncArea(id, area); this._rebuild();
  }
  async _syncArea(id, area) {
    if (!this._cfg.sync_areas || !this._hass.user || !this._hass.user.is_admin || !area) return;
    try {
      const devs = String(id).startsWith("r:") ? this._reg.dev.filter((d) => d.id === id.slice(2)) : this._reg.dev.filter((d) => (d.connections || []).some(([t, v]) => t === "mac" && macNorm(v) === id));
      for (const d of devs) await this._hass.callWS({ type: "config/device_registry/update", device_id: d.id, area_id: area });
    } catch (e) { console.warn("network-map-card: area sync failed", e); }
  }
  _drag(e, g) {
    if (e.button || !g.dataset.nm) return;
    const svg = this.shadowRoot.querySelector("svg.house"); if (!svg) return;
    const id = g.dataset.nm, x0 = e.clientX, y0 = e.clientY, pt = (ev) => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
    let ghost = null, tag = null;
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      const p = pt(ev), NS = "http://www.w3.org/2000/svg", sc = Math.max(...this._pdims) / 1000;
      if (!ghost) { ghost = document.createElementNS(NS, "circle"); ghost.setAttribute("r", 14 * sc); ghost.setAttribute("class", "ghost"); tag = document.createElementNS(NS, "text"); tag.setAttribute("class", "hubt"); tag.setAttribute("font-size", 15 * sc); svg.append(ghost, tag); this._hold = true; }
      ghost.setAttribute("cx", p.x); ghost.setAttribute("cy", p.y); tag.setAttribute("x", p.x + 20 * sc); tag.setAttribute("y", p.y + 5 * sc);
      const a = this._roomAt(p.x, p.y); tag.textContent = a ? this._S.plan.rooms[a].name : "";
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (!ghost) return; ghost.remove(); tag.remove(); this._hold = false;
      this._suppress = true; setTimeout(() => (this._suppress = false), 80);
      if (ev.type === "pointerup") { const p = pt(ev), a = this._roomAt(p.x, p.y); if (a) { this._S.pos[id] = [Math.round(p.x), Math.round(p.y), this._floor]; this._S.rooms[id] = a; this._save(); this._syncArea(id, a); this._rebuild(); } }
      this._html = ""; this._draw();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  _drawRoom(e, svg) {
    if (!this._pickArea || e.button) return;
    const pt = (ev) => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }, a = pt(e), NS = "http://www.w3.org/2000/svg";
    const r = document.createElementNS(NS, "rect"); r.setAttribute("class", "ghost"); svg.append(r); this._hold = true; e.preventDefault();
    const rect = (b) => [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y)];
    const move = (ev) => { const [x, y, w, h] = rect(pt(ev)); r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", w); r.setAttribute("height", h); };
    const up = (ev) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); r.remove(); this._hold = false;
      const [x, y, w, h] = rect(pt(ev)).map(Math.round);
      if (w > 20 && h > 20) { const id = this._pickArea, cur = this._S.plan.rooms[id], nm = (this._areaList().find((q) => q.id === id) || {}).name || id; this._S.plan.rooms[id] = cur && (cur.floor || 0) === this._floor ? { ...cur, rects: [...cur.rects, [x, y, w, h]] } : { name: nm, floor: this._floor, rects: [[x, y, w, h]] }; this._save(); }
      this._html = ""; this._draw();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  /* ---------- slideshow: rings (each link type, everything, each hub zoomed), then the house ---------- */
  _steps() {
    const nodes = this._ring(this._nodes), by = Object.fromEntries(nodes.map((n) => [n.i, n]));
    const all = Object.keys(LINK_NAME), have = all.filter((t) => nodes.some((n) => !n.hub && this._ltype(n, by) === t));
    const hubs = nodes.filter((n) => n.hub && n.k !== "gateway").sort((a, b) => (b.main || 0) - (a.main || 0) || a.n.localeCompare(b.n));
    const run = (v, hs, where, fl) => [...have.map((t) => ({ v, fl, f: null, t: [t], c: `${where} · ${LINK_NAME[t]} only` })), { v, fl, f: null, t: all, c: `${where} · everything` }, ...hs.map((h) => ({ v, fl, f: h.i, t: all, c: `${where} · ${h.n}` }))];
    const st = run("ring", hubs, "Rings", 0);
    if (Object.keys(this._S.plan.rooms).length) this._floors().forEach((fl, i) => st.push(...run("house", [], this._floors().length > 1 ? `House · ${fl.name || "floor " + (i + 1)}` : "House", i)));
    return st;
  }
  _showStep() {
    const st = this._steps(); if (!st.length) return this._showStop();
    const s = st[(this._si = ((this._si ?? -1) + 1) % st.length)];
    this._view = s.v; this._focus = s.f; this._floor = s.fl; this._sel = null; this._links = new Set(s.t); this._cap = s.c; this._edit = false; this._html = ""; this._draw();
  }
  _showStart() { this._si = -1; this._bak = new Set(this._links); this._showStep(); this._showT = setInterval(() => this._showStep(), 4000); this._html = ""; this._draw(); }
  _showStop(quiet) { if (!this._showT) return; clearInterval(this._showT); this._showT = null; this._cap = ""; this._focus = null; if (this._bak) this._links = this._bak; if (!quiet) { this._html = ""; this._draw(); } }
}
if (!customElements.get("network-map-card")) customElements.define("network-map-card", NetworkMapCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "network-map-card", name: "Network Map", description: "Live map of every device on your network: rings, zoom, link-type filters, slideshow and a floor-plan view you draw yourself.", preview: false });
console.info(`%c NETWORK-MAP-CARD %c v${VERSION} `, "background:#3b82f6;color:#fff", "background:#222;color:#fff");
