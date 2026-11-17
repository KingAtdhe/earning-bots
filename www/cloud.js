/* Connects the app to your Earning Bots cloud (a Cloudflare Worker you own), which runs the bots 24/7.
   Sync: every local change is pushed; everything newer in the cloud is pulled. Newest change wins. */
(function () {
  "use strict";
  const { U, LS, Store, Log, IN_CLAUDE } = window.EB;
  const S = Store.S;
  const toast = (m, k) => window.EB_APP.toast(m, k);
  const CLOUD_BOTS = ["niche_research", "product_factory", "calendar_bot", "idea_bot", "seo_optimizer", "maze_books", "coloring_books", "notebooks", "worksheets",
    "pod_designs", "wall_art", "content_bot", "pin_bot", "article_bot", "ebook_bot", "newsletter_bot", "social_poster", "lead_finder", "job_scanner", "gig_bot", "price_watch",
    "planner_bot", "paper_bot", "party_bot", "cards_bot"];
  let dirty = new Set(LS.get("eb_cloud_dirty", [])), timer = null, syncing = false, lastStatus = null;
  const saveDirty = () => LS.set("eb_cloud_dirty", [...dirty]);

  const Cloud = {
    CLOUD_BOTS,
    url: () => (LS.get("eb_cloud_url", "") || "").replace(/\/+$/, ""),
    connected: () => !!(LS.get("eb_cloud_url", "") && LS.get("eb_cloud_token", "")),
    status: () => lastStatus,
    runsBot: id => Cloud.connected() && CLOUD_BOTS.includes(id),
    async api(method, path, body) {
      const res = await fetch(Cloud.url() + path, { method, headers: { Authorization: `Bearer ${LS.get("eb_cloud_token", "")}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const txt = await res.text(); let data = {}; try { data = txt ? JSON.parse(txt) : {}; } catch { data = { error: txt.slice(0, 200) }; }
      if (!res.ok) throw new Error(data.error || `Cloud answered ${res.status}`);
      return data;
    },
    async connect(url) {
      url = String(url || "").trim().replace(/\/+$/, ""); if (!/^https?:\/\//.test(url)) throw new Error("Paste the full address, starting with https://");
      const h = await (await fetch(url + "/health")).json().catch(() => null);
      if (!h || h.app !== "earning-bots-cloud") throw new Error("That address isn't an Earning Bots cloud.");
      const r = await fetch(url + "/claim", { method: "POST" }); const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't connect");
      LS.set("eb_cloud_url", url); LS.set("eb_cloud_token", d.token); LS.set("eb_cloud_since", 0);
      // first sync: send everything this phone has
      for (const col of ["items", "earnings", "runs", "watches", "config"]) for (const id of Object.keys(S[col])) dirty.add(`${col}\u0000${id}`);
      saveDirty(); Log.add("info", "Connected to cloud " + url);
      await Cloud.sendKeys().catch(e => Log.add("error", "send keys: " + e.message));
      await Cloud.sync();
    },
    disconnect() { for (const k of ["eb_cloud_url", "eb_cloud_token", "eb_cloud_since", "eb_cloud_etsy"]) { try { localStorage.removeItem(k); } catch { /* ignore */ } } dirty.clear(); saveDirty(); },
    markDirty(col, id) { if (!Cloud.connected()) return; dirty.add(`${col}\u0000${id}`); saveDirty(); clearTimeout(timer); timer = setTimeout(() => Cloud.sync().catch(() => {}), 4000); },
    async push() {
      const keys = [...dirty]; let sent = 0;
      for (let i = 0; i < keys.length; i += 60) {
        const batch = keys.slice(i, i + 60).map(k => { const [col, id] = k.split("\u0000"); const data = S[col] ? S[col][id] : null; return { col, id, data: data || null, updated: (data && data._u) || Date.now() }; });
        await Cloud.api("POST", "/sync", { docs: batch });
        batch.forEach(b => { const k = `${b.col}\u0000${b.id}`; const cur = S[b.col] && S[b.col][b.id]; if (!cur || (cur._u || 0) <= b.updated) dirty.delete(k); });
        saveDirty(); sent += batch.length;
      }
      return sent;
    },
    async pull() {
      let since = Number(LS.get("eb_cloud_since", 0)) || 0, got = 0;
      for (let page = 0; page < 50; page++) {
        const r = await Cloud.api("GET", `/sync?since=${since}`);
        for (const d of r.docs) {
          const local = S[d.col] && S[d.col][d.id];
          if (dirty.has(`${d.col}\u0000${d.id}`) && local && (local._u || 0) >= d.updated) continue; // our newer change wins
          if (!local || d.updated > (local._u || 0) || !d.data) { await Store.applyRemote(d.col, d.id, d.data ? { ...d.data, _u: d.updated } : null); got++; }
          since = Math.max(since, d.updated);
        }
        LS.set("eb_cloud_since", since);
        if (!r.more) break;
      }
      return got;
    },
    async sync() {
      if (!Cloud.connected() || syncing) return; syncing = true;
      try { const sent = await Cloud.push(), got = await Cloud.pull(); LS.set("eb_cloud_last", U.now()); if (sent || got) Log.add("info", `Cloud sync: sent ${sent}, received ${got}`); if (got && window.EB_QA) setTimeout(() => window.EB_QA.backfill().catch(e => Log.add("warn", "Image check: " + e.message)), 500); }
      catch (e) { Log.add("error", "Cloud sync: " + e.message); throw e; }
      finally { syncing = false; }
    },
    async sendKeys() {
      const tok = LS.get("eb_etsy_token", null);
      const body = { anthropic: LS.get("eb_anthropic_key", ""), model: LS.get("eb_model", "claude-sonnet-5-5"), gumroad: LS.get("eb_gumroad", "") };
      if (tok && LS.get("eb_etsy_key", "")) body.etsy = { key: LS.get("eb_etsy_key", ""), secret: LS.get("eb_etsy_secret", ""), token: tok };
      const r = await Cloud.api("POST", "/secrets", body);
      if (r.have && r.have.etsy) LS.set("eb_cloud_etsy", true);
      return r.have;
    },
    async etsyToken() { const r = await Cloud.api("GET", "/token/etsy"); LS.set("eb_etsy_token", r.token); return r.token; },
    async refreshStatus() { lastStatus = await Cloud.api("GET", "/status"); return lastStatus; },
    async runNow(botId) { const r = await Cloud.api("POST", `/run/${botId}`); await Cloud.pull(); return r; },
    start() {
      if (!Cloud.connected()) return;
      Cloud.sync().catch(() => {}); Cloud.refreshStatus().catch(() => {});
      setInterval(() => { Cloud.sync().catch(() => {}); }, 3 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) Cloud.sync().catch(() => {}); });
    },

    // ---- settings UI ----------------------------------------------------------------------------
    settingsHtml() {
      const esc = U.esc;
      if (IN_CLAUDE) return `<h4>Cloud (24/7)</h4><p class="muted">Connect the cloud from the Android app. Pages inside Claude can't reach other websites.</p>`;
      if (!Cloud.connected()) return `<h4>Cloud (bots run 24/7)</h4><p class="hint">Deploy your cloud once (see the README in your earning-bots repo), then paste its address here.</p>
        <form class="cloudform"><label>Cloud address<input name="url" type="url" placeholder="https://earning-bots-cloud.yourname.workers.dev" autocomplete="off"></label><button class="primary">Connect</button></form>`;
      const st = lastStatus, ago = t => t ? U.ago(new Date(t).toISOString()) : "never";
      return `<h4>Cloud (bots run 24/7)</h4>
        <div class="kpis inline"><div><b>${st ? ago(st.lastTick) : "…"}</b><span>last check</span></div><div><b>${LS.get("eb_cloud_last", "") ? U.ago(LS.get("eb_cloud_last", "")) : "never"}</b><span>last sync</span></div><div><b>${dirty.size}</b><span>waiting to send</span></div></div>
        ${st ? `<p class="muted">Keys in the cloud: Claude ${st.keys.anthropic ? "✓" : "✗"} · Etsy ${st.keys.etsy ? "✓" : "✗"} · Gumroad ${st.keys.gumroad ? "✓" : "✗"}. ${st.lastRuns.length ? `Latest: ${esc(st.lastRuns[0].summary)}` : ""}</p>` : ""}
        <p class="hint">The cloud runs ${CLOUD_BOTS.length} bots on their autopilot schedule and syncs sales. This phone only runs the Sudoku book bot and does the uploading when you tap Publish.</p>
        <div class="btns wrap"><button class="ghost" data-act="cloud-sync">Sync now</button><button class="ghost" data-act="cloud-keys">Send my keys</button><button class="ghost" data-act="cloud-status">Refresh status</button><button class="ghost" data-act="cloud-disconnect">Disconnect</button></div>
        <p class="muted small">${esc(Cloud.url())}</p>`;
    },
    async handleAct(name) {
      try {
        if (name === "cloud-sync") { await Cloud.sync(); toast("Synced with the cloud"); return true; }
        if (name === "cloud-keys") { const h = await Cloud.sendKeys(); toast(`Keys sent. Claude ${h.anthropic ? "✓" : "✗"}, Etsy ${h.etsy ? "✓" : "✗"}, Gumroad ${h.gumroad ? "✓" : "✗"}`); return true; }
        if (name === "cloud-status") { await Cloud.refreshStatus(); return true; }
        if (name === "cloud-disconnect") { Cloud.disconnect(); toast("Disconnected from the cloud"); return true; }
      } catch (e) { toast("Cloud: " + e.message, "error"); return true; }
      return false;
    },
    async handleSubmit(f, fd) {
      if (!f.classList.contains("cloudform")) return false;
      try { toast("Connecting..."); await Cloud.connect(fd.get("url")); await Cloud.refreshStatus().catch(() => {}); toast("Cloud connected. Your bots now run 24/7."); }
      catch (e) { toast(e.message, "error"); }
      return true;
    },
  };

  window.EB_CLOUD = Cloud;
})();
