/* Earning Bots: printable page designs, catalogue and renderers (PDF via jsPDF, previews via canvas).
   Every page is a list of shapes, drawn identically into the PDF and the preview images. */
(function () {
  "use strict";

  const SIZES = { "A4": [595.28, 841.89], "US-Letter": [612, 792] };

  const THEMES = {
    Sage: { accent: [104, 135, 104], light: [231, 238, 229] },
    Blush: { accent: [190, 118, 120], light: [249, 233, 231] },
    Navy: { accent: [38, 58, 98], light: [225, 230, 240] },
    Terracotta: { accent: [184, 96, 66], light: [247, 231, 222] },
    Lavender: { accent: [128, 104, 164], light: [238, 232, 246] },
    Monochrome: { accent: [38, 38, 38], light: [234, 234, 234] },
    Ocean: { accent: [34, 112, 132], light: [224, 240, 243] },
    Mustard: { accent: [176, 132, 30], light: [248, 239, 216] },
  };
  for (const t of Object.values(THEMES)) { t.ink = [55, 55, 55]; t.rule = [196, 196, 196]; }

  const NARROW = new Set("il.,:;|!'ftjI ");
  const WIDE = new Set("mwMW@%");
  function textWidth(text, size, bold) {
    let w = 0;
    for (const ch of text) {
      if (NARROW.has(ch)) w += 0.28;
      else if (WIDE.has(ch)) w += 0.86;
      else if (ch >= "A" && ch <= "Z") w += 0.68;
      else if (ch >= "0" && ch <= "9") w += 0.556;
      else w += 0.52;
    }
    return w * size * (bold ? 1.06 : 1);
  }

  class Page {
    constructor(size, theme) {
      [this.W, this.H] = size; this.th = theme; this.m = 36; this.g = 10; this.shapes = [];
    }
    get iw() { return this.W - 2 * this.m; }
    rect(x, y, w, h, stroke, fill, lw = 0.8) { this.shapes.push({ t: "rect", x, y, w, h, stroke, fill, lw }); }
    line(x1, y1, x2, y2, color, lw = 0.5, dash = false) {
      this.shapes.push({ t: "line", x1, y1, x2, y2, color: color || this.th.rule, lw, dash });
    }
    circle(cx, cy, r, stroke, fill, lw = 0.7) { this.shapes.push({ t: "circle", cx, cy, r, stroke, fill, lw }); }
    text(x, y, s, text, color, bold = false, align = "left") {
      this.shapes.push({ t: "text", x, y, s, text, color: color || this.th.ink, bold, align });
    }
    header(title, fields = []) {
      const m = this.m, acc = this.th.accent, fw = 170;
      this.text(m, m + 24, 24, title, acc, true);
      const base = m + 24 - 16 * (fields.length - 1);
      fields.forEach((f, i) => this.label(this.W - m - fw, base + 16 * i, f, fw));
      this.line(m, m + 36, this.W - m, m + 36, acc, 1.5);
      return m + 48;
    }
    label(x, y, text, w) {
      this.text(x, y, 7.5, text, null, true);
      this.line(x + textWidth(text, 7.5, true) + 5, y + 1.5, x + w, y + 1.5, null, 0.6);
    }
    box(x, y, w, h, title) {
      this.rect(x, y, w, h, this.th.accent, null, 0.8);
      if (!title) return y;
      this.rect(x, y, w, 17, null, this.th.light);
      this.line(x, y + 17, x + w, y + 17, this.th.accent, 0.5);
      this.text(x + 8, y + 11.8, 7.5, title, this.th.accent, true);
      return y + 17;
    }
    lines(x, y, w, h, sp = 18) {
      for (let yy = y + sp; yy <= y + h - 4; yy += sp) this.line(x + 8, yy, x + w - 8, yy);
    }
    checklist(x, y, w, h, sp = 18, items = []) {
      let i = 0;
      for (let yy = y + sp; yy <= y + h - 4; yy += sp, i++) {
        this.rect(x + 8, yy - 8, 7, 7, this.th.accent, null, 0.6);
        this.line(x + 21, yy, x + w - 8, yy);
        if (i < items.length) this.text(x + 23, yy - 2.4, 8, items[i]);
      }
    }
    table(x, y, w, h, headers, fracs, rowH = 18, labels = [], headH = 18) {
      fracs = fracs || headers.map(() => 1 / headers.length);
      const xs = [x];
      fracs.forEach(f => xs.push(xs[xs.length - 1] + w * f));
      xs[xs.length - 1] = x + w;
      const n = Math.max(1, Math.floor((h - headH) / rowH));
      const bottom = y + headH + n * rowH, acc = this.th.accent;
      this.rect(x, y, w, headH, null, this.th.light);
      headers.forEach((hd, i) => {
        if (!hd) return;
        const size = xs[i + 1] - xs[i] > 30 ? 7.5 : 6;
        this.text((xs[i] + xs[i + 1]) / 2, y + headH / 2 + size * 0.36, size, hd, acc, true, "center");
      });
      for (let r = 1; r < n; r++) this.line(x, y + headH + r * rowH, x + w, y + headH + r * rowH);
      labels.slice(0, n).forEach((lab, i) =>
        this.text((xs[0] + xs[1]) / 2, y + headH + i * rowH + rowH / 2 + 2.8, 7.5, lab, acc, true, "center"));
      xs.slice(1, -1).forEach(cx => this.line(cx, y, cx, bottom));
      this.line(x, y + headH, x + w, y + headH, acc, 0.6);
      this.rect(x, y, w, bottom - y, acc, null, 0.8);
      return { bottom, n, xs };
    }
  }

  const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  function weeklyPlanner(p) {
    const y = p.header("WEEKLY PLANNER", ["WEEK OF"]), m = p.m, g = p.g;
    const cw = (p.iw - g) / 2, rh = (p.H - m - y - 3 * g) / 4;
    for (let i = 0; i < 8; i++) {
      const x = m + (i % 2) * (cw + g), yy = y + Math.floor(i / 2) * (rh + g);
      if (i < 7) { const t = p.box(x, yy, cw, rh, DAYS[i]); p.lines(x, t, cw, rh - 17); }
      else { const t = p.box(x, yy, cw, rh, "TOP PRIORITIES"); p.checklist(x, t, cw, rh - 17); }
    }
  }

  function dailyPlanner(p) {
    const y = p.header("DAILY PLANNER", ["DATE"]), m = p.m, g = p.g, acc = p.th.accent;
    const lw = (p.iw - g) * 0.55, rw = p.iw - g - lw, rx = m + lw + g, hgt = p.H - m - y;
    const top = p.box(m, y, lw, hgt, "SCHEDULE");
    const hours = [];
    for (let h = 6; h < 22; h++) hours.push(`${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`);
    const sp = (hgt - 17) / (hours.length + 0.6);
    hours.forEach((hr, i) => {
      const yy = top + (i + 1) * sp;
      p.text(m + 8, yy - 4, 7, hr, acc, true);
      p.line(m + 42, yy, m + lw - 8, yy);
    });
    const h1 = hgt * 0.17, h3 = hgt * 0.2, h4 = 46, h2 = hgt - h1 - h3 - h4 - 3 * g;
    let yy = y, t;
    t = p.box(rx, yy, rw, h1, "TOP 3 PRIORITIES"); p.checklist(rx, t, rw, h1 - 17, (h1 - 17 - 5) / 3);
    yy += h1 + g; t = p.box(rx, yy, rw, h2, "TO DO"); p.checklist(rx, t, rw, h2 - 17);
    yy += h2 + g; t = p.box(rx, yy, rw, h3, "NOTES"); p.lines(rx, t, rw, h3 - 17);
    yy += h3 + g; t = p.box(rx, yy, rw, h4, "WATER");
    for (let i = 0; i < 8; i++) p.circle(rx + 20 + i * ((rw - 40) / 7), t + (h4 - 17) / 2, 6.5, acc);
  }

  function habitTracker(p) {
    const y = p.header("HABIT TRACKER", ["MONTH"]), m = p.m, g = p.g, w = p.iw, first = 110;
    const fracs = [first / w].concat(Array(31).fill((w - first) / w / 31));
    const th = (p.H - m - y) * 0.76;
    const heads = ["HABIT"]; for (let d = 1; d <= 31; d++) heads.push(String(d));
    const { bottom } = p.table(m, y, w, th, heads, fracs, (th - 18) / 15);
    const rest = p.H - m - bottom - g;
    const t = p.box(m, bottom + g, w, rest, "NOTES & REFLECTION"); p.lines(m, t, w, rest - 17);
  }

  function monthlyBudget(p) {
    let y = p.header("MONTHLY BUDGET", ["MONTH"]);
    const m = p.m, g = p.g, w = p.iw, bw = (w - 2 * g) / 3, bh = 50;
    ["TOTAL INCOME", "TOTAL EXPENSES", "LEFT OVER"].forEach((lab, i) => {
      const x = m + i * (bw + g);
      p.box(x, y, bw, bh, lab); p.line(x + 14, y + bh - 9, x + bw - 14, y + bh - 9);
    });
    y += bh + g;
    const cw = (w - g) / 2, avail = p.H - m - y, h1 = avail * 0.32, h2 = avail * 0.68, rx = m + cw + g;
    p.table(m, y, cw, h1, ["INCOME SOURCE", "AMOUNT"], [0.64, 0.36]);
    p.table(m, y + h1 + g, cw, avail - h1 - g, ["FIXED BILLS", "DUE", "AMOUNT", "PAID"], [0.4, 0.18, 0.24, 0.18]);
    p.table(rx, y, cw, h2, ["SPENDING", "BUDGET", "ACTUAL"], [0.44, 0.28, 0.28]);
    const t = p.box(rx, y + h2 + g, cw, avail - h2 - g, "NOTES"); p.lines(rx, t, cw, avail - h2 - g - 17);
  }

  function expenseTracker(p) {
    const y = p.header("EXPENSE TRACKER", ["MONTH"]), m = p.m;
    p.table(m, y, p.iw, p.H - m - y - 30, ["DATE", "DESCRIPTION", "CATEGORY", "AMOUNT"], [0.14, 0.44, 0.24, 0.18], 20);
    p.label(p.W - m - 170, p.H - m - 4, "TOTAL", 170);
  }

  function mealPlanner(p) {
    const y = p.header("MEAL PLANNER", ["WEEK OF"]), m = p.m, g = p.g, w = p.iw, h1 = (p.H - m - y) * 0.62;
    p.table(m, y, w, h1, ["", "BREAKFAST", "LUNCH", "DINNER", "SNACKS"], [0.12, 0.22, 0.22, 0.22, 0.22],
      (h1 - 18) / 7, DAYS.map(d => d.slice(0, 3)));
    const rest = p.H - m - y - h1 - g, t = p.box(m, y + h1 + g, w, rest, "GROCERY LIST"), cw = w / 3;
    for (let c = 0; c < 3; c++) p.checklist(m + c * cw, t, cw, rest - 17);
  }

  function readingLog(p) {
    const y = p.header("READING LOG", ["YEAR"]), m = p.m, acc = p.th.accent, rowH = 24;
    const { n, xs } = p.table(m, y, p.iw, p.H - m - y, ["BOOK TITLE", "AUTHOR", "STARTED", "FINISHED", "RATING"],
      [0.34, 0.24, 0.13, 0.13, 0.16], rowH);
    const mid = (xs[4] + xs[5]) / 2;
    for (let r = 0; r < n; r++) for (let k = 0; k < 5; k++)
      p.circle(mid + (k - 2) * 11, y + 18 + r * rowH + rowH / 2, 3.6, acc, null, 0.5);
  }

  function workoutLog(p) {
    let y = p.header("WORKOUT LOG", ["DATE"]);
    const m = p.m, g = p.g, w = p.iw, acc = p.th.accent;
    p.label(m, y + 8, "FOCUS", w * 0.48); p.label(m + w * 0.52, y + 8, "DURATION", w * 0.48);
    y += 22;
    const { bottom } = p.table(m, y, w, (p.H - m - y) * 0.72, ["EXERCISE", "SETS", "REPS", "WEIGHT", "NOTES"],
      [0.34, 0.11, 0.11, 0.14, 0.30], 22);
    const rest = p.H - m - bottom - g, lw = w * 0.62;
    let t = p.box(m, bottom + g, lw, rest, "HOW I FELT"); p.lines(m, t, lw, rest - 17);
    const rx = m + lw + g, rw = w - lw - g;
    t = p.box(rx, bottom + g, rw, rest, "WATER");
    for (let i = 0; i < 8; i++) p.circle(rx + rw / 5 * (i % 4 + 1), t + (rest - 17) / 3 * (Math.floor(i / 4) + 1), 8, acc);
  }

  const CLEANING = {
    DAILY: ["Make beds", "Wash dishes", "Wipe counters", "Sweep kitchen", "Tidy living room", "Laundry load", "Take out trash"],
    WEEKLY: ["Vacuum floors", "Mop floors", "Clean bathrooms", "Change bed sheets", "Dust surfaces", "Clean mirrors", "Water plants"],
    MONTHLY: ["Clean fridge", "Clean oven", "Wash windows", "Declutter closet", "Clean vents", "Wash curtains", "Deep clean bath"],
  };
  function cleaningSchedule(p) {
    const y = p.header("CLEANING SCHEDULE", ["WEEK OF"]), m = p.m, g = p.g, w = p.iw;
    const h1 = (p.H - m - y) * 0.62, cw = (w - 2 * g) / 3;
    Object.entries(CLEANING).forEach(([title, items], i) => {
      const x = m + i * (cw + g), t = p.box(x, y, cw, h1, title); p.checklist(x, t, cw, h1 - 17, 18, items);
    });
    const rest = p.H - m - y - h1 - g, t = p.box(m, y + h1 + g, w, rest, "EXTRA TASKS");
    p.checklist(m, t, w / 2, rest - 17); p.checklist(m + w / 2, t, w / 2, rest - 17);
  }

  function gratitudeJournal(p) {
    const y = p.header("GRATITUDE JOURNAL", ["DATE"]), m = p.m, g = p.g, w = p.iw, acc = p.th.accent;
    const avail = p.H - m - y - 4 * g;
    const parts = [[0.22, "TODAY I AM GRATEFUL FOR"], [0.2, "BEST PART OF MY DAY"], [0.15, "TODAY'S AFFIRMATION"],
      [0.13, "MOOD"], [0.30, "TOMORROW I WILL"]];
    let yy = y;
    for (const [f, title] of parts) {
      const h = avail * f, t = p.box(m, yy, w, h, title);
      if (title === "TODAY I AM GRATEFUL FOR") {
        const sp = (h - 17 - 5) / 3;
        for (let i = 0; i < 3; i++) {
          const ly = t + (i + 1) * sp;
          p.text(m + 10, ly - 2.5, 9, `${i + 1}.`, acc, true); p.line(m + 24, ly, m + w - 8, ly);
        }
      } else if (title === "MOOD") {
        ["GREAT", "GOOD", "OKAY", "LOW", "ROUGH"].forEach((mood, i) => {
          const cx = m + w / 6 * (i + 1), cy = t + (h - 17) * 0.42;
          p.circle(cx, cy, 9, acc); p.text(cx, cy + 22, 7, mood, null, false, "center");
        });
      } else if (title === "TOMORROW I WILL") p.checklist(m, t, w, h - 17);
      else p.lines(m, t, w, h - 17);
      yy += h + g;
    }
  }

  function savingsTracker(p) {
    let y = p.header("SAVINGS TRACKER", ["GOAL", "TARGET"]);
    const m = p.m, g = p.g, w = p.iw, acc = p.th.accent;
    p.label(m, y + 8, "SAVING FOR", w * 0.48); p.label(m + w * 0.52, y + 8, "DEADLINE", w * 0.48);
    y += 22;
    const gh = (p.H - m - y) * 0.52, t = p.box(m, y, w, gh, "COLOUR ONE CIRCLE FOR EVERY STEP SAVED");
    const cell = Math.min(w / 10, (gh - 17) / 10), ox = m + (w - cell * 10) / 2;
    for (let i = 0; i < 100; i++) {
      const cx = ox + cell * (i % 10) + cell / 2, cy = t + cell * Math.floor(i / 10) + cell / 2;
      p.circle(cx, cy, cell * 0.38, acc, null, 0.6);
      p.text(cx, cy + cell * 0.09, cell * 0.24, String(i + 1), null, false, "center");
    }
    const ty = y + gh + g;
    p.table(m, ty, w, p.H - m - ty, ["DATE", "AMOUNT ADDED", "TOTAL SAVED", "NOTE"], [0.18, 0.24, 0.24, 0.34]);
  }

  function todoList(p) {
    const y = p.header("TO DO LIST", ["DATE"]), m = p.m, g = p.g, w = p.iw;
    const h1 = (p.H - m - y) * 0.74, cw = (w - g) / 2;
    ["MUST DO", "NICE TO DO"].forEach((title, i) => {
      const x = m + i * (cw + g), t = p.box(x, y, cw, h1, title); p.checklist(x, t, cw, h1 - 17);
    });
    const rest = p.H - m - y - h1 - g, t = p.box(m, y + h1 + g, w, rest, "NOTES"); p.lines(m, t, w, rest - 17);
  }

  const LAYOUTS = {
    weekly_planner: ["Weekly Planner", weeklyPlanner],
    daily_planner: ["Daily Planner", dailyPlanner],
    todo_list: ["To Do List", todoList],
    habit_tracker: ["Monthly Habit Tracker", habitTracker],
    monthly_budget: ["Monthly Budget", monthlyBudget],
    expense_tracker: ["Expense Tracker", expenseTracker],
    savings_tracker: ["Savings Tracker (100-step challenge)", savingsTracker],
    meal_planner: ["Weekly Meal Planner & Grocery List", mealPlanner],
    reading_log: ["Reading Log", readingLog],
    workout_log: ["Workout Log", workoutLog],
    cleaning_schedule: ["Cleaning Schedule", cleaningSchedule],
    gratitude_journal: ["Gratitude Journal Page", gratitudeJournal],
  };

  function buildPage(key, sizeName, themeName) {
    const p = new Page(SIZES[sizeName], THEMES[themeName]);
    LAYOUTS[key][1](p);
    return p;
  }

  const BUNDLES = {
    planner: { name: "Weekly & Daily Planner Bundle", pages: ["weekly_planner", "daily_planner", "todo_list"], price: 4.9,
      intro: "Plan your week, run your days and clear your to-do list with this clean, undated planner set.",
      tags: ["weekly planner", "daily planner", "printable planner", "planner pdf", "undated planner", "planner insert", "to do list", "productivity", "planner pages", "a4 planner"] },
    budget: { name: "Budget Planner Bundle", pages: ["monthly_budget", "expense_tracker", "savings_tracker"], price: 5.9,
      intro: "Take control of your money: plan the month, track every expense and watch your savings grow.",
      tags: ["budget planner", "monthly budget", "expense tracker", "savings tracker", "finance planner", "budget template", "bill tracker", "money planner", "budget printable", "savings challenge"] },
    habit: { name: "Habit Tracker & Gratitude Pages", pages: ["habit_tracker", "gratitude_journal"], price: 3.9,
      intro: "Build better habits one day at a time, and end each day noticing what went well.",
      tags: ["habit tracker", "monthly tracker", "goal tracker", "self care planner", "habit printable", "gratitude journal", "routine tracker", "wellness planner", "bullet journal", "daily habits"] },
    meal: { name: "Meal Planner & Grocery List", pages: ["meal_planner"], price: 3.5,
      intro: "Plan a week of meals in minutes and shop with a ready-made grocery checklist.",
      tags: ["meal planner", "grocery list", "menu planner", "weekly meal plan", "meal prep", "food planner", "shopping list", "kitchen printable", "family meal plan", "dinner planner"] },
    reading: { name: "Reading Log & Book Tracker", pages: ["reading_log"], price: 3.2,
      intro: "Keep track of every book you read this year, with start and finish dates and a 5-star rating.",
      tags: ["reading log", "reading journal", "book tracker", "book lover gift", "reading tracker", "book journal", "bookish printable", "reading challenge", "book review", "library log"] },
    fitness: { name: "Workout Log & Fitness Tracker", pages: ["workout_log", "habit_tracker"], price: 3.9,
      intro: "Log every workout, sets, reps and weights, and keep your fitness habits on track all month.",
      tags: ["workout log", "fitness planner", "gym tracker", "exercise log", "fitness journal", "workout planner", "habit tracker", "training log", "health tracker", "gym printable"] },
    cleaning: { name: "Cleaning Schedule & Chore Checklist", pages: ["cleaning_schedule", "todo_list"], price: 3.2,
      intro: "Keep your home under control with daily, weekly and monthly cleaning checklists.",
      tags: ["cleaning schedule", "cleaning checklist", "chore chart", "home organization", "cleaning planner", "house chores", "weekly cleaning", "household planner", "to do list", "home printable"] },
    gratitude: { name: "Daily Gratitude Journal Page", pages: ["gratitude_journal"], price: 2.9,
      intro: "A calm, five-minute daily page for gratitude, affirmations and a quick mood check-in.",
      tags: ["gratitude journal", "daily journal", "mindfulness", "self care journal", "journal pages", "journal printable", "positive mindset", "five minute journal", "reflection journal", "morning journal"] },
    savings: { name: "100-Step Savings Challenge Tracker", pages: ["savings_tracker"], price: 2.9,
      intro: "Make saving fun: colour in a circle every time you put money aside and log every deposit.",
      tags: ["savings tracker", "savings challenge", "money saving", "savings goal", "100 envelope", "finance tracker", "debt free", "budget printable", "saving printable", "money tracker"] },
    life: { name: "Ultimate Life Planner Bundle", pages: Object.keys(LAYOUTS), price: 9.9,
      intro: "Everything in one download: 12 planner pages for your time, money, home, health and goals.",
      tags: ["life planner", "printable planner", "planner bundle", "budget planner", "habit tracker", "meal planner", "weekly planner", "daily planner", "undated planner", "planner pdf"] },
  };

  function cleanTags(tags, theme) {
    const out = [];
    for (let t of [...tags, `${theme.toLowerCase()} planner`, "printable pdf", "instant download"]) {
      t = String(t).trim().toLowerCase();
      if (t && t.length <= 20 && !out.includes(t)) out.push(t);
    }
    return out.slice(0, 13);
  }

  function listingCopy(bundle, theme) {
    const names = bundle.pages.map(k => LAYOUTS[k][0]), n = names.length;
    let title = `${bundle.name}, ${theme} Minimalist Printable, A4 & US Letter PDF, Undated, Instant Download`;
    if (title.length > 140) title = `${bundle.name}, ${theme} Printable PDF, A4 & US Letter`.slice(0, 140);
    const description = `${bundle.intro}

WHAT'S INCLUDED
${names.map(x => "- " + x).join("\n")}
- ${n} page${n === 1 ? "" : "s"}, each in A4 and US Letter size (2 PDF files)
- ${theme} colour theme with a clean, minimalist design
- Undated, so you can use it any year and print it as often as you like

HOW IT WORKS
1. Buy and download the files instantly
2. Open the PDF on your computer, tablet or phone
3. Print at home or at a print shop, as many copies as you need
4. Or write on it digitally in a note-taking app that supports PDF annotation

PLEASE NOTE
- This is a digital download. No physical item will be shipped.
- Colours can look slightly different depending on your screen and printer.
- For personal use only. Please do not share or resell the files.
`;
    return { title, shortName: `${bundle.name} (${theme})`, description, tags: cleanTags(bundle.tags, theme),
      price: Math.round(bundle.price * 100) / 100 };
  }

  // ---- renderers ------------------------------------------------------------

  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;

  function drawShapes(ctx, shapes, k, ox, oy) {
    ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.textBaseline = "alphabetic";
    for (const s of shapes) {
      if (s.t === "rect") {
        if (s.fill) { ctx.fillStyle = css(s.fill); ctx.fillRect(s.x, s.y, s.w, s.h); }
        if (s.stroke) { ctx.strokeStyle = css(s.stroke); ctx.lineWidth = s.lw; ctx.strokeRect(s.x, s.y, s.w, s.h); }
      } else if (s.t === "line") {
        ctx.setLineDash(s.dash ? [2, 2.5] : []); ctx.strokeStyle = css(s.color); ctx.lineWidth = s.lw;
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); ctx.setLineDash([]);
      } else if (s.t === "circle") {
        ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
        if (s.fill) { ctx.fillStyle = css(s.fill); ctx.fill(); }
        if (s.stroke) { ctx.strokeStyle = css(s.stroke); ctx.lineWidth = s.lw; ctx.stroke(); }
      } else if (s.t === "text") {
        ctx.font = `${s.bold ? 700 : 400} ${s.s}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = css(s.color); ctx.textAlign = s.align || "left"; ctx.fillText(s.text, s.x, s.y);
      }
    }
    ctx.restore();
  }

  function pageToPdf(doc, shapes) {
    const dash = (on) => { if (doc.setLineDashPattern) doc.setLineDashPattern(on ? [2, 2.5] : [], 0); };
    for (const s of shapes) {
      if (s.t === "rect") {
        if (s.fill) { doc.setFillColor(...s.fill); doc.rect(s.x, s.y, s.w, s.h, "F"); }
        if (s.stroke) { doc.setDrawColor(...s.stroke); doc.setLineWidth(s.lw); doc.rect(s.x, s.y, s.w, s.h, "S"); }
      } else if (s.t === "line") {
        dash(s.dash); doc.setDrawColor(...s.color); doc.setLineWidth(s.lw); doc.line(s.x1, s.y1, s.x2, s.y2); dash(false);
      } else if (s.t === "circle") {
        if (s.fill) doc.setFillColor(...s.fill);
        if (s.stroke) { doc.setDrawColor(...s.stroke); doc.setLineWidth(s.lw); }
        doc.circle(s.cx, s.cy, s.r, s.fill && s.stroke ? "FD" : s.fill ? "F" : "S");
      } else if (s.t === "text") {
        doc.setFont("helvetica", s.bold ? "bold" : "normal"); doc.setFontSize(s.s); doc.setTextColor(...s.color);
        doc.text(s.text, s.x, s.y, { align: s.align || "left" });
      }
    }
  }

  function makePdf(product, sizeName) {
    const size = SIZES[sizeName];
    const doc = new window.jspdf.jsPDF({ unit: "pt", format: size, compress: true });
    doc.setProperties({ title: product.shortName });
    product.bundle.pages.forEach((key, i) => {
      if (i > 0) doc.addPage(size);
      pageToPdf(doc, buildPage(key, sizeName, product.theme).shapes);
    });
    return doc.output("blob");
  }

  function lighten(c, a) { return c.map(v => Math.round(v + (255 - v) * a)); }

  function coverCanvas(product, width = 2000) {
    const W = width, H = Math.round(width * 0.8), th = THEMES[product.theme];
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = css(th.light); ctx.fillRect(0, 0, W, H);
    // headline, wrapped to two lines if needed
    const name = product.bundle.name;
    let fs = W * 0.06;
    ctx.fillStyle = css(th.accent); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const setFont = () => { ctx.font = `600 ${fs}px Fraunces, Georgia, serif`; };
    setFont();
    let lines = [name];
    if (ctx.measureText(name).width > W * 0.88) {
      const words = name.split(" "); let best = [name], bestW = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
        const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (w < bestW) { bestW = w; best = [a, b]; }
      }
      lines = best;
      while (bestW > W * 0.88 && fs > 20) { fs -= 2; setFont(); bestW = Math.max(...lines.map(l => ctx.measureText(l).width)); }
    }
    let ty = H * 0.04 + fs;
    for (const l of lines) { ctx.fillText(l, W / 2, ty); ty += fs * 1.12; }
    ctx.fillStyle = css(th.ink);
    ctx.font = `500 ${W * 0.017}px Inter, Helvetica, Arial, sans-serif`;
    ctx.fillText("PRINTABLE PDF  ·  A4 & US LETTER  ·  INSTANT DOWNLOAD", W / 2, ty - fs * 0.35 + W * 0.02);
    // pages
    const keys = product.bundle.pages.slice(0, 3), size = SIZES.A4;
    const top = ty + W * 0.03, ph = H * 0.9 - top - H * 0.03, k = ph / size[1], pw = size[0] * k, gap = W * 0.03;
    const total = keys.length * pw + (keys.length - 1) * gap;
    keys.forEach((key, i) => {
      const x = (W - total) / 2 + i * (pw + gap);
      ctx.fillStyle = css(lighten(th.accent, 0.55)); ctx.fillRect(x + W * 0.005, top + W * 0.006, pw, ph);
      ctx.fillStyle = "#fff"; ctx.fillRect(x, top, pw, ph);
      drawShapes(ctx, buildPage(key, "A4", product.theme).shapes, k, x, top);
    });
    // footer band
    const by = H * 0.9; ctx.fillStyle = css(th.accent); ctx.fillRect(0, by, W, H - by);
    const n = product.bundle.pages.length;
    ctx.fillStyle = "#fff"; ctx.font = `700 ${W * 0.02}px Inter, Helvetica, Arial, sans-serif`; ctx.textBaseline = "middle";
    ctx.fillText(`${n} PAGE${n === 1 ? "" : "S"}  ·  UNDATED  ·  ${product.theme.toUpperCase()} THEME`, W / 2, by + (H - by) / 2);
    return cv;
  }

  function pageCanvas(product, key, width = 2000) {
    const W = width, H = Math.round(width * 0.8), th = THEMES[product.theme], size = SIZES.A4;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = css(th.light); ctx.fillRect(0, 0, W, H);
    const ph = H * 0.9, k = ph / size[1], pw = size[0] * k, x = (W - pw) / 2, top = (H - ph) / 2;
    ctx.fillStyle = css(lighten(th.accent, 0.55)); ctx.fillRect(x + W * 0.005, top + W * 0.006, pw, ph);
    ctx.fillStyle = "#fff"; ctx.fillRect(x, top, pw, ph);
    drawShapes(ctx, buildPage(key, "A4", product.theme).shapes, k, x, top);
    return cv;
  }

  const canvasBlob = (cv, type = "image/png", q) => new Promise(res => cv.toBlob(res, type, q));

  window.EB_DESIGNS = { SIZES, THEMES, LAYOUTS, BUNDLES, listingCopy, cleanTags, makePdf, coverCanvas, pageCanvas, canvasBlob };
})();
