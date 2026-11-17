/* Earning Bots: every worker bot, and every kind of thing they make.
   Add a bot: append to BOTS with id, title, desc, icon, category, earnsVia, needs, settings and an async run(ctx). */
(function () {
  "use strict";
  const { U, Store, Claude, Web, Files } = window.EB;
  const D = window.EB_DESIGNS, P = window.EB_PUZZLES, M = window.EB_MEDIA;

  const PLATFORMS = ["Etsy", "Gumroad", "Amazon KDP", "Redbubble", "Merch by Amazon", "TikTok", "YouTube", "Instagram", "Affiliate", "Client work", "Upwork / Fiverr", "Resale", "Other"];

  // ---- listing copy helpers ------------------------------------------------------------------
  function bookCopy(d) {
    const lvl = d.level ? d.level[0].toUpperCase() + d.level.slice(1) : "";
    if (d.type === "sudoku") {
      return {
        title: `Large Print Sudoku for Adults: ${d.count} ${lvl} Puzzles`,
        subtitle: `One Puzzle per Page with Solutions. Big 8.5 x 11 Book for Seniors and Beginners`,
        keywords: ["large print sudoku", "sudoku puzzle book adults", `${d.level} sudoku`, "sudoku for seniors", "brain games for adults", "puzzle books for adults large print", "logic puzzles gift"],
        categories: ["Humor & Entertainment > Puzzles & Games > Sudoku", "Humor & Entertainment > Puzzles & Games > Logic & Brain Teasers"],
        description: `Sharpen your mind with ${d.count} ${d.level} Sudoku puzzles, printed big and clear: one puzzle per page on large 8.5 x 11 inch pages.\n\n- ${d.count} ${d.level}-level puzzles, each with exactly one solution\n- Large print numbers that are easy on the eyes\n- Full solutions at the back\n- Plenty of room to pencil in your notes\n\nA relaxing gift for parents, grandparents and puzzle lovers.`,
        price: 7.99,
      };
    }
    return {
      title: `${d.theme} Word Search for Adults: ${d.count} Large Print Puzzles`,
      subtitle: `Fun ${d.theme} Themed Word Find Book with Solutions. 8.5 x 11 Large Print for Seniors and Puzzle Lovers`,
      keywords: [`${d.theme.toLowerCase()} word search`, "large print word search", "word search for adults", "word find books for seniors", "puzzle books for adults", "word search gift", "brain games"],
      categories: ["Humor & Entertainment > Puzzles & Games > Word Search", "Humor & Entertainment > Puzzles & Games > Puzzles"],
      description: `Relax with ${d.count} ${d.theme.toLowerCase()} word search puzzles printed in large, easy-to-read letters.\n\n- ${d.count} themed puzzles, one per page\n- ${d.level === "hard" ? "Words hidden in all 8 directions for a real challenge" : "Words run across, down and diagonally"}\n- Big 15 x 15 grids on 8.5 x 11 inch pages\n- Solutions included at the back\n\nA perfect gift for word lovers of every age.`,
      price: 7.99,
    };
  }

  // ---- kinds -----------------------------------------------------------------------------
  const KINDS = {
    printable: {
      label: "Printable", plural: "Printables", icon: "file", platforms: ["Etsy", "Gumroad"],
      thumb: (it, w) => D.coverCanvas(asProduct(it), w),
      async kit(it) {
        const p = asProduct(it), zip = new window.JSZip(), stem = U.slug(p.shortName);
        const etsy = zip.folder("1-upload-to-etsy"), gum = zip.folder("2-upload-to-gumroad"), customer = new window.JSZip();
        for (const size of Object.keys(D.SIZES)) {
          const pdf = D.makePdf(p, size), low = D.makePdf(p, size, true);
          etsy.file(`${stem}-${size}.pdf`, pdf); customer.file(`${stem}-${size}.pdf`, pdf);
          etsy.file(`${stem}-${size}-low-ink.pdf`, low); customer.file(`${stem}-${size}-low-ink.pdf`, low);
        }
        customer.file("HOW-TO-PRINT.txt", "Thank you for your purchase!\n\n- The -A4 files are for A4 paper (Europe and most of the world).\n- The -US-Letter files are for US Letter paper (USA and Canada).\n- The -low-ink files print with far less ink.\n- Print at 100% / \"Actual size\" for the best result.\n");
        gum.file(`${stem}.zip`, await customer.generateAsync({ type: "blob" }));
        const cover = await Files.canvasBlob(D.coverCanvas(p, 2000)); etsy.file("01-cover.png", cover); gum.file("cover.png", cover);
        let i = 2; for (const key of p.bundle.pages.slice(0, 9)) etsy.file(`${String(i++).padStart(2, "0")}-${key}.png`, await Files.canvasBlob(D.pageCanvas(p, key, 2000)));
        zip.file("LISTING.txt", listingText(it, p.title, p.price, p.tags, p.description,
          `ETSY: Digital file listing. Photos from 1-upload-to-etsy (cover first), both PDFs as digital files.\nGUMROAD: New product, name it "${p.shortName}", upload the zip and cover.png.`));
        return { blob: await zip.generateAsync({ type: "blob" }), name: `${stem}-upload-kit.zip` };
      },
      copy: it => [["Title", it.data.title], ["Description", it.data.description], ["Tags", (it.data.tags || []).join(", ")]],
      summary: it => `${it.data.bundle.pages.length} pages · ${it.data.theme}`,
    },
    puzzlebook: {
      label: "Puzzle book", plural: "Puzzle books", icon: "book", platforms: ["Amazon KDP"],
      thumb: (it, w) => P.coverCanvas(it, w),
      async kit(it) {
        const d = it.data, zip = new window.JSZip(), stem = U.slug(d.title);
        const { blob, pages } = P.interiorPdf(it);
        zip.file(`${stem}-interior.pdf`, blob);
        zip.file(`${stem}-front-cover.png`, await Files.canvasBlob(P.coverCanvas(it, 2550)));
        zip.file("LISTING.txt", `KINDLE DIRECT PUBLISHING (kdp.amazon.com) > Create > Paperback\n\nAI-GENERATED CONTENT QUESTION\n${d.aiUsed ? "YES: the word lists were written with AI (Claude). Tick 'text' as AI-generated." : "NO: the puzzles, cover and text were generated by your own software, not by an AI model."}\nKDP allows about 3 new titles per day per account.\n\nTITLE\n${d.title}\n\nSUBTITLE\n${d.subtitle}\n\nAUTHOR\n${d.author || "your pen name"}\n\nDESCRIPTION\n${d.description}\n\n7 KEYWORDS\n${d.keywords.join("\n")}\n\nCATEGORIES\n${d.categories.join("\n")}\n\nPRINT OPTIONS\n- Ink and paper: Black & white interior with white paper\n- Trim size: 8.5 x 11 in\n- Bleed: No bleed\n- Cover finish: Matte\n- Interior: upload ${stem}-interior.pdf (${pages} pages)\n- Cover: use KDP Cover Creator and upload ${stem}-front-cover.png as the front image\n- Low-content book: No (it has puzzles and solutions)\n\nPRICE\n${d.price.toFixed(2)} USD (check the minimum KDP shows for ${pages} pages)\n`);
        return { blob: await zip.generateAsync({ type: "blob" }), name: `${stem}-kdp-kit.zip` };
      },
      copy: it => [["Title", it.data.title], ["Subtitle", it.data.subtitle], ["Description", it.data.description], ["Keywords", it.data.keywords.join("\n")]],
      summary: it => `${it.data.count} puzzles · ${it.data.type === "sudoku" ? it.data.level : it.data.theme}`,
    },
    design: {
      label: "Shirt design", plural: "Designs", icon: "shirt", platforms: ["Redbubble", "Merch by Amazon", "Etsy"],
      thumb: (it, w) => M.shirtMockup(it, w),
      async kit(it) {
        const d = it.data, zip = new window.JSZip(), stem = U.slug(d.slogan);
        zip.file(`${stem}-4500x5400.png`, await Files.canvasBlob(M.designCanvas(it, 4500)));
        zip.file(`${stem}-mockup.jpg`, await Files.canvasBlob(M.shirtMockup(it, 2000), "image/jpeg", 0.9));
        zip.file("LISTING.txt", `${listingText(it, d.title, d.price || 19.99, d.tags, d.description)}\nSHIRT COLOUR\n${M.INKS[d.palette % M.INKS.length].name}: use a ${M.INKS[d.palette % M.INKS.length].shirt.startsWith("#e") || M.INKS[d.palette % M.INKS.length].shirt.startsWith("#f") ? "light" : "dark"} shirt colour.\n\nBEFORE UPLOADING\nSearch the exact phrase on tmsearch.uspto.gov and euipo.europa.eu to make sure nobody owns it as a trademark.\n\nWHERE\n- Redbubble: Add new work, upload the PNG, enable all products\n- Merch by Amazon: Create, Standard T-shirt, upload the 4500 x 5400 PNG\n`);
        return { blob: await zip.generateAsync({ type: "blob" }), name: `${stem}-design-kit.zip` };
      },
      copy: it => [["Title", it.data.title], ["Description", it.data.description], ["Tags", (it.data.tags || []).join(", ")]],
      summary: it => `${it.data.style} · ${it.data.niche || ""}`,
    },
    content: {
      label: "Social post", plural: "Social posts", icon: "video", platforms: ["TikTok", "Instagram", "YouTube"],
      thumb: (it, w) => M.slideCanvas(it, 0, w),
      async kit(it) {
        const d = it.data, zip = new window.JSZip(), stem = U.slug(d.hook).slice(0, 40), n = (d.slides || []).length + 2;
        for (let i = 0; i < n; i++) zip.file(`slide-${i + 1}.png`, await Files.canvasBlob(M.slideCanvas(it, i, 1080)));
        zip.file("POST.txt", `PLATFORM\n${d.platform}\n\nCAPTION\n${d.caption}\n\n${(d.hashtags || []).map(h => "#" + h.replace(/^#/, "")).join(" ")}\n\nVOICEOVER SCRIPT (for a video version)\n${d.script}\n`);
        return { blob: await zip.generateAsync({ type: "blob" }), name: `${stem}-post.zip` };
      },
      copy: it => [["Caption", `${it.data.caption}\n\n${(it.data.hashtags || []).map(h => "#" + h.replace(/^#/, "")).join(" ")}`], ["Script", it.data.script]],
      summary: it => `${it.data.platform} · ${(it.data.slides || []).length + 2} slides`,
    },
    article: {
      label: "Article", plural: "Articles", icon: "doc", platforms: ["Affiliate", "Other"],
      thumb: null,
      async kit(it) {
        const d = it.data, zip = new window.JSZip(), stem = U.slug(d.title);
        zip.file(`${stem}.md`, `---\ntitle: "${d.title.replace(/"/g, "'")}"\ndescription: "${(d.meta || "").replace(/"/g, "'")}"\nkeyword: "${d.keyword}"\n---\n\n${d.markdown}\n`);
        zip.file(`${stem}.html`, `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${U.esc(d.title)}</title><meta name="description" content="${U.esc(d.meta)}"></head><body><article>\n<h1>${U.esc(d.title)}</h1>\n${M.mdToHtml(d.markdown)}\n</article></body></html>`);
        return { blob: await zip.generateAsync({ type: "blob" }), name: `${stem}.zip` };
      },
      copy: it => [["Title", it.data.title], ["Meta description", it.data.meta], ["Article (Markdown)", it.data.markdown], ["Article (HTML)", M.mdToHtml(it.data.markdown)]],
      summary: it => `“${it.data.keyword}” · ${Math.round((it.data.markdown || "").split(/\s+/).length / 10) * 10} words`,
    },
    lead: {
      label: "Lead", plural: "Leads", icon: "target", platforms: ["Client work"], pipeline: ["new", "contacted", "won", "lost"],
      thumb: null, kit: null,
      copy: it => [["Pitch", `${it.data.pitchSubject}\n\n${it.data.pitchBody}`]],
      summary: it => [it.data.category, it.data.address].filter(Boolean).join(" · "),
    },
    opportunity: {
      label: "Job", plural: "Jobs", icon: "briefcase", platforms: ["Upwork / Fiverr", "Client work"], pipeline: ["new", "applied", "won", "lost"],
      thumb: null, kit: null,
      copy: it => it.data.proposal ? [["Proposal", it.data.proposal]] : [],
      summary: it => [it.data.company, it.data.source, it.data.salary].filter(Boolean).join(" · "),
    },
    deal: {
      label: "Deal", plural: "Deals", icon: "tag", platforms: ["Resale"], pipeline: ["new", "bought", "sold", "skipped"],
      thumb: null, kit: null, copy: () => [],
      summary: it => `${U.fmt(Math.round(it.data.price * 100), it.data.currency || "EUR")} (target ${U.fmt(Math.round(it.data.target * 100), it.data.currency || "EUR")})`,
    },
  };

  function asProduct(it) {
    const d = it.data;
    return { sku: it.id, bundle: d.bundle, theme: d.theme, shortName: d.shortName, title: d.title, description: d.description, tags: d.tags, price: d.price };
  }
  function listingText(it, title, price, tags, description, extra = "") {
    return `TITLE\n${title}\n\nPRICE\n${Number(price).toFixed(2)}\n\nTAGS\n${(tags || []).join(", ")}\n\nDESCRIPTION\n${description}\n\n${extra}\n`;
  }

  // ---- bots ------------------------------------------------------------------------------
  const BOTS = [
    {
      id: "product_factory", title: "Product Factory", icon: "file", category: "Make & sell", earnsVia: "Etsy, Gumroad",
      desc: "Designs printable planner PDFs in A4 and US Letter, renders the Etsy photos and writes the listing.",
      needs: [], settings: [{ key: "perRun", label: "Products per run", type: "number", def: 3, min: 1, max: 10 }],
      async run(ctx) {
        const todo = [];
        for (const b of Object.keys(D.BUNDLES)) for (const t of Object.keys(D.THEMES)) if (!Store.S.items[`${b}-${t.toLowerCase()}`]) todo.push([b, t]);
        if (!todo.length) return "The catalogue is complete. Run the Idea Bot for new products.";
        const counts = {}; Object.values(Store.S.items).forEach(i => { if (i.kind === "printable") counts[i.data.bundleKey] = (counts[i.data.bundleKey] || 0) + 1; });
        const win = window.EB_WIN ? window.EB_WIN.prefer("printable", "bundleKey") : {};
        const pickList = U.shuffle(todo).sort((a, b) => ((counts[a[0]] || 0) - (win[a[0]] || 0) * 3) - ((counts[b[0]] || 0) - (win[b[0]] || 0) * 3)).slice(0, ctx.cfg.perRun);
        for (const [bk, theme] of pickList) await addPrintable(ctx, `${bk}-${theme.toLowerCase()}`, bk, { ...D.BUNDLES[bk] }, theme);
        return `${pickList.length} printables ready to review. ${todo.length - pickList.length} more in the catalogue.`;
      },
    },
    {
      id: "idea_bot", title: "Idea Bot", icon: "spark", category: "Make & sell", earnsVia: "Etsy, Gumroad",
      desc: "Asks Claude for printable bundles aimed at buyer niches (teachers, nurses, weddings, pets...) and builds them.",
      needs: ["claude"], settings: [{ key: "perRun", label: "Ideas per run", type: "number", def: 3, min: 1, max: 6 },
        { key: "focus", label: "Niches to focus on (optional)", type: "text", def: "", placeholder: "e.g. teachers, nurses, homeschool" }],
      async run(ctx) {
        const existing = Object.values(Store.S.items).filter(i => i.kind === "printable").map(i => i.data.bundle.name);
        const pages = Object.entries(D.LAYOUTS).map(([k, v]) => `${k} (${v[0]})`).join(", "), themes = Object.keys(D.THEMES);
        const ideas = await Claude.json(`You research products for a printable planner shop on Etsy.
Suggest ${ctx.cfg.perRun} NEW printable bundles aimed at specific buyer niches that sell well on Etsy${ctx.cfg.focus ? ` (focus on: ${ctx.cfg.focus})` : " (for example teachers, nurses, students, new parents, small business owners, wedding planning, pet owners, homeschool)"}. Each bundle may ONLY use these page designs: ${pages}.
Do not repeat these existing products: ${existing.slice(-60).join("; ") || "none"}.
Return a JSON array. Each item: {"name": product name in Title Case, max 45 characters, naming the niche; "pages": 2 to 6 page keys from the list; "intro": one sentence that sells it to the buyer; "tags": exactly 10 lowercase Etsy search tags of at most 20 characters; "price": number between 2.5 and 9.9; "theme": one of ${themes.join(", ")}}.`);
        if (!Array.isArray(ideas)) throw new Error("Claude didn't return a list.");
        let made = 0;
        for (const it of ideas) {
          const pg = (it.pages || []).filter(k => D.LAYOUTS[k]); if (!it.name || !pg.length) continue;
          const theme = themes.includes(it.theme) ? it.theme : U.pick(themes);
          const bundle = { name: U.clampStr(it.name, 60), pages: [...new Set(pg)].slice(0, 6), intro: U.clampStr(it.intro, 300), tags: (it.tags || []).map(String), price: Math.min(19.9, Math.max(1.5, Number(it.price) || 3.9)) };
          const id = `idea-${U.slug(bundle.name).slice(0, 40)}-${theme.toLowerCase()}`;
          if (Store.S.items[id]) continue;
          await addPrintable(ctx, id, "custom", bundle, theme); made++;
        }
        return made ? `${made} niche printables ready to review.` : "All ideas were duplicates. Run again.";
      },
    },
    {
      id: "puzzle_books", title: "Puzzle Book Bot", icon: "book", category: "Make & sell", earnsVia: "Amazon KDP",
      desc: "Generates large-print Sudoku and Word Search books with solutions, a front cover and the full KDP listing.",
      needs: [], uses: ["claude"],
      settings: [
        { key: "type", label: "Book type", type: "select", def: "mixed", options: [["mixed", "Alternate Sudoku and Word Search"], ["sudoku", "Sudoku"], ["wordsearch", "Word Search"]] },
        { key: "count", label: "Puzzles per book", type: "select", def: "100", options: [["50", "50"], ["100", "100"]] },
        { key: "author", label: "Author / pen name", type: "text", def: "", placeholder: "the name printed on the book" },
        { key: "themes", label: "Word search themes (from research)", type: "text", def: "", placeholder: "e.g. gardening, bible, cats" },
      ],
      async run(ctx) {
        const books = Object.values(Store.S.items).filter(i => i.kind === "puzzlebook").map(i => i.data);
        let type = ctx.cfg.type; if (type === "mixed") type = books.filter(b => b.type === "sudoku").length <= books.filter(b => b.type === "wordsearch").length ? "sudoku" : "wordsearch";
        const count = Math.min(100, parseInt(ctx.cfg.count, 10) || 100);
        const spec = { type, count };
        if (type === "sudoku") {
          const used = books.filter(b => b.type === "sudoku").map(b => b.level);
          spec.level = ["medium", "easy", "hard"].sort((a, b) => used.filter(x => x === a).length - used.filter(x => x === b).length)[0];
        } else {
          const usedThemes = books.filter(b => b.type === "wordsearch").map(b => b.theme);
          spec.level = U.pick(["easy", "hard"]);
          if (Claude.available()) {
            ctx.progress("Asking Claude for a fresh theme...");
            const wanted = String(ctx.cfg.themes || "").split(",").map(s => s.trim()).filter(t => t && !usedThemes.map(u => u.toLowerCase()).includes(t.toLowerCase()));
            const res = await Claude.json(`Create content for a large-print word search book for adults that sells on Amazon KDP.
${wanted.length ? `Use this theme (it was researched as in demand): ${wanted[0]}.` : `Pick ONE popular theme not in this list: ${usedThemes.join(", ") || "none"}.`} Then give 25 puzzle topics within that theme, each with exactly 20 English words (single words, letters only, 4 to 12 letters, no proper nouns or brand names).
Return JSON: {"theme": short theme name like "Gardening", "lists": [{"topic": "...", "words": ["..."]}]}`);
            if (res && res.theme && Array.isArray(res.lists) && res.lists.length) {
              spec.aiUsed = true; spec.theme = U.clampStr(res.theme, 30); spec.lists = res.lists.filter(l => Array.isArray(l.words) && l.words.length >= 10).map(l => ({ topic: U.clampStr(l.topic, 40), words: l.words.map(String) }));
            }
          }
          if (!spec.lists) spec.theme = U.shuffle(Object.keys(P.THEMES)).sort((a, b) => usedThemes.filter(x => x === a).length - usedThemes.filter(x => x === b).length)[0];
          spec.count = Math.min(spec.count, 60);
        }
        ctx.progress(type === "sudoku" ? `Generating ${spec.count} ${spec.level} Sudoku puzzles...` : `Building ${spec.count} word searches...`);
        const puzzles = await P.makeBook(spec, (n, t) => ctx.progress(`Generated ${n} of ${t} puzzles...`));
        const data = { ...spec, lists: undefined, aiUsed: !!spec.aiUsed, puzzles, palette: books.length, author: ctx.cfg.author || "" };
        Object.assign(data, bookCopy(data)); delete data.lists;
        await ctx.add("puzzlebook", data.title, data, { id: `book-${U.uid()}`, price: data.price });
        return `“${data.title}” is ready to review.`;
      },
    },
    {
      id: "pod_designs", title: "Shirt Design Bot", icon: "shirt", category: "Make & sell", earnsVia: "Redbubble, Merch by Amazon",
      desc: "Creates slogan t-shirt and sticker designs as print-ready transparent PNGs, with a mockup and tags.",
      needs: [], uses: ["claude"],
      settings: [{ key: "perRun", label: "Designs per run", type: "number", def: 4, min: 1, max: 10 },
        { key: "niches", label: "Niches", type: "text", def: "fishing, nurses, teachers, cats, coffee, gardening, hiking, gaming", placeholder: "comma separated" }],
      async run(ctx) {
        const niches = String(ctx.cfg.niches || "").split(",").map(s => s.trim()).filter(Boolean);
        const existing = Object.values(Store.S.items).filter(i => i.kind === "design").map(i => i.data.slogan);
        let ideas;
        if (Claude.available()) {
          ideas = await Claude.json(`Write ${ctx.cfg.perRun} original, funny or heartfelt slogan designs for print-on-demand t-shirts and stickers (Redbubble, Merch by Amazon). Niches to use: ${niches.join(", ") || "popular hobbies and professions"}.
Rules: no brand names, celebrities, song lyrics, movie quotes or known trademarked phrases; 2 to 4 short lines; at most 32 characters per line. Avoid these existing slogans: ${existing.slice(-40).join(" | ") || "none"}.
Return a JSON array of {"lines": ["..."], "niche": "...", "title": product title of at most 60 characters, "tags": 13 lowercase search tags, "description": two friendly sentences}.`);
        } else {
          const T = [["WORLD'S OKAYEST", "{role}"], ["POWERED BY", "COFFEE", "AND {thing}"], ["{thing}", "IS MY", "THERAPY"], ["I'D RATHER BE", "{doing}"], ["JUST ONE MORE", "{thing}"], ["{thing} MODE", "ON"], ["OFFICIALLY", "{role}", "OFF DUTY"]];
          const forms = n => ({ thing: n.toUpperCase(), role: n.toUpperCase().replace(/S$/, ""), doing: n.toUpperCase().endsWith("ING") ? n.toUpperCase() : `${n.toUpperCase()}` });
          ideas = Array.from({ length: ctx.cfg.perRun }, () => {
            const n = window.EB_WIN.weightedPick(niches.length ? niches : ["coffee"], window.EB_WIN.prefer("design", "niche")), f = forms(n);
            const fits = T.filter(t => !(t.join(" ").includes("{doing}") && !f.doing.endsWith("ING")) && !(t.join(" ").includes("COFFEE") && f.thing === "COFFEE") && !(t.join(" ").includes("{role}") && /ING$/.test(f.role)));
            const t = U.pick(fits.length ? fits : T);
            const lines = t.map(l => l.replace("{thing}", f.thing).replace("{role}", f.role).replace("{doing}", f.doing));
            return { lines, niche: n, title: `${lines.join(" ")} Funny ${n} Shirt`.replace(/\s+/g, " ").slice(0, 60), tags: [n, `${n} gift`, `${n} lover`, `funny ${n}`, `${n} shirt`, "gift idea", "funny saying", "humor", "birthday gift", "retro", "vintage", "sticker", "quote"], description: `A fun design for anyone who loves ${n}. Makes a great gift.` };
          });
        }
        if (!Array.isArray(ideas)) throw new Error("No designs came back.");
        let made = 0;
        for (const it of ideas.slice(0, ctx.cfg.perRun)) {
          const lines = (it.lines || []).map(s => U.clampStr(s, 36)).filter(Boolean).slice(0, 4); if (!lines.length) continue;
          const slogan = lines.join(" "); if (existing.includes(slogan)) continue;
          const intro = U.clampStr(it.description || `A fun “${slogan}” design for anyone who loves ${it.niche || "a good laugh"}.`, 400);
          const description = `${intro}\n\n- Soft, comfortable unisex fit\n- Printed on demand just for you, so every order is made fresh\n- Makes a great gift for birthdays, holidays and just because\n\nPlease check the size chart in the photos before ordering.`;
          const data = { aiUsed: Claude.available(), lines, slogan, niche: U.clampStr(it.niche, 30), style: U.pick(M.STYLES), palette: Math.floor(Math.random() * M.INKS.length),
            title: U.clampStr(it.title || slogan, 60), tags: (it.tags || []).map(t => U.clampStr(String(t).toLowerCase(), 20)).slice(0, 13), description, price: 24.99 };
          await ctx.add("design", data.title, data, { price: data.price }); made++;
        }
        return `${made} designs ready to review.`;
      },
    },
    {
      id: "content_bot", title: "Content Bot", icon: "video", category: "Content", earnsVia: "TikTok, Instagram, YouTube creator pay and affiliate links",
      desc: "Writes viral-style carousel posts for a faceless niche account: slides, caption, hashtags and a voiceover script.",
      needs: ["claude"],
      settings: [{ key: "niche", label: "Account niche", type: "text", def: "surprising history facts", placeholder: "e.g. money tips, history facts, cat care" },
        { key: "platform", label: "Platform", type: "select", def: "TikTok", options: [["TikTok", "TikTok"], ["Instagram", "Instagram"], ["YouTube Shorts", "YouTube Shorts"]] },
        { key: "handle", label: "Account handle", type: "text", def: "", placeholder: "@youraccount" },
        { key: "perRun", label: "Posts per run", type: "number", def: 3, min: 1, max: 7 }],
      async run(ctx) {
        const prev = Object.values(Store.S.items).filter(i => i.kind === "content").map(i => i.data.hook).slice(-40);
        const posts = await Claude.json(`You run a faceless ${ctx.cfg.platform} account about "${ctx.cfg.niche}". Write ${ctx.cfg.perRun} new carousel posts that are accurate, useful and highly shareable. Do not repeat these hooks: ${prev.join(" | ") || "none"}.
Return a JSON array of {"hook": scroll-stopping first slide, max 70 characters; "slides": 4 slides, each max 160 characters, one idea per slide; "cta": last slide, max 60 characters; "caption": up to 300 characters; "hashtags": 6 hashtags without #; "script": a 30-45 second voiceover script covering the same content}.`);
        if (!Array.isArray(posts)) throw new Error("No posts came back.");
        let made = 0;
        for (const p of posts.slice(0, ctx.cfg.perRun)) {
          if (!p.hook || !Array.isArray(p.slides)) continue;
          await ctx.add("content", U.clampStr(p.hook, 80), { hook: U.clampStr(p.hook, 90), slides: p.slides.slice(0, 6).map(s => U.clampStr(s, 200)), cta: U.clampStr(p.cta || "Follow for more", 80),
            caption: U.clampStr(p.caption, 600), hashtags: (p.hashtags || []).slice(0, 10).map(String), script: U.clampStr(p.script, 2000), platform: ctx.cfg.platform, handle: ctx.cfg.handle, palette: Math.floor(Math.random() * M.SLIDE_THEMES.length) });
          made++;
        }
        return `${made} posts ready to review.`;
      },
    },
    {
      id: "article_bot", title: "Article Bot", icon: "doc", category: "Content", earnsVia: "Affiliate commissions and ads on your niche site",
      desc: "Writes SEO articles for a niche website (buying guides, how-tos) in Markdown and HTML, ready to publish.",
      needs: ["claude"],
      settings: [{ key: "topic", label: "Website topic", type: "text", def: "home coffee brewing", placeholder: "e.g. budget travel in Europe" },
        { key: "audience", label: "Readers", type: "text", def: "beginners", placeholder: "who the site is for" },
        { key: "perRun", label: "Articles per run", type: "number", def: 2, min: 1, max: 4 }],
      async run(ctx) {
        const prev = Object.values(Store.S.items).filter(i => i.kind === "article").map(i => i.data.keyword);
        const arts = await Claude.json(`You write for a niche website about "${ctx.cfg.topic}" for ${ctx.cfg.audience}. Pick ${ctx.cfg.perRun} long-tail search keywords people really search for (mix "best ... for ...", "how to ...", "... vs ..."), not these: ${prev.join(", ") || "none"}. Write one helpful, accurate, original article per keyword, 900-1300 words, in Markdown with ## headings, short paragraphs and lists. Where a product recommendation fits, describe the type of product and write [check price](https://example.com/affiliate-link) as a placeholder link. Do not invent statistics, prices or quotes.
Return a JSON array of {"keyword": "...", "title": SEO title max 60 characters, "meta": meta description max 155 characters, "markdown": the article body without the H1}.`);
        if (!Array.isArray(arts)) throw new Error("No articles came back.");
        let made = 0;
        for (const a of arts.slice(0, ctx.cfg.perRun)) {
          if (!a.title || !a.markdown) continue;
          await ctx.add("article", U.clampStr(a.title, 90), { keyword: U.clampStr(a.keyword, 90), title: U.clampStr(a.title, 90), meta: U.clampStr(a.meta, 200), markdown: U.clampStr(a.markdown, 60000), topic: ctx.cfg.topic });
          made++;
        }
        return `${made} articles ready to review.`;
      },
    },
    {
      id: "lead_finder", title: "Client Finder", icon: "target", category: "Clients & jobs", earnsVia: "Paid client work (websites, social media, design)",
      desc: "Finds local businesses with no website on OpenStreetMap and writes a personal pitch for each one.",
      needs: [], uses: ["web", "claude"],
      settings: [{ key: "city", label: "City", type: "text", def: "", placeholder: "e.g. Belgrade" },
        { key: "types", label: "Business types", type: "select", def: "mixed", options: [["mixed", "Shops, cafés, salons & trades"], ["food", "Restaurants & cafés"], ["beauty", "Hair & beauty"], ["trades", "Trades & repairs"], ["health", "Dentists & clinics"]] },
        { key: "offer", label: "What you offer", type: "text", def: "a simple modern website with Google Maps and online booking", placeholder: "your service" },
        { key: "price", label: "Your price", type: "text", def: "from 299 EUR" },
        { key: "name", label: "Your name", type: "text", def: "" },
        { key: "manual", label: "Business names (if you can't search the map here)", type: "textarea", def: "", placeholder: "One per line: name, type" },
        { key: "perRun", label: "Leads per run", type: "number", def: 8, min: 1, max: 20 }],
      async run(ctx) {
        const known = new Set(Object.values(Store.S.items).filter(i => i.kind === "lead").map(i => i.data.key));
        let found = [];
        if (Web.available() && ctx.cfg.city) {
          ctx.progress(`Searching OpenStreetMap in ${ctx.cfg.city}...`);
          const sel = { mixed: ['["shop"]', '["amenity"~"restaurant|cafe|bar"]', '["craft"]', '["amenity"~"dentist|clinic"]'], food: ['["amenity"~"restaurant|cafe|bar|fast_food"]'], beauty: ['["shop"~"hairdresser|beauty|cosmetics"]'], trades: ['["craft"]', '["shop"~"car_repair|hardware|doityourself"]'], health: ['["amenity"~"dentist|clinic|doctors|veterinary"]'] }[ctx.cfg.types] || ['["shop"]'];
          const city = ctx.cfg.city.replace(/"/g, "");
          const q = `[out:json][timeout:30];area["name"="${city}"]["boundary"="administrative"]->.a;(${sel.map(s => `nwr${s}["name"][!"website"][!"contact:website"](area.a);`).join("")});out center tags 300;`;
          const res = await (await Web.post("https://overpass-api.de/api/interpreter", "data=" + encodeURIComponent(q), { "Content-Type": "application/x-www-form-urlencoded" })).json();
          found = (res.elements || []).map(e => { const t = e.tags || {}; return { key: `osm-${e.type}-${e.id}`, name: t.name, category: (t.shop || t.amenity || t.craft || "business").replace(/_/g, " "),
            address: [t["addr:street"], t["addr:housenumber"], t["addr:city"]].filter(Boolean).join(" "), phone: t.phone || t["contact:phone"] || "", email: t.email || t["contact:email"] || "",
            social: t["contact:facebook"] || t["contact:instagram"] || "", osm: `https://www.openstreetmap.org/${e.type}/${e.id}` }; })
            .filter(l => l.name && !known.has(l.key));
          found.sort((a, b) => (b.phone || b.email ? 1 : 0) - (a.phone || a.email ? 1 : 0));
        } else {
          found = String(ctx.cfg.manual || "").split("\n").map(s => s.trim()).filter(Boolean).map(line => { const [name, category] = line.split(",").map(s => s && s.trim()); return { key: "manual-" + U.slug(name), name, category: category || "business", address: ctx.cfg.city || "" }; })
            .filter(l => !known.has(l.key));
          if (!found.length) return Web.available() ? "Add your city in this bot's settings first." : "Searching the map needs the Android app. Here, add business names in this bot's settings and run again.";
        }
        found = found.slice(0, ctx.cfg.perRun);
        if (!found.length) return "No new businesses without a website found. Try another business type.";
        let pitches = [];
        if (Claude.available()) {
          ctx.progress("Writing personal pitches...");
          pitches = await Claude.json(`Write a short, friendly, non-pushy cold outreach message for each local business below. I am ${ctx.cfg.name || "a local freelancer"} and I offer ${ctx.cfg.offer} (${ctx.cfg.price}). Mention that they don't seem to have a website yet and one concrete benefit for their type of business. Max 90 words each, plain text, end with a simple question. Write in the language people use in ${ctx.cfg.city || "their city"}, and add an English version after a line "---".
Businesses: ${JSON.stringify(found.map(f => ({ name: f.name, type: f.category })))}
Return a JSON array in the same order of {"subject": "...", "body": "..."}.`);
        }
        for (let i = 0; i < found.length; i++) {
          const f = found[i], p = (Array.isArray(pitches) && pitches[i]) || {
            subject: `A website for ${f.name}?`,
            body: `Hi ${f.name} team,\n\nI noticed ${f.name} doesn't have a website yet. I make ${ctx.cfg.offer} for local businesses like yours, ${ctx.cfg.price}, so customers can find your hours, location and services on Google.\n\nWould you like to see a free example of what yours could look like?\n\n${ctx.cfg.name || ""}` };
          await ctx.add("lead", f.name, { ...f, pitchSubject: U.clampStr(p.subject, 120), pitchBody: U.clampStr(p.body, 2000), city: ctx.cfg.city }, { status: "new" });
        }
        return `${found.length} new leads with pitches in your Library.`;
      },
    },
    {
      id: "job_scanner", title: "Job Scanner", icon: "briefcase", category: "Clients & jobs", earnsVia: "Freelance and remote work, open-source bounties",
      desc: "Scans remote job boards and GitHub bounties for work that matches your skills. Claude drafts the proposal.",
      needs: ["web"], uses: ["claude"],
      settings: [{ key: "keywords", label: "Your skills / keywords", type: "text", def: "shopify, wordpress, react, copywriting, translation", placeholder: "comma separated" },
        { key: "sources", label: "Sources", type: "select", def: "all", options: [["all", "Remote job boards + GitHub bounties"], ["jobs", "Remote job boards"], ["bounties", "GitHub bounties"]] }],
      async run(ctx) {
        const kws = String(ctx.cfg.keywords || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
        const known = new Set(Object.values(Store.S.items).filter(i => i.kind === "opportunity").map(i => i.data.key));
        const found = [], errors = [];
        const match = text => !kws.length || kws.some(k => String(text).toLowerCase().includes(k));
        if (ctx.cfg.sources !== "bounties") {
          ctx.progress("Checking Remotive...");
          for (const k of kws.slice(0, 5)) {
            try {
              const r = await Web.json(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(k)}&limit=15`);
              (r.jobs || []).forEach(j => found.push({ key: "remotive-" + j.id, source: "Remotive", url: j.url, title: j.title, company: j.company_name, salary: j.salary || "", location: j.candidate_required_location || "", date: j.publication_date, tags: (j.tags || []).slice(0, 6) }));
            } catch (e) { errors.push(e.message); }
          }
          ctx.progress("Checking Remote OK...");
          try {
            const r = await Web.json("https://remoteok.com/api");
            (Array.isArray(r) ? r.slice(1) : []).forEach(j => { if (match(`${j.position} ${(j.tags || []).join(" ")}`)) found.push({ key: "remoteok-" + j.id, source: "Remote OK", url: j.url, title: j.position, company: j.company, salary: j.salary_min ? `${j.salary_min}-${j.salary_max} USD` : "", location: j.location || "", date: j.date, tags: (j.tags || []).slice(0, 6) }); });
          } catch (e) { errors.push(e.message); }
        }
        if (ctx.cfg.sources !== "jobs") {
          ctx.progress("Checking GitHub bounties...");
          try {
            const r = await Web.json("https://api.github.com/search/issues?q=" + encodeURIComponent("label:bounty state:open is:issue no:assignee") + "&sort=created&order=desc&per_page=40", { Accept: "application/vnd.github+json" });
            (r.items || []).forEach(i => { if (match(`${i.title} ${i.repository_url}`) || ctx.cfg.sources === "bounties") found.push({ key: "gh-" + i.id, source: "GitHub bounty", url: i.html_url, title: i.title, company: i.repository_url.split("/").slice(-2).join("/"), salary: (i.labels || []).map(l => l.name).filter(n => /\$|€|bounty/i.test(n)).join(", "), date: i.created_at, tags: (i.labels || []).map(l => l.name).slice(0, 5) }); });
          } catch (e) { errors.push(e.message); }
        }
        const fresh = []; const seen = new Set();
        for (const f of found) if (!known.has(f.key) && !seen.has(f.key)) { seen.add(f.key); fresh.push(f); }
        for (const f of fresh.slice(0, 30)) await ctx.add("opportunity", U.clampStr(f.title, 140), { ...f, title: U.clampStr(f.title, 200) }, { status: "new" });
        return `${Math.min(30, fresh.length)} new opportunities in your Library.${errors.length ? ` (${errors.length} source${errors.length > 1 ? "s" : ""} didn't answer)` : ""}`;
      },
    },
    {
      id: "price_watch", title: "Deal Finder", icon: "tag", category: "Deals", earnsVia: "Buying low and reselling (Vinted, eBay, local)",
      desc: "Watches product pages and tells you when the price drops below your buy price, so you can resell at a profit.",
      needs: ["web"], settings: [], watches: true,
      async run(ctx) {
        const watches = Object.values(Store.S.watches);
        if (!watches.length) return "Add product links to watch first (open this bot's settings).";
        let hits = 0, errs = 0;
        for (const w of watches) {
          ctx.progress(`Checking ${w.name || w.url}...`);
          try {
            const html = await Web.text(w.url);
            const price = extractPrice(html);
            if (price == null) throw new Error("no price found on the page");
            const history = [...(w.history || []), { t: U.now(), p: price }].slice(-60);
            await Store.save("watches", w.id, { ...w, history, last: price, lastAt: U.now(), error: "" });
            if (price <= w.target) {
              hits++;
              await ctx.add("deal", w.name || w.url, { url: w.url, price, target: w.target, currency: w.currency || "EUR", resell: w.resell || 0, watchId: w.id }, { status: "new", id: `deal-${w.id}-${Date.now().toString(36)}` });
            }
          } catch (e) { errs++; await Store.save("watches", w.id, { ...w, error: e.message, lastAt: U.now() }); }
        }
        return `${watches.length} pages checked. ${hits ? `${hits} deal${hits > 1 ? "s" : ""} below your buy price!` : "No price below your target yet."}${errs ? ` ${errs} page(s) couldn't be read.` : ""}`;
      },
    },
  ];

  function extractPrice(html) {
    const nums = [];
    for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const walk = o => { if (!o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
          if (o.price != null && !isNaN(parseFloat(o.price))) nums.push(parseFloat(String(o.price).replace(",", ".")));
          if (o.lowPrice != null) nums.push(parseFloat(o.lowPrice)); Object.values(o).forEach(walk); };
        walk(JSON.parse(m[1].trim()));
      } catch { /* skip broken block */ }
      if (nums.length) return Math.min(...nums);
    }
    const metas = [/property=["'](?:product:price:amount|og:price:amount)["'][^>]*content=["']([\d.,]+)/i, /content=["']([\d.,]+)["'][^>]*property=["'](?:product:price:amount|og:price:amount)/i, /itemprop=["']price["'][^>]*content=["']([\d.,]+)/i, /"price"\s*:\s*"?([\d]+[.,]?\d*)/i];
    for (const re of metas) { const m = html.match(re); if (m) return parseFloat(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")); }
    return null;
  }

  async function addPrintable(ctx, id, bundleKey, bundle, theme) {
    const copy = D.listingCopy(bundle, theme);
    await ctx.add("printable", copy.shortName, { bundleKey, bundle, theme, ...copy }, { id, price: copy.price });
  }

  window.EB_BOTS = { BOTS, KINDS, PLATFORMS };
})();
