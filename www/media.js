/* Print-on-demand designs, shirt mockups and social carousel slides, all drawn on canvas. */
(function () {
  "use strict";
  const { U } = window.EB;

  // ---- print-on-demand designs (transparent PNG, 4500 x 5400 for shirts) -----------------------
  const INKS = [
    { name: "Cream on dark", ink: "#f4ead5", accent: "#e9b949", shirt: "#1d1f22" },
    { name: "Sunset", ink: "#ffd6a5", accent: "#ff7b54", shirt: "#26323a" },
    { name: "Mint", ink: "#d8f3dc", accent: "#74c69d", shirt: "#1b2a24" },
    { name: "Navy on light", ink: "#1d3557", accent: "#e63946", shirt: "#f1ede4" },
    { name: "Black on light", ink: "#111111", accent: "#c1121f", shirt: "#e9e5dc" },
    { name: "Forest on sand", ink: "#283618", accent: "#bc6c25", shirt: "#e9dcc4" },
  ];
  const STYLES = ["stacked", "badge", "retro", "script"];

  function fitFont(x, text, family, weight, maxW, start) {
    let fs = start;
    do { x.font = `${weight} ${fs}px ${family}`; fs -= 4; } while (x.measureText(text).width > maxW && fs > 20);
    return fs + 4;
  }

  function arcText(x, text, cx, cy, r, startAngle, inward) {
    const chars = text.split(""), widths = chars.map(c => x.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) / r;
    let a = startAngle - (inward ? -total / 2 : total / 2);
    chars.forEach((ch, i) => {
      const step = widths[i] / r;
      a += inward ? -step / 2 : step / 2;
      x.save(); x.translate(cx + r * Math.cos(a), cy + r * Math.sin(a)); x.rotate(a + (inward ? -Math.PI / 2 : Math.PI / 2));
      x.fillText(ch, 0, 0); x.restore();
      a += inward ? -step / 2 : step / 2;
    });
  }

  function designCanvas(item, width = 4500) {
    const d = item.data, H = Math.round(width * 1.2), cv = document.createElement("canvas");
    cv.width = width; cv.height = H;
    const x = cv.getContext("2d"), pal = INKS[d.palette % INKS.length], u = width / 100;
    const lines = (d.lines && d.lines.length ? d.lines : [d.slogan]).map(l => String(l).toUpperCase());
    x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillStyle = pal.ink;
    const cx = width / 2;
    if (d.style === "badge") {
      const r = width * 0.42, cy = H * 0.45;
      x.strokeStyle = pal.ink; x.lineWidth = u * 1.6; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
      x.lineWidth = u * 0.6; x.beginPath(); x.arc(cx, cy, r - u * 3.2, 0, Math.PI * 2); x.stroke();
      x.font = `400 ${u * 7.5}px "Bebas Neue", Impact, sans-serif`;
      arcText(x, lines[0], cx, cy, r - u * 8.5, -Math.PI / 2, false);
      if (lines.length > 2) arcText(x, lines[lines.length - 1], cx, cy, r - u * 3, Math.PI / 2, true);
      const mid = lines.length > 2 ? lines.slice(1, -1) : lines.slice(1);
      x.fillStyle = pal.accent;
      mid.forEach((l, i) => { const fs = fitFont(x, l, '"Archivo Black", Impact, sans-serif', 400, r * 1.35, u * 11); x.fillText(l, cx, cy + (i - (mid.length - 1) / 2) * fs * 1.1 + fs * 0.35); });
      x.fillStyle = pal.ink; x.font = `400 ${u * 4}px "Bebas Neue", Impact, sans-serif`; x.fillText("★  ★  ★", cx, cy + r * 0.62);
    } else if (d.style === "retro") {
      const cy = H * 0.36, r = width * 0.3;
      const stripes = [pal.accent, pal.ink, pal.accent, pal.ink];
      x.save(); x.beginPath(); x.arc(cx, cy, r, Math.PI, 0); x.closePath(); x.clip();
      stripes.forEach((c, i) => { x.fillStyle = c; x.fillRect(cx - r, cy - r + i * r / 4, r * 2, r / 8); });
      x.restore();
      let y = cy + u * 16;
      lines.forEach((l, i) => {
        const fs = fitFont(x, l, '"Archivo Black", Impact, sans-serif', 400, width * 0.92, u * (i === 0 ? 13 : 10));
        x.fillStyle = pal.accent; x.fillText(l, cx + u * 0.9, y + u * 0.9);
        x.fillStyle = pal.ink; x.fillText(l, cx, y); y += fs * 1.12;
      });
    } else if (d.style === "script") {
      let y = H * 0.32;
      lines.forEach((l, i) => {
        if (i % 2 === 1) {
          const fs = fitFont(x, l.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), 'Pacifico, cursive', 400, width * 0.9, u * 12);
          x.fillStyle = pal.accent; x.fillText(l.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), cx, y + fs * 0.2); y += fs * 1.25;
        } else {
          const fs = fitFont(x, l, '"Bebas Neue", Impact, sans-serif', 400, width * 0.92, u * 17);
          x.fillStyle = pal.ink; x.fillText(l, cx, y + fs * 0.75); y += fs * 0.95;
        }
      });
    } else { // stacked
      const sizes = lines.map((l, i) => fitFont(x, l, '"Bebas Neue", Impact, sans-serif', 400, width * 0.94, u * (i === lines.length - 1 ? 26 : 16)));
      const total = sizes.reduce((a, b) => a + b * 0.86, 0);
      let y = (H - total) / 2.4;
      lines.forEach((l, i) => {
        x.font = `400 ${sizes[i]}px "Bebas Neue", Impact, sans-serif`;
        x.fillStyle = i === lines.length - 1 ? pal.accent : pal.ink;
        y += sizes[i] * 0.86; x.fillText(l, cx, y);
        if (i < lines.length - 1) { x.fillStyle = pal.ink; x.fillRect(cx - width * 0.18, y + u * 1.2, width * 0.36, u * 0.5); y += u * 2.4; }
      });
    }
    return cv;
  }

  function shirtMockup(item, width = 1500) {
    const H = width, cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const x = cv.getContext("2d"), pal = INKS[item.data.palette % INKS.length], u = width / 100;
    x.fillStyle = "#ece8df"; x.fillRect(0, 0, width, H);
    x.fillStyle = pal.shirt;
    x.beginPath();
    x.moveTo(u * 34, u * 10); x.quadraticCurveTo(u * 50, u * 17, u * 66, u * 10);
    x.lineTo(u * 88, u * 20); x.lineTo(u * 96, u * 38); x.lineTo(u * 80, u * 44); x.lineTo(u * 76, u * 36);
    x.lineTo(u * 76, u * 94); x.lineTo(u * 24, u * 94); x.lineTo(u * 24, u * 36); x.lineTo(u * 20, u * 44);
    x.lineTo(u * 4, u * 38); x.lineTo(u * 12, u * 20); x.closePath(); x.fill();
    x.fillStyle = "rgba(0,0,0,.12)"; x.beginPath(); x.moveTo(u * 38, u * 11.5); x.quadraticCurveTo(u * 50, u * 20, u * 62, u * 11.5); x.quadraticCurveTo(u * 50, u * 16, u * 38, u * 11.5); x.fill();
    const art = designCanvas(item, 1200), aw = u * 40, ah = aw * 1.2;
    x.drawImage(art, (width - aw) / 2, u * 24, aw, ah);
    return cv;
  }

  // ---- carousel slides (1080 x 1350) -------------------------------------------------------------
  const SLIDE_THEMES = [["#101820", "#fee715"], ["#1f3d33", "#e9b949"], ["#f3f1ea", "#1f3d33"], ["#2b2d42", "#ef8354"], ["#fefae0", "#bc6c25"]];
  function wrap(x, text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  function slideCanvas(item, index, width = 1080) {
    const d = item.data, H = Math.round(width * 1.25), cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const x = cv.getContext("2d"), [bg, fg] = SLIDE_THEMES[(d.palette || 0) % SLIDE_THEMES.length], u = width / 100;
    const slides = [d.hook, ...(d.slides || []), d.cta || "Follow for more"];
    const text = slides[index] || "";
    x.fillStyle = bg; x.fillRect(0, 0, width, H);
    const light = bg.startsWith("#f");
    x.fillStyle = fg; x.fillRect(u * 8, u * 8, u * 10, u * 1.2);
    x.font = `600 ${u * 3}px Inter, Arial, sans-serif`; x.fillStyle = light ? "#555" : "#bbb"; x.textAlign = "right";
    x.fillText(`${index + 1}/${slides.length}`, width - u * 8, u * 10);
    x.textAlign = "left";
    const first = index === 0, last = index === slides.length - 1;
    const fs = first ? u * 9.5 : last ? u * 8 : u * 6.4;
    x.font = first || last ? `800 ${fs}px Fraunces, Georgia, serif` : `600 ${fs}px Inter, Arial, sans-serif`;
    const lines = wrap(x, text, width - u * 16);
    let y = (H - lines.length * fs * 1.22) / 2 + fs;
    x.fillStyle = first || last ? fg : (light ? "#1d1d1d" : "#f5f5f5");
    for (const l of lines) { x.fillText(l, u * 8, y); y += fs * 1.22; }
    if (d.handle) { x.font = `600 ${u * 3.2}px Inter, Arial, sans-serif`; x.fillStyle = light ? "#555" : "#bbb"; x.fillText(d.handle, u * 8, H - u * 8); }
    if (!last) { x.textAlign = "right"; x.font = `700 ${u * 3.4}px Inter, Arial, sans-serif`; x.fillStyle = fg; x.fillText("swipe →", width - u * 8, H - u * 8); }
    return cv;
  }

  // ---- markdown to HTML (articles) ------------------------------------------------------------------
  function mdToHtml(md) {
    const inline = s => U.esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="nofollow sponsored">$1</a>');
    const out = []; let list = null;
    for (const raw of String(md).split("\n")) {
      const line = raw.trimEnd();
      const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
      if (li) { const type = /^\s*\d+\./.test(line) ? "ol" : "ul"; if (list !== type) { if (list) out.push(`</${list}>`); out.push(`<${type}>`); list = type; } out.push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push(`</${list}>`); list = null; }
      const h = line.match(/^(#{1,4})\s+(.*)/);
      if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`</${list}>`);
    return out.join("\n");
  }

  window.EB_MEDIA = { INKS, STYLES, designCanvas, shirtMockup, slideCanvas, SLIDE_THEMES, mdToHtml };
})();
