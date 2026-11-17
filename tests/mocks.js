// Browser-side fakes used by the test suite. Each is injected before the app loads.

// Inside Claude: fake Claude (sample) and connectors (mcp)
export const claudeMode = () => {
  window.__calls = [];
  const fake = async prompt => {
    await new Promise(r => setTimeout(r, 20));
    const ids = [...prompt.matchAll(/"id":"([^"]+)"/g)].map(m => m[1]);
    if (prompt.includes('{"ok": true}')) return { ok: true };
    if (prompt.includes("quality reviewer")) return ids.map((id, i) => ({ id, score: i % 3 === 2 ? 5 : 9, issue: i % 3 === 2 ? "Title too vague" : "" }));
    if (prompt.includes("market researcher")) return [{ keyword: "pickleball gifts for men", type: "shirt", demand: 8, competition: 4, angle: "Funny pickleball shirts" }, { keyword: "homeschool planner printable", type: "printable", demand: 7, competition: 5, angle: "Undated homeschool planner" }];
    if (prompt.includes("best product type")) return [];
    if (prompt.includes("printable bundles")) return [{ name: "Teacher Lesson Planner Bundle", pages: ["weekly_planner", "todo_list"], intro: "Plan lessons fast.", tags: ["teacher planner", "lesson planner"], price: 5.5, theme: "Ocean" }];
    if (prompt.includes("word search book")) return { theme: "Gardening", lists: Array.from({ length: 25 }, (_, i) => ({ topic: "Garden " + (i + 1), words: "TOMATO CARROT SHOVEL RAKE SEEDS SOIL COMPOST WATERING FLOWERS TULIP ROSE DAISY HEDGE LAWN MOWER WEEDS BASIL MINT THYME SAGE".split(" ") })) };
    if (prompt.includes("slogan")) return [{ lines: ["REEL COOL", "GRANDPA"], niche: "fishing", title: "Reel Cool Grandpa Fishing Shirt", tags: ["fishing", "grandpa"], description: "A fun gift for the grandpa who would rather be fishing. Soft, comfy and made to order." }];
    if (prompt.includes("carousel")) return [{ hook: "5 history facts", slides: ["a", "b", "c", "d"], cta: "Follow", caption: "c", hashtags: ["h"], script: "s" }];
    if (prompt.includes("niche website")) return [{ keyword: "k", title: "Best Pour Over Coffee Makers", meta: "m", markdown: "## Hi\ntext" }];
    if (prompt.includes("uplifting quotes")) return ["Bloom where you are planted", "Little by little becomes a lot"];
    if (prompt.includes("short ebook")) return { title: "Meal Prep on a Budget", subtitle: "A simple plan", kicker: "Guide", description: "Inside: plans and lists for busy families, with simple steps to follow every week.", tags: ["meal prep"], price: 7, chapters: Array.from({ length: 6 }, (_, i) => ({ title: "Chapter " + (i + 1), body: "## Start\nText.\n- one\n- two" })) };
    if (prompt.includes("newsletter")) return { title: "Your money this week", meta: "m", keyword: "budget", markdown: "## One\ntext" };
    if (prompt.includes("standalone social posts")) return ["Tip: finish one product before starting the next.", "Most side income fails because nobody ships."];
    if (prompt.includes("service listings")) return [{ title: "I will set up your Shopify store", description: "d", packages: [{ name: "Basic", price: "40 USD", delivery: "3 days", includes: "x" }], faq: [], tags: ["shopify"], requirements: "r" }];
    if (prompt.includes("Etsy SEO expert")) return ids.map(id => ({ id, title: "Optimized Printable Planner Title " + id.slice(-4), tags: ["printable planner", "undated planner"] }));
    if (prompt.includes("cold outreach")) return [{ subject: "Website for Cafe Luna?", body: "Hi" }, { subject: "x", body: "y" }];
    return [];
  };
  const sample = p => fake(p); sample.json = fake;
  const mcp = {
    callTool: async (server, tool, input) => { window.__calls.push([server, tool, input]); if (tool === "getBrandSettings") return { payload: { brands: [{ id: 123, label: "Brand", timezone: "Europe/Belgrade" }] } }; return { payload: { id: "d1", viewUrl: "https://mail.google.com/x" } }; },
    listTools: async () => ({ servers: [{ server: "Gmail", tools: [] }] }),
  };
  window.claude = { use: async n => (n === "sample" ? sample : n === "mcp" ? mcp : null) };
};

