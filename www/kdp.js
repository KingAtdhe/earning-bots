/* KDP + printable generators: mazes, mandala coloring pages, notebooks, math worksheets, and book covers. */
(function () {
  "use strict";
  const { U } = window.EB;

  // seeded random so a stored seed always redraws the same page
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }

  // ---- mazes ------------------------------------------------------------------------
  function maze(w, h, seed) {
    const r = rng(seed), walls = new Uint8Array(w * h).fill(15), seen = new Uint8Array(w * h); // bits: 1=N 2=E 4=S 8=W
    const stack = [0]; seen[0] = 1;
    const D = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
    while (stack.length) {
      const c = stack[stack.length - 1], x = c % w, y = Math.floor(c / w);
      const opts = D.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx]; });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy, a, b] = opts[Math.floor(r() * opts.length)], n = (y + dy) * w + x + dx;
      walls[c] &= ~a; walls[n] &= ~b; seen[n] = 1; stack.push(n);
    }
    walls[0] &= ~8; walls[w * h - 1] &= ~2; // entrance left, exit right
    // solution by BFS
    const prev = new Int32Array(w * h).fill(-1), q = [0]; prev[0] = 0;
    while (q.length) {
      const c = q.shift(), x = c % w, y = Math.floor(c / w);
      for (const [dx, dy, a] of D) { if (walls[c] & a) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const n = ny * w + nx; if (prev[n] < 0) { prev[n] = c; q.push(n); } }
    }
    const path = []; for (let c = w * h - 1; ; c = prev[c]) { path.push(c); if (c === 0) break; }
    return { w, h, walls, path: path.reverse() };
  }
  function drawMaze(doc, m, x, y, size, solved) {
    const cell = Math.min(size / m.w, (size * 1.3) / m.h), ox = x + (size - cell * m.w) / 2;
    doc.setDrawColor(20); doc.setLineWidth(Math.max(0.8, cell * 0.09)); doc.setLineCap && doc.setLineCap("round");
    for (let i = 0; i < m.w * m.h; i++) {
      const cx = ox + (i % m.w) * cell, cy = y + Math.floor(i / m.w) * cell, wl = m.walls[i];
      if (wl & 1) doc.line(cx, cy, cx + cell, cy);
      if (wl & 8) doc.line(cx, cy, cx, cy + cell);
      if (wl & 4 && Math.floor(i / m.w) === m.h - 1) doc.line(cx, cy + cell, cx + cell, cy + cell);
      if (wl & 2 && i % m.w === m.w - 1) doc.line(cx + cell, cy, cx + cell, cy + cell);
      if (wl & 4 && Math.floor(i / m.w) < m.h - 1) doc.line(cx, cy + cell, cx + cell, cy + cell);
    }
    if (solved) {
      doc.setDrawColor(200, 60, 60); doc.setLineWidth(Math.max(0.8, cell * 0.28));
      for (let k = 1; k < m.path.length; k++) {
        const a = m.path[k - 1], b = m.path[k];
        doc.line(ox + (a % m.w + 0.5) * cell, y + (Math.floor(a / m.w) + 0.5) * cell, ox + (b % m.w + 0.5) * cell, y + (Math.floor(b / m.w) + 0.5) * cell);
      }
    }
    doc.setLineCap && doc.setLineCap("butt");
    return cell * m.h;
  }

  // ---- mandalas (drawn on canvas, black line art) -------------------------------------
  function mandalaCanvas(seed, size = 2400) {
    const r = rng(seed), cv = document.createElement("canvas"); cv.width = size; cv.height = size;
    const x = cv.getContext("2d"), c = size / 2, R = size * 0.47;
    x.fillStyle = "#fff"; x.fillRect(0, 0, size, size);
    x.strokeStyle = "#111"; x.lineJoin = "round"; x.lineCap = "round";
    const lw = size / 520;
    let rad = R * (0.08 + r() * 0.05);
    x.lineWidth = lw * 1.4; x.beginPath(); x.arc(c, c, rad, 0, 7); x.stroke();
    x.beginPath(); x.arc(c, c, rad * 0.45, 0, 7); x.stroke();
    while (rad < R * 0.97) {
      const band = R * (0.07 + r() * 0.09), n = [8, 10, 12, 16, 18, 20, 24, 32][Math.floor(r() * 8)], motif = Math.floor(r() * 6), outer = Math.min(R, rad + band);
      x.lineWidth = lw;
      x.save(); x.translate(c, c);
      for (let i = 0; i < n; i++) {
        x.save(); x.rotate((i / n) * Math.PI * 2);
        const half = Math.PI / n, mid = (rad + outer) / 2, wdt = Math.sin(half) * outer;
        x.beginPath();
        if (motif === 0) { // petal
          x.moveTo(0, -rad); x.quadraticCurveTo(wdt, -mid, 0, -outer); x.quadraticCurveTo(-wdt, -mid, 0, -rad);
          x.moveTo(0, -rad - band * 0.2); x.quadraticCurveTo(wdt * 0.45, -mid, 0, -outer + band * 0.2); x.quadraticCurveTo(-wdt * 0.45, -mid, 0, -rad - band * 0.2);
        } else if (motif === 1) { // scallop
          x.arc(0, -rad, wdt, Math.PI, 0); x.moveTo(wdt * 0.5, -rad); x.arc(0, -rad, wdt * 0.5, 0, Math.PI, true);
        } else if (motif === 2) { // circles
          const cr = Math.min(band / 2, wdt) * 0.85; x.arc(0, -mid, cr, 0, 7); x.moveTo(cr * 0.45, -mid); x.arc(0, -mid, cr * 0.45, 0, 7);
        } else if (motif === 3) { // pointed leaf / triangle
          x.moveTo(-wdt * 0.8, -rad); x.lineTo(0, -outer); x.lineTo(wdt * 0.8, -rad); x.moveTo(0, -rad); x.lineTo(0, -outer + band * 0.25);
        } else if (motif === 4) { // teardrops
          x.moveTo(0, -outer); x.bezierCurveTo(wdt * 0.9, -mid, wdt * 0.5, -rad, 0, -rad); x.bezierCurveTo(-wdt * 0.5, -rad, -wdt * 0.9, -mid, 0, -outer);
          x.moveTo(wdt * 0.15 + band * 0.08, -rad - band * 0.35); x.arc(0, -rad - band * 0.35, band * 0.08 + wdt * 0.15, 0, 7);
        } else { // rays
          x.moveTo(Math.sin(half) * rad, -Math.cos(half) * rad); x.lineTo(Math.sin(half) * outer, -Math.cos(half) * outer);
          x.moveTo(0, -rad - band * 0.15); x.lineTo(0, -outer + band * 0.15);
        }
        x.stroke(); x.restore();
      }
      x.restore();
      rad = outer; x.lineWidth = lw * 1.3; x.beginPath(); x.arc(c, c, rad, 0, 7); x.stroke();
      if (r() < 0.4 && rad < R * 0.9) { rad += R * 0.02; x.beginPath(); x.arc(c, c, rad, 0, 7); x.stroke(); }
    }
    return cv;
  }

  // ---- worksheets -------------------------------------------------------------------------
  const OPS = { add: "+", sub: "−", mul: "×", div: "÷" };
  function problems(op, level, n, seed) {
    const r = rng(seed), out = [], max = [10, 20, 100, 1000][level] || 20, tmax = [5, 10, 12, 12][level] || 10;
    for (let i = 0; i < n; i++) {
      let a, b, ans;
      if (op === "add") { a = 1 + Math.floor(r() * max); b = 1 + Math.floor(r() * max); ans = a + b; }
      else if (op === "sub") { a = 1 + Math.floor(r() * max); b = Math.floor(r() * a); ans = a - b; }
      else if (op === "mul") { a = 1 + Math.floor(r() * tmax); b = 1 + Math.floor(r() * tmax); ans = a * b; }
      else { b = 1 + Math.floor(r() * tmax); ans = 1 + Math.floor(r() * tmax); a = b * ans; }
      out.push([a, b, ans]);
    }
    return out;
  }

  // ---- interiors -----------------------------------------------------------------------------
  function frontMatter(doc, W, H, d) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(W < 500 ? 24 : 32); doc.setTextColor(20);
    doc.text(doc.splitTextToSize(d.title, W - 120), W / 2, H * 0.33, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(W < 500 ? 12 : 15);
    doc.text(doc.splitTextToSize(d.subtitle || "", W - 140), W / 2, H * 0.47, { align: "center" });
    doc.setFontSize(12); doc.text(d.author || "", W / 2, H * 0.58, { align: "center" });
    doc.addPage();
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text([`Copyright © ${new Date().getFullYear()} ${d.author || ""}`.trim(), "All rights reserved."], 50, H - 90);
  }
  const pageNo = (doc, W, H, n) => { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(130); doc.text(String(n), W / 2, H - 24, { align: "center" }); };

  // async so long books (coloring pages are images) never freeze the screen
  async function interior(item) {
    const d = item.data, J = window.jspdf.jsPDF;
    if (d.type === "maze") {
      const W = 612, H = 792, doc = new J({ unit: "pt", format: [W, H], compress: true }); let page = 2;
      frontMatter(doc, W, H, d);
      const mazes = d.seeds.map(s => maze(d.w, d.h, s));
      for (const [i, m] of mazes.entries()) { if (i % 10 === 9) await new Promise(r => setTimeout(r, 0)); doc.addPage(); page++; doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(20); doc.text(`Maze ${i + 1}`, W / 2, 70, { align: "center" }); drawMaze(doc, m, 66, 100, W - 132); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("START →", 30, 96); pageNo(doc, W, H, page); }
      doc.addPage(); page++; doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.setTextColor(20); doc.text("Solutions", W / 2, H / 2, { align: "center" });
      for (let i = 0; i < mazes.length; i += 4) {
        doc.addPage(); page++;
        for (let k = 0; k < 4 && i + k < mazes.length; k++) { const x = 50 + (k % 2) * 270, y = 70 + Math.floor(k / 2) * 350; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20); doc.text(`Maze ${i + k + 1}`, x, y - 8); drawMaze(doc, mazes[i + k], x, y, 240, true); }
        pageNo(doc, W, H, page);
      }
      if (page % 2) doc.addPage();
      return doc.output("blob");
    }
    if (d.type === "coloring") {
      const W = 612, H = 792, doc = new J({ unit: "pt", format: [W, H], compress: true });
      frontMatter(doc, W, H, d);
      for (const s of d.seeds) {
        doc.addPage(); const cv = mandalaCanvas(s, 2200), img = cv.toDataURL("image/jpeg", 0.88); cv.width = 0;
        doc.addImage(img, "JPEG", 36, (H - (W - 72)) / 2, W - 72, W - 72, undefined, "FAST");
        doc.addPage(); doc.setFontSize(9); doc.setTextColor(170); doc.text("This page is left blank so colors don't bleed through.", W / 2, H / 2, { align: "center" });
        await new Promise(r => setTimeout(r, 0));
      }
      return doc.output("blob");
    }
    if (d.type === "notebook") {
      const W = 432, H = 648, doc = new J({ unit: "pt", format: [W, H], compress: true }), m = 40;
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(30); doc.text("This notebook belongs to", W / 2, H * 0.4, { align: "center" });
      doc.setDrawColor(150); doc.line(m + 30, H * 0.47, W - m - 30, H * 0.47);
      for (let p = 1; p < d.pages; p++) {
        doc.addPage(); doc.setDrawColor(185); doc.setFillColor(150);
        const inner = p % 2 ? m + 10 : m, x0 = inner, x1 = W - (p % 2 ? m : m + 10);
        if (d.style === "lined") { doc.setLineWidth(0.5); for (let y = 70; y < H - 40; y += 21.6) doc.line(x0, y, x1, y); }
        else if (d.style === "dot") { for (let y = 50; y < H - 36; y += 14.17) for (let x = x0; x <= x1; x += 14.17) doc.circle(x, y, 0.55, "F"); }
        else if (d.style === "graph") { doc.setLineWidth(0.3); for (let y = 50; y <= H - 40; y += 14.17) doc.line(x0, y, x1, y); for (let x = x0; x <= x1 + 0.1; x += 14.17) doc.line(x, 50, x, H - 40 - ((H - 90) % 14.17)); }
        else { doc.setLineWidth(0.5); doc.line(x0, 52, x1, 52); doc.setFontSize(8); doc.setTextColor(150); doc.text("DATE", x1 - 80, 46); for (let y = 82; y < H - 40; y += 21.6) doc.line(x0, y, x1, y); }
      }
      return doc.output("blob");
    }
    if (d.type === "worksheet") {
      const W = 612, H = 792, doc = new J({ unit: "pt", format: [W, H], compress: true });
      const pagesP = d.seeds.map(s => problems(d.op, d.level, 30, s));
      const draw = (probs, key, idx) => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(30);
        doc.text(`${d.opName} ${key ? "Answer Key" : "Practice"} ${idx + 1}`, 50, 64);
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(90);
        doc.text("Name ____________________   Date __________   Score ____ / 30", 50, 88);
        probs.forEach(([a, b, ans], i) => {
          const col = i % 5, row = Math.floor(i / 5), x = 80 + col * 104, y = 150 + row * 104;
          doc.setFont("courier", "bold"); doc.setFontSize(19); doc.setTextColor(25);
          doc.text(String(a), x + 52, y, { align: "right" }); doc.text(`${OPS[d.op] === "−" ? "-" : OPS[d.op] === "×" ? "x" : OPS[d.op] === "÷" ? "/" : "+"} ${b}`, x + 52, y + 24, { align: "right" });
          doc.setDrawColor(40); doc.setLineWidth(1.2); doc.line(x, y + 32, x + 56, y + 32);
          if (key) { doc.setTextColor(200, 50, 50); doc.text(String(ans), x + 52, y + 56, { align: "right" }); }
        });
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150); doc.text(d.title, W / 2, H - 28, { align: "center" });
      };
      pagesP.forEach((p, i) => { if (i) doc.addPage(); draw(p, false, i); });
      pagesP.forEach((p, i) => { doc.addPage(); draw(p, true, i); });
      return doc.output("blob");
    }
    throw new Error("Unknown book type");
  }

  // one worksheet page as an image (for listing photos)
  function worksheetPage(item, idx = 0, key = false, width = 1100) {
    const d = item.data, k = width / 612, H = Math.round(792 * k), cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, width, H); x.scale(k, k);
    x.fillStyle = "#1e1e1e"; x.font = "700 20px Inter, Arial, sans-serif"; x.fillText(`${d.opName} ${key ? "Answer Key" : "Practice"} ${idx + 1}`, 50, 64);
    x.fillStyle = "#5a5a5a"; x.font = "400 11px Inter, Arial, sans-serif"; x.fillText("Name ____________________   Date __________   Score ____ / 30", 50, 88);
    problems(d.op, d.level, 30, d.seeds[idx % d.seeds.length]).forEach(([a, b, ans], i) => {
      const px = 80 + (i % 5) * 104, py = 150 + Math.floor(i / 5) * 104;
      x.textAlign = "right"; x.fillStyle = "#191919"; x.font = "700 19px 'Courier New', monospace";
      x.fillText(String(a), px + 52, py); x.fillText(`${OPS[d.op]} ${b}`, px + 52, py + 24);
      x.fillRect(px, py + 31, 56, 1.4);
      if (key) { x.fillStyle = "#c83232"; x.fillText(String(ans), px + 52, py + 56); }
      x.textAlign = "left";
    });
    x.fillStyle = "#969696"; x.font = "400 8px Inter, Arial, sans-serif"; x.textAlign = "center"; x.fillText(d.title, 306, 764);
    return cv;
  }

  // ---- covers ----------------------------------------------------------------------------------
  const PALETTES = [["#16324f", "#f2c14e"], ["#2d6a4f", "#f1faee"], ["#7b2d26", "#f6d8ae"], ["#3d348b", "#f7b801"], ["#0b525b", "#ffd6a5"], ["#5a189a", "#ffd166"], ["#283618", "#fefae0"], ["#9a031e", "#fcd5ce"], ["#14213d", "#fca311"]];
  function cover(item, width = 2400) {
    const d = item.data, ratio = d.type === "notebook" ? 9 / 6 : 11 / 8.5, H = Math.round(width * ratio);
    const cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const x = cv.getContext("2d"), [bg, fg] = PALETTES[(d.palette || 0) % PALETTES.length], u = width / 100, r = rng(d.seed || 7);
    x.fillStyle = bg; x.fillRect(0, 0, width, H);
    x.textAlign = "center";
    if (d.type === "notebook") {
      x.globalAlpha = 0.16; x.fillStyle = fg;
      const pat = d.pattern || 0;
      for (let i = 0; i < 160; i++) {
        const px = r() * width, py = r() * H, s = u * (1 + r() * 4);
        x.beginPath();
        if (pat === 0) x.arc(px, py, s, 0, 7); else if (pat === 1) { x.rect(px, py, s, s); } else { x.moveTo(px, py - s); x.lineTo(px + s, py + s); x.lineTo(px - s, py + s); }
        x.fill();
      }
      x.globalAlpha = 1;
      const bw = width * 0.72, bh = H * 0.28, bx = (width - bw) / 2, by = H * 0.33;
      x.fillStyle = fg; x.fillRect(bx, by, bw, bh); x.fillStyle = bg;
      let fs = u * 9; x.font = `800 ${fs}px Fraunces, Georgia, serif`;
      const lines = String(d.coverTitle || d.title).split("\n");
      while (lines.some(l => x.measureText(l).width > bw * 0.86) && fs > 20) { fs -= 4; x.font = `800 ${fs}px Fraunces, Georgia, serif`; }
      lines.forEach((l, i) => x.fillText(l, width / 2, by + bh / 2 + (i - (lines.length - 1) / 2) * fs * 1.1 + fs * 0.35));
      x.fillStyle = fg; x.font = `600 ${u * 3.6}px Inter, Arial, sans-serif`;
      x.fillText(`${d.style.toUpperCase()} · ${d.pages} PAGES · 6 x 9 IN`, width / 2, H * 0.9);
      return cv;
    }
    x.fillStyle = fg; x.font = `400 ${u * 6}px "Bebas Neue", Impact, sans-serif`;
    x.fillText(d.kicker || "", width / 2, u * 13);
    let fs = u * 18; x.font = `400 ${fs}px "Bebas Neue", Impact, sans-serif`;
    const main = d.coverMain || d.title;
    while (x.measureText(main).width > width * 0.9 && fs > 30) { fs -= u; x.font = `400 ${fs}px "Bebas Neue", Impact, sans-serif`; }
    x.fillText(main, width / 2, u * 13 + fs * 0.95);
    x.font = `600 ${u * 4.4}px Fraunces, Georgia, serif`; x.fillText(d.coverSub || "", width / 2, u * 13 + fs + u * 7);
    const box = width * 0.66, bx = (width - box) / 2, by = H * 0.4;
    x.fillStyle = "#fff"; x.fillRect(bx - u, by - u, box + 2 * u, box + 2 * u);
    if (d.type === "coloring") x.drawImage(mandalaCanvas(d.seeds[0], 1200), bx, by, box, box);
    else if (d.type === "maze") {
      const m = maze(Math.min(d.w, 16), Math.min(d.w, 16), d.seeds[0]), cell = box / m.w;
      x.strokeStyle = "#111"; x.lineWidth = cell * 0.12; x.lineCap = "round";
      for (let i = 0; i < m.w * m.h; i++) { const cx = bx + (i % m.w) * cell, cy = by + Math.floor(i / m.w) * cell, wl = m.walls[i]; x.beginPath(); if (wl & 1) { x.moveTo(cx, cy); x.lineTo(cx + cell, cy); } if (wl & 8) { x.moveTo(cx, cy); x.lineTo(cx, cy + cell); } if (wl & 4) { x.moveTo(cx, cy + cell); x.lineTo(cx + cell, cy + cell); } if (wl & 2) { x.moveTo(cx + cell, cy); x.lineTo(cx + cell, cy + cell); } x.stroke(); }
      x.strokeStyle = bg; x.lineWidth = cell * 0.3; x.beginPath(); m.path.forEach((c, k) => { const px = bx + (c % m.w + 0.5) * cell, py = by + (Math.floor(c / m.w) + 0.5) * cell; k ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
    } else if (d.type === "worksheet") {
      x.fillStyle = "#111"; x.font = `700 ${box * 0.11}px "Courier New", monospace`; x.textAlign = "right";
      problems(d.op, d.level, 4, d.seeds[0]).forEach(([a, b], i) => { const px = bx + box * (0.36 + (i % 2) * 0.46), py = by + box * (0.25 + Math.floor(i / 2) * 0.46); x.fillText(String(a), px, py); x.fillText(`${OPS[d.op]} ${b}`, px, py + box * 0.12); x.fillRect(px - box * 0.3, py + box * 0.15, box * 0.3, box * 0.012); });
      x.textAlign = "center";
    }
    x.fillStyle = fg; x.font = `600 ${u * 3.3}px Inter, Arial, sans-serif`; x.fillText(d.footer || "", width / 2, H - u * 8);
    return cv;
  }

  window.EB_KDP = { maze, mandalaCanvas, problems, interior, cover, worksheetPage, OPS, rng };
})();
