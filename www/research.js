/* Niche research (demand vs competition), winners tracking and one-tap variations.
   Research sources (Android app): Google and Amazon search suggestions for demand, Etsy's public
   listing search for competition and buyer interest. Inside Claude, where pages can't reach other
   websites, it falls back to Claude's own estimate and labels it as an estimate. */
(function () {
  "use strict";
  const { U, LS, Store, Claude, Web } = window.EB;
  const { BOTS, KINDS } = window.EB_BOTS;
  const D = window.EB_DESIGNS, M = window.EB_MEDIA, A = window.EB_ART;
  const S = Store.S;

  // ---- winners: what sells, gets favorites or views --------------------------------------------
  function itemScore(it) {
    const st = (it.data && it.data.stats) || {};
    const sales = Object.values(S.earnings).filter(e => e.itemId === it.id).length;
    return sales * 10 + (st.favorites || 0) * 2 + (st.views || 0) * 0.1;
  }
  // map of attribute value -> weight among items of a kind (e.g. bundleKey, style, niche, theme)
  function prefer(kind, attr) {
    const w = {};
    for (const it of Object.values(S.items)) {
      if (it.kind !== kind) continue;
      const v = typeof attr === "function" ? attr(it) : it.data[attr]; if (v == null) continue;
      const s = itemScore(it); if (s > 0) w[v] = (w[v] || 0) + s;
    }
    return w;
  }
  function weightedPick(options, weights, base = 1) {
    const tot = options.reduce((a, o) => a + base + (weights[o] || 0), 0);
    let r = Math.random() * tot;
    for (const o of options) { r -= base + (weights[o] || 0); if (r <= 0) return o; }
    return options[options.length - 1];
  }
  function winners(n = 5) {
    return Object.values(S.items).map(it => [it, itemScore(it)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  // ---- variations of a product -----------------------------------------------------------------------
  async function variations(it, count = 3) {
    const base = { bot: it.bot, kind: it.kind, status: "pending", createdAt: U.now(), links: {} };
    const made = [];
    const save = async (id, title, data, price) => { await Store.save("items", id, { ...base, id, title, data, price: price ?? it.price }); made.push(title); };
    const d = it.data;
    if (it.kind === "printable") {
      for (const theme of U.shuffle(Object.keys(D.THEMES)).filter(t => t !== d.theme)) {
        if (made.length >= count) break;
        const id = `${d.bundleKey === "custom" ? "idea-" + U.slug(d.bundle.name).slice(0, 40) : d.bundleKey}-${theme.toLowerCase()}`;
        if (S.items[id]) continue;
        const copy = D.listingCopy(d.bundle, theme);
        await save(id, copy.shortName, { ...d, theme, ...copy, stats: undefined, etsyId: undefined, optimizedAt: undefined });
      }
    } else if (it.kind === "wallart") {
      for (let i = 0; i < count; i++) await save(`wallart-${U.uid()}`, it.title, { ...d, palette: (d.palette + 1 + i) % A.ART_PALETTES.length, seed: Math.floor(Math.random() * 1e9), stats: undefined, etsyId: undefined, title: d.title.replace(/(Sage|Terracotta|Blush|Navy & Mustard|Ocean|Mono)/, A.ART_PALETTES[(d.palette + 1 + i) % A.ART_PALETTES.length].name) });
    } else if (it.kind === "design") {
      for (const style of M.STYLES.filter(s => s !== d.style).slice(0, count)) await save(`design-${U.uid()}`, it.title, { ...d, style, palette: Math.floor(Math.random() * M.INKS.length), stats: undefined });
    } else if (it.kind === "kdpbook") {
      for (let i = 0; i < count; i++) {
        const nd = { ...d, seeds: d.seeds ? d.seeds.map(() => Math.floor(Math.random() * 2 ** 31)) : undefined, seed: Math.floor(Math.random() * 1e9), palette: (d.palette || 0) + 1 + i, stats: undefined };
        if (d.type === "notebook") { nd.style = ["lined", "dot", "graph", "journal"][(["lined", "dot", "graph", "journal"].indexOf(d.style) + 1 + i) % 4]; nd.title = nd.title.replace(/Lined|Dot Grid|Graph Paper|Dated Journal/, { lined: "Lined", dot: "Dot Grid", graph: "Graph Paper", journal: "Dated Journal" }[nd.style]); }
        else nd.title = `${d.title.replace(/ \(Volume \d+\)$/, "")} (Volume ${i + 2})`;
        await save(`kdpbook-${U.uid()}`, nd.title, nd);
      }
    } else if (it.kind === "worksheet") {
      for (let i = 0; i < count; i++) await save(`worksheet-${U.uid()}`, `${d.title} (Set ${i + 2})`, { ...d, seeds: d.seeds.map(() => Math.floor(Math.random() * 2 ** 31)), title: `${d.title} (Set ${i + 2})`, palette: (d.palette || 0) + i + 1 });
    } else throw new Error("Variations aren't available for this kind of item.");
    return made.length;
  }

  // ---- research ------------------------------------------------------------------------------------------------
  const TYPES = { printable: "Printable", shirt: "Shirt / sticker design", notebook: "Notebook / journal", wallart: "Wall art", wordsearch: "Word search book", coloring: "Coloring book", ebook: "Ebook / guide" };
  function guessType(k) {
    k = k.toLowerCase();
    if (/shirt|tee|sticker|hoodie|mug/.test(k)) return "shirt";
    if (/notebook|journal|log ?book|diary/.test(k)) return "notebook";
    if (/wall art|print|poster|decor/.test(k)) return "wallart";
    if (/word search|word find|puzzle/.test(k)) return "wordsearch";
    if (/coloring|colouring/.test(k)) return "coloring";
    if (/guide|ebook|course|how to/.test(k)) return "ebook";
    return "printable";
  }
  async function suggest(q) {
    const out = new Set();
    try { const r = await Web.json(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`); (r[1] || []).forEach(s => out.add(String(s).toLowerCase())); } catch { /* source down */ }
    try { const r = await Web.json(`https://completion.amazon.com/api/2017/suggestions?prefix=${encodeURIComponent(q)}&mid=ATVPDKIKX0DER&alias=aps&limit=10`); (r.suggestions || []).forEach(s => out.add(String(s.value).toLowerCase())); } catch { /* source down */ }
    return [...out];
  }
  async function etsyStats(keyword) {
    const key = window.EB_AUTO && window.EB_AUTO.Etsy.key(); if (!key) return null;
    const r = await Web.json(`https://api.etsy.com/v3/application/listings/active?keywords=${encodeURIComponent(keyword)}&limit=25&sort_on=score`, { "x-api-key": key });
    const res = r.results || []; if (!res.length) return { count: r.count || 0, fav: 0, views: 0, price: 0 };
    const avg = f => res.reduce((a, x) => a + (Number(x[f]) || 0), 0) / res.length;
    return { count: r.count || 0, fav: Math.round(avg("num_favorers")), views: Math.round(avg("views")), price: Math.round(res.reduce((a, x) => a + (x.price ? x.price.amount / x.price.divisor : 0), 0) / res.length * 100) / 100 };
  }
  function score(n) {
    // demand: autocomplete presence + favorites/views of top listings; competition: number of active listings
    const demand = (n.suggestHits || 0) * 8 + (n.etsy ? Math.min(60, n.etsy.fav) + Math.min(30, n.etsy.views / 50) : 0);
    const comp = n.etsy ? Math.log10(Math.max(10, n.etsy.count)) : 3.5;
    return Math.round(Math.max(1, Math.min(100, demand / comp * 3)));
  }

  BOTS.splice(0, 0, {
    id: "niche_research", title: "Niche Research Bot", icon: "search", category: "Research", earnsVia: "Picks what the other bots should make",
    desc: "Finds product ideas buyers search for, checks how crowded each one is on Etsy, scores them and feeds the best ones to your other bots.",
    needs: [], uses: ["web", "claude"],
    settings: [{ key: "seeds", label: "Starting keywords", type: "text", def: "planner, teacher gift, nurse gift, wall art, coloring book, word search, journal", placeholder: "comma separated" },
      { key: "perRun", label: "Niches to check per run", type: "number", def: 12, min: 5, max: 25 },
      { key: "autoUse", label: "Feed the best niches to other bots automatically", type: "select", def: "on", options: [["on", "Yes"], ["off", "No, I'll choose"]] }],
    async run(ctx) {
      const seeds = String(ctx.cfg.seeds || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const known = new Set(Object.values(S.items).filter(i => i.kind === "niche").map(i => i.data.keyword));
      let found = [], estimated = false;
      if (Web.available()) {
        const pool = new Map();
        for (const s of seeds) {
          ctx.progress(`Looking up searches for “${s}”...`);
          for (const q of [s, `${s} for`, `${s} printable`]) for (const k of await suggest(q)) {
            if (k.length < 6 || k.length > 50 || known.has(k)) continue;
            pool.set(k, (pool.get(k) || 0) + 1);
          }
        }
        const cand = [...pool.entries()].sort((a, b) => b[1] - a[1]).slice(0, ctx.cfg.perRun);
        for (const [k, hits] of cand) {
          ctx.progress(`Checking competition for “${k}”...`);
          let etsy = null; try { etsy = await etsyStats(k); } catch { etsy = null; }
          found.push({ keyword: k, suggestHits: hits, etsy, type: guessType(k) });
          await U.sleep(250);
        }
        if (!found.length) throw new Error("No search suggestions came back. Check your connection.");
      } else if (Claude.available()) {
        estimated = true;
        const r = await Claude.json(`Act as an Etsy and Amazon KDP market researcher. Based on your general knowledge (you have no live data), suggest ${ctx.cfg.perRun} specific, long-tail product niches related to: ${seeds.join(", ")}. Favor niches with steady buyer demand and less competition than generic terms. Not these: ${[...known].slice(-40).join("; ") || "none"}.
Return a JSON array of {"keyword": search phrase buyers type, "type": one of ${Object.keys(TYPES).join(", ")}, "demand": 1-10, "competition": 1-10, "angle": one sentence on what to make}.`);
        found = (Array.isArray(r) ? r : []).filter(x => x.keyword).map(x => ({ keyword: String(x.keyword).toLowerCase().slice(0, 60), type: TYPES[x.type] ? x.type : guessType(x.keyword), est: { demand: Number(x.demand) || 5, competition: Number(x.competition) || 5 }, angle: U.clampStr(x.angle, 200) }));
      } else throw new Error("Research needs the Android app (live data) or Claude (estimates).");

      if (Claude.available() && !estimated && found.length) {
        try {
          ctx.progress("Asking Claude for product angles...");
          const r = await Claude.json(`For each Etsy/KDP search keyword, give the best product type to make (${Object.keys(TYPES).join(", ")}) and a one-sentence angle that would stand out. Keywords: ${JSON.stringify(found.map(f => f.keyword))}. Return a JSON array of {"keyword": "...", "type": "...", "angle": "..."} in the same order.`);
          (Array.isArray(r) ? r : []).forEach((x, i) => { if (found[i] && TYPES[x.type]) { found[i].type = x.type; found[i].angle = U.clampStr(x.angle, 200); } });
        } catch { /* angles are optional */ }
      }
      for (const f of found) {
        f.score = f.est ? Math.round(Math.max(1, Math.min(100, f.est.demand * 10 - f.est.competition * 5 + 30))) : score(f);
        f.estimated = !!f.est;
        await ctx.add("niche", f.keyword, f, { status: "new" });
      }
      const top = found.slice().sort((a, b) => b.score - a.score).slice(0, 3);
      if (ctx.cfg.autoUse === "on") for (const t of top) await useNiche(t);
      return `${found.length} niches scored${estimated ? " (estimates, no live data here)" : ""}. Best: ${top.map(t => `“${t.keyword}” ${t.score}`).join(", ")}.${ctx.cfg.autoUse === "on" ? " Fed to your bots." : ""}`;
    },
  });

  // feed a niche to the bot that makes that kind of product
  async function useNiche(n) {
    const add = async (botId, key, value) => {
      const cur = String(Store.botConfig(botId)[key] ?? (BOTS.find(b => b.id === botId)?.settings || []).find(s => s.key === key)?.def ?? "");
      const parts = cur.split(",").map(s => s.trim()).filter(Boolean);
      if (!parts.map(p => p.toLowerCase()).includes(value.toLowerCase())) parts.unshift(value);
      await Store.setBotConfig(botId, { [key]: parts.slice(0, 8).join(", ") });
    };
    const clean = (txt, words) => txt.replace(new RegExp(`\\b(${words})\\b`, "gi"), " ").replace(/\s+/g, " ").trim();
    const k = n.keyword, generic = "gifts? for (men|women|him|her|kids|dad|mom)|gifts?|ideas?|funny|best|cute|for";
    if (n.type === "shirt") await add("pod_designs", "niches", clean(k, `t-?shirts?|tshirts?|shirts?|tees?|stickers?|hoodies?|mugs?|${generic}`) || k);
    else if (n.type === "notebook") await add("notebooks", "themes", clean(k, `notebooks?|journals?|diary|log ?book|${generic}`) || k);
    else if (n.type === "ebook") await add("ebook_bot", "niche", k);
    else if (n.type === "wallart") await add("wall_art", "focus", clean(k, `wall art|prints?|posters?|decor|printable|digital download|${generic}`) || k);
    else if (n.type === "wordsearch" || n.type === "coloring") await add("puzzle_books", "themes", clean(k, `word search|word find|coloring|colouring|books?|adults?|large print|puzzles?|${generic}`) || k);
    else await add("idea_bot", "focus", k);
    const item = Object.values(S.items).find(i => i.kind === "niche" && i.data.keyword === k);
    if (item) await Store.patch("items", item.id, { status: "using" });
  }

  KINDS.niche = {
    label: "Niche", plural: "Niches", icon: "search", platforms: [], pipeline: ["new", "using", "skipped"],
    thumb: null, kit: null,
    copy: it => [["Keyword", it.data.keyword]],
    summary: it => `Score ${it.data.score}/100 · ${TYPES[it.data.type] || it.data.type}${it.data.etsy ? ` · ${it.data.etsy.count.toLocaleString()} on Etsy` : it.data.estimated ? " · estimate" : ""}`,
  };

  window.EB_WIN = { itemScore, prefer, weightedPick, winners, variations, useNiche, TYPES };
})();
