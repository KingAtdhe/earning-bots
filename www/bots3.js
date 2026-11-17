/* Earning Bots, part 3: digital planners, digital paper packs, party game bundles and printable card decks.
   Bots only store small recipes (themes, seeds, word lists), so they also run in the cloud; the PDFs,
   pattern files and photos are drawn on the phone when you open, download or publish them. */
(function () {
  "use strict";
  const { U, Store, Claude, Files } = window.EB;
  const { BOTS, KINDS } = window.EB_BOTS;
  const D = window.EB_DESIGNS, P = window.EB_PUZZLES, rng = window.EB_KDP.rng;
  const { Page, textWidth, drawShapes, pageToPdf, css, lighten } = D;
  const S = Store.S;
  const itemsOf = kind => Object.values(S.items).filter(i => i.kind === kind);
  const add = bot => { const i = BOTS.findIndex(b => b.id === bot.after); BOTS.splice(i >= 0 ? i + 1 : BOTS.length, 0, bot); };
  const seed = () => Math.floor(Math.random() * 2 ** 31);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const leastUsed = (opts, used) => U.shuffle(opts.slice()).sort((a, b) => used.filter(x => x === a).length - used.filter(x => x === b).length)[0];
  const LETTER = [612, 792];

  // ---- shared drawing -------------------------------------------------------------------------
  function wrap(text, size, bold, maxW) {
    const out = []; let line = "";
    for (const w of String(text).split(/\s+/)) { const t = line ? line + " " + w : w; if (textWidth(t, size, bold) > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line); return out;
  }
  // centred text block that shrinks until it fits the box
  function fitText(p, text, cx, cy, maxW, maxH, size, color, bold = true, minSize = 8) {
    let s = size, lines = wrap(text, s, bold, maxW);
    while ((lines.length * s * 1.25 > maxH || lines.some(l => textWidth(l, s, bold) > maxW)) && s > minSize) { s -= 0.5; lines = wrap(text, s, bold, maxW); }
    const top = cy - (lines.length * s * 1.25) / 2 + s;
    lines.forEach((l, i) => p.text(cx, top + i * s * 1.25, s, l, color, bold, "center"));
  }
  function renderPage(page, width = 1100) {
    const k = width / page.W, cv = document.createElement("canvas"); cv.width = width; cv.height = Math.round(page.H * k);
    const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); drawShapes(x, page.shapes, k, 0, 0);
    return cv;
  }
  async function pagesToPdf(builders, size, title) {
    const orient = size[0] > size[1] ? "l" : "p", doc = new window.jspdf.jsPDF({ unit: "pt", format: size, orientation: orient, compress: true });
    doc.setProperties({ title });
    for (let i = 0; i < builders.length; i++) { if (i) doc.addPage(size, orient); pageToPdf(doc, builders[i]().shapes); if (i % 12 === 11) await U.sleep(0); }
    return doc.output("blob");
  }
  const pdfPageCount = async blob => ((await blob.text()).match(/\/Type\s*\/Page[^s]/g) || []).length;

  // =============================================================================================
  // 1. DIGITAL PLANNER: landscape, hyperlinked (tabs, year > month > week), for tablets
  // =============================================================================================
  const PL_THEMES = {
    Sage: { accent: [104, 135, 104], light: [236, 241, 233], ink: [52, 60, 52], rule: [200, 210, 198], bg: [250, 251, 248], tabs: ["#c9d8c5", "#b7cbb2", "#a5bd9f"] },
    Blush: { accent: [186, 112, 116], light: [249, 234, 232], ink: [74, 52, 54], rule: [232, 206, 204], bg: [255, 251, 250], tabs: ["#f3cfcc", "#eebcb8", "#e8aaa5"] },
    Linen: { accent: [150, 120, 92], light: [242, 235, 225], ink: [70, 60, 50], rule: [220, 208, 192], bg: [252, 249, 244], tabs: ["#e6d8c4", "#dccab1", "#d1bc9f"] },
    Lavender: { accent: [124, 104, 170], light: [238, 234, 247], ink: [58, 52, 78], rule: [214, 207, 232], bg: [251, 250, 255], tabs: ["#d9d0ee", "#cbc0e7", "#bdb0df"] },
    Ocean: { accent: [42, 111, 120], light: [228, 240, 241], ink: [36, 58, 62], rule: [196, 218, 220], bg: [248, 252, 252], tabs: ["#bcdbdd", "#a5ced1", "#8fc1c5"] },
    Midnight: { accent: [233, 185, 120], light: [52, 58, 74], ink: [232, 228, 220], rule: [86, 92, 110], bg: [34, 38, 50], tabs: ["#4a5168", "#545c76", "#5f6884"], dark: true },
  };
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const PW = 1024, PH = 768;

  function plannerPlan(d) {
    // page numbers (1-based): cover, year, goals, 12 months, weeks, habit, to-do, notes
    const weeks = [];
    if (d.year) {
      const jan1 = new Date(Date.UTC(d.year, 0, 1)), start = new Date(jan1); start.setUTCDate(1 - ((jan1.getUTCDay() + 6) % 7));
      for (let t = new Date(start); t.getUTCFullYear() <= d.year; t.setUTCDate(t.getUTCDate() + 7)) weeks.push(new Date(t));
    } else for (let i = 0; i < 52; i++) weeks.push(i);
    const plan = { cover: 1, year: 2, goals: 3, month: m => 4 + m, week: w => 16 + w, weeks };
    plan.habit = 16 + weeks.length; plan.todo = plan.habit + 1; plan.notes = plan.todo + 1; plan.notesCount = 8; plan.total = plan.notes + plan.notesCount - 1;
    // undated: weeks shared out 4-4-5 per quarter; dated: the week holding the 1st of the month
    plan.weekOfMonth = m => {
      if (!d.year) { const per = [4, 4, 5]; let w = 0; for (let i = 0; i < m; i++) w += per[i % 3]; return w; }
      const first = Date.UTC(d.year, m, 1); return weeks.findIndex((w, i) => first >= w.getTime() && (i === weeks.length - 1 || first < weeks[i + 1].getTime()));
    };
    plan.weeksIn = m => { if (!d.year) return [4, 4, 5][m % 3]; const a = plan.weekOfMonth(m), b = m === 11 ? weeks.length : plan.weekOfMonth(m + 1) + (Date.UTC(d.year, m + 1, 1) === weeks[plan.weekOfMonth(m + 1)].getTime() ? 0 : 1); return b - a; };
    plan.monthOfWeek = w => { if (!d.year) { for (let m = 11; m >= 0; m--) if (plan.weekOfMonth(m) <= w) return m; return 0; } const t = new Date(weeks[w].getTime() + 3 * 864e5); return t.getUTCFullYear() < d.year ? 0 : t.getUTCFullYear() > d.year ? 11 : t.getUTCMonth(); };
    return plan;
  }
  function plPage(d, plan) {
    const th = PL_THEMES[d.theme] || PL_THEMES.Sage, p = new Page([PW, PH], th);
    p.rect(0, 0, PW, PH, null, th.bg);
    // tab column with links on every page
    const tabs = [["YEAR", plan.year], ...MON.map((m, i) => [m, plan.month(i)]), ["NOTES", plan.notes]], th0 = 44, gap = 4, top = 30;
    const tabH = (PH - 2 * top - gap * (tabs.length - 1)) / tabs.length;
    tabs.forEach(([label, pg], i) => {
      const y = top + i * (tabH + gap), col = hex(th.tabs[i % th.tabs.length]);
      p.rrect(PW - th0 - 18, y, th0 + 30, tabH, 6, null, col); p.text(PW - th0 / 2 - 14, y + tabH / 2 + 3.5, 9.5, label, th.dark ? th.ink : th.ink, true, "center");
      p.link(PW - th0 - 18, y, th0 + 18, tabH, pg);
    });
    p.cw = PW - th0 - 18 - 40; // content width
    return p;
  }
  function plHeader(p, d, title, sub, plan, back) {
    const th = p.th; p.text(40, 64, 30, title, th.accent, true); if (sub) p.text(40 + textWidth(title, 30, true) + 14, 64, 13, sub, th.ink);
    p.line(40, 78, 40 + p.cw, 78, th.accent, 1.4);
    if (back) { p.text(40 + p.cw, 40, 9, back[0], th.accent, true, "right"); p.link(40 + p.cw - textWidth(back[0], 9, true) - 4, 28, textWidth(back[0], 9, true) + 8, 16, back[1]); }
  }
  function plMini(p, d, m, x, y, w, plan, link) {
    const th = p.th; p.text(x, y + 12, 12, MONTHS[m].toUpperCase(), th.accent, true); if (link) p.link(x, y, w, 18, plan.month(m));
    const cell = w / 7; DOW.forEach((dw, i) => p.text(x + cell * i + cell / 2, y + 30, 8, dw[0], th.accent, true, "center"));
    if (!d.year) { for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) p.circle(x + cell * c + cell / 2, y + 46 + r * 22, 1.3, null, th.rule); return; }
    const first = (new Date(Date.UTC(d.year, m, 1)).getUTCDay() + 6) % 7, days = new Date(Date.UTC(d.year, m + 1, 0)).getUTCDate();
    for (let dd = 1; dd <= days; dd++) { const i = first + dd - 1; p.text(x + cell * (i % 7) + cell / 2, y + 50 + Math.floor(i / 7) * 22, 10, String(dd), th.ink, false, "center"); }
  }
  function plannerBuilders(d) {
    const plan = plannerPlan(d), out = [], th = PL_THEMES[d.theme] || PL_THEMES.Sage, yr = d.year ? String(d.year) : "";
    const lines = (p, x, y, w, h, step = 24) => { for (let yy = y + step; yy < y + h - 4; yy += step) p.line(x, yy, x + w, yy, th.rule, 0.6); };
    const box = (p, x, y, w, h, title, ln = true) => { p.rrect(x, y, w, h, 8, th.rule, null, 0.8); if (title) { p.text(x + 12, y + 20, 10, title, th.accent, true); } if (ln) lines(p, x + 12, y + (title ? 26 : 4), w - 24, h - (title ? 26 : 4), 22); };
    // cover
    out.push(() => {
      const p = plPage(d, plan), cx = 40 + p.cw / 2;
      p.circle(cx - 250, 180, 120, null, lighten(th.accent, th.dark ? 0 : 0.75)); p.circle(cx + 260, 560, 150, null, th.light); p.circle(cx + 190, 150, 50, null, lighten(th.accent, th.dark ? 0.2 : 0.55));
      p.text(cx, 330, 64, yr || "UNDATED", th.accent, true, "center"); p.text(cx, 392, 30, "DIGITAL PLANNER", th.ink, true, "center");
      p.text(cx, 428, 13, d.year ? "Weekly · Monthly · Yearly · Hyperlinked" : "Undated · Weekly · Monthly · Hyperlinked", th.ink, false, "center");
      p.rrect(cx - 90, 470, 180, 44, 22, null, th.accent); p.text(cx, 497, 14, "START  ›", th.dark ? th.bg : [255, 255, 255], true, "center"); p.link(cx - 90, 470, 180, 44, plan.year);
      return p;
    });
    // year overview
    out.push(() => {
      const p = plPage(d, plan); plHeader(p, d, d.year ? `${yr} AT A GLANCE` : "YEAR AT A GLANCE", "", plan, ["GOALS ›", plan.goals]);
      const cw = (p.cw - 3 * 26) / 4; for (let m = 0; m < 12; m++) plMini(p, d, m, 40 + (m % 4) * (cw + 26), 100 + Math.floor(m / 4) * 215, cw, plan, true);
      return p;
    });
    // goals
    out.push(() => {
      const p = plPage(d, plan); plHeader(p, d, "MY YEAR", "goals and intentions", plan, ["‹ YEAR", plan.year]);
      const w = (p.cw - 20) / 2; box(p, 40, 96, w, 300, "GOALS"); box(p, 60 + w, 96, w, 300, "WORD OF THE YEAR"); box(p, 40, 412, w, 320, "HABITS TO BUILD"); box(p, 60 + w, 412, w, 320, "PLACES & PEOPLE");
      return p;
    });
    // months
    for (let m = 0; m < 12; m++) out.push(() => {
      const p = plPage(d, plan); plHeader(p, d, MONTHS[m].toUpperCase(), yr, plan, ["‹ YEAR", plan.year]);
      const gw = p.cw * 0.74, cell = gw / 7, top = 96, rows = 6, rh = (PH - top - 60) / rows;
      DOW.forEach((dw, i) => p.text(40 + cell * i + 6, top + 12, 8, dw, th.accent, true));
      for (let r = 0; r <= rows; r++) p.line(40, top + 20 + r * rh, 40 + gw, top + 20 + r * rh, th.rule, 0.7);
      for (let c = 0; c <= 7; c++) p.line(40 + c * cell, top + 20, 40 + c * cell, top + 20 + rows * rh, th.rule, 0.7);
      const w0 = plan.weekOfMonth(m);
      if (d.year) {
        const first = (new Date(Date.UTC(d.year, m, 1)).getUTCDay() + 6) % 7, days = new Date(Date.UTC(d.year, m + 1, 0)).getUTCDate();
        for (let dd = 1; dd <= days; dd++) {
          const i = first + dd - 1, x = 40 + cell * (i % 7), y = top + 20 + Math.floor(i / 7) * rh;
          p.text(x + 6, y + 13, 9, String(dd), th.ink, true); p.link(x, y, cell, rh, plan.week(Math.min(plan.weeks.length - 1, w0 + Math.floor(i / 7))));
        }
      } else for (let r = 0; r < plan.weeksIn(m); r++) p.link(40, top + 20 + r * rh, gw, rh, plan.week(w0 + r));
      const sx = 60 + gw, sw = p.cw - gw - 20;
      box(p, sx, 96, sw, 250, "FOCUS");
      p.text(sx + 12, 372, 10, "WEEKS", th.accent, true);
      for (let r = 0; r < plan.weeksIn(m); r++) { const y = 382 + r * 30; p.rrect(sx, y, sw, 24, 6, null, th.light); p.text(sx + 10, y + 16, 9, d.year ? `Week of ${plan.weeks[w0 + r].getUTCDate()} ${MON[plan.weeks[w0 + r].getUTCMonth()]}` : `Week ${w0 + r + 1}`, th.ink, true); p.link(sx, y, sw, 24, plan.week(w0 + r)); }
      return p;
    });
    // weeks
    plan.weeks.forEach((wk, w) => out.push(() => {
      const p = plPage(d, plan), m = plan.monthOfWeek(w);
      const sub = d.year ? (() => { const e = new Date(wk.getTime() + 6 * 864e5); return `${wk.getUTCDate()} ${MON[wk.getUTCMonth()]} – ${e.getUTCDate()} ${MON[e.getUTCMonth()]}`; })() : "";
      plHeader(p, d, `WEEK ${w + 1}`, sub, plan, [`‹ ${MONTHS[m].toUpperCase()}`, plan.month(m)]);
      const cw = (p.cw - 3 * 14) / 4, ch = (PH - 96 - 40 - 14) / 2;
      for (let i = 0; i < 8; i++) {
        const x = 40 + (i % 4) * (cw + 14), y = 96 + Math.floor(i / 4) * (ch + 14);
        if (i < 7) { const day = d.year ? new Date(wk.getTime() + i * 864e5).getUTCDate() : ""; box(p, x, y, cw, ch, `${DOW[i]}  ${day}`); }
        else { p.rrect(x, y, cw, ch, 8, null, th.light); p.text(x + 12, y + 20, 10, "PRIORITIES", th.accent, true); for (let k = 0; k < 7; k++) { p.rect(x + 14, y + 38 + k * 26, 9, 9, th.accent, null, 0.8); p.line(x + 30, y + 47 + k * 26, x + cw - 14, y + 47 + k * 26, th.rule, 0.6); } }
      }
      if (w > 0) p.link(40, 20, 60, 20, plan.week(w - 1));
      if (w < plan.weeks.length - 1) p.link(110, 20, 60, 20, plan.week(w + 1));
      p.text(40, 34, 8, "‹ PREV", th.accent, true); p.text(110, 34, 8, "NEXT ›", th.accent, true);
      return p;
    }));
    // habit tracker
    out.push(() => {
      const p = plPage(d, plan); plHeader(p, d, "HABIT TRACKER", "", plan, ["‹ YEAR", plan.year]);
      const lw = 150, cell = (p.cw - lw) / 31;
      for (let dd = 0; dd < 31; dd++) p.text(40 + lw + cell * dd + cell / 2, 106, 7, String(dd + 1), th.accent, true, "center");
      for (let r = 0; r < 14; r++) { const y = 116 + r * 44; p.line(40, y + 34, 40 + lw - 10, y + 34, th.rule, 0.6); for (let dd = 0; dd < 31; dd++) p.circle(40 + lw + cell * dd + cell / 2, y + 22, Math.min(cell * 0.36, 8), th.rule, null, 0.7); }
      return p;
    });
    // to-do
    out.push(() => {
      const p = plPage(d, plan); plHeader(p, d, "TO DO", "", plan, ["‹ YEAR", plan.year]);
      const w = (p.cw - 20) / 2;
      for (const x of [40, 60 + w]) for (let k = 0; k < 22; k++) { const y = 104 + k * 28; p.rect(x, y, 10, 10, th.accent, null, 0.8); p.line(x + 18, y + 10, x + w, y + 10, th.rule, 0.6); }
      return p;
    });
    // notes (lined and dotted)
    for (let n = 0; n < plan.notesCount; n++) out.push(() => {
      const p = plPage(d, plan); plHeader(p, d, "NOTES", "", plan, ["‹ YEAR", plan.year]);
      if (n % 2 === 0) lines(p, 40, 90, p.cw, PH - 120, 26);
      else for (let y = 110; y < PH - 30; y += 20) for (let x = 44; x < 40 + p.cw; x += 20) p.circle(x, y, 0.8, null, th.rule);
      return p;
    });
    return { out, plan };
  }
  function plannerCopy(d) {
    const t = d.theme, yr = d.year ? String(d.year) : "Undated";
    const title = `${yr} Digital Planner, Hyperlinked Tablet Planner PDF, ${t} Weekly Monthly Planner, iPad Android Planner, ${d.year ? "Dated" : "Undated"} Landscape Planner`;
    return {
      title: title.slice(0, 140),
      tags: [`${d.year ? d.year + " " : ""}digital planner`.slice(0, 20), "hyperlinked planner", "ipad planner", "tablet planner", "digital journal", d.year ? "dated planner" : "undated planner", "weekly planner", "monthly planner", `${t.toLowerCase()} planner`, "landscape planner", "android planner", "planner pdf", "productivity planner"].map(s => s.slice(0, 20)),
      description: `A clean ${t.toLowerCase()} digital planner for your tablet. Every page is hyperlinked: tap a tab to jump to any month, tap a day to open its week.\n\nWHAT'S INSIDE\n- ${d.year ? d.year + " year at a glance" : "Year at a glance"} with links to every month\n- Goals page\n- 12 monthly pages${d.year ? " with dates" : " (undated: write your own dates)"} and links to each week\n- ${d.year ? "Dated" : "52 undated"} weekly pages with a priorities box\n- Habit tracker, to-do list and 8 notes pages (lined and dot grid)\n- Side tabs on every page: Year, January to December, Notes\n\nHOW TO USE\nOpen the PDF in any note-taking or PDF annotation app that supports links, on iPad or Android tablets. Write with a stylus or type.\n\nThis is a digital download (PDF, landscape). No physical item will be shipped.`,
      price: d.year ? 6.9 : 7.9,
    };
  }

  // =============================================================================================
  // 2. DIGITAL PAPER: 12 seamless patterns per pack, 12 x 12 in at 300 dpi
  // =============================================================================================
  const PAPER_PALETTES = [
    { name: "Sage Boho", c: ["#f4efe6", "#8a9a7b", "#c9b79c", "#e2c290", "#5e6b52"], months: [] },
    { name: "Terracotta", c: ["#f3e9dc", "#c86b4a", "#e0a96d", "#7a8b69", "#3e3a36"], months: [7, 8, 9] },
    { name: "Blush Pink", c: ["#fbf1ee", "#e4a9a0", "#f0cfa9", "#c97b70", "#b8a39b"], months: [0, 1] },
    { name: "Baby Blue", c: ["#f3f7fb", "#a9c6e0", "#f2d7a6", "#7d9bb0", "#dfe9f2"], months: [] },
    { name: "Christmas Red Green", c: ["#f8f3ea", "#b3262e", "#2f6b46", "#d9a441", "#7e1d22"], months: [8, 9, 10, 11] },
    { name: "Valentine", c: ["#fff4f4", "#d63a4a", "#f2a3ad", "#8c1c2c", "#f7d4d8"], months: [11, 0, 1] },
    { name: "Easter Pastel", c: ["#fffaf0", "#f4b6c2", "#b8e0d2", "#f9e79f", "#c3b1e1"], months: [1, 2, 3] },
    { name: "Halloween", c: ["#2b2633", "#f08a24", "#f7f2e8", "#6c4f8a", "#9bbf4a"], months: [7, 8, 9] },
    { name: "Autumn Harvest", c: ["#fbf3e6", "#b5562a", "#d99a3d", "#6e7f3e", "#7a4a2a"], months: [7, 8, 9, 10] },
    { name: "Navy Nautical", c: ["#f6f4ee", "#1f3557", "#c45c3b", "#7d9bb0", "#e3a72f"], months: [4, 5, 6] },
    { name: "Lemon Summer", c: ["#fffdf2", "#f2c94c", "#6fbf73", "#f28c6b", "#3f8f7f"], months: [4, 5, 6, 7] },
    { name: "Lavender Dream", c: ["#f8f6fc", "#b9a7d9", "#e7c6e0", "#7e6bab", "#d9e4dd"], months: [2, 3, 4] },
    { name: "Neutral Mono", c: ["#f2f0eb", "#1e1e1e", "#8c8c8c", "#c9c4ba", "#b08d57"], months: [] },
    { name: "Rainbow Kids", c: ["#ffffff", "#ef6f6c", "#f6c85f", "#6fb07f", "#5b8fd6"], months: [7, 8] },
  ];
  const PATTERNS = ["polka", "gingham", "stripes", "chevron", "scallop", "terrazzo", "confetti", "florals", "stars", "hearts", "waves", "plaid", "checker", "arches", "spots", "diamonds"];
  // draws a tile of size T that repeats without visible seams
  function drawTile(x, style, T, cols, r) {
    const [bg, a, b, c2, d2] = cols, any = () => [a, b, c2, d2][Math.floor(r() * 4)];
    x.fillStyle = bg; x.fillRect(0, 0, T, T);
    const wrapped = fn => { for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) { x.save(); x.translate(ox, oy); fn(); x.restore(); } };
    const scatter = (n, draw) => { const g = Math.ceil(Math.sqrt(n)), cell = T / g; const pts = []; for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) pts.push([(i + 0.15 + r() * 0.7) * cell, (j + 0.15 + r() * 0.7) * cell, r(), any()]); wrapped(() => pts.forEach(pt => draw(...pt))); };
    const star = (cx, cy, R) => { x.beginPath(); for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; x.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); } x.closePath(); x.fill(); };
    const heart = (cx, cy, s) => { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s, cy - s * 0.3, cx - s * 0.45, cy - s, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.45, cy - s, cx + s, cy - s * 0.3, cx, cy + s * 0.35); x.fill(); };
    if (style === "polka") { x.fillStyle = a; const n = 4, s = T / n; for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { x.beginPath(); x.arc(i * s + (j % 2 ? s / 2 : 0), j * s, s * 0.17, 0, 7); x.fill(); } }
    else if (style === "gingham") { const n = 8, s = T / n; x.globalAlpha = 0.5; x.fillStyle = a; for (let i = 0; i < n; i += 2) { x.fillRect(i * s, 0, s, T); x.fillRect(0, i * s, T, s); } x.globalAlpha = 1; }
    else if (style === "stripes") { const ws = [0.06, 0.02, 0.09, 0.03, 0.05, 0.02]; let px = 0, i = 0; while (px < T) { const w = ws[i % ws.length] * T; if (i % 2 === 0) { x.fillStyle = [a, b, c2][i / 2 % 3]; x.fillRect(px, 0, w, T); } px += w; i++; } }
    else if (style === "chevron") { const n = 6, h = T / n, w = T / 4; x.lineWidth = h * 0.32; x.lineJoin = "miter"; for (let j = -1; j <= n; j++) { x.strokeStyle = j % 2 ? a : b; x.beginPath(); for (let i = 0; i <= 4; i++) x.lineTo(i * w, j * h + (i % 2 ? h * 0.5 : 0) + h / 2); x.stroke(); } }
    else if (style === "scallop") { const n = 6, s = T / n; for (let j = -1; j <= n * 2 + 1; j++) for (let i = -1; i <= n; i++) { x.fillStyle = j % 2 ? a : b; x.beginPath(); x.arc(i * s + (j % 2 ? s / 2 : 0), j * s / 2, s / 2, 0, Math.PI); x.fill(); x.strokeStyle = bg; x.lineWidth = s * 0.05; x.stroke(); } }
    else if (style === "terrazzo") scatter(36, (px, py, k, col) => { x.fillStyle = col; x.beginPath(); const R = T * (0.03 + k * 0.05), sides = 4 + Math.floor(k * 4); for (let i = 0; i < sides; i++) { const ang = i / sides * Math.PI * 2 + k * 3; x.lineTo(px + Math.cos(ang) * R * (0.6 + ((i * 7) % 5) / 8), py + Math.sin(ang) * R * (0.6 + ((i * 3) % 5) / 8)); } x.fill(); });
    else if (style === "confetti") scatter(49, (px, py, k, col) => { x.fillStyle = col; x.save(); x.translate(px, py); x.rotate(k * 6); if (k > 0.5) x.fillRect(-T * 0.03, -T * 0.01, T * 0.06, T * 0.02); else { x.beginPath(); x.arc(0, 0, T * 0.018, 0, 7); x.fill(); } x.restore(); });
    else if (style === "florals") scatter(9, (px, py, k, col) => {
      const R = T * (0.07 + k * 0.03);
      x.fillStyle = d2; for (const s2 of [-1, 1]) { x.beginPath(); x.ellipse(px + s2 * R * 1.4, py + R * 0.9, R * 0.75, R * 0.3, s2 * 0.6, 0, 7); x.fill(); }
      x.fillStyle = col === d2 ? a : col; for (let i = 0; i < 5; i++) { const ang = i / 5 * Math.PI * 2 + k; x.beginPath(); x.ellipse(px + Math.cos(ang) * R * 0.6, py + Math.sin(ang) * R * 0.6, R * 0.55, R * 0.38, ang, 0, 7); x.fill(); }
      x.fillStyle = bg; x.beginPath(); x.arc(px, py, R * 0.25, 0, 7); x.fill();
    });
    else if (style === "stars") scatter(16, (px, py, k, col) => { x.fillStyle = col; star(px, py, T * (0.04 + k * 0.03)); });
    else if (style === "hearts") scatter(16, (px, py, k, col) => { x.fillStyle = col; heart(px, py, T * (0.06 + k * 0.03)); });
    else if (style === "waves") { const n = 8, h = T / n; x.lineWidth = h * 0.22; x.lineCap = "round"; for (let j = 0; j <= n; j++) { x.strokeStyle = [a, b, c2][j % 3]; x.beginPath(); for (let i = 0; i <= 64; i++) x.lineTo(i / 64 * T, j * h + Math.sin(i / 64 * Math.PI * 4) * h * 0.25); x.stroke(); } }
    else if (style === "plaid") { x.globalAlpha = 0.55; const bands = [[0, 0.22, a], [0.3, 0.06, b], [0.5, 0.22, a], [0.8, 0.04, c2]]; for (const [o, w, col] of bands) { x.fillStyle = col; x.fillRect(o * T, 0, w * T, T); x.fillRect(0, o * T, T, w * T); } x.globalAlpha = 1; x.strokeStyle = d2; x.lineWidth = T * 0.004; for (const o of [0.11, 0.61]) { x.beginPath(); x.moveTo(o * T, 0); x.lineTo(o * T, T); x.moveTo(0, o * T); x.lineTo(T, o * T); x.stroke(); } }
    else if (style === "checker") { const n = 8, s = T / n; x.fillStyle = a; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) x.fillRect(i * s, j * s, s, s); }
    else if (style === "arches") { const n = 4, s = T / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = i * s + s / 2, cy = j * s + s * 0.78; [a, b, c2].forEach((col, k) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, s * (0.4 - k * 0.11), Math.PI, 0); x.fill(); }); } }
    else if (style === "spots") scatter(16, (px, py, k, col) => { x.fillStyle = d2; x.beginPath(); x.ellipse(px, py, T * (0.06 + k * 0.03), T * 0.045, k * 3, 0, 7); x.fill(); x.fillStyle = a; x.beginPath(); x.ellipse(px, py, T * (0.03 + k * 0.015), T * 0.022, k * 3, 0, 7); x.fill(); });
    else if (style === "diamonds") { const n = 4, s = T / n; for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.beginPath(); x.moveTo(i * s, j * s - s / 2); x.lineTo(i * s + s / 2, j * s); x.lineTo(i * s, j * s + s / 2); x.lineTo(i * s - s / 2, j * s); x.fill(); } x.strokeStyle = c2; x.lineWidth = T * 0.004; for (let i = -n; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s + T, T); x.moveTo(i * s + T, 0); x.lineTo(i * s, T); x.stroke(); } }
  }
  // one finished paper: the tile repeated over the sheet
  function paperCanvas(d, i, size = 3600) {
    const pal = PAPER_PALETTES[d.palette % PAPER_PALETTES.length].c, sp = d.papers[i], r = rng(sp.seed);
    const cols = sp.dark ? [pal[4], pal[0], pal[2], pal[3], pal[1]] : sp.tint ? [lightHex(pal[sp.tint], 0.78), pal[1], pal[2], pal[3], pal[4]] : pal;
    const reps = sp.reps || 4, T = Math.round(size / reps), tile = document.createElement("canvas"); tile.width = T; tile.height = T;
    drawTile(tile.getContext("2d"), sp.style, T, cols, r);
    const cv = document.createElement("canvas"); cv.width = size; cv.height = size; const x = cv.getContext("2d");
    for (let a = 0; a < reps; a++) for (let b = 0; b < reps; b++) x.drawImage(tile, a * T, b * T);
    tile.width = 0; return cv;
  }
  function lightHex(h, t) { const c = lighten(hex(h), t); return `rgb(${c.join(",")})`; }
  function paperPreview(d, width = 1600) {
    const H = Math.round(width * 0.75), cv = document.createElement("canvas"); cv.width = width; cv.height = H; const x = cv.getContext("2d"), u = width / 100;
    const pal = PAPER_PALETTES[d.palette % PAPER_PALETTES.length];
    x.fillStyle = pal.c[0]; x.fillRect(0, 0, width, H);
    const cols = 4, rows = 3, gap = u * 1.6, top = u * 15, sw = (width - gap * (cols + 1)) / cols, sh = (H - top - gap * (rows + 1)) / rows, s = Math.min(sw, sh);
    const ox = (width - (s * cols + gap * (cols - 1))) / 2;
    d.papers.slice(0, 12).forEach((_, i) => { const p = paperCanvas(d, i, 600); x.save(); x.shadowColor = "rgba(0,0,0,.18)"; x.shadowBlur = u; x.shadowOffsetY = u * 0.3; x.drawImage(p, ox + (i % cols) * (s + gap), top + gap + Math.floor(i / cols) * (s + gap), s, s); x.restore(); p.width = 0; });
    x.fillStyle = pal.c[4] === "#1e1e1e" ? "#1e1e1e" : pal.c[4]; x.textAlign = "center"; x.font = `800 ${u * 5}px Fraunces, Georgia, serif`; x.fillText(`${pal.name} Digital Paper`, width / 2, u * 7.6);
    x.font = `600 ${u * 2}px Inter, Arial, sans-serif`; x.fillStyle = pal.c[1]; x.fillText("12 SEAMLESS PATTERNS · 12 x 12 IN · 300 DPI · COMMERCIAL USE", width / 2, u * 11.4);
    return cv;
  }
  function paperCopy(pal, d) {
    const n = pal.name;
    return {
      title: `${n} Digital Paper Pack, 12 Seamless Patterns, ${n} Scrapbook Paper, Printable Background, Commercial Use, 12x12 Pattern JPG`.slice(0, 140),
      tags: [`${n.toLowerCase()} paper`.slice(0, 20), "digital paper", "seamless pattern", "scrapbook paper", "commercial use", "digital background", "pattern pack", "printable paper", "12x12 paper", "junk journal", "planner stickers", "craft supplies", `${n.split(" ")[0].toLowerCase()} pattern`.slice(0, 20)],
      description: `12 coordinating ${n.toLowerCase()} patterns, each a seamless 12 x 12 inch sheet at 300 dpi (3600 x 3600 px JPG).\n\nUSE THEM FOR\n- Scrapbooking, junk journals and card making\n- Printables, planners, stickers and labels\n- Product backgrounds, social media graphics and packaging\n\nYOU GET\n- 12 JPG files (3600 x 3600 px), in 2 ZIP folders\n- A license note\n\nLICENSE\nPersonal and small-business commercial use is allowed (for example on products you sell). You may not resell or share these files as digital paper, patterns or graphics.\n\nThis is a digital download. No physical item will be shipped.`,
      price: 3.9,
    };
  }

  // =============================================================================================
  // 3. PARTY GAMES: bingo (30 cards), word scramble, word search, would you rather, find the guest
  // =============================================================================================
  const PARTY = {
    "Baby Shower": { months: [], accent: [94, 140, 160], light: [229, 240, 244], words: ["bottle", "diaper", "rattle", "stroller", "crib", "pacifier", "onesie", "blanket", "bib", "lullaby", "cradle", "teddy", "booties", "bassinet", "nursery", "wipes", "mittens", "carrier", "giggle", "cuddle", "bath", "storybook", "mobile", "swaddle", "highchair", "sleepsuit", "nap", "tummy", "toes", "smile", "babble", "bedtime", "pram", "teether", "playmat", "socks"],
      wyr: ["have a baby who sleeps all night or one who never cries", "change ten diapers or do ten loads of laundry", "know the baby's name now or be surprised at the birth", "have twins or one baby at a time", "babysit a newborn or a toddler for a day", "sing lullabies or read bedtime stories every night", "have a baby who loves bath time or one who loves car rides", "decorate the nursery or plan the baby shower", "get a year of free diapers or a year of free babysitting", "have a baby with your eyes or your partner's smile", "push a stroller up a hill or carry a car seat all day", "be woken up by giggles or by a kiss"],
      find: ["has changed a diaper today", "was born in the same month as the mom-to-be", "has more than two siblings", "can sing a lullaby by heart", "is wearing something blue", "has held a newborn this year", "knows what a swaddle is", "traveled the farthest today", "has a baby photo on their phone", "is the youngest guest", "has twins in the family", "brought a book as a gift", "can name three baby animals", "has the same birthday as a friend", "has worked with children", "knows the baby's due date"] },
    "Bridal Shower": { months: [2, 3, 4, 5], accent: [170, 110, 120], light: [248, 234, 236], words: ["bride", "groom", "bouquet", "veil", "ring", "vows", "champagne", "toast", "honeymoon", "cake", "dance", "garter", "gown", "romance", "wedding", "aisle", "flowers", "tuxedo", "kiss", "promise", "forever", "registry", "shower", "proposal", "diamond", "bridesmaid", "celebrate", "love", "dress", "photos", "guests", "lace", "invitation", "candles", "sparkle", "together"],
      wyr: ["have a beach wedding or a garden wedding", "plan the whole wedding or have it planned for you", "have a big party or a small dinner", "go on a honeymoon to the mountains or to the sea", "write your own vows or use traditional ones", "dance all night or eat all night", "have a live band or a DJ", "get married in summer or in winter", "keep the dress or the bouquet", "have a surprise proposal or plan it together", "elope or have a big wedding", "eat wedding cake or wedding cupcakes"],
      find: ["has been a bridesmaid", "knows how the couple met", "has caught a bouquet", "has been married over 10 years", "is wearing pink", "has known the bride the longest", "has planned a wedding", "can name the couple's first date spot", "has been to a destination wedding", "has the same birthday month as the bride", "speaks more than two languages", "has a wedding photo on their phone", "has danced at three weddings this year", "traveled the farthest", "met the bride at work", "has a pet"] },
    "Birthday Party": { months: [], accent: [222, 110, 80], light: [253, 236, 228], words: ["balloon", "cake", "candles", "presents", "party", "confetti", "games", "music", "dance", "friends", "cupcake", "streamers", "wish", "laugh", "surprise", "sprinkles", "banner", "hats", "invite", "ribbon", "cookies", "candy", "photos", "song", "card", "pizza", "lemonade", "icecream", "celebrate", "gift", "pinata", "smile", "fun", "sparkler", "frosting", "goodies"],
      wyr: ["have a pool party or a pizza party", "get one big present or ten small ones", "have chocolate cake or vanilla cake", "have a party at home or at the park", "blow out candles or open presents first", "have a magic show or a bounce house", "eat ice cream or cupcakes", "dance at the party or play games", "have your party in summer or winter", "wear a party hat or a crown", "have a costume party or a pajama party", "invite the whole class or three best friends"],
      find: ["has a birthday this month", "has a pet", "can whistle", "has been on a plane", "likes broccoli", "can do a cartwheel", "has a sibling", "is wearing stripes", "loves to draw", "can count to 10 in another language", "has lost a tooth this year", "likes pizza best", "plays an instrument", "has been to the beach", "can swim", "has the same favorite color as you"] },
    "Christmas": { months: [9, 10, 11], accent: [170, 40, 48], light: [246, 233, 228], words: ["reindeer", "sleigh", "snowman", "stocking", "ornament", "presents", "tinsel", "garland", "candy", "cookies", "mistletoe", "carols", "chimney", "elves", "wreath", "snowflake", "holly", "lights", "gingerbread", "ribbon", "star", "angel", "bells", "cocoa", "fireplace", "sweater", "winter", "family", "nutcracker", "pine", "sledding", "joy", "eggnog", "candles", "december", "feast"],
      wyr: ["build a snowman or have a snowball fight", "open presents on Christmas Eve or Christmas morning", "bake cookies or decorate the tree", "wear a festive sweater or a Santa hat all day", "drink hot cocoa or eggnog", "have a white Christmas or a sunny Christmas", "give gifts or receive gifts", "go caroling or watch a holiday movie", "eat gingerbread or candy canes", "spend the holidays in a cabin or at the beach", "wrap presents or untangle the lights", "have real snow or a real fireplace"],
      find: ["has already finished their holiday shopping", "has a real tree at home", "can sing a carol by heart", "is wearing red or green", "has built a snowman this year", "loves fruitcake", "has been to a holiday market", "has a family holiday tradition", "made cookies this week", "has an ugly holiday sweater", "has been sledding", "puts the tree up before December", "hangs stockings", "has wrapped more than 10 gifts", "travels for the holidays", "has a holiday playlist"] },
    "Halloween": { months: [8, 9], accent: [214, 110, 30], light: [251, 236, 220], words: ["pumpkin", "ghost", "witch", "costume", "candy", "spider", "broom", "cauldron", "bats", "moon", "lantern", "skeleton", "mask", "treats", "cobweb", "potion", "haunted", "owl", "black cat", "monster", "zombie", "mummy", "vampire", "goblin", "scarecrow", "October", "spooky", "harvest", "caramel", "apple", "boo", "fog", "candle", "graveyard", "wizard", "midnight"],
      wyr: ["carve a pumpkin or paint a pumpkin", "be a ghost or a witch", "go trick-or-treating or host a party", "eat candy corn or caramel apples", "visit a haunted house or a corn maze", "have a black cat or an owl as a pet", "wear a scary costume or a funny costume", "find a spider in your shoe or a bat in your room", "fly on a broom or ride a ghost ship", "watch a scary movie or tell ghost stories", "get only chocolate or only gummies", "dress up as a vampire or a mummy"],
      find: ["has carved a pumpkin this year", "is wearing orange", "has been to a haunted house", "loves scary movies", "has a black cat", "made their own costume", "has been in a corn maze", "can howl like a wolf", "likes candy corn", "has dressed as a ghost", "has been on a hayride", "likes caramel apples", "knows a ghost story", "decorated their home", "is afraid of spiders", "has a costume with a cape"] },
    "Easter": { months: [1, 2, 3], accent: [120, 150, 90], light: [240, 245, 230], words: ["bunny", "eggs", "basket", "chocolate", "spring", "tulips", "chicks", "jellybeans", "carrot", "lamb", "daffodil", "bonnet", "pastel", "hunt", "grass", "ribbon", "sunshine", "picnic", "bloom", "garden", "butterfly", "ducklings", "bake", "family", "brunch", "lilies", "hop", "feathers", "nest", "rainbow", "cookies", "flowers", "breeze", "meadow", "sprinkles", "treats"],
      wyr: ["find the golden egg or the biggest basket", "eat a chocolate bunny ears first or tail first", "dye eggs or paint eggs", "have a picnic or a brunch", "be a bunny or a chick for a day", "hunt eggs in the garden or in the house", "get jelly beans or chocolate eggs", "plant flowers or plant vegetables", "wear a bonnet or bunny ears", "see butterflies or baby ducks", "bake carrot cake or hot cross buns", "hide the eggs or find the eggs"],
      find: ["has dyed eggs this year", "is wearing a pastel color", "has a garden", "has held a baby chick", "loves jelly beans", "has found more than 10 eggs in a hunt", "eats chocolate bunnies ears first", "has a spring birthday", "has seen a butterfly this week", "can hop on one foot for 10 seconds", "has planted flowers", "likes carrot cake", "has a pet rabbit", "has made an Easter basket", "has been on a picnic this year", "knows a spring song"] },
  };
  function scramble(w, r) { const a = w.split(""); for (let t = 0; t < 20; t++) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (a.join("") !== w) break; } return a.join(""); }
  function partyBuilders(d) {
    const th = { accent: d.accent, light: d.light, ink: [40, 40, 40], rule: [200, 200, 200] }, r = rng(d.seed), out = [], W0 = LETTER[0], H0 = LETTER[1];
    const words = d.words.map(w => w.toUpperCase());
    const head = (p, title, sub) => { p.rect(0, 0, W0, 92, null, th.light); p.text(W0 / 2, 52, 26, title, th.accent, true, "center"); if (sub) p.text(W0 / 2, 74, 11, sub, th.ink, false, "center"); p.text(W0 / 2, H0 - 24, 8, d.occasion.toUpperCase() + " GAMES", [150, 150, 150], true, "center"); };
    const page = () => new Page(LETTER, th);
    out.push(() => { // cover / contents
      const p = page(); p.rect(0, 0, W0, H0, null, th.light); p.rrect(56, 56, W0 - 112, H0 - 112, 18, th.accent, [255, 255, 255], 2);
      fitText(p, d.occasion.toUpperCase(), W0 / 2, 200, W0 - 180, 100, 44, th.accent, true, 20); p.text(W0 / 2, 268, 28, "GAMES BUNDLE", th.ink, true, "center"); p.line(W0 / 2 - 60, 290, W0 / 2 + 60, 290, th.accent, 2);
      ["Bingo (30 cards + caller list)", "Word Scramble + answer key", "Word Search + answer key", "Would You Rather", "Find the Guest Who"].forEach((g, i) => { const y = 350 + i * 58; p.rrect(120, y - 26, W0 - 240, 44, 22, null, th.light); p.circle(146, y - 4, 15, null, th.accent); p.text(146, y + 1.5, 14, String(i + 1), [255, 255, 255], true, "center"); p.text(174, y + 2, 17, g, th.ink, true); });
      p.text(W0 / 2, H0 - 110, 11, "Print at actual size on US Letter or A4", [120, 120, 120], false, "center");
      return p;
    });
    out.push(() => { // bingo how-to + caller list
      const p = page(); head(p, "BINGO", "How to play and caller list");
      ["Give each guest a card and a pen.", "The host reads words from the caller list in any order and checks them off.", "Guests mark the word if it's on their card. The middle square is free.", "The first guest with five in a row (across, down or diagonal) shouts BINGO and wins."].forEach((t, i) => p.text(60, 130 + i * 22, 11.5, `${i + 1}.  ${t}`, th.ink));
      const cw = (W0 - 120) / 3; words.slice(0, 36).forEach((w, i) => { const x = 60 + (i % 3) * cw, y = 250 + Math.floor(i / 3) * 34; p.rect(x, y - 11, 11, 11, th.accent, null, 0.8); p.text(x + 18, y - 1, 12, w, th.ink, true); });
      return p;
    });
    const cards = []; for (let c = 0; c < 30; c++) { const pool = words.slice(0, 36).slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } cards.push(pool.slice(0, 24)); }
    for (let pg = 0; pg < 15; pg++) out.push(() => {
      const p = page();
      for (let k = 0; k < 2; k++) {
        const card = cards[pg * 2 + k], top = 30 + k * 380, size = 300, cell = size / 5, x0 = (W0 - size) / 2;
        p.text(W0 / 2, top + 26, 24, "B I N G O", th.accent, true, "center");
        for (let i = 0; i < 25; i++) {
          const x = x0 + (i % 5) * cell, y = top + 40 + Math.floor(i / 5) * cell;
          p.rect(x, y, cell, cell, th.accent, i === 12 ? th.light : null, 1);
          const word = i === 12 ? "FREE" : card[i > 12 ? i - 1 : i];
          fitText(p, word, x + cell / 2, y + cell / 2 - 2, cell - 8, cell - 10, 9.5, th.ink, true, 5.5);
        }
        p.text(x0 + size + 14, top + 60, 7, `#${pg * 2 + k + 1}`, [160, 160, 160], false);
        if (!k) p.line(40, 382, W0 - 40, 382, [190, 190, 190], 0.6, true);
      }
      return p;
    });
    const scr = words.filter(w => !w.includes(" ")).slice(0, 20).map(w => [w, scramble(w, r)]);
    for (const key of [false, true]) out.push(() => {
      const p = page(); head(p, key ? "WORD SCRAMBLE: ANSWERS" : "WORD SCRAMBLE", key ? "" : "Unscramble each word. Most correct answers wins!");
      scr.forEach(([w, s], i) => { const col = i % 2, x = 60 + col * 260, y = 140 + Math.floor(i / 2) * 58; p.text(x, y, 15, `${i + 1}. ${s}`, th.accent, true); p.line(x + 10, y + 26, x + 220, y + 26, th.rule, 0.8); if (key) p.text(x + 14, y + 22, 13, w, [200, 50, 50], true); });
      return p;
    });
    const ws = d.wordsearch;
    for (const key of [false, true]) out.push(() => {
      const p = page(); head(p, key ? "WORD SEARCH: ANSWERS" : "WORD SEARCH", key ? "" : "Find the hidden words. They go across, down and diagonally.");
      const n = ws.n, size = 420, cell = size / n, x0 = (W0 - size) / 2, y0 = 120;
      p.rect(x0 - 6, y0 - 6, size + 12, size + 12, th.accent, null, 1.2);
      if (key) for (const [w, rr, cc, dr, dc] of ws.w) { const x1 = x0 + (cc + 0.5) * cell, y1 = y0 + (rr + 0.5) * cell, x2 = x0 + (cc + dc * (w.length - 1) + 0.5) * cell, y2 = y0 + (rr + dr * (w.length - 1) + 0.5) * cell; p.line(x1, y1, x2, y2, lighten(th.accent, 0.45), cell * 0.62); }
      for (let i = 0; i < n * n; i++) p.text(x0 + (i % n + 0.5) * cell, y0 + (Math.floor(i / n) + 0.5) * cell + 5, cell * 0.5, ws.g[i], th.ink, true, "center");
      const list = ws.w.map(w => w[0]), cw = (W0 - 120) / 3; list.forEach((w, i) => p.text(60 + (i % 3) * cw, y0 + size + 40 + Math.floor(i / 3) * 20, 11, w, th.ink, true));
      return p;
    });
    out.push(() => {
      const p = page(); head(p, "WOULD YOU RATHER", "Read a question aloud. Everyone picks a side and explains why!");
      d.wyr.slice(0, 12).forEach((q, i) => { const y = 120 + i * 52; p.rrect(56, y, W0 - 112, 42, 10, null, i % 2 ? [255, 255, 255] : th.light); p.text(76, y + 26, 12, `${i + 1}.`, th.accent, true); fitText(p, `Would you rather ${q}?`, W0 / 2 + 10, y + 21, W0 - 170, 36, 11.5, th.ink, false, 8); });
      return p;
    });
    out.push(() => {
      const p = page(); head(p, "FIND THE GUEST WHO...", "Find a different guest for each square and write their name.");
      const size = 480, cell = size / 4, x0 = (W0 - size) / 2, y0 = 120;
      d.find.slice(0, 16).forEach((t, i) => { const x = x0 + (i % 4) * cell, y = y0 + Math.floor(i / 4) * cell; p.rect(x, y, cell, cell, th.accent, null, 1); fitText(p, t, x + cell / 2, y + cell * 0.38, cell - 14, cell * 0.6, 10.5, th.ink, true, 7); p.line(x + 12, y + cell - 18, x + cell - 12, y + cell - 18, th.rule, 0.7); });
      return p;
    });
    return out;
  }
  function partyCopy(occ) {
    return {
      title: `${occ} Games Bundle, 5 Printable ${occ} Games, Bingo with 30 Cards, Word Scramble, Word Search, Would You Rather, Find the Guest, Instant Download`.slice(0, 140),
      tags: [`${occ.toLowerCase()} games`.slice(0, 20), `${occ.toLowerCase()} bingo`.slice(0, 20), "party games", "printable games", "bingo cards", "word scramble", "word search", "would you rather", "find the guest", "party printable", "game bundle", "instant download", `${occ.split(" ")[0].toLowerCase()} party`.slice(0, 20)],
      description: `Five ready-to-print ${occ.toLowerCase()} games, so you can host without the prep.\n\nINCLUDED (23-page PDF)\n- Bingo: 30 different cards, 2 per page, plus a caller list and how-to\n- Word Scramble with answer key\n- Word Search with answer key\n- Would You Rather: 12 questions\n- Find the Guest Who: 16-square icebreaker\n\nPrint at actual size on US Letter or A4 paper, as many copies as you need for your own party.\n\nThis is a digital download. No physical item will be shipped.`,
      price: 5.9,
    };
  }

  // =============================================================================================
  // 4. CARD DECKS: affirmations, conversation starters, sight-word flashcards, journal prompts
  // =============================================================================================
  const DECKS = {
    affirmations: { name: "Daily Affirmation Cards", short: "Affirmations", accent: [150, 110, 140], light: [245, 236, 243], who: "women", cards: ["I am allowed to take up space.", "Today I choose progress over perfection.", "My calm is my strength.", "I trust myself to figure it out.", "I am becoming who I want to be.", "Small steps still move me forward.", "I am worthy of rest.", "I let go of what I cannot control.", "My voice matters.", "I welcome good things into my life.", "I am proud of how far I have come.", "I can do hard things.", "I give myself the kindness I give others.", "Every day is a fresh start.", "I am enough as I am.", "I choose to see the good today.", "I learn from every mistake.", "I deserve the love I give.", "My body carries me through life, and I thank it.", "I set boundaries with love.", "I am open to new beginnings.", "I am grateful for this moment.", "I believe in my dreams.", "I bring something special to the world.", "I am calm, clear and focused.", "I am growing at my own pace.", "I release worry and breathe in peace.", "I am surrounded by people who care.", "I make room for joy.", "I trust the timing of my life.", "I keep my promises to myself.", "I am brave enough to begin.", "I celebrate my small wins.", "I am the author of my story.", "I let today be simple.", "Kindness is my superpower.", "I am stronger than my doubts.", "I give myself permission to rest and reset.", "Good things are coming my way.", "I am at home in myself."] },
    kids_affirmations: { name: "Affirmation Cards for Kids", short: "Kids Affirmations", accent: [80, 140, 190], light: [230, 241, 250], who: "kids", cards: ["I am brave.", "I can try new things.", "I am a good friend.", "Mistakes help me learn.", "I am kind to others.", "I believe in myself.", "I can calm my body.", "I am loved.", "My ideas matter.", "I can ask for help.", "I am proud of myself.", "I keep going when it's hard.", "I am a great listener.", "I use my words to share my feelings.", "I make good choices.", "I am creative.", "I can do it!", "It's okay to feel sad sometimes.", "I am thankful for my family.", "I am strong inside and out.", "I can take deep breaths.", "I shine my own way.", "I like who I am.", "I am learning every day.", "I help others.", "My feelings are important.", "I am curious about the world.", "I can be patient.", "I share and take turns.", "Today will be a great day!"] },
    couples: { name: "Conversation Starters for Couples", short: "Couple Questions", accent: [176, 84, 84], light: [249, 232, 230], who: "couples", cards: ["What is a small thing I do that makes your day better?", "Where would you go if we could travel anywhere tomorrow?", "What is your favorite memory of us so far?", "What is something new you would like us to try together?", "What song reminds you of us?", "What did you think of me when we first met?", "What does a perfect lazy Sunday look like to you?", "What is a dream you have never told anyone?", "Which tradition would you like us to start?", "What makes you feel most loved?", "What is one thing you are proud of this year?", "If we wrote a book about us, what would the title be?", "What is the best meal we have shared?", "What is a skill you would love to learn together?", "How do you like to be comforted after a hard day?", "What is something about your childhood you want me to know?", "What would our dream home have?", "What is one way we could have more fun together?", "Which movie would you watch with me again and again?", "What do you think is our biggest strength as a couple?", "What is a goal you want us to reach in five years?", "When did you last laugh so hard you cried?", "What is a habit of mine you secretly love?", "What would your perfect date night be?", "What are three words that describe us?", "What is something you want more of in our life?", "What is a place from your past you want to show me?", "What is your favorite way to spend time with me?", "What is a question you have always wanted to ask me?", "What adventure should we plan next?", "What does home mean to you?", "What is a compliment you would like to hear more?", "What made you smile today?", "What would you do with a free day together?", "What is a lesson you learned from a past relationship?", "What is the kindest thing someone ever did for you?", "What is your favorite photo of us and why?", "What should we celebrate more often?", "If you could relive one day with me, which would it be?", "What is one promise you want to make to me?"] },
    family: { name: "Family Dinner Conversation Cards", short: "Family Questions", accent: [200, 130, 50], light: [252, 240, 222], who: "families", cards: ["What was the best part of your day?", "If you could have any superpower, what would it be?", "What made you laugh this week?", "If our family had a theme song, what would it be?", "What is something kind you did today?", "Where would you go on a dream vacation?", "What animal would you like to be for a day?", "What is your favorite family memory?", "What is something you want to learn this year?", "If you could invent a holiday, what would it celebrate?", "What food could you eat every day?", "Who is someone you admire and why?", "What is the funniest thing that ever happened to you?", "If you could meet any book character, who would it be?", "What would you do with a free day and no rules?", "What is one thing that makes our family special?", "What job would you like to try for a week?", "If you could live anywhere, where would it be?", "What is your favorite season and why?", "What is something that was hard for you this week?", "What would you put in a time capsule?", "What is a game you would like to play together?", "If you could change one rule at home, what would it be?", "What is the best gift you ever gave someone?", "What makes a good friend?", "What is your favorite thing about yourself?", "If you could ask a pet one question, what would it be?", "What would you name a new planet?", "What are you thankful for today?", "What would your perfect birthday look like?", "If you could talk to your future self, what would you ask?", "What is a place near home you want to explore?", "What is the best advice you have been given?", "If you could be famous for something, what would it be?", "What is a small thing that makes you happy?", "What is something you are looking forward to?", "What is the bravest thing you have done?", "What would you cook for the family?", "If you wrote a book, what would it be about?", "What should our next family adventure be?"] },
    sightwords_preprimer: { name: "Sight Word Flashcards: Pre-Primer", short: "Pre-Primer Words", accent: [70, 140, 110], light: [228, 244, 236], who: "kindergarten", flash: true, cards: ["a", "and", "away", "big", "blue", "can", "come", "down", "find", "for", "funny", "go", "help", "here", "I", "in", "is", "it", "jump", "little", "look", "make", "me", "my", "not", "one", "play", "red", "run", "said", "see", "the", "three", "to", "two", "up", "we", "where", "yellow", "you"] },
    sightwords_primer: { name: "Sight Word Flashcards: Primer", short: "Primer Words", accent: [90, 110, 180], light: [232, 236, 250], who: "kindergarten and first grade", flash: true, cards: ["all", "am", "are", "at", "ate", "be", "black", "brown", "but", "came", "did", "do", "eat", "four", "get", "good", "have", "he", "into", "like", "must", "new", "no", "now", "on", "our", "out", "please", "pretty", "ran", "ride", "saw", "say", "she", "so", "soon", "that", "there", "they", "this", "too", "under", "want", "was", "well", "went", "what", "white", "who", "will", "with", "yes"] },
    journal: { name: "Journal Prompt Cards", short: "Journal Prompts", accent: [110, 120, 90], light: [238, 241, 230], who: "journaling", cards: ["What is taking up most of my energy right now?", "Describe a moment this week when you felt at peace.", "What would I do if I knew I could not fail?", "Write a letter to your younger self.", "What am I ready to let go of?", "List five things that made you smile recently.", "What does a good day look like for me?", "Which habit would change my life the most?", "What am I avoiding, and why?", "Describe your ideal morning in detail.", "What did I learn from a recent challenge?", "Who has shaped the person I am today?", "What boundaries do I need to set?", "What would I like to be remembered for?", "Write about a place where you feel at home.", "What are three things I love about myself?", "What is one fear I want to face this year?", "How do I want to feel at the end of this month?", "What is something I have been putting off?", "Describe a small win from today.", "What does success mean to me now?", "Which relationships give me energy?", "If my life were a book, what chapter am I in?", "What advice would I give a friend in my situation?", "What would I try if no one was watching?", "What am I most grateful for this season?", "How can I be kinder to myself this week?", "What drains me, and what refills me?", "Write about a time you surprised yourself.", "What is a dream I have put on hold?", "What do I need more of right now?", "Describe your perfect weekend.", "What is a belief I want to change?", "What made me feel proud this year?", "Where do I want to be one year from today?", "What is one thing I can simplify?", "Write a thank-you note to your body.", "What is my favorite way to recharge?", "Which song describes my life right now?", "What will I do differently tomorrow?"] },
  };
  const CW = 180, CH = 252; // 2.5 x 3.5 in
  function cardFace(p, d, text, x, y, i) {
    const th = p.th;
    p.rrect(x + 6, y + 6, CW - 12, CH - 12, 10, th.accent, [255, 255, 255], 1.4);
    p.text(x + CW / 2, y + 30, 7, d.short.toUpperCase(), th.accent, true, "center");
    if (d.flash) fitText(p, text, x + CW / 2, y + CH / 2, CW - 36, 120, 46, th.ink, true, 18);
    else fitText(p, text, x + CW / 2, y + CH / 2, CW - 40, CH - 90, 15, th.ink, true, 8);
    p.circle(x + CW / 2, y + CH - 28, 3, null, th.accent); p.circle(x + CW / 2 - 10, y + CH - 28, 2, null, lighten(th.accent, 0.4)); p.circle(x + CW / 2 + 10, y + CH - 28, 2, null, lighten(th.accent, 0.4));
  }
  function cardBack(p, d, x, y) {
    const th = p.th;
    p.rrect(x + 6, y + 6, CW - 12, CH - 12, 10, null, th.accent);
    p.rrect(x + 16, y + 16, CW - 32, CH - 32, 6, [255, 255, 255], null, 0.8);
    fitText(p, d.short.toUpperCase(), x + CW / 2, y + CH / 2, CW - 50, 80, 16, [255, 255, 255], true, 8);
  }
  function deckBuilders(d) {
    const th = { accent: d.accent, light: d.light, ink: [45, 45, 45], rule: [200, 200, 200] }, out = [], x0 = (LETTER[0] - 3 * CW) / 2, y0 = (LETTER[1] - 3 * CH) / 2;
    const marks = p => { const xs = [0, 1, 2, 3].map(i => x0 + i * CW), ys = [0, 1, 2, 3].map(i => y0 + i * CH); for (const x of xs) { p.line(x, 4, x, y0 - 6, [150, 150, 150], 0.5); p.line(x, y0 + 3 * CH + 6, x, LETTER[1] - 4, [150, 150, 150], 0.5); } for (const y of ys) { p.line(4, y, x0 - 6, y, [150, 150, 150], 0.5); p.line(x0 + 3 * CW + 6, y, LETTER[0] - 4, y, [150, 150, 150], 0.5); } };
    out.push(() => { // instructions
      const p = new Page(LETTER, th); p.rect(0, 0, LETTER[0], 150, null, th.light);
      p.text(LETTER[0] / 2, 80, 28, d.name.toUpperCase(), th.accent, true, "center"); p.text(LETTER[0] / 2, 112, 12, `${d.cards.length} printable cards · 2.5 x 3.5 in (playing-card size)`, th.ink, false, "center");
      ["Print the card pages on thick paper or card stock at actual size (100%).", "For card backs, print the back page on the reverse side (flip on the long edge), or print it separately and glue.", "Cut along the grey crop marks.", "Optional: laminate the cards or round the corners for a finished look."].forEach((t, i) => p.text(70, 210 + i * 28, 12, `${i + 1}.  ${t}`, th.ink));
      return p;
    });
    for (let pg = 0; pg * 9 < d.cards.length; pg++) {
      out.push(() => { const p = new Page(LETTER, th); marks(p); d.cards.slice(pg * 9, pg * 9 + 9).forEach((t, i) => cardFace(p, d, t, x0 + (i % 3) * CW, y0 + Math.floor(i / 3) * CH, pg * 9 + i)); return p; });
    }
    out.push(() => { const p = new Page(LETTER, th); marks(p); for (let i = 0; i < 9; i++) cardBack(p, d, x0 + (i % 3) * CW, y0 + Math.floor(i / 3) * CH); return p; });
    return out;
  }
  function cardCanvas(d, i, width = 600, back = false) {
    const th = { accent: d.accent, light: d.light, ink: [45, 45, 45], rule: [200, 200, 200] }, p = new Page([CW, CH], th);
    if (back) cardBack(p, d, 0, 0); else cardFace(p, d, d.cards[i % d.cards.length], 0, 0, i);
    const k = width / CW, cv = document.createElement("canvas"); cv.width = width; cv.height = Math.round(CH * k); drawShapes(cv.getContext("2d"), p.shapes, k, 0, 0); return cv;
  }
  function deckCover(d, width = 1600) {
    const H = Math.round(width * 0.75), cv = document.createElement("canvas"); cv.width = width; cv.height = H; const x = cv.getContext("2d"), u = width / 100;
    x.fillStyle = css(d.light); x.fillRect(0, 0, width, H);
    const show = [0, 1, 2, 3, 4].map(i => cardCanvas(d, Math.floor(i * d.cards.length / 5), 520, i === 4));
    show.forEach((c, i) => { x.save(); x.translate(width * (0.18 + i * 0.16), H * 0.6 + Math.abs(i - 2) * u * 1.5); x.rotate((i - 2) * 0.08); x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = u * 1.5; x.shadowOffsetY = u * 0.5; x.drawImage(c, -c.width * 0.36, -c.height * 0.36, c.width * 0.72, c.height * 0.72); x.restore(); c.width = 0; });
    x.fillStyle = css(d.accent); x.textAlign = "center"; x.font = `800 ${u * 5}px Fraunces, Georgia, serif`; x.fillText(d.name, width / 2, u * 8.5);
    x.font = `600 ${u * 2}px Inter, Arial, sans-serif`; x.fillStyle = "rgba(0,0,0,.6)"; x.fillText(`${d.cards.length} PRINTABLE CARDS · PRINT, CUT, USE`, width / 2, u * 12.5);
    return cv;
  }
  function deckCopy(d) {
    const n = d.name;
    return {
      title: `${n}, ${d.cards.length} Printable Cards for ${d.who.replace(/\b\w/g, c => c.toUpperCase())}, Print and Cut PDF, Instant Download`.slice(0, 140),
      tags: [n.toLowerCase().slice(0, 20), `${d.short.toLowerCase()}`.slice(0, 20), "printable cards", "card deck", "print and cut", "instant download", d.flash ? "flash cards" : "conversation cards", d.flash ? "sight words" : "gift idea", d.flash ? "kindergarten" : "self care", d.flash ? "homeschool" : "mindfulness", d.flash ? "reading practice" : "journal cards", d.flash ? "teacher resources" : "family game", d.flash ? "preschool" : "printable gift"].map(t => t.slice(0, 20)).filter((t, i, a) => a.indexOf(t) === i).slice(0, 13),
      description: `${d.cards.length} ${d.flash ? "large-print flashcards" : "beautifully simple cards"} for ${d.who}, ready to print and cut.\n\nYOU GET\n- A PDF with ${Math.ceil(d.cards.length / 9)} card pages (9 cards per page) plus a card-back page\n- Playing-card size: 2.5 x 3.5 in, with crop marks\n- Printing and cutting instructions\n\nPrint at actual size on US Letter or A4, ideally on card stock. Print as many sets as you need for personal${d.flash ? " and classroom" : ""} use.\n\nThis is a digital download. No physical item will be shipped.`,
      price: d.flash ? 3.5 : 4.5,
    };
  }

  // ---- kinds -------------------------------------------------------------------------------------
  const zipOf = async files => { const z = new window.JSZip(); for (const [n, b] of files) z.file(n, await b); return z.generateAsync({ type: "blob" }); };
  Object.assign(KINDS, {
    dplanner: {
      label: "Digital planner", plural: "Digital planners", icon: "tablet", platforms: ["Etsy", "Gumroad"],
      thumb: (it, w) => renderPage(plannerBuilders(it.data).out[0](), w),
      async kit(it) { const d = it.data, z = new window.JSZip(), stem = U.slug(d.title).slice(0, 50); z.file(`${stem}.pdf`, await plannerPdf(it)); await window.EB_SCENES.addPhotos(it, z.folder("listing-photos")); z.file("LISTING.txt", listing(it)); return { blob: await z.generateAsync({ type: "blob" }), name: `${stem}-kit.zip` }; },
      copy: it => [["Title", it.data.title], ["Description", it.data.description], ["Tags", it.data.tags.join(", ")]],
      summary: it => `${it.data.year || "Undated"} · ${it.data.theme} · ${plannerPlan(it.data).total} hyperlinked pages`,
    },
    paperpack: {
      label: "Digital paper", plural: "Digital paper", icon: "grid", platforms: ["Etsy", "Gumroad", "Creative Market"],
      thumb: (it, w) => paperPreview(it.data, w),
      async kit(it) { const d = it.data, z = new window.JSZip(), stem = U.slug(d.title).slice(0, 40); const files = z.folder("digital-files"); for (const [n, f] of paperFiles(it)) files.file(n, await f()); await window.EB_SCENES.addPhotos(it, z.folder("listing-photos")); z.file("LISTING.txt", listing(it)); return { blob: await z.generateAsync({ type: "blob" }), name: `${stem}-kit.zip` }; },
      copy: it => [["Title", it.data.title], ["Description", it.data.description], ["Tags", it.data.tags.join(", ")]],
      summary: it => `${PAPER_PALETTES[it.data.palette % PAPER_PALETTES.length].name} · 12 patterns`,
    },
    partygame: {
      label: "Party games", plural: "Party games", icon: "party", platforms: ["Etsy", "Gumroad"],
      thumb: (it, w) => renderPage(partyBuilders(it.data)[0](), w),
      async kit(it) { const d = it.data, z = new window.JSZip(), stem = U.slug(d.title).slice(0, 40); z.file(`${stem}.pdf`, await partyPdf(it)); await window.EB_SCENES.addPhotos(it, z.folder("listing-photos")); z.file("LISTING.txt", listing(it)); return { blob: await z.generateAsync({ type: "blob" }), name: `${stem}-kit.zip` }; },
      copy: it => [["Title", it.data.title], ["Description", it.data.description], ["Tags", it.data.tags.join(", ")]],
      summary: it => `${it.data.occasion} · 5 games · 23 pages`,
    },
    carddeck: {
      label: "Card deck", plural: "Card decks", icon: "cards", platforms: ["Etsy", "Gumroad", "Teachers Pay Teachers"],
      thumb: (it, w) => deckCover(it.data, w),
      async kit(it) { const d = it.data, z = new window.JSZip(), stem = U.slug(d.title).slice(0, 40); z.file(`${stem}.pdf`, await deckPdf(it)); await window.EB_SCENES.addPhotos(it, z.folder("listing-photos")); z.file("LISTING.txt", listing(it)); return { blob: await z.generateAsync({ type: "blob" }), name: `${stem}-kit.zip` }; },
      copy: it => [["Title", it.data.title], ["Description", it.data.description], ["Tags", it.data.tags.join(", ")]],
      summary: it => `${it.data.cards.length} cards · ${it.data.short}`,
    },
  });
  const listing = it => `TITLE\n${it.data.title}\n\nPRICE\n${Number(it.price || it.data.price).toFixed(2)}\n\nTAGS\n${it.data.tags.join(", ")}\n\nDESCRIPTION\n${it.data.description}\n\nETSY\nDigital listing. Photos from listing-photos in number order (01 is the thumbnail). Upload the PDF or ZIP files as the digital files.\n`;
  const plannerPdf = it => pagesToPdf(plannerBuilders(it.data).out, [PW, PH], it.data.title);
  const partyPdf = it => pagesToPdf(partyBuilders(it.data), LETTER, it.data.title);
  const deckPdf = it => pagesToPdf(deckBuilders(it.data), LETTER, it.data.title);
  // 12 pattern files, split into two ZIPs so each stays well under Etsy's 20 MB file limit
  function paperFiles(it) {
    const d = it.data, stem = U.slug(PAPER_PALETTES[d.palette % PAPER_PALETTES.length].name);
    return d.papers.map((_, i) => [`${stem}-pattern-${String(i + 1).padStart(2, "0")}.jpg`, async () => { const cv = paperCanvas(d, i, 3600); const b = await Files.canvasBlob(cv, "image/jpeg", 0.88); cv.width = 0; await U.sleep(0); return b; }]);
  }
  // files for marketplace upload (used by publishing): [name, async () => Blob]
  function etsyFiles(it) {
    const d = it.data, stem = U.slug(d.title).slice(0, 40);
    if (it.kind === "dplanner") return [[`${stem}.pdf`, () => plannerPdf(it)]];
    if (it.kind === "partygame") return [[`${stem}.pdf`, () => partyPdf(it)]];
    if (it.kind === "carddeck") return [[`${stem}.pdf`, () => deckPdf(it)]];
    if (it.kind === "paperpack") {
      const f = paperFiles(it), lic = "LICENSE\nPersonal and small-business commercial use is allowed (for example on products you sell). You may not resell or share these files as digital paper, patterns or graphics.\n";
      return [0, 1].map(h => [`${U.slug(PAPER_PALETTES[d.palette % PAPER_PALETTES.length].name)}-digital-paper-part-${h + 1}.zip`, async () => { const z = new window.JSZip(); for (const [n, fn] of f.slice(h * 6, h * 6 + 6)) z.file(n, await fn()); z.file("LICENSE.txt", lic); return z.generateAsync({ type: "blob" }); }]);
    }
    return [];
  }

  // ---- bots --------------------------------------------------------------------------------------------
  add({ id: "planner_bot", after: "calendar_bot", title: "Digital Planner Bot", icon: "tablet", category: "Make & sell", earnsVia: "Etsy digital planners",
    desc: "Builds hyperlinked tablet planners (tap a month or day to jump there): year, goals, 12 months, every week, habit tracker, notes. Dated for next year or undated, in 6 themes.", needs: [],
    settings: [{ key: "kind", label: "Make", type: "select", def: "both", options: [["both", "Dated and undated"], ["dated", "Dated only"], ["undated", "Undated only"]] }],
    async run(ctx) {
      const now = new Date(), year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
      const have = itemsOf("dplanner").map(i => `${i.data.year || "u"}-${i.data.theme}`);
      const want = ctx.cfg.kind === "dated" ? [year] : ctx.cfg.kind === "undated" ? [0] : [year, 0];
      const yearPick = want[have.length % want.length], theme = leastUsed(Object.keys(PL_THEMES), have.filter(h => h.startsWith(`${yearPick || "u"}-`)).map(h => h.split("-")[1]));
      if (have.includes(`${yearPick || "u"}-${theme}`)) return "You already have every theme for this planner. Try the other planner type in settings.";
      const data = { year: yearPick, theme }; Object.assign(data, plannerCopy(data));
      await ctx.add("dplanner", data.title, data, { price: data.price });
      return `${data.year || "Undated"} ${theme} digital planner ready to review.`;
    } });
  add({ id: "paper_bot", after: "planner_bot", title: "Digital Paper Bot", icon: "grid", category: "Make & sell", earnsVia: "Etsy digital paper, Creative Market",
    desc: "Designs packs of 12 seamless patterns (dots, gingham, florals, terrazzo, waves and more) in a coordinated palette, 12 x 12 in at 300 dpi, with a commercial-use license. Seasonal palettes come 8-12 weeks early.", needs: [],
    settings: [{ key: "perRun", label: "Packs per run", type: "number", def: 1, min: 1, max: 3 }],
    async run(ctx) {
      const used = itemsOf("paperpack").map(i => i.data.palette), m = new Date().getMonth(), made = [];
      for (let n = 0; n < ctx.cfg.perRun; n++) {
        const seasonal = PAPER_PALETTES.map((p, i) => [p, i]).filter(([p]) => !p.months.length || p.months.includes(m));
        const idx = leastUsed(seasonal.map(s => s[1]), used.concat(made)); made.push(idx);
        const styles = U.shuffle(PATTERNS.slice()).slice(0, 12);
        const papers = styles.map((style, i) => ({ style, seed: seed(), reps: ["florals", "terrazzo", "confetti", "spots"].includes(style) ? 3 : 4, dark: i === 5 || i === 10, tint: i % 3 === 1 && !(i === 5 || i === 10) ? 1 + (i % 4) : 0 }));
        const data = { palette: idx, papers }; Object.assign(data, paperCopy(PAPER_PALETTES[idx], data));
        await ctx.add("paperpack", data.title, data, { price: data.price });
      }
      return `${made.length} digital paper pack${made.length > 1 ? "s" : ""} ready to review: ${made.map(i => PAPER_PALETTES[i].name).join(", ")}.`;
    } });
  add({ id: "party_bot", after: "paper_bot", title: "Party Games Bot", icon: "party", category: "Make & sell", earnsVia: "Etsy party printables",
    desc: "Makes printable game bundles (bingo with 30 cards, word scramble, word search, would you rather, find the guest) for showers, birthdays and holidays, timed for the season. Claude can add any occasion you name.", needs: [], uses: ["claude"],
    settings: [{ key: "occasions", label: "Extra occasions (Claude writes the words)", type: "text", def: "", placeholder: "e.g. graduation, retirement, game night" }],
    async run(ctx) {
      const have = itemsOf("partygame").map(i => i.data.occasion), m = new Date().getMonth();
      let occ = null, spec = null;
      const extra = String(ctx.cfg.occasions || "").split(",").map(s => s.trim()).filter(s => s && !have.map(h => h.toLowerCase()).includes(s.toLowerCase()));
      if (extra.length && Claude.available()) {
        const name = extra[0].replace(/\b\w/g, c => c.toUpperCase());
        ctx.progress(`Writing ${name} game content...`);
        const r = await Claude.json(`Write content for printable "${name}" party games. Family-friendly, original, accurate; no brand or character names.
Return JSON {"words": 36 single words (no spaces, 3-10 letters) that fit the occasion, "wyr": 12 "would you rather" choices written as "X or Y" (no question words, no "Would you rather"), "find": 16 short "find the guest who..." endings like "has been to Paris"}.`);
        const words = (r.words || []).map(w => String(w).replace(/[^a-zA-Z]/g, "")).filter(w => w.length >= 3 && w.length <= 10);
        if (words.length >= 30 && (r.wyr || []).length >= 10 && (r.find || []).length >= 16) { occ = name; spec = { accent: [90, 100, 160], light: [234, 236, 248], words: words.slice(0, 36), wyr: r.wyr.map(s => U.clampStr(String(s).replace(/\?$/, ""), 110)), find: r.find.map(s => U.clampStr(String(s), 60)), aiUsed: true }; }
      }
      if (!occ) {
        const opts = Object.keys(PARTY).filter(k => !have.includes(k) && (!PARTY[k].months.length || PARTY[k].months.includes(m)));
        occ = opts[0] || leastUsed(Object.keys(PARTY), have); spec = PARTY[occ];
      }
      const ws = P.wordSearch(spec.words.filter(w => !w.includes(" ")).slice(0, 24), 14, false);
      const data = { occasion: occ, accent: spec.accent, light: spec.light, words: U.shuffle(spec.words.slice()), wyr: spec.wyr, find: spec.find, seed: seed(), wordsearch: ws, aiUsed: !!spec.aiUsed };
      Object.assign(data, partyCopy(occ));
      await ctx.add("partygame", data.title, data, { price: data.price });
      return `${occ} games bundle ready to review.`;
    } });
  add({ id: "cards_bot", after: "party_bot", title: "Card Deck Bot", icon: "cards", category: "Make & sell", earnsVia: "Etsy, Teachers Pay Teachers",
    desc: "Makes print-and-cut card decks: affirmation cards, conversation starters for couples and families, journal prompts and sight-word flashcards, with card backs and crop marks. Claude can write decks for any topic.", needs: [], uses: ["claude"],
    settings: [{ key: "topics", label: "Extra deck topics (Claude writes them)", type: "text", def: "", placeholder: "e.g. gratitude cards for teens, icebreakers for teams" }],
    async run(ctx) {
      const have = itemsOf("carddeck").map(i => i.data.deck);
      const extra = String(ctx.cfg.topics || "").split(",").map(s => s.trim()).filter(s => s && !have.includes("ai:" + s.toLowerCase()));
      let deck;
      if (extra.length && Claude.available()) {
        ctx.progress(`Writing “${extra[0]}” cards...`);
        const r = await Claude.json(`Write a printable card deck: "${extra[0]}". Original, warm, practical; no quotes from famous people; no medical or therapy claims.
Return JSON {"name": deck name max 40 chars, "short": 1-3 word label, "who": who it's for (2-4 words), "cards": 36 card texts, each max 110 characters}.`);
        const cards = (r.cards || []).map(c => U.clampStr(String(c), 120)).filter(Boolean);
        if (cards.length >= 27) deck = { key: "ai:" + extra[0].toLowerCase(), name: U.clampStr(r.name || extra[0], 50), short: U.clampStr(r.short || "Cards", 24), who: U.clampStr(r.who || "everyone", 40), accent: [110, 100, 160], light: [238, 236, 248], cards: cards.slice(0, 36), aiUsed: true };
      }
      if (!deck) { const key = Object.keys(DECKS).find(k => !have.includes(k)) || leastUsed(Object.keys(DECKS), have); deck = { key, ...DECKS[key] }; }
      const data = { deck: deck.key, name: deck.name, short: deck.short, who: deck.who, accent: deck.accent, light: deck.light, cards: deck.cards, flash: !!deck.flash, aiUsed: !!deck.aiUsed };
      Object.assign(data, deckCopy(data));
      await ctx.add("carddeck", data.title, data, { price: data.price });
      return `“${data.name}” (${data.cards.length} cards) ready to review.`;
    } });

  // ---- KDP: print-ready full cover (back + spine + front, with bleed) ---------------------------------
  // KDP paperback, white paper: spine = pages x 0.002252 in; 0.125 in bleed on all outside edges;
  // spine text only from 79 pages; the barcode area (bottom right of the back) is left empty for KDP.
  async function kdpFullCover(it, pages) {
    const d = it.data, nb = d.type === "notebook", tw = nb ? 6 : 8.5, th = nb ? 9 : 11, bleed = 0.125, spine = pages * 0.002252;
    const W = (2 * tw + spine + 2 * bleed) * 72, H = (th + 2 * bleed) * 72;
    const front = it.kind === "puzzlebook" ? P.coverCanvas(it, 2550) : window.EB_KDP.cover(it, 2550);
    const px = front.getContext("2d").getImageData(3, 3, 1, 1).data, bg = [px[0], px[1], px[2]];
    const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255, fg = lum > 0.55 ? [30, 30, 30] : [250, 247, 240];
    const doc = new window.jspdf.jsPDF({ unit: "pt", format: [W, H], orientation: "l", compress: true });
    doc.setFillColor(...bg); doc.rect(0, 0, W, H, "F");
    const fx = (bleed + tw + spine) * 72; doc.addImage(front.toDataURL("image/jpeg", 0.92), "JPEG", fx, 0, W - fx, H, undefined, "SLOW"); front.width = 0;
    if (pages >= 79) {
      const label = String(d.coverMain || d.title).split(":")[0].slice(0, 60), size = Math.min(spine * 72 * 0.5, 14), cx = (bleed + tw + spine / 2) * 72;
      doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(...fg);
      const tw2 = doc.getTextWidth(label); doc.text(label, cx - size * 0.35, H / 2 - tw2 / 2, { angle: -90 });
    }
    const m = (bleed + 0.375) * 72, maxW = (tw - 0.75) * 72, stopY = H - (bleed + 0.25 + 1.2 + 0.25) * 72;
    const k = nb ? 0.78 : 1; // notebooks are smaller
    doc.setTextColor(...fg); doc.setFont("helvetica", "bold"); doc.setFontSize(28 * k);
    let y = m + 34 * k; for (const l of doc.splitTextToSize(String(d.title).split(":")[0], maxW)) { doc.text(l, m, y); y += 33 * k; }
    doc.setDrawColor(...fg); doc.setLineWidth(1.5); doc.line(m, y - 12 * k, m + 70, y - 12 * k); y += 14 * k;
    doc.setFont("helvetica", "normal"); doc.setFontSize(14 * k);
    const previewH = nb ? 0 : 2.6 * 72;
    for (const para of String(d.description || "").split(/\n+/)) {
      for (const l of doc.splitTextToSize(para.replace(/^- /, "•  "), maxW)) { if (y > stopY - previewH) break; doc.text(l, m, y); y += 20 * k; }
      y += 8 * k; if (y > stopY - previewH) break;
    }
    // a peek inside: one interior page, bottom left (clear of the barcode area)
    if (!nb && ["coloring", "maze"].includes(d.type)) {
      const sz = 2.4 * 72, px0 = m, py0 = H - (bleed + 0.375) * 72 - sz;
      doc.setFillColor(255, 255, 255); doc.roundedRect(px0, py0, sz, sz, 8, 8, "F");
      const cv = d.type === "coloring" ? window.EB_KDP.mandalaCanvas(d.seeds[1] || d.seeds[0], 700) : (() => { const c = document.createElement("canvas"); c.width = 700; c.height = 700; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 700, 700); const mz = window.EB_KDP.maze(14, 14, d.seeds[1] || d.seeds[0]), cell = 640 / 14; x.strokeStyle = "#111"; x.lineWidth = 5; x.lineCap = "round"; for (let i = 0; i < 196; i++) { const cx = 30 + (i % 14) * cell, cy = 30 + Math.floor(i / 14) * cell, w = mz.walls[i]; x.beginPath(); if (w & 1) { x.moveTo(cx, cy); x.lineTo(cx + cell, cy); } if (w & 8) { x.moveTo(cx, cy); x.lineTo(cx, cy + cell); } if (w & 4) { x.moveTo(cx, cy + cell); x.lineTo(cx + cell, cy + cell); } if (w & 2) { x.moveTo(cx + cell, cy); x.lineTo(cx + cell, cy + cell); } x.stroke(); } return c; })();
      doc.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", px0 + 10, py0 + 10, sz - 20, sz - 20); cv.width = 0;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...fg); doc.text("A LOOK INSIDE", px0 + sz + 14, py0 + 16);
    }
    return doc.output("blob");
  }
  async function kdpCoverFiles(it, interiorBlob) {
    const pages = await pdfPageCount(interiorBlob);
    return { pages, blob: await kdpFullCover(it, pages) };
  }

  window.EB_BOTS3 = { kdpFullCover, kdpCoverFiles,  plannerBuilders, plannerPlan, partyBuilders, deckBuilders, cardCanvas, deckCover, paperCanvas, paperPreview, renderPage, etsyFiles, pdfPageCount, plannerPdf, partyPdf, deckPdf, PAPER_PALETTES, PL_THEMES, PARTY, DECKS, PATTERNS };
})();
