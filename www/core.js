/* Earning Bots core: storage, Claude access, web access, files and small helpers.
   One codebase, two homes:
   - inside Claude (artifact): artifact database, Claude via `sample`, files via `downloads`, no outside web
   - Android app (Capacitor): data on the phone, Claude via your API key, full web access, files via share sheet */
(function () {
  "use strict";

  const U = {
    esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    now: () => new Date().toISOString(),
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    slug: s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    money: obj => {
      const parts = Object.entries(obj || {}).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
      return parts.length ? parts.map(([cur, c]) => fmtMoney(c, cur)).join(" + ") : fmtMoney(0, "EUR");
    },
    fmt: (cents, cur) => fmtMoney(cents, cur),
    ago: iso => {
      const s = (Date.now() - Date.parse(iso)) / 1000;
      if (s < 60) return "just now";
      if (s < 3600) return `${Math.floor(s / 60)} min ago`;
      if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
      if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
      return new Date(iso).toLocaleDateString();
    },
    clampStr: (s, n) => String(s ?? "").slice(0, n),
  };
  function fmtMoney(cents, cur) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR" }).format((cents || 0) / 100); }
    catch { return `${((cents || 0) / 100).toFixed(2)} ${cur}`; }
  }

  const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const IN_CLAUDE = !!(window.claude && window.claude.use);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  // ---- storage -------------------------------------------------------------------
  const COLS = ["items", "earnings", "runs", "watches", "config"];
  const S = { items: {}, earnings: {}, runs: {}, watches: {}, config: {}, ready: false, mode: "local", listeners: [] };
  let db = null, sample = null, downloads = null;
  // batch change notifications: many saves in a row cause one re-render, not one per save
  let pendingChange = false;
  const changed = () => { if (pendingChange) return; pendingChange = true; setTimeout(() => { pendingChange = false; S.listeners.forEach(fn => { try { fn(); } catch (e) { Log.add("error", "render: " + e.message); } }); }, 0); };

  // ---- on-device database (IndexedDB: no 5 MB limit, one record written per change) ----------------
  const IDB = {
    db: null,
    open() {
      return new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error("IndexedDB unavailable"));
        const r = indexedDB.open("earning-bots", 1);
        r.onupgradeneeded = () => { for (const c of [...COLS, "log"]) if (!r.result.objectStoreNames.contains(c)) r.result.createObjectStore(c); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("Database blocked by another tab"));
      });
    },
    all(col) {
      return new Promise((res, rej) => {
        const out = {}, rq = IDB.db.transaction(col).objectStore(col).openCursor();
        rq.onsuccess = () => { const c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
        rq.onerror = () => rej(rq.error);
      });
    },
    tx(col, fn) {
      return new Promise((res, rej) => { const t = IDB.db.transaction(col, "readwrite"); fn(t.objectStore(col)); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("aborted")); });
    },
    put: (col, id, v) => IDB.tx(col, st => st.put(v, id)),
    del: (col, id) => IDB.tx(col, st => st.delete(id)),
  };
  const clean = obj => JSON.parse(JSON.stringify(obj)); // drops undefined and functions, same as the cloud store

  // ---- activity and error log -----------------------------------------------------------------------
  const Log = {
    entries: [],
    add(level, msg) {
      const e = { t: new Date().toISOString(), level, msg: String(msg).slice(0, 500) };
      Log.entries.push(e); if (Log.entries.length > 300) Log.entries.splice(0, Log.entries.length - 300);
      if (IDB.db) IDB.put("log", e.t + Math.random().toString(36).slice(2, 5), e).catch(() => {});
      if (level === "error") console.error("[EB]", msg);
    },
    async load() {
      if (!IDB.db) return;
      try { const all = await IDB.all("log"), keys = Object.keys(all).sort(); Log.entries = keys.slice(-300).map(k => all[k]).concat(Log.entries);
        for (const k of keys.slice(0, Math.max(0, keys.length - 300))) IDB.del("log", k).catch(() => {}); } catch { /* ignore */ }
    },
  };
  window.addEventListener("error", e => Log.add("error", `${e.message} @ ${(e.filename || "").split("/").pop()}:${e.lineno}`));
  window.addEventListener("unhandledrejection", e => Log.add("error", "Unhandled: " + ((e.reason && (e.reason.message || e.reason.code)) || e.reason)));

  const Store = {
    S,
    onChange(fn) { S.listeners.push(fn); },
    async save(col, id, obj) {
      obj = clean(obj); obj._u = Date.now(); S[col][id] = obj; changed();
      try {
        if (db) await db.doc(`${col}/${id}`).set(obj);
        else if (IDB.db) await IDB.put(col, id, obj);
        else LS.set("eb2_" + col, S[col]);
      } catch (e) {
        Log.add("error", `save ${col}/${id}: ${e.message || e.code}`);
        App.toast(e.code === "quota_exceeded" || e.name === "QuotaExceededError" ? "Storage is full. Delete old items or runs." : "Couldn't save: " + (e.message || e.code), "error");
      }
      if (window.EB_CLOUD) window.EB_CLOUD.markDirty(col, id);
    },
    // a change that came from the cloud: store it locally without sending it back
    async applyRemote(col, id, obj) {
      if (!S[col]) return;
      if (obj) S[col][id] = obj; else delete S[col][id];
      changed();
      try {
        if (IDB.db) await (obj ? IDB.put(col, id, obj) : IDB.del(col, id));
        else if (!db) LS.set("eb2_" + col, S[col]);
      } catch (e) { Log.add("error", `store remote ${col}/${id}: ${e.message}`); }
    },
    async patch(col, id, fields) {
      const cur = S[col][id]; if (!cur) return;
      await Store.save(col, id, { ...cur, ...fields });
    },
    async remove(col, id) {
      delete S[col][id]; changed();
      try {
        if (db) await db.doc(`${col}/${id}`).delete();
        else if (IDB.db) await IDB.del(col, id);
        else LS.set("eb2_" + col, S[col]);
      } catch (e) { Log.add("error", `delete ${col}/${id}: ${e.message || e.code}`); App.toast("Couldn't delete: " + (e.message || e.code), "error"); }
      if (window.EB_CLOUD) window.EB_CLOUD.markDirty(col, id);
    },
    config() { return S.config.main || {}; },
    async setConfig(fields) { await Store.save("config", "main", { ...(S.config.main || {}), ...fields }); },
    botConfig(id) { return ((S.config.main || {}).bots || {})[id] || {}; },
    async setBotConfig(id, fields) {
      const bots = { ...((S.config.main || {}).bots || {}) };
      bots[id] = { ...(bots[id] || {}), ...fields };
      await Store.setConfig({ bots });
    },
  };

  function migrateLegacy(legacy) {
    // version 1 kept printables in "products"; move them into "items"
    for (const [id, p] of Object.entries(legacy || {})) {
      if (S.items[id] || !p || !p.bundle) continue;
      const status = p.status === "listed" ? "listed" : p.status;
      Store.save("items", id, { id, bot: p.bot || "product_factory", kind: "printable", title: p.shortName, status,
        createdAt: p.createdAt || U.now(), price: p.price, links: p.listings || {},
        data: { bundleKey: p.bundleKey, bundle: p.bundle, theme: p.theme, shortName: p.shortName, title: p.title,
          description: p.description, tags: p.tags, price: p.price } });
    }
  }

  async function startStorage() {
    if (IN_CLAUDE) {
      try { db = await window.claude.use("db"); } catch { db = null; }
      try { sample = await window.claude.use("sample"); } catch { sample = null; }
      try { downloads = await window.claude.use("downloads"); } catch { downloads = null; }
    }
    if (!db) {
      try {
        IDB.db = await IDB.open();
        for (const c of COLS) S[c] = await IDB.all(c);
        // one-time move from the old localStorage format
        for (const c of COLS) {
          const old = LS.get("eb2_" + c, null); if (!old) continue;
          for (const [id, v] of Object.entries(old)) if (!S[c][id]) { S[c][id] = v; await IDB.put(c, id, clean(v)); }
          try { localStorage.removeItem("eb2_" + c); } catch { /* ignore */ }
          Log.add("info", `Moved ${Object.keys(old).length} ${c} to the on-device database`);
        }
        await Log.load();
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      } catch (e) {
        Log.add("error", "On-device database unavailable, using basic storage: " + e.message);
        IDB.db = null; for (const c of COLS) S[c] = LS.get("eb2_" + c, {});
      }
      migrateLegacy(LS.get("eb_products", null));
      if (LS.get("eb_products", null)) {
        for (const [id, e] of Object.entries(LS.get("eb_earnings", {}))) if (!S.earnings[id]) Store.save("earnings", id, { ...e, itemId: e.sku || "" });
        try { localStorage.removeItem("eb_products"); localStorage.removeItem("eb_earnings"); } catch { /* ignore */ }
      }
      S.mode = "local"; S.ready = true; changed(); return;
    }
    S.mode = "claude";
    let waiting = COLS.length;
    const timer = setTimeout(() => { if (!S.ready) { S.ready = true; changed(); App.toast("Your saved data can't be reached yet.", "error"); } }, 10000);
    for (const c of COLS) {
      db.collection(c).onSnapshot(snap => {
        const next = {}; snap.docs.forEach(d => { next[d.id] = d.data(); }); S[c] = next;
        if (!snap.metadata.fromCache && --waiting === 0) {
          clearTimeout(timer); S.ready = true;
          db.collection("products").get().then(s => { const old = {}; s.docs.forEach(d => { old[d.id] = d.data(); }); if (s.size) { migrateLegacy(old); s.docs.forEach(d => db.doc("products/" + d.id).delete().catch(() => {})); } }).catch(() => {});
        }
        changed();
      }, err => { clearTimeout(timer); S.ready = true; changed(); App.toast("Data connection stopped: " + err.message, "error"); });
    }
  }

  // ---- Claude ------------------------------------------------------------------------
  const Claude = {
    available() { return !!sample || (!IN_CLAUDE && !!LS.get("eb_anthropic_key", "")); },
    why() { return IN_CLAUDE ? "Claude isn't available in this view." : "Add your Anthropic API key in Settings."; },
    async json(prompt) {
      // one retry on a malformed answer or a temporary error
      try { return await Claude._json(prompt); }
      catch (e) { if (/rate|limit|not_granted|API key|Settings/i.test(String(e.message || e.code))) throw e; await U.sleep(1500); return await Claude._json(prompt); }
    },
    async _json(prompt) {
      if (sample) return await sample.json(prompt, { modelTier: "default" });
      const key = LS.get("eb_anthropic_key", "");
      if (!key) throw new Error("Add your Anthropic API key in Settings to use this bot.");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: LS.get("eb_model", "claude-sonnet-5-5"), max_tokens: 8000,
          messages: [{ role: "user", content: prompt + "\n\nReply with valid JSON only, no other text." }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Claude API error ${res.status}`);
      const text = (data.content || []).map(c => c.text || "").join("");
      const a = text.search(/[[{]/), b = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
      return JSON.parse(text.slice(a, b + 1));
    },
  };

  // ---- web (Android app only: the native layer bypasses browser CORS) ---------------------
  const Web = {
    available() { return IS_NATIVE; },
    why() { return IN_CLAUDE ? "Pages inside Claude can't reach other websites. This bot runs in the Android app." : "This bot needs the Android app (browsers block it)."; },
    async get(url, headers = {}) {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) EarningBots/2.0", "Accept": "*/*", ...headers } });
      if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
      return res;
    },
    async json(url, headers) { return (await Web.get(url, headers)).json(); },
    async text(url, headers) { return (await Web.get(url, headers)).text(); },
    async post(url, body, headers = {}) {
      const res = await fetch(url, { method: "POST", body, headers });
      if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
      return res;
    },
  };

  // ---- files -----------------------------------------------------------------------
  async function blobToBase64(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const Files = {
    async save(filename, blob) {
      if (downloads) {
        try { await downloads.save({ filename, data: blob }); return true; }
        catch (e) { if (e.code !== "declined") App.toast("Download failed: " + (e.message || e.code), "error"); return false; }
      }
      const P = window.Capacitor && window.Capacitor.Plugins;
      if (IS_NATIVE && P && P.Filesystem) {
        const written = await P.Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: "CACHE" });
        try { await P.Share.share({ title: filename, url: written.uri, dialogTitle: "Save or send " + filename }); } catch { /* closed */ }
        return true;
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return true;
    },
    canvasBlob: (cv, type = "image/png", q) => new Promise(res => cv.toBlob(res, type, q)),
    async copy(text, label = "Text") {
      try { await navigator.clipboard.writeText(text); App.toast(`${label} copied`); }
      catch { App.copyBox(text, label); }
    },
    open(url) {
      const P = window.Capacitor && window.Capacitor.Plugins;
      if (IS_NATIVE && P && P.Browser) return P.Browser.open({ url });
      const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    },
  };

  // App is filled in by ui.js; core only needs toast/copyBox
  const App = window.EB_APP = window.EB_APP || { toast: m => console.log(m), copyBox: t => console.log(t) };

  window.EB = { Log, IDB, U, LS, Store, Claude, Web, Files, IS_NATIVE, IN_CLAUDE, startStorage };
})();
