// Cloud runtime for the app's bot code. The bots were written for the browser (window.EB...);
// this module provides the same interfaces backed by the cloud database, so the cloud runs the
// exact same bot code as the phone. Must be imported before the bot scripts.
const g = globalThis;
g.window = g;

const U = {
  esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  now: () => new Date().toISOString(),
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  slug: s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  money: () => "", fmt: () => "", ago: () => "",
  clampStr: (s, n) => String(s ?? "").slice(0, n),
};

const mem = {};
const LS = { get: (k, d) => (k in mem ? mem[k] : d), set: (k, v) => { mem[k] = v; } };

export const S = { items: {}, earnings: {}, runs: {}, watches: {}, config: {}, ready: true, mode: "cloud", listeners: [] };
export const writes = new Map();
export const logs = [];
const clone = o => JSON.parse(JSON.stringify(o));

export const Store = {
  S,
  onChange() {},
  async save(col, id, obj) {
    if (obj && obj._lite) throw new Error(`Refusing to overwrite full ${col}/${id} with a trimmed copy`);
    obj = clone(obj); obj._u = Date.now(); S[col][id] = obj; writes.set(`${col}\u0000${id}`, [col, id, obj]);
  },
  async patch(col, id, fields) {
    const cur = S[col][id]; if (!cur) return;
    if (cur._lite) { // safe partial update of a trimmed item: only touch top-level fields and data fields given
      writes.set(`${col}\u0000${id}`, [col, id, { __patch: clone(fields) }]); S[col][id] = { ...cur, ...fields, _u: Date.now() }; return;
    }
    await Store.save(col, id, { ...cur, ...fields });
  },
  async remove(col, id) { delete S[col][id]; writes.set(`${col}\u0000${id}`, [col, id, null]); },
  config() { return S.config.main || {}; },
  async setConfig(fields) { await Store.save("config", "main", { ...(S.config.main || {}), ...fields }); },
  botConfig(id) { return ((S.config.main || {}).bots || {})[id] || {}; },
  async setBotConfig(id, fields) { const bots = { ...((S.config.main || {}).bots || {}) }; bots[id] = { ...(bots[id] || {}), ...fields }; await Store.setConfig({ bots }); },
};

export const Claude = {
  key: "", model: "claude-sonnet-5-5",
  available() { return !!this.key; },
  why() { return "Send your Anthropic API key to the cloud (app Settings > Cloud > Send my keys)."; },
  async json(prompt) {
    try { return await this._json(prompt); }
    catch (e) { if (/API key|rate|credit/i.test(e.message)) throw e; await U.sleep(1500); return await this._json(prompt); }
  },
  async _json(prompt) {
    if (!this.key) throw new Error(this.why());
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: this.model, max_tokens: 8000, messages: [{ role: "user", content: prompt + "\n\nReply with valid JSON only, no other text." }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Claude API error ${res.status}`);
    const text = (data.content || []).map(c => c.text || "").join("");
    const a = text.search(/[[{]/), b = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
    return JSON.parse(text.slice(a, b + 1));
  },
};

const Web = {
  available: () => true, why: () => "",
  async get(url, headers = {}) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; EarningBotsCloud/1.0)", Accept: "*/*", ...headers } });
    if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
    return res;
  },
  async json(url, headers) { return (await Web.get(url, headers)).json(); },
  async text(url, headers) { return (await Web.get(url, headers)).text(); },
  async post(url, body, headers = {}) { const res = await fetch(url, { method: "POST", body, headers }); if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`); return res; },
};

export const Log = { entries: logs, add(level, msg) { logs.push({ t: Date.now(), level, msg: String(msg).slice(0, 500) }); } };

g.EB = { U, LS, Store, Claude, Web, Log, Files: { save: async () => false, canvasBlob: async () => null, copy() {}, open() {} }, IS_NATIVE: false, IN_CLAUDE: false, IN_CLOUD: true, startStorage() {} };
g.EB_APP = { toast() {}, copyBox() {} };
