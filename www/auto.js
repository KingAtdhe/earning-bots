/* Automation engine: quality gate (auto-approve with Claude review), Etsy auto-publishing and sales sync
   (Android app), Gmail drafts and Metricool scheduling (inside Claude), and the autopilot preset. */
(function () {
  "use strict";
  const { U, LS, Store, Claude, Web, Files, IS_NATIVE, IN_CLAUDE } = window.EB;
  const { BOTS, KINDS } = window.EB_BOTS;
  const D = window.EB_DESIGNS, A = window.EB_ART, K = window.EB_KDP;
  const S = Store.S, esc = U.esc;
  const toast = (m, k) => window.EB_APP.toast(m, k);
  const cfg = () => Store.config(), auto = () => cfg().auto || {};
  const setAuto = fields => Store.setConfig({ auto: { ...auto(), ...fields } });
  const PIPELINE = ["lead", "opportunity", "deal"];

  // ---- connectors inside Claude ---------------------------------------------------------------
  let mcp = null;
  const METRICOOL = "Metricool Social Media Management", GMAIL = "Gmail";
  (async () => { if (IN_CLAUDE) { try { mcp = await window.claude.use("mcp"); } catch { mcp = null; } } })();
  async function callTool(server, tool, input) {
    if (!mcp) throw new Error("Connected apps only work inside Claude.");
    try { return (await mcp.callTool(server, tool, input)).payload; }
    catch (e) {
      const fix = { needs_reauth: `Reconnect ${server} in claude.ai Settings > Connectors.`, server_not_connected: `Add ${server} in claude.ai Settings > Connectors.`, approval_required: `Allow ${server} for this page when Claude asks.`, not_in_manifest: `${server} isn't allowed for this page.` }[e.code];
      throw new Error(fix || e.message || e.code);
    }
  }

  // ---- quality gate -------------------------------------------------------------------------------
  function approveMode(botId) { return Store.botConfig(botId).approve || "manual"; }
  async function afterRun(bot, ids) {
    const fresh = ids.map(id => S.items[id]).filter(Boolean);
    if (!fresh.length) return "";
    const notes = [];
    // leads: Gmail drafts
    if (bot.id === "lead_finder" && auto().gmailDrafts && mcp) {
      let n = 0;
      for (const it of fresh.filter(i => i.kind === "lead" && i.data.email && !i.data.draftId)) {
        try { const r = await callTool(GMAIL, "create_draft", { to: [it.data.email], subject: it.data.pitchSubject, body: it.data.pitchBody }); await Store.patch("items", it.id, { data: { ...it.data, draftId: r?.id || "draft", draftUrl: r?.viewUrl || "" } }); n++; }
        catch (e) { notes.push("Gmail: " + e.message); break; }
      }
      if (n) notes.push(`${n} email draft${n > 1 ? "s" : ""} waiting in Gmail`);
    }
    const mode = approveMode(bot.id), pending = fresh.filter(i => i.status === "pending");
    if (!pending.length || mode === "manual") return notes.join(". ");
    let approved = [];
    if (mode === "auto" || !Claude.available()) approved = pending;
    else {
      try {
        const r = await Claude.json(`You are a strict quality reviewer for a seller who lists digital products and content on marketplaces. Score each item 1-10 for: clear and accurate title, no spelling mistakes, no trademark or brand names, no misleading claims, sensible price, and whether buyers would want it. Items: ${JSON.stringify(pending.map(i => ({ id: i.id, kind: i.kind, title: i.data.title || i.title, description: String(i.data.description || i.data.caption || i.data.text || i.data.markdown || "").slice(0, 600), tags: i.data.tags || i.data.hashtags, price: i.price })))}
Return a JSON array of {"id": "...", "score": number, "issue": "short reason if below 7, else empty"}.`);
        const scores = new Map((Array.isArray(r) ? r : []).map(x => [x.id, x]));
        for (const it of pending) {
          const s = scores.get(it.id);
          if (s && Number(s.score) >= 7) approved.push(it);
          else if (s) await Store.patch("items", it.id, { review: { score: Number(s.score) || 0, issue: U.clampStr(s.issue, 200) } });
        }
        if (pending.length - approved.length) notes.push(`${pending.length - approved.length} held back for you to check`);
      } catch (e) { notes.push("Review skipped: " + e.message); }
    }
    for (const it of approved) await approve(it, true);
    if (approved.length) notes.unshift(`${approved.length} auto-approved`);
    return notes.join(". ");
  }

  async function approve(it, quiet) {
    await Store.patch("items", it.id, { status: PIPELINE.includes(it.kind) ? "new" : "approved", approvedAt: U.now() });
    const fresh = S.items[it.id];
    try {
      if (Etsy.canPublish(fresh) && auto().etsyPublish) { await Etsy.publish(fresh); if (!quiet) toast("Published on Etsy"); }
      if (fresh.kind === "post" && Store.botConfig("social_poster").autoSchedule === "on" && mcp && auto().metricool) { await Metricool.schedule(fresh); if (!quiet) toast("Scheduled in Metricool"); }
    } catch (e) { await Store.patch("items", it.id, { publishError: e.message }); toast(e.message, "error"); }
  }

  // ---- Metricool (inside Claude) -----------------------------------------------------------------
  function tzOffsetMin(tz, date) {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date).map(x => [x.type, x.value]));
      return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 60000;
    } catch { return 0; }
  }
  const pad = n => String(n).padStart(2, "0");
  const Metricool = {
    async brands() {
      const p = await callTool(METRICOOL, "getBrandSettings", {});
      const found = [];
      const walk = o => { if (!o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
        const id = o.blogId ?? o.id; if (id != null && (o.label || o.name || o.title)) found.push({ blogId: String(id), label: o.label || o.name || o.title, timezone: o.timezone || o.timeZone || "Europe/Belgrade" });
        Object.values(o).forEach(walk); };
      walk(typeof p === "string" ? (() => { try { return JSON.parse(p); } catch { return {}; } })() : p);
      const seen = new Set(); return found.filter(b => !seen.has(b.blogId) && seen.add(b.blogId));
    },
    nextSlot() {
      const m = auto().metricool, tz = m.timezone || "UTC", slots = [[9, 0], [18, 30]];
      let t = Math.max(Date.now() + 30 * 60e3, Date.parse(m.lastSlot || 0) || 0) + 60e3;
      for (let d = 0; d < 60; d++) {
        const day = new Date(t + d * 864e5);
        for (const [h, mi] of slots) {
          const localGuess = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, mi);
          const utc = localGuess - tzOffsetMin(tz, new Date(localGuess)) * 60e3;
          if (utc >= t) { const local = new Date(utc + tzOffsetMin(tz, new Date(utc)) * 60e3); return { utc, tz, local: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00` }; }
        }
      }
      throw new Error("No free slot found");
    },
    async schedule(it) {
      const m = auto().metricool; if (!m || !m.blogId) throw new Error("Pick your Metricool brand in Settings first.");
      const nets = (it.data.networks || ["twitter"]).filter(n => ["twitter", "threads", "linkedin", "bluesky", "facebook"].includes(n));
      const slot = Metricool.nextSlot(), off = tzOffsetMin(slot.tz, new Date(slot.utc)), sign = off >= 0 ? "+" : "-";
      const info = { autoPublish: true, draft: false, descendants: [], firstCommentText: "", hasNotReadNotes: false, media: [], mediaAltText: [], shortener: false, smartLinkData: { ids: [] },
        providers: nets.map(network => ({ network })), publicationDate: { dateTime: slot.local, timezone: slot.tz }, text: it.data.text };
      if (nets.includes("twitter")) info.twitterData = { tags: [] };
      if (nets.includes("threads")) info.threadsData = { allowedCountryCodes: [] };
      if (nets.includes("bluesky")) info.blueskyData = { postLanguages: ["en"] };
      if (nets.includes("linkedin")) info.linkedinData = { type: "post", previewIncluded: true, publishImagesAsPDF: false };
      if (nets.includes("facebook")) info.facebookData = { type: "POST" };
      const r = await callTool(METRICOOL, "createScheduledPost", { blogId: m.blogId, date: `${slot.local}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`, info: JSON.stringify(info) });
      await setAuto({ metricool: { ...m, lastSlot: new Date(slot.utc).toISOString() } });
      await Store.patch("items", it.id, { status: "listed", data: { ...it.data, scheduledFor: new Date(slot.utc).toISOString(), plannerUrl: JSON.stringify(r || "").match(/https?:[^"\\]+/)?.[0] || "" } });
    },
  };

  // ---- Etsy (Android app) --------------------------------------------------------------------------
  const ETSY_API = "https://api.etsy.com/v3/application", REDIRECT = "https://localhost/etsy-callback.html";
  const ETSY_KINDS = { printable: ["calendars & planners", "planners"], wallart: ["prints", "digital prints"], worksheet: ["worksheets", "educational", "learning"], ebook: ["guides", "books"], design: null };
  const Etsy = {
    connected: () => !!LS.get("eb_etsy_token", null),
    key() { const k = LS.get("eb_etsy_key", ""), s = LS.get("eb_etsy_secret", ""); return s ? `${k}:${s}` : k; },
    canPublish: it => IS_NATIVE && Etsy.connected() && !!ETSY_KINDS[it.kind] && !(it.links || {}).Etsy,
    async connect() {
      const key = LS.get("eb_etsy_key", ""); if (!key) throw new Error("Add your Etsy keystring and shared secret first.");
      const verifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(48)))).replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const state = U.uid(); LS.set("eb_etsy_pkce", { verifier, state });
      location.href = "https://www.etsy.com/oauth/connect?" + new URLSearchParams({ response_type: "code", redirect_uri: REDIRECT, scope: "listings_r listings_w shops_r transactions_r", client_id: key, state, code_challenge: challenge, code_challenge_method: "S256" });
    },
    async finish() {
      const cb = LS.get("eb_etsy_cb", null); if (!cb) return; try { localStorage.removeItem("eb_etsy_cb"); } catch { /* ignore */ }
      const pk = LS.get("eb_etsy_pkce", {}); const q = new URLSearchParams(cb);
      if (!q.get("code") || q.get("state") !== pk.state) return toast("Etsy login didn't finish: " + (q.get("error_description") || q.get("error") || "try again"), "error");
      try {
        const tok = await (await Web.post("https://api.etsy.com/v3/public/oauth/token", new URLSearchParams({ grant_type: "authorization_code", client_id: LS.get("eb_etsy_key", ""), redirect_uri: REDIRECT, code: q.get("code"), code_verifier: pk.verifier }).toString(), { "Content-Type": "application/x-www-form-urlencoded" })).json();
        tok.expires_at = Date.now() + (tok.expires_in || 3600) * 1000; LS.set("eb_etsy_token", tok);
        const shop = await Etsy.api("GET", `/users/${tok.access_token.split(".")[0]}/shops`);
        const s = shop.results ? shop.results[0] : shop; tok.shop_id = s.shop_id; tok.shop_name = s.shop_name; LS.set("eb_etsy_token", tok);
        toast(`Etsy connected: ${s.shop_name}`); window.EB_APP.refresh && window.EB_APP.refresh();
      } catch (e) { toast("Etsy connection failed: " + e.message, "error"); }
    },
    async token() {
      const t = LS.get("eb_etsy_token", null); if (!t) throw new Error("Connect Etsy in Settings first.");
      if (t.expires_at - 60e3 > Date.now()) return t;
      const fresh = await (await Web.post("https://api.etsy.com/v3/public/oauth/token", new URLSearchParams({ grant_type: "refresh_token", client_id: LS.get("eb_etsy_key", ""), refresh_token: t.refresh_token }).toString(), { "Content-Type": "application/x-www-form-urlencoded" })).json();
      const merged = { ...t, ...fresh, expires_at: Date.now() + (fresh.expires_in || 3600) * 1000 }; LS.set("eb_etsy_token", merged); return merged;
    },
    async api(method, path, body, isForm) {
      const t = await Etsy.token(), headers = { "x-api-key": Etsy.key(), Authorization: `Bearer ${t.access_token}` };
      if (body && !isForm) headers["Content-Type"] = "application/x-www-form-urlencoded";
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(ETSY_API + path, { method, headers, body: body ? (isForm ? body : new URLSearchParams(body).toString()) : undefined });
        const txt = await res.text();
        if (res.ok) return txt ? JSON.parse(txt) : {};
        if ((res.status === 429 || res.status >= 500) && attempt < 2 && (method === "GET" || res.status === 429)) { await U.sleep(1500 * (attempt + 1)); continue; }
        let msg = txt.slice(0, 200); try { msg = JSON.parse(txt).error || msg; } catch { /* plain text */ }
        throw new Error(`Etsy ${res.status}: ${msg}`);
      }
    },
    async taxonomy(kind) {
      const cache = LS.get("eb_etsy_tax", {}); if (cache[kind]) return cache[kind];
      const words = ETSY_KINDS[kind] || []; const nodes = (await Web.json(`${ETSY_API}/seller-taxonomy/nodes`, { "x-api-key": Etsy.key() })).results || [];
      let hit = null; const walk = (ns, trail) => ns.forEach(n => { const p = [...trail, n.name]; if (!hit && words.some(w => n.name.toLowerCase() === w)) hit = n.id; walk(n.children || [], p); });
      walk(nodes, []);
      const id = hit || Number(LS.get("eb_etsy_taxonomy", 0)); if (!id) throw new Error("Couldn't find an Etsy category. Set one in Settings.");
      cache[kind] = id; LS.set("eb_etsy_tax", cache); return id;
    },
    async publish(it) {
      const t = await Etsy.token(), d = it.data, shop = t.shop_id;
      toast(`Publishing “${(d.title || it.title).slice(0, 40)}” on Etsy...`);
      const listing = await Etsy.api("POST", `/shops/${shop}/listings`, { quantity: 999, title: String(d.title || it.title).slice(0, 140), description: d.description || "", price: Number(it.price || d.price || 4.9).toFixed(2),
        who_made: "i_did", when_made: "made_to_order", taxonomy_id: await Etsy.taxonomy(it.kind), type: "download", is_supply: "false", tags: (d.tags || []).slice(0, 13).join(",") });
      const id = listing.listing_id, imgs = [], files = [];
      if (it.kind === "printable") {
        const p = { bundle: d.bundle, theme: d.theme, shortName: d.shortName, title: d.title };
        imgs.push(D.coverCanvas(p, 2000)); d.bundle.pages.slice(0, 9).forEach(k => imgs.push(D.pageCanvas(p, k, 2000)));
        for (const size of Object.keys(D.SIZES)) files.push([`${U.slug(d.shortName)}-${size}.pdf`, D.makePdf(p, size)]);
      } else if (it.kind === "wallart") {
        imgs.push(A.roomMockup(it, 2000), A.artCanvas(it, "2x3", 2000));
        for (const [key] of A.SIZES) files.push([`${U.slug(d.title).slice(0, 40)}-${key}.jpg`, await Files.canvasBlob(A.artCanvas(it, key, 4500), "image/jpeg", 0.93)]);
      } else if (it.kind === "worksheet") { imgs.push(K.cover(it, 2000)); files.push([`${U.slug(d.title)}.pdf`, K.interior(it)]); }
      else if (it.kind === "ebook") { imgs.push(A.ebookCover(it, 1600)); files.push([`${U.slug(d.title)}.pdf`, A.ebookPdf(it)]); }
      for (let i = 0; i < imgs.length && i < 10; i++) { const f = new FormData(); f.append("image", await Files.canvasBlob(imgs[i], "image/jpeg", 0.9), `photo-${i + 1}.jpg`); f.append("rank", String(i + 1)); await Etsy.api("POST", `/shops/${shop}/listings/${id}/images`, f, true); }
      for (let i = 0; i < files.length && i < 5; i++) { const f = new FormData(); f.append("file", files[i][1], files[i][0]); f.append("name", files[i][0]); f.append("rank", String(i + 1)); await Etsy.api("POST", `/shops/${shop}/listings/${id}/files`, f, true); }
      if (auto().etsyActivate !== false) await Etsy.api("PATCH", `/shops/${shop}/listings/${id}`, { state: "active" });
      await Store.patch("items", it.id, { status: "listed", links: { ...(it.links || {}), Etsy: `https://www.etsy.com/listing/${id}` }, data: { ...d, etsyId: String(id) }, publishError: "" });
    },
    async syncSales() {
      const t = await Etsy.token(); let added = 0;
      const byListing = {}; Object.values(S.items).forEach(i => { if (i.data.etsyId) byListing[i.data.etsyId] = i; });
      for (let offset = 0; offset < 500; offset += 100) {
        const r = await Etsy.api("GET", `/shops/${t.shop_id}/receipts?limit=100&offset=${offset}&was_paid=true`);
        for (const rc of r.results || []) for (const tr of rc.transactions || []) {
          const key = "etsy-" + tr.transaction_id; if (S.earnings[key]) continue;
          const it = byListing[String(tr.listing_id)], pr = tr.price || {}, cents = Math.round((pr.amount || 0) * 100 / (pr.divisor || 100)) * (tr.quantity || 1);
          await Store.save("earnings", key, { amountCents: cents, currency: pr.currency_code || "USD", platform: "Etsy", itemId: it ? it.id : "", bot: it ? it.bot : "", date: new Date((rc.created_timestamp || Date.now() / 1000) * 1000).toISOString(), note: tr.title || "" });
          added++;
        }
        if ((r.results || []).length < 100) break;
      }
      // views and favorites for every listing the bots made, so winners can be found
      try {
        for (let offset = 0; offset < 1000; offset += 100) {
          const r = await Etsy.api("GET", `/shops/${t.shop_id}/listings?state=active&limit=100&offset=${offset}`);
          for (const l of r.results || []) { const it = byListing[String(l.listing_id)]; if (it) await Store.patch("items", it.id, { data: { ...S.items[it.id].data, stats: { views: l.views || 0, favorites: l.num_favorers || 0, at: U.now() } } }); }
          if ((r.results || []).length < 100) break;
        }
      } catch { /* stats are a bonus */ }
      return added;
    },
  };

  async function syncSales(quiet) {
    const msgs = [];
    if (IS_NATIVE && Etsy.connected()) { try { const n = await Etsy.syncSales(); msgs.push(`Etsy +${n}`); } catch (e) { msgs.push("Etsy: " + e.message); } }
    if (IS_NATIVE && LS.get("eb_gumroad", "")) { try { await window.EB_APP.syncGumroad(true); msgs.push("Gumroad synced"); } catch (e) { msgs.push("Gumroad: " + e.message); } }
    await setAuto({ lastSync: U.now() });
    if (!quiet || msgs.some(m => m.includes(":"))) toast(msgs.join(" · ") || "No sales platforms connected", msgs.some(m => m.includes(":")) ? "error" : "ok");
  }
  async function periodic() {
    const a = auto(); if (a.salesSync && Date.now() - Date.parse(a.lastSync || 0) > 6 * 3600e3) await syncSales(true);
  }

  // ---- full autopilot preset ---------------------------------------------------------------------
  const PRESET = { "Research": 72, "Make & sell": 24, "Content": 12, "Clients & jobs": 8, "Deals": 6 };
  async function enableAutopilot(on) {
    const bots = { ...(cfg().bots || {}) };
    for (const b of BOTS) {
      const runnable = !((b.needs || []).includes("claude") && !Claude.available()) && !((b.needs || []).includes("web") && !Web.available());
      const off = (bots[b.id] || {}).disabled;
      bots[b.id] = { ...(bots[b.id] || {}), auto: on && runnable && !off ? PRESET[b.category] || 24 : 0, approve: on ? (Claude.available() ? "review" : "manual") : (bots[b.id] || {}).approve || "manual" };
    }
    await Store.setConfig({ bots, auto: { ...auto(), autopilot: on, salesSync: on ? true : auto().salesSync, etsyPublish: on && Etsy.connected() ? true : auto().etsyPublish } });
    toast(on ? "Autopilot on: bots run on their own while the app is open" : "Autopilot off");
    reminders();
  }

  // ---- UI pieces ----------------------------------------------------------------------------------------
  function approveField(bot) {
    const v = approveMode(bot.id);
    return `<label>New work<select name="approve">${[["manual", "Wait in my Inbox"], ["review", "Claude checks it, approves the good ones"], ["auto", "Approve everything automatically"]].map(([k, l]) => `<option value="${k}" ${v === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  }
  function homeCard() {
    const a = auto(), on = BOTS.filter(b => parseFloat(Store.botConfig(b.id).auto || 0)).length;
    const parts = [`${on}/${BOTS.length} bots scheduled`];
    if (a.etsyPublish && Etsy.connected()) parts.push("Etsy auto-publish");
    if (a.gmailDrafts) parts.push("Gmail drafts"); if (a.metricool) parts.push("Metricool");
    if (a.salesSync) parts.push("sales sync");
    return `<section class="card autopilot ${a.autopilot ? "on" : ""}"><div class="ap-head"><div><b>Autopilot</b><span>${a.autopilot ? esc(parts.join(" · ")) : "Bots only run when you tap Run"}</span></div>
      <button class="switch ${a.autopilot ? "on" : ""}" data-act="autopilot" aria-pressed="${!!a.autopilot}" aria-label="Autopilot"><i></i></button></div>
      ${a.autopilot ? `<p class="hint">Runs while the app is open. Keep it open (or check in daily) and new work, approvals and sales keep flowing.</p>` : ""}</section>`;
  }
  function settingsSection() {
    const a = auto(), m = a.metricool, tok = LS.get("eb_etsy_token", null);
    let h = `<h4>Automation</h4><form class="autoform">
      <label class="check"><input type="checkbox" name="salesSync" ${a.salesSync ? "checked" : ""}> Sync sales automatically every 6 hours${IS_NATIVE ? "" : " (Android app)"}</label>`;
    if (IS_NATIVE) h += `<label class="check"><input type="checkbox" name="etsyPublish" ${a.etsyPublish ? "checked" : ""}> Publish approved products on Etsy automatically</label>
      <label class="check"><input type="checkbox" name="etsyActivate" ${a.etsyActivate !== false ? "checked" : ""}> Make Etsy listings live right away (USD 0.20 each), otherwise save as drafts</label>`;
    if (IN_CLAUDE) h += `<label class="check"><input type="checkbox" name="gmailDrafts" ${a.gmailDrafts ? "checked" : ""}> Put Client Finder pitches in Gmail as drafts (never sent automatically)</label>`;
    h += `<button class="ghost">Save automation</button></form>`;
    if (IS_NATIVE) {
      h += `<h4>Etsy</h4>${tok ? `<p class="muted">Connected to <b>${esc(tok.shop_name || "your shop")}</b>.</p><div class="btns wrap"><button class="ghost" data-act="etsy-sync">Sync Etsy sales</button><button class="ghost" data-act="etsy-disconnect">Disconnect</button></div>`
        : `<form class="etsyform"><p class="hint">Create an app at etsy.com/developers with the callback URL ${REDIRECT}, then paste its keys here.</p>
        <div class="two"><label>Keystring<input name="key" value="${esc(LS.get("eb_etsy_key", ""))}" autocomplete="off"></label><label>Shared secret<input name="secret" type="password" value="${esc(LS.get("eb_etsy_secret", ""))}" autocomplete="off"></label></div>
        <button class="primary">Connect Etsy</button></form>`}`;
    }
    if (IN_CLAUDE) {
      h += `<h4>Metricool (social scheduling)</h4>${m ? `<p class="muted">Posting as <b>${esc(m.label)}</b> (${esc(m.timezone)}).</p>` : `<p class="muted">Pick the brand the Social Text Bot should schedule posts for.</p>`}
        <div class="btns wrap"><button class="ghost" data-act="metricool-brands">${m ? "Change brand" : "Load my brands"}</button></div><div id="mbrands"></div>`;
    }
    return h;
  }
  async function handleAct(name, el) {
    switch (name) {
      case "autopilot": await enableAutopilot(!auto().autopilot); return true;
      case "etsy-sync": await syncSales(); return true;
      case "etsy-disconnect": try { localStorage.removeItem("eb_etsy_token"); } catch { /* ignore */ } toast("Etsy disconnected"); return true;
      case "metricool-brands": {
        const box = document.getElementById("mbrands"); box.innerHTML = `<p class="muted"><span class="spin"></span> Loading...</p>`;
        try { const list = await Metricool.brands(); box.innerHTML = list.length ? `<div class="list">${list.map(b => `<button class="row" data-act="metricool-pick" data-blog="${esc(b.blogId)}" data-label="${esc(b.label)}" data-tz="${esc(b.timezone)}"><div><b>${esc(b.label)}</b><span>${esc(b.timezone)}</span></div></button>`).join("")}</div>` : `<p class="muted">No brands found in Metricool.</p>`; }
        catch (e) { box.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
        return "keep";
      }
      case "metricool-pick": await setAuto({ metricool: { blogId: el.dataset.blog, label: el.dataset.label, timezone: el.dataset.tz } }); toast(`Metricool brand: ${el.dataset.label}`); window.EB_APP.closeSheet(); return true;
      case "schedule-post": { const it = S.items[el.dataset.id]; try { await Metricool.schedule(it); toast("Scheduled in Metricool"); } catch (e) { toast(e.message, "error"); } return true; }
      case "etsy-publish": { const it = S.items[el.dataset.id]; try { await Etsy.publish(it); toast("Published on Etsy"); } catch (e) { toast(e.message, "error"); } return true; }
      case "gmail-draft": { const it = S.items[el.dataset.id]; try { const r = await callTool(GMAIL, "create_draft", { to: [it.data.email], subject: it.data.pitchSubject, body: it.data.pitchBody }); await Store.patch("items", it.id, { data: { ...it.data, draftId: r?.id || "draft", draftUrl: r?.viewUrl || "" } }); toast("Draft saved in Gmail"); } catch (e) { toast(e.message, "error"); } return true; }
    }
    return false;
  }
  async function handleSubmit(f, fd) {
    if (f.classList.contains("autoform")) {
      await setAuto({ salesSync: fd.has("salesSync"), ...(IS_NATIVE ? { etsyPublish: fd.has("etsyPublish"), etsyActivate: fd.has("etsyActivate") } : {}), ...(IN_CLAUDE ? { gmailDrafts: fd.has("gmailDrafts") } : {}) });
      toast("Automation saved"); return true;
    }
    if (f.classList.contains("etsyform")) {
      LS.set("eb_etsy_key", String(fd.get("key")).trim()); LS.set("eb_etsy_secret", String(fd.get("secret")).trim());
      try { await Etsy.connect(); } catch (e) { toast(e.message, "error"); } return true;
    }
    return false;
  }
  function itemActions(it) {
    const out = [];
    if (Etsy.canPublish(it) && it.status !== "pending") out.push(`<button class="primary" data-act="etsy-publish" data-id="${esc(it.id)}">Publish on Etsy</button>`);
    if (it.kind === "post" && it.status !== "pending" && !it.data.scheduledFor && mcp) out.push(`<button class="primary" data-act="schedule-post" data-id="${esc(it.id)}">Schedule in Metricool</button>`);
    if (it.kind === "lead" && it.data.email && mcp && !it.data.draftId) out.push(`<button class="ghost" data-act="gmail-draft" data-id="${esc(it.id)}">Draft in Gmail</button>`);
    if (it.data.draftUrl) out.push(`<button class="ghost" data-act="open" data-url="${esc(it.data.draftUrl)}">Open Gmail draft</button>`);
    if (it.publishError) out.push(`<p class="hint">Last publish attempt failed: ${esc(it.publishError)}</p>`);
    if (it.review && it.status === "pending") out.push(`<p class="hint">Claude's review: ${it.review.score}/10. ${esc(it.review.issue)}</p>`);
    return out.join("");
  }

  async function diagnostics() {
    const out = [];
    const check = async (name, fn) => { const t0 = Date.now(); try { const r = await fn(); out.push([name, true, r || `OK (${Date.now() - t0} ms)`]); } catch (e) { out.push([name, false, e.message || String(e)]); } };
    out.push(["Running as", true, IN_CLAUDE ? "Inside Claude" : IS_NATIVE ? "Android app" : "Web browser"]);
    await check("Saving data", async () => { await Store.setConfig({ diagAt: U.now() }); return S.mode === "claude" ? "Artifact database" : "This device"; });
    await check("Claude", async () => { if (!Claude.available()) throw new Error(Claude.why()); const r = await Claude.json('Reply with the JSON {"ok": true}'); if (!r || !r.ok) throw new Error("Unexpected answer"); });
    await check("Files (download / share)", async () => { if (!window.jspdf || !window.JSZip) throw new Error("PDF or ZIP library missing"); return "Ready"; });
    if (IS_NATIVE) {
      await check("Web access", async () => { await Web.text("https://api.github.com/zen"); });
      await check("Etsy", async () => { if (!Etsy.connected()) throw new Error("Not connected (Settings)"); const t = await Etsy.token(); await Etsy.api("GET", `/shops/${t.shop_id}`); return `Connected to ${t.shop_name}`; });
      await check("Gumroad", async () => { const k = LS.get("eb_gumroad", ""); if (!k) throw new Error("No token (Settings)"); await Web.json(`https://api.gumroad.com/v2/user?access_token=${encodeURIComponent(k)}`); });
    }
    if (IN_CLAUDE) {
      await check("Gmail", async () => { if (!mcp) throw new Error("Connected apps unavailable here"); const l = await mcp.listTools(GMAIL); if (!l.servers.length) throw new Error("Add Gmail in claude.ai Settings > Connectors"); return "Available"; });
      await check("Metricool", async () => { if (!auto().metricool) throw new Error("Pick a brand in Settings"); return auto().metricool.label; });
    }
    return out;
  }
  async function reminders() {
    const P = window.Capacitor && window.Capacitor.Plugins, N = P && P.LocalNotifications; if (!IS_NATIVE || !N) return;
    try {
      await N.cancel({ notifications: [{ id: 101 }] });
      if (!auto().autopilot) return;
      const perm = await N.requestPermissions(); if (perm.display !== "granted") return;
      await N.schedule({ notifications: [{ id: 101, title: "Your bots are ready", body: "Open Earning Bots so autopilot can make today's products and sync sales.", schedule: { on: { hour: 9, minute: 0 }, allowWhileIdle: true } }] });
    } catch { /* reminders are optional */ }
  }

  setTimeout(() => Etsy.finish(), 1500);
  window.EB_AUTO = { diagnostics, reminders, afterRun, approve, periodic, syncSales, approveField, homeCard, settingsSection, handleAct, handleSubmit, itemActions, Etsy, Metricool };
})();
