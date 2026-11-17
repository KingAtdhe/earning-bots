/* Wall art prints (abstract boho / Bauhaus / quote typography), Pinterest pins and ebook PDFs. */
(function () {
  "use strict";
  const { U } = window.EB;
  const { rng } = window.EB_KDP;

  const ART_PALETTES = [
    { name: "Terracotta", bg: "#f3e9dc", c: ["#c86b4a", "#e0a96d", "#7a8b69", "#3e3a36", "#d9c3a5"] },
    { name: "Sage", bg: "#eef0e8", c: ["#8a9a7b", "#c9b79c", "#5e6b52", "#e2c290", "#2f3a2f"] },
    { name: "Blush", bg: "#f8ede9", c: ["#e4a9a0", "#c97b70", "#f0cfa9", "#6d4c41", "#b8a39b"] },
    { name: "Navy & Mustard", bg: "#f4efe6", c: ["#1f3557", "#e3a72f", "#c45c3b", "#7d9bb0", "#2b2b2b"] },
    { name: "Ocean", bg: "#eef3f3", c: ["#2a6f78", "#8fb8b8", "#e6b980", "#1d3b44", "#d97b5d"] },
    { name: "Mono", bg: "#f2f0eb", c: ["#1e1e1e", "#8c8c8c", "#c9c4ba", "#4a4a4a", "#b08d57"] },
  ];
  const SIZES = [["2x3", 2, 3, "24x36 in, 20x30 in, 16x24 in, 12x18 in, 8x12 in, 4x6 in"], ["3x4", 3, 4, "18x24 in, 12x16 in, 9x12 in, 6x8 in"],
    ["4x5", 4, 5, "16x20 in, 8x10 in, 4x5 in"], ["ISO", 1, Math.SQRT2, "A1, A2, A3, A4, A5"], ["11x14", 11, 14, "11x14 in"]];

  function artCanvas(item, sizeKey = "2x3", long = 1500) {
    const d = item.data, [, a, b] = SIZES.find(s => s[0] === sizeKey) || SIZES[0];
    const H = long, W = Math.round(long * a / b), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"), pal = ART_PALETTES[d.palette % ART_PALETTES.length], r = rng(d.seed), u = W / 100;
    x.fillStyle = pal.bg; x.fillRect(0, 0, W, H);
    const col = () => pal.c[Math.floor(r() * pal.c.length)];
    const cx = W / 2, cy = H * 0.46;
    if (d.style === "arches") {
      const n = 4 + Math.floor(r() * 3), rw = W * 0.34;
      for (let i = 0; i < n; i++) { x.fillStyle = pal.c[i % pal.c.length]; const ww = rw - i * (rw / n); x.beginPath(); x.moveTo(cx - ww, cy + H * 0.2); x.lineTo(cx - ww, cy); x.arc(cx, cy, ww, Math.PI, 0); x.lineTo(cx + ww, cy + H * 0.2); x.fill(); }
      x.fillStyle = col(); x.beginPath(); x.arc(cx + W * 0.22, cy - H * 0.2, W * 0.07, 0, 7); x.fill();
    } else if (d.style === "sun") {
      x.fillStyle = col(); x.beginPath(); x.arc(cx, cy, W * 0.26, Math.PI, 0); x.fill();
      x.strokeStyle = col(); x.lineWidth = u * 1.2;
      for (let i = 0; i <= 12; i++) { const ang = Math.PI + (i / 12) * Math.PI; x.beginPath(); x.moveTo(cx + Math.cos(ang) * W * 0.31, cy + Math.sin(ang) * W * 0.31); x.lineTo(cx + Math.cos(ang) * W * 0.42, cy + Math.sin(ang) * W * 0.42); x.stroke(); }
      x.fillStyle = col(); x.fillRect(W * 0.12, cy + u, W * 0.76, u * 1.4);
      for (let i = 0; i < 3; i++) { x.fillStyle = pal.c[(i + 2) % pal.c.length]; x.beginPath(); x.ellipse(cx, cy + H * (0.08 + i * 0.07), W * (0.36 - i * 0.08), H * 0.025, 0, 0, 7); x.fill(); }
    } else if (d.style === "bauhaus") {
      const g = 3, cell = W * 0.8 / g, ox = W * 0.1, oy = (H - cell * g) / 2.3;
      for (let i = 0; i < g * g; i++) {
        const px = ox + (i % g) * cell, py = oy + Math.floor(i / g) * cell, t = Math.floor(r() * 4);
        x.fillStyle = col(); x.fillRect(px, py, cell, cell); x.fillStyle = col();
        x.beginPath();
        if (t === 0) x.arc(px + cell / 2, py + cell / 2, cell * 0.4, 0, 7);
        else if (t === 1) { x.moveTo(px, py + cell); x.arc(px, py + cell, cell, -Math.PI / 2, 0); }
        else if (t === 2) { x.moveTo(px, py); x.lineTo(px + cell, py + cell); x.lineTo(px, py + cell); }
        else x.arc(px + cell / 2, py + cell, cell / 2, Math.PI, 0);
        x.fill();
      }
    } else if (d.style === "blobs") {
      for (let i = 0; i < 7; i++) {
        x.fillStyle = col(); x.beginPath();
        const bx = W * (0.2 + r() * 0.6), by = H * (0.2 + r() * 0.55), br = W * (0.08 + r() * 0.16), pts = 8;
        for (let k = 0; k <= pts; k++) { const ang = (k / pts) * Math.PI * 2, rr = br * (0.75 + r() * 0.5); const px = bx + Math.cos(ang) * rr, py = by + Math.sin(ang) * rr; k ? x.quadraticCurveTo(bx + Math.cos(ang - 0.4) * rr * 1.15, by + Math.sin(ang - 0.4) * rr * 1.15, px, py) : x.moveTo(px, py); }
        x.fill();
      }
      x.strokeStyle = pal.c[3]; x.lineWidth = u * 0.5; x.beginPath(); for (let k = 0; k < 6; k++) x.arc(W * (0.25 + k * 0.1), H * 0.82, u * 0.8, 0, 7); x.stroke();
    } else { // quote
      x.fillStyle = pal.c[0]; x.fillRect(W * 0.08, H * 0.08, W * 0.84, H * 0.84); x.fillStyle = pal.bg; x.fillRect(W * 0.1, H * 0.095, W * 0.8, H * 0.81);
      const words = String(d.quote || "").split(" "), lines = []; let line = "", fs = u * 11;
      x.font = `800 ${fs}px Fraunces, Georgia, serif`;
      for (const w of words) { const t = line ? line + " " + w : w; if (x.measureText(t).width > W * 0.68 && line) { lines.push(line); line = w; } else line = t; }
      if (line) lines.push(line);
      while (lines.length * fs * 1.15 > H * 0.55 && fs > 20) fs -= 4;
      x.font = `800 ${fs}px Fraunces, Georgia, serif`; x.fillStyle = pal.c[3]; x.textAlign = "center";
      let y = H / 2 - (lines.length - 1) * fs * 0.575;
      lines.forEach(l => { x.fillText(l, cx, y + fs * 0.35); y += fs * 1.15; });
      x.fillStyle = pal.c[1]; x.fillRect(cx - u * 6, y + u * 2, u * 12, u * 0.8);
    }
    if (d.style !== "quote" && d.caption) { x.fillStyle = pal.c[3]; x.textAlign = "center"; x.font = `500 ${u * 2.6}px Inter, Arial, sans-serif`; x.fillText(d.caption.toUpperCase().split("").join(" "), cx, H * 0.88); }
    return cv;
  }

  function roomMockup(item, width = 1600) {
    const H = Math.round(width * 0.8), cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const x = cv.getContext("2d"), u = width / 100;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#efe9df"); g.addColorStop(1, "#e3dacb"); x.fillStyle = g; x.fillRect(0, 0, width, H);
    x.fillStyle = "#cdbfa9"; x.fillRect(0, H * 0.78, width, H * 0.22);
    x.fillStyle = "#8b6f4e"; x.fillRect(u * 10, H * 0.7, u * 80, u * 3); x.fillRect(u * 14, H * 0.7, u * 2, H * 0.12); x.fillRect(u * 84, H * 0.7, u * 2, H * 0.12);
    x.fillStyle = "#5f7a57"; x.beginPath(); x.ellipse(u * 20, H * 0.6, u * 4, u * 9, -0.3, 0, 7); x.ellipse(u * 24, H * 0.58, u * 3.5, u * 8, 0.35, 0, 7); x.fill();
    x.fillStyle = "#c9a27e"; x.fillRect(u * 18, H * 0.62, u * 7, H * 0.08);
    const art = artCanvas(item, "2x3", 900), fh = H * 0.56, fw = fh * 2 / 3, fx = (width - fw) / 2, fy = H * 0.08;
    x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(fx + u * 0.8, fy + u * 1, fw, fh);
    x.fillStyle = "#2b2622"; x.fillRect(fx - u, fy - u, fw + 2 * u, fh + 2 * u); x.fillStyle = "#fff"; x.fillRect(fx, fy, fw, fh);
    x.drawImage(art, fx + u * 1.6, fy + u * 1.6, fw - u * 3.2, fh - u * 3.2);
    return cv;
  }

  // Pinterest pin promoting one of your items
  function pinCanvas(item, sourceCanvas, width = 1000) {
    const d = item.data, H = Math.round(width * 1.5), cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const x = cv.getContext("2d"), u = width / 100, pal = [["#1f3d33", "#f4ead5", "#e9b949"], ["#f4ead5", "#1f3d33", "#c86b4a"], ["#2b2d42", "#fefae0", "#ef8354"]][(d.palette || 0) % 3];
    x.fillStyle = pal[0]; x.fillRect(0, 0, width, H);
    if (sourceCanvas) { const iw = width * 0.88, ih = iw * sourceCanvas.height / sourceCanvas.width, ix = (width - iw) / 2, iy = H * 0.33; x.fillStyle = "rgba(0,0,0,.2)"; x.fillRect(ix + u, iy + u, iw, Math.min(ih, H * 0.6)); x.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, Math.min(sourceCanvas.height, sourceCanvas.width * (H * 0.6) / iw), ix, iy, iw, Math.min(ih, H * 0.6)); }
    x.fillStyle = pal[2]; x.font = `700 ${u * 4}px Inter, Arial, sans-serif`; x.textAlign = "center"; x.fillText(String(d.kicker || "PRINTABLE").toUpperCase(), width / 2, u * 10);
    x.fillStyle = pal[1]; let fs = u * 8.5; x.font = `800 ${fs}px Fraunces, Georgia, serif`;
    const words = String(d.headline).split(" "), lines = []; let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (x.measureText(t).width > width * 0.86 && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((l, i) => x.fillText(l, width / 2, u * 21 + i * fs * 1.1));
    x.fillStyle = pal[2]; x.fillRect(width * 0.3, H - u * 15, width * 0.4, u * 8); x.fillStyle = pal[0]; x.font = `700 ${u * 3.6}px Inter, Arial, sans-serif`; x.fillText(d.cta || "SHOP NOW", width / 2, H - u * 9.8);
    return cv;
  }

  // simple ebook PDF (A5) from markdown-ish chapters
  function ebookPdf(item) {
    const d = item.data, W = 420, H = 595, m = 48, doc = new window.jspdf.jsPDF({ unit: "pt", format: [W, H], compress: true });
    const cv = ebookCover(item, 1200); doc.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, W, H);
    let page = 1, y = 0;
    const newPage = () => { doc.addPage(); page++; y = m + 10; doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150); doc.text(String(page), W / 2, H - 22, { align: "center" }); };
    const write = (text, size, style, color, gap) => {
      doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
      for (const ln of doc.splitTextToSize(text, W - 2 * m)) { if (y > H - m - 10) newPage(); doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(ln, m, y); y += size * 1.45; }
      y += gap;
    };
    newPage(); write("Contents", 18, "bold", [25, 25, 25], 8);
    d.chapters.forEach((c, i) => write(`${i + 1}.  ${c.title}`, 11, "normal", [60, 60, 60], 2));
    d.chapters.forEach((c, i) => {
      newPage(); write(`Chapter ${i + 1}`, 10, "bold", [170, 120, 30], 2); write(c.title, 19, "bold", [25, 25, 25], 10);
      for (const block of String(c.body).split(/\n+/)) {
        const t = block.trim(); if (!t) continue;
        if (/^#+\s/.test(t)) write(t.replace(/^#+\s/, ""), 13, "bold", [30, 30, 30], 4);
        else if (/^[-*]\s/.test(t)) write("•  " + t.replace(/^[-*]\s/, "").replace(/\*\*/g, ""), 10.5, "normal", [45, 45, 45], 2);
        else write(t.replace(/\*\*/g, ""), 10.5, "normal", [45, 45, 45], 6);
      }
    });
    return doc.output("blob");
  }
  function ebookCover(item, width = 1600) {
    const d = item.data, H = Math.round(width * 595 / 420), cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const x = cv.getContext("2d"), pal = ART_PALETTES[(d.palette || 0) % ART_PALETTES.length], u = width / 100, r = rng(d.seed || 3);
    x.fillStyle = pal.c[3]; x.fillRect(0, 0, width, H);
    for (let i = 0; i < 5; i++) { x.fillStyle = pal.c[i % 3]; x.globalAlpha = 0.85; x.beginPath(); x.arc(width * (0.2 + r() * 0.6), H * (0.55 + r() * 0.3), width * (0.12 + r() * 0.2), 0, 7); x.fill(); }
    x.globalAlpha = 1; x.fillStyle = pal.bg; x.textAlign = "left";
    x.font = `700 ${u * 3.6}px Inter, Arial, sans-serif`; x.fillText(String(d.kicker || "THE PRACTICAL GUIDE").toUpperCase(), u * 9, u * 16);
    let fs = u * 10; x.font = `800 ${fs}px Fraunces, Georgia, serif`;
    const words = String(d.title).split(" "), lines = []; let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (x.measureText(t).width > width * 0.82 && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    lines.forEach((l, i) => x.fillText(l, u * 9, u * 30 + i * fs * 1.08));
    x.font = `500 ${u * 4}px Inter, Arial, sans-serif`; x.fillText(String(d.subtitle || "").slice(0, 60), u * 9, u * 30 + lines.length * fs * 1.08 + u * 4);
    return cv;
  }

  window.EB_ART = { ART_PALETTES, SIZES, artCanvas, roomMockup, pinCanvas, ebookPdf, ebookCover, STYLES: ["arches", "sun", "bauhaus", "blobs", "quote"] };
})();