// Android app: native flag plus fake Etsy / Printify / Pinterest / search servers.
// window.__fail = { "files": 1 } makes the first Etsy file upload fail, to test resuming.
export const androidMode = () => {
  window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("eb_etsy_key", "KEY"); set("eb_etsy_secret", "SEC");
  set("eb_etsy_token", { access_token: "1.abc", refresh_token: "r", expires_at: Date.now() + 3600e3, shop_id: 77, shop_name: "TestShop" });
  set("eb_printify_token", "PT"); set("eb_printify_shop", { id: 5, title: "Printify shop" });
  set("eb_pinterest_token", "PIN"); set("eb_pinterest_board", { id: "b1", name: "Planners" });
  window.__req = []; window.__fail = window.__fail || {};
  let listingN = 900;
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const real = window.fetch;
  window.fetch = async (url, opt = {}) => {
    url = String(url); if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) return real(url, opt);
    const body = opt.body instanceof FormData ? "[form]" : typeof opt.body === "string" ? opt.body : "";
    window.__req.push([opt.method || "GET", url.replace(/\?.*/, ""), body]);
    if (url.includes("suggestqueries")) { const q = decodeURIComponent(url.split("q=")[1]); return J([q, [q + " printable", q + " for women"]]); }
    if (url.includes("completion.amazon")) return J({ suggestions: [{ value: "teacher gift ideas" }] });
    if (url.includes("/listings/active")) return J({ count: 12000, results: [{ num_favorers: 80, views: 900, price: { amount: 499, divisor: 100 } }] });
    if (url.includes("seller-taxonomy")) return J({ results: [{ id: 1, name: "Paper & Party Supplies", children: [{ id: 2, name: "Paper", children: [{ id: 2078, name: "Calendars & Planners", children: [] }] }] }, { id: 66, name: "Art & Collectibles", children: [{ id: 3000, name: "Prints", children: [{ id: 3001, name: "Digital Prints", children: [] }] }] }, { id: 70, name: "Books", children: [{ id: 4000, name: "Educational Worksheets", children: [] }] }] });
    if (/\/shops\/77\/listings$/.test(url.replace(/\?.*/, "")) && opt.method === "POST") return J({ listing_id: ++listingN });
    if (url.includes("/files") && opt.method === "POST" && window.__fail.files > 0) { window.__fail.files--; return J({ error: "Temporary upload problem" }, 400); }
    if (url.includes("api.etsy.com")) return J({ results: [] });
    if (url.includes("catalog/blueprints.json")) return J([{ id: 12, title: "Unisex Jersey Short Sleeve Tee" }]);
    if (url.includes("print_providers.json")) return J([{ id: 29, title: "Provider" }]);
    if (url.includes("variants.json")) return J({ variants: ["Black", "Navy", "White"].flatMap((c, i) => ["S", "M", "L", "XL", "2XL"].map((s, k) => ({ id: 100 + i * 10 + k, title: `${c} / ${s}`, options: { color: c, size: s } }))) });
    if (url.includes("uploads/images.json")) return J({ id: "img1" });
    if (url.includes("/products.json")) return J({ id: "prod" + Math.random().toString(36).slice(2, 6) });
    if (url.includes("api.printify.com")) return J({});
    if (url.includes("api.pinterest.com/v5/pins")) return J({ id: "pin123" });
    if (url.includes("api.pinterest.com")) return J({ items: [{ id: "b1", name: "Planners" }] });
    return J({});
  };
};
