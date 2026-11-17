/* Printify (shirt designs become real products, published to your Etsy or Shopify store) and
   Pinterest (pins posted to a board). Both run in the Android app, where the native layer can reach their APIs. */
(function () {
  "use strict";
  const { U, LS, Store, Web, Files, IS_NATIVE } = window.EB;
  const M = window.EB_MEDIA;
  const S = Store.S;

  async function b64(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function req(base, token, method, path, body) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "EarningBots/3" }, body: body ? JSON.stringify(body) : undefined });
      const txt = await res.text();
      if (res.ok) return txt ? JSON.parse(txt) : {};
      if ((res.status === 429 || res.status >= 500) && attempt < 2) { await U.sleep(2000 * (attempt + 1)); continue; }
      let msg = txt.slice(0, 220); try { const j = JSON.parse(txt); msg = j.message || j.error || msg; if (j.errors) msg += " " + JSON.stringify(j.errors).slice(0, 160); } catch { /* text */ }
      throw new Error(`${new URL(base).hostname.split(".").slice(-2, -1)[0]} ${res.status}: ${msg}`);
    }
  }

  // ---- Printify --------------------------------------------------------------------------------
  const PF = "https://api.printify.com/v1";
  const Printify = {
    ready: () => IS_NATIVE && !!LS.get("eb_printify_token", "") && !!LS.get("eb_printify_shop", null),
    api: (method, path, body) => req(PF, LS.get("eb_printify_token", ""), method, path, body),
    async shops() { return await Printify.api("GET", "/shops.json"); },
    async blueprint() {
      const cached = LS.get("eb_printify_bp", null); if (cached && cached.variants) return cached;
      const bps = await Printify.api("GET", "/catalog/blueprints.json");
      const bp = bps.find(b => /unisex jersey short sleeve tee/i.test(b.title)) || bps.find(b => /unisex.*tee/i.test(b.title));
      if (!bp) throw new Error("Couldn't find a unisex tee in the Printify catalog.");
      const providers = await Printify.api("GET", `/catalog/blueprints/${bp.id}/print_providers.json`);
      for (const pr of providers.slice(0, 6)) {
        const v = await Printify.api("GET", `/catalog/blueprints/${bp.id}/print_providers/${pr.id}/variants.json`);
        const variants = (v.variants || []).map(x => ({ id: x.id, color: (x.options || {}).color || x.title.split(" / ")[0], size: (x.options || {}).size || x.title.split(" / ")[1] }));
        if (variants.length) { const out = { id: bp.id, title: bp.title, provider: pr.id, providerName: pr.title, variants }; LS.set("eb_printify_bp", out); return out; }
      }
      throw new Error("No print provider offers this tee right now.");
    },
    // Resumable: upload, product and publish steps are saved, so a retry never makes a second product
    async publish(it) {
      const issues = window.EB_AUTO.validate(it); if (issues.length) throw new Error("Fix before publishing: " + issues.join("; "));
      const shop = LS.get("eb_printify_shop", null), bp = await Printify.blueprint();
      const save = async job => { await Store.patch("items", it.id, { data: { ...S.items[it.id].data, printifyJob: job } }); return job; };
      let d = S.items[it.id].data, job = { ...(d.printifyJob || {}) };
      if (!job.uploadId) {
        const cv = M.designCanvas(it, 4500), art = await Files.canvasBlob(cv); cv.width = 0;
        const up = await Printify.api("POST", "/uploads/images.json", { file_name: `${U.slug(d.slogan).slice(0, 40)}.png`, contents: await b64(art) });
        job = await save({ uploadId: up.id });
      }
      if (!job.productId) {
        const pal = M.INKS[d.palette % M.INKS.length], darkShirt = !/^#[ef]/i.test(pal.shirt);
        const wantColors = darkShirt ? ["Black", "Navy", "Dark Grey Heather", "Heather Forest"] : ["White", "Natural", "Athletic Heather", "Heather Peach"];
        const sizes = ["S", "M", "L", "XL", "2XL"];
        const picked = bp.variants.filter(v => wantColors.includes(v.color) && sizes.includes(v.size));
        if (!picked.length) throw new Error("No matching shirt colours at this print provider.");
        const price = Math.round((Number(it.price) || 24.99) * 100);
        const disclosure = d.aiUsed ? "\n\nDesign note: the slogan was written with AI assistance and the design was created and reviewed by our shop." : "";
        const product = await Printify.api("POST", `/shops/${shop.id}/products.json`, {
          title: String(d.title).slice(0, 140), description: `${d.description}${disclosure}`, tags: (d.tags || []).slice(0, 13),
          blueprint_id: bp.id, print_provider_id: bp.provider,
          variants: picked.map(v => ({ id: v.id, price: v.size === "2XL" ? price + 300 : price, is_enabled: true })),
          print_areas: [{ variant_ids: picked.map(v => v.id), placeholders: [{ position: "front", images: [{ id: job.uploadId, x: 0.5, y: 0.42, scale: 0.9, angle: 0 }] }] }],
        });
        job = await save({ ...job, productId: product.id });
      }
      if (!job.published) {
        await Printify.api("POST", `/shops/${shop.id}/products/${job.productId}/publish.json`, { title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: true });
        job = await save({ ...job, published: true });
      }
      d = S.items[it.id].data;
      await Store.patch("items", it.id, { status: "listed", links: { ...(it.links || {}), Printify: `https://printify.com/app/store/products/${job.productId}` }, data: { ...d, printifyId: job.productId }, publishError: "" });
      window.EB.Log.add("info", `Printify product ${job.productId} published`);
    },
  };

  // ---- Pinterest ------------------------------------------------------------------------------
  const PIN = "https://api.pinterest.com/v5";
  const Pinterest = {
    ready: () => IS_NATIVE && !!LS.get("eb_pinterest_token", "") && !!LS.get("eb_pinterest_board", null),
    api: (method, path, body) => req(PIN, LS.get("eb_pinterest_token", ""), method, path, body),
    async boards() { const r = await Pinterest.api("GET", "/boards?page_size=50"); return (r.items || []).map(b => ({ id: b.id, name: b.name })); },
    async post(it, canvas) {
      const board = LS.get("eb_pinterest_board", null), d = it.data;
      const blob = await Files.canvasBlob(canvas, "image/jpeg", 0.9);
      const body = { board_id: board.id, title: String(d.pinTitle || it.title).slice(0, 100), description: String(d.pinDescription || "").slice(0, 500), alt_text: String(d.headline || it.title).slice(0, 500),
        media_source: { source_type: "image_base64", content_type: "image/jpeg", data: await b64(blob) } };
      const link = d.link || Object.values((S.items[d.sourceId] || {}).links || {})[0]; if (link) body.link = link;
      const pin = await Pinterest.api("POST", "/pins", body);
      await Store.patch("items", it.id, { status: "listed", links: { ...(it.links || {}), Pinterest: `https://www.pinterest.com/pin/${pin.id}/` }, publishError: "" });
    },
  };

  window.EB_CONNECT = { Printify, Pinterest };
})();
