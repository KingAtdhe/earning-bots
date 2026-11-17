/* Listing photo scenes, drawn on canvas: desk flat-lays, clipboard, tablet, styled rooms, and
   "what's included" / details images. Every claim drawn on an image matches the files the buyer gets. */
(function () {
  "use strict";
  const { U } = window.EB;
  const { rng } = window.EB_KDP;
  const W0 = 2000, H0 = 1500; // 4:3, Etsy's recommended shape

  const make = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const css = c => Array.isArray(c) ? `rgb(${c.join(",")})` : c;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const free = c => { try { c.width = 0; c.height = 0; } catch { /* ignore */ } };

  // ---- surfaces --------------------------------------------------------------------------------
  let grain = null;
  function noise(x, W, H, alpha = 0.05) {
    if (!grain) {
      grain = make(256, 256); const g = grain.getContext("2d"), r = rng(99), img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    }
    x.save(); x.globalAlpha = alpha; x.globalCompositeOperation = "overlay"; x.fillStyle = x.createPattern(grain, "repeat"); x.fillRect(0, 0, W, H); x.restore();
  }
  function light(x, W, H, strength = 0.22) { // soft window light from the top left, vignette bottom right
    const g = x.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, Math.hypot(W, H) * 0.95);
    g.addColorStop(0, `rgba(255,255,255,${strength})`); g.addColorStop(0.55, "rgba(255,255,255,0)"); g.addColorStop(1, `rgba(0,0,0,${strength * 0.8})`);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  function wood(x, W, H, r, base = [196, 160, 120]) {
    const planks = 5, ph = H / planks;
    for (let p = 0; p < planks; p++) {
      x.fillStyle = css(mix(base, [120, 85, 55], r() * 0.18)); x.fillRect(0, p * ph, W, ph);
      x.lineWidth = 1.2;
      for (let l = 0; l < 26; l++) {
        const y0 = p * ph + r() * ph; x.strokeStyle = `rgba(90,55,25,${0.05 + r() * 0.09})`; x.beginPath(); x.moveTo(0, y0);
        for (let xx = 0; xx <= W; xx += W / 10) x.lineTo(xx, y0 + Math.sin(xx / (120 + r() * 160) + l) * ph * 0.05);
        x.stroke();
      }
      x.fillStyle = "rgba(60,35,15,.28)"; x.fillRect(0, p * ph, W, 2.5);
    }
  }
  function linen(x, W, H, base) {
    x.fillStyle = css(base); x.fillRect(0, 0, W, H); x.lineWidth = 1;
    for (let i = 0; i < W; i += 4) { x.strokeStyle = i % 8 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.035)"; x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let i = 0; i < H; i += 4) { x.strokeStyle = i % 8 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)"; x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
  }
  function marble(x, W, H, r) {
    x.fillStyle = "#f1efeb"; x.fillRect(0, 0, W, H);
    for (let v = 0; v < 9; v++) {
      x.strokeStyle = `rgba(120,115,110,${0.05 + r() * 0.1})`; x.lineWidth = 1 + r() * 4; x.beginPath();
      let px = r() * W, py = 0; x.moveTo(px, py);
      while (py < H) { const nx = px + (r() - 0.4) * W * 0.12, ny = py + H * (0.06 + r() * 0.08); x.quadraticCurveTo(px + (r() - 0.5) * 120, (py + ny) / 2, nx, ny); px = nx; py = ny; }
      x.stroke();
    }
  }
  const SURFACES = [
    (x, W, H, r) => wood(x, W, H, r),
    (x, W, H, r) => wood(x, W, H, r, [222, 196, 160]),
    (x, W, H) => linen(x, W, H, [228, 222, 212]),
    (x, W, H, r) => marble(x, W, H, r),
    (x, W, H) => linen(x, W, H, [214, 222, 214]),
  ];

  function shadowed(x, blur, offY, alpha, fn) { x.save(); x.shadowColor = `rgba(0,0,0,${alpha})`; x.shadowBlur = blur; x.shadowOffsetX = offY * 0.4; x.shadowOffsetY = offY; fn(); x.restore(); }
  // a sheet of paper (or any canvas) lying on a surface, slightly turned
  function placePaper(x, src, cx, cy, w, rot, u) {
    const h = w * src.height / src.width;
    x.save(); x.translate(cx, cy); x.rotate(rot);
    shadowed(x, u * 2.2, u * 0.7, 0.28, () => { x.fillStyle = "#fff"; x.fillRect(-w / 2, -h / 2, w, h); });
    x.drawImage(src, -w / 2, -h / 2, w, h);
    const g = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, "rgba(255,255,255,.10)"); g.addColorStop(1, "rgba(0,0,0,.06)");
    x.fillStyle = g; x.fillRect(-w / 2, -h / 2, w, h);
    x.restore();
    return h;
  }

  // ---- props ------------------------------------------------------------------------------------
  function pen(x, cx, cy, len, rot, u, color = "#1d2a3a") {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    shadowed(x, u * 0.8, u * 0.4, 0.3, () => { x.fillStyle = color; x.beginPath(); x.roundRect(-len / 2, -u * 0.55, len * 0.86, u * 1.1, u * 0.5); x.fill(); });
    x.fillStyle = "#c9ccd1"; x.beginPath(); x.moveTo(len * 0.36, -u * 0.5); x.lineTo(len / 2, 0); x.lineTo(len * 0.36, u * 0.5); x.fill();
    x.fillStyle = "#d4af37"; x.fillRect(-len * 0.3, -u * 0.62, u * 0.5, u * 1.24); x.fillRect(-len * 0.42, -u * 0.75, len * 0.18, u * 0.28);
    x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(-len / 2 + u, -u * 0.35, len * 0.78, u * 0.18);
    x.restore();
  }
  function pencil(x, cx, cy, len, rot, u) {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    shadowed(x, u * 0.6, u * 0.3, 0.28, () => { x.fillStyle = "#f2c230"; x.fillRect(-len / 2, -u * 0.5, len * 0.8, u); });
    x.fillStyle = "#e6b422"; x.fillRect(-len / 2, -u * 0.12, len * 0.8, u * 0.24);
    x.fillStyle = "#e9c9a0"; x.beginPath(); x.moveTo(len * 0.3, -u * 0.5); x.lineTo(len / 2, 0); x.lineTo(len * 0.3, u * 0.5); x.fill();
    x.fillStyle = "#333"; x.beginPath(); x.moveTo(len * 0.44, -u * 0.15); x.lineTo(len / 2, 0); x.lineTo(len * 0.44, u * 0.15); x.fill();
    x.fillStyle = "#e48a9a"; x.fillRect(-len / 2 - u * 0.9, -u * 0.5, u * 0.9, u); x.fillStyle = "#b9b9b9"; x.fillRect(-len / 2, -u * 0.52, u * 0.6, u * 1.04);
    x.restore();
  }
  function mug(x, cx, cy, rad, u, color = "#f6f3ee") {
    shadowed(x, u * 2, u * 0.8, 0.3, () => { x.fillStyle = color; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill(); });
    x.save(); x.lineWidth = rad * 0.22; x.strokeStyle = color; x.beginPath(); x.arc(cx + rad * 1.05, cy + rad * 0.15, rad * 0.32, -1.3, 1.6); x.stroke(); x.restore();
    const g = x.createRadialGradient(cx - rad * 0.2, cy - rad * 0.2, rad * 0.1, cx, cy, rad * 0.8); g.addColorStop(0, "#8a5a36"); g.addColorStop(1, "#4a2c17");
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad * 0.8, 0, 7); x.fill();
    x.fillStyle = "rgba(255,240,220,.35)"; x.beginPath(); x.ellipse(cx - rad * 0.25, cy - rad * 0.3, rad * 0.25, rad * 0.1, -0.6, 0, 7); x.fill();
  }
  function sprig(x, cx, cy, len, rot, u, r, green = "#5f7f57") {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    shadowed(x, u * 0.8, u * 0.4, 0.22, () => {
      x.strokeStyle = "#4b6343"; x.lineWidth = u * 0.3; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(len * 0.1, -len * 0.5, 0, -len); x.stroke();
      for (let i = 1; i < 9; i++) {
        const t = i / 9, py = -len * t, side = i % 2 ? 1 : -1, s = u * (2.6 - t * 1.4);
        x.fillStyle = css(mix([95, 127, 87], [140, 170, 120], r() * 0.6)); x.beginPath(); x.ellipse(side * s * 0.9, py, s * 1.25, s * 0.5, side * 0.6, 0, 7); x.fill();
      }
    });
    x.restore();
  }
  function clips(x, cx, cy, u) {
    x.save(); x.strokeStyle = "#b8bcc2"; x.lineWidth = u * 0.22; x.lineCap = "round";
    for (let i = 0; i < 2; i++) { x.save(); x.translate(cx + i * u * 2.6, cy + i * u * 1.4); x.rotate(0.5 + i * 0.6); x.beginPath(); x.roundRect(-u * 0.7, -u * 2.2, u * 1.4, u * 4.4, u * 0.7); x.stroke(); x.beginPath(); x.roundRect(-u * 0.4, -u * 1.6, u * 0.8, u * 3, u * 0.4); x.stroke(); x.restore(); }
    x.restore();
  }

  // ---- text helpers ---------------------------------------------------------------------------
  function wrap(x, text, maxW) { const out = []; let line = ""; for (const w of String(text).split(/\s+/)) { const t = line ? line + " " + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
  function badge(x, text, cx, cy, u, bg = "rgba(255,255,255,.92)", fg = "#222") {
    x.font = `600 ${u * 2.1}px Inter, Arial, sans-serif`; const w = x.measureText(text).width + u * 4;
    shadowed(x, u, u * 0.3, 0.18, () => { x.fillStyle = bg; x.beginPath(); x.roundRect(cx - w / 2, cy - u * 2.2, w, u * 4.4, u * 2.2); x.fill(); });
    x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, cx, cy + u * 0.1); x.textBaseline = "alphabetic";
  }

  // ---- scenes ---------------------------------------------------------------------------------
  // flat-lay: the page on a desk with a few props
  function deskScene(page, seed, opts = {}) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100, r = rng(seed);
    SURFACES[(opts.surface ?? Math.floor(r() * SURFACES.length)) % SURFACES.length](x, W0, H0, r);
    const pw = H0 * 0.86 * page.width / page.height, rot = (r() - 0.5) * 0.08;
    placePaper(x, page, W0 * 0.5, H0 * 0.5, Math.min(pw, W0 * 0.5), rot, u);
    const side = r() < 0.5 ? -1 : 1;
    mug(x, W0 * (0.5 + side * 0.36), H0 * 0.27, u * 6.2, u);
    sprig(x, W0 * (0.5 - side * 0.37), H0 * 0.92, H0 * 0.42, side * 0.35, u, r);
    pen(x, W0 * (0.5 + side * 0.36), H0 * 0.72, u * 26, -side * 1.15 + (r() - 0.5) * 0.3, u, ["#1d2a3a", "#7a2f2f", "#2f4f3f"][Math.floor(r() * 3)]);
    clips(x, W0 * (0.5 - side * 0.38), H0 * 0.2, u);
    light(x, W0, H0); noise(x, W0, H0, 0.06);
    if (opts.badge) badge(x, opts.badge, W0 / 2, H0 - u * 4.5, u);
    return cv;
  }
  function clipboardScene(page, seed, opts = {}) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100, r = rng(seed + 7);
    SURFACES[(opts.surface ?? 2 + Math.floor(r() * 3)) % SURFACES.length](x, W0, H0, r);
    const bh = H0 * 0.9, bw = bh * 0.74, bx = W0 * 0.5 - bw / 2, by = H0 * 0.06;
    x.save(); x.translate(W0 / 2, H0 / 2); x.rotate((r() - 0.5) * 0.06); x.translate(-W0 / 2, -H0 / 2);
    shadowed(x, u * 3, u, 0.32, () => { x.fillStyle = "#a47c55"; x.beginPath(); x.roundRect(bx, by, bw, bh, u * 1.2); x.fill(); });
    const g = x.createLinearGradient(bx, by, bx + bw, by + bh); g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,.12)"); x.fillStyle = g; x.beginPath(); x.roundRect(bx, by, bw, bh, u * 1.2); x.fill();
    const pw = bw * 0.9, ph = pw * page.height / page.width, px = bx + (bw - pw) / 2, py = by + u * 4.5;
    shadowed(x, u * 0.8, u * 0.25, 0.25, () => { x.fillStyle = "#fff"; x.fillRect(px, py, pw, Math.min(ph, bh - u * 6)); });
    x.drawImage(page, 0, 0, page.width, Math.min(page.height, page.width * (bh - u * 6) / pw), px, py, pw, Math.min(ph, bh - u * 6));
    const cw = bw * 0.42, cx = W0 / 2 - cw / 2;
    shadowed(x, u * 1.2, u * 0.5, 0.35, () => { const mg = x.createLinearGradient(0, by - u * 1.5, 0, by + u * 5); mg.addColorStop(0, "#e9ecef"); mg.addColorStop(0.5, "#aeb4bb"); mg.addColorStop(1, "#d5d9de"); x.fillStyle = mg; x.beginPath(); x.roundRect(cx, by - u * 1.5, cw, u * 6, u * 1.2); x.fill(); });
    x.fillStyle = "#8d949c"; x.beginPath(); x.roundRect(cx + cw * 0.3, by - u * 2.4, cw * 0.4, u * 2, u * 0.8); x.fill();
    x.restore();
    pencil(x, W0 * 0.84, H0 * 0.62, u * 24, -1.3, u);
    sprig(x, W0 * 0.14, H0 * 0.96, H0 * 0.4, 0.3, u, r);
    light(x, W0, H0); noise(x, W0, H0, 0.06);
    if (opts.badge) badge(x, opts.badge, W0 / 2, H0 - u * 4.5, u);
    return cv;
  }
  function tabletScene(page, seed, opts = {}) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100, r = rng(seed + 13);
    SURFACES[(opts.surface ?? Math.floor(r() * SURFACES.length)) % SURFACES.length](x, W0, H0, r);
    const th = H0 * 0.86, tw = th * 0.74, tx = W0 / 2 - tw / 2 - u * 6, ty = H0 * 0.07;
    shadowed(x, u * 3, u * 1.2, 0.4, () => { x.fillStyle = "#1c1d20"; x.beginPath(); x.roundRect(tx, ty, tw, th, u * 3); x.fill(); });
    x.strokeStyle = "#4a4c52"; x.lineWidth = u * 0.25; x.beginPath(); x.roundRect(tx + u * 0.2, ty + u * 0.2, tw - u * 0.4, th - u * 0.4, u * 2.8); x.stroke();
    const b = u * 2.2, sw = tw - 2 * b, sh = th - 2 * b; x.fillStyle = "#fff"; x.fillRect(tx + b, ty + b, sw, sh);
    const k = Math.min(sw / page.width, sh / page.height), dw = page.width * k, dh = page.height * k;
    x.drawImage(page, tx + b + (sw - dw) / 2, ty + b + (sh - dh) / 2, dw, dh);
    const glare = x.createLinearGradient(tx, ty, tx + tw, ty + th); glare.addColorStop(0, "rgba(255,255,255,.12)"); glare.addColorStop(0.4, "rgba(255,255,255,0)"); x.fillStyle = glare; x.fillRect(tx + b, ty + b, sw, sh);
    x.save(); x.translate(tx + tw + u * 7, H0 * 0.52); x.rotate(0.12);
    shadowed(x, u, u * 0.5, 0.3, () => { x.fillStyle = "#f4f4f2"; x.beginPath(); x.roundRect(-u * 0.75, -H0 * 0.32, u * 1.5, H0 * 0.6, u * 0.75); x.fill(); });
    x.fillStyle = "#cfcfcc"; x.beginPath(); x.moveTo(-u * 0.75, H0 * 0.28); x.lineTo(0, H0 * 0.33); x.lineTo(u * 0.75, H0 * 0.28); x.fill(); x.restore();
    mug(x, W0 * 0.86, H0 * 0.2, u * 5.4, u);
    light(x, W0, H0, 0.18); noise(x, W0, H0, 0.05);
    badge(x, opts.badge || "Print it, or fill it in with a PDF app on a tablet", W0 / 2 - u * 6, H0 - u * 4.5, u);
    return cv;
  }

  // landscape tablet (for digital planners)
  function tabletLandscape(page, seed, opts = {}) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100, r = rng(seed + 21);
    SURFACES[(opts.surface ?? Math.floor(r() * SURFACES.length)) % SURFACES.length](x, W0, H0, r);
    const tw = W0 * 0.78, th = tw * 0.75 + u * 4.4, tx = (W0 - tw) / 2 - u * 3, ty = (H0 - th) / 2 - u * 1.5;
    shadowed(x, u * 3, u * 1.2, 0.4, () => { x.fillStyle = "#1c1d20"; x.beginPath(); x.roundRect(tx, ty, tw, th, u * 3); x.fill(); });
    const b = u * 2.2, sw = tw - 2 * b, sh = th - 2 * b; x.fillStyle = "#fff"; x.fillRect(tx + b, ty + b, sw, sh);
    const k = Math.min(sw / page.width, sh / page.height), dw = page.width * k, dh = page.height * k; x.drawImage(page, tx + b + (sw - dw) / 2, ty + b + (sh - dh) / 2, dw, dh);
    const glare = x.createLinearGradient(tx, ty, tx + tw, ty + th); glare.addColorStop(0, "rgba(255,255,255,.10)"); glare.addColorStop(0.35, "rgba(255,255,255,0)"); x.fillStyle = glare; x.fillRect(tx + b, ty + b, sw, sh);
    x.save(); x.translate(tx + tw + u * 3.5, H0 * 0.5); x.rotate(0.05);
    shadowed(x, u, u * 0.5, 0.3, () => { x.fillStyle = "#f4f4f2"; x.beginPath(); x.roundRect(-u * 0.75, -H0 * 0.3, u * 1.5, H0 * 0.56, u * 0.75); x.fill(); });
    x.restore();
    light(x, W0, H0, 0.16); noise(x, W0, H0, 0.04);
    if (opts.badge) badge(x, opts.badge, W0 / 2, H0 - u * 3.6, u);
    return cv;
  }
  // a few cards or swatches scattered on a surface
  function fanScene(items, seed, opts = {}) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100, r = rng(seed + 33);
    SURFACES[(opts.surface ?? Math.floor(r() * SURFACES.length)) % SURFACES.length](x, W0, H0, r);
    const n = items.length;
    items.forEach((c, i) => { const w = opts.w || W0 * 0.24, cx = W0 * (0.5 + (i - (n - 1) / 2) * (opts.spread || 0.17)), cy = H0 * (0.5 + (i % 2 ? 0.05 : -0.03)); placePaper(x, c, cx, cy, w, (i - (n - 1) / 2) * 0.09 + (r() - 0.5) * 0.05, u); });
    sprig(x, W0 * 0.08, H0 * 0.98, H0 * 0.4, 0.4, u, r);
    light(x, W0, H0); noise(x, W0, H0, 0.05);
    if (opts.badge) badge(x, opts.badge, W0 / 2, H0 - u * 4.5, u);
    return cv;
  }

  // a framed print on a wall: three room styles
  const ROOMS = {
    living: { wall: ["#efe9df", "#e3dacb"], floor: "#cdbfa9", frame: "#2b2622" },
    bedroom: { wall: ["#e7ebe6", "#d9dfd8"], floor: "#bfae96", frame: "#c8a77c" },
    office: { wall: ["#f3f1ed", "#e6e2db"], floor: "#a99a86", frame: "#f7f7f5" },
  };
  function roomScene(art, style, seed) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100, rm = ROOMS[style] || ROOMS.living, r = rng(seed + style.length);
    const g = x.createLinearGradient(0, 0, 0, H0); g.addColorStop(0, rm.wall[0]); g.addColorStop(1, rm.wall[1]); x.fillStyle = g; x.fillRect(0, 0, W0, H0);
    x.fillStyle = rm.floor; x.fillRect(0, H0 * 0.86, W0, H0 * 0.14);
    const fh = H0 * (style === "office" ? 0.5 : 0.55), fw = fh * art.width / art.height, fx = (W0 - fw) / 2, fy = H0 * 0.08, fr = u * 1.1, mat = u * 2.4;
    shadowed(x, u * 2.5, u * 1.2, 0.3, () => { x.fillStyle = rm.frame; x.fillRect(fx - fr, fy - fr, fw + 2 * fr, fh + 2 * fr); });
    if (rm.frame === "#f7f7f5") { x.strokeStyle = "rgba(0,0,0,.12)"; x.lineWidth = 2; x.strokeRect(fx - fr, fy - fr, fw + 2 * fr, fh + 2 * fr); }
    x.fillStyle = "#fbfaf7"; x.fillRect(fx, fy, fw, fh);
    x.drawImage(art, fx + mat, fy + mat, fw - 2 * mat, fh - 2 * mat);
    x.strokeStyle = "rgba(0,0,0,.08)"; x.lineWidth = 2; x.strokeRect(fx + mat, fy + mat, fw - 2 * mat, fh - 2 * mat);
    const fy2 = fy + fh + fr;
    if (style === "living") {
      shadowed(x, u * 2, u, 0.25, () => { x.fillStyle = "#9c8b78"; x.beginPath(); x.roundRect(u * 14, fy2 + H0 * 0.1, u * 72, H0 * 0.2, u * 2); x.fill(); });
      x.fillStyle = "#8a7966"; x.beginPath(); x.roundRect(u * 12, fy2 + H0 * 0.17, u * 76, H0 * 0.16, u * 2); x.fill();
      x.fillStyle = "#c98b5a"; x.beginPath(); x.roundRect(u * 22, fy2 + H0 * 0.12, u * 12, H0 * 0.09, u * 1.5); x.fill();
      x.fillStyle = "#e6d8c3"; x.beginPath(); x.roundRect(u * 64, fy2 + H0 * 0.12, u * 12, H0 * 0.09, u * 1.5); x.fill();
      sprig(x, u * 6, H0 * 0.88, H0 * 0.5, -0.1, u * 1.4, r);
    } else if (style === "bedroom") {
      x.fillStyle = "#b9a58c"; x.beginPath(); x.roundRect(u * 18, fy2 + H0 * 0.05, u * 64, H0 * 0.18, [u * 3, u * 3, 0, 0]); x.fill();
      shadowed(x, u * 2, u * 0.6, 0.2, () => { x.fillStyle = "#f4f1ea"; x.fillRect(u * 16, fy2 + H0 * 0.16, u * 68, H0 * 0.2); });
      x.fillStyle = "#fbfaf6"; x.beginPath(); x.roundRect(u * 22, fy2 + H0 * 0.1, u * 22, H0 * 0.09, u * 2); x.fill(); x.beginPath(); x.roundRect(u * 56, fy2 + H0 * 0.1, u * 22, H0 * 0.09, u * 2); x.fill();
      x.fillStyle = "#8aa08a"; x.fillRect(u * 16, fy2 + H0 * 0.24, u * 68, H0 * 0.05);
      x.fillStyle = "#a07c58"; x.fillRect(u * 3, fy2 + H0 * 0.14, u * 10, H0 * 0.16); x.fillStyle = "#efe6d6"; x.beginPath(); x.moveTo(u * 5, fy2 + H0 * 0.02); x.lineTo(u * 11, fy2 + H0 * 0.02); x.lineTo(u * 12.5, fy2 + H0 * 0.1); x.lineTo(u * 3.5, fy2 + H0 * 0.1); x.fill(); x.fillStyle = "#6b5a48"; x.fillRect(u * 7.7, fy2 + H0 * 0.1, u * 0.6, H0 * 0.04);
    } else {
      shadowed(x, u * 2, u, 0.22, () => { x.fillStyle = "#c19a6b"; x.fillRect(u * 8, fy2 + H0 * 0.17, u * 84, u * 2.2); });
      x.fillStyle = "#8c6c48"; x.fillRect(u * 12, fy2 + H0 * 0.17 + u * 2.2, u * 1.6, H0 * 0.2); x.fillRect(u * 86, fy2 + H0 * 0.17 + u * 2.2, u * 1.6, H0 * 0.2);
      x.fillStyle = "#2c2f35"; x.beginPath(); x.roundRect(u * 34, fy2 + H0 * 0.06, u * 28, H0 * 0.11, u * 0.6); x.fill(); x.fillStyle = "#4b6b8a"; x.fillRect(u * 35, fy2 + H0 * 0.07, u * 26, H0 * 0.09); x.fillStyle = "#3a3d44"; x.fillRect(u * 30, fy2 + H0 * 0.17 - u * 0.6, u * 36, u * 0.8);
      x.strokeStyle = "#2b2b2b"; x.lineWidth = u * 0.5; x.beginPath(); x.moveTo(u * 76, fy2 + H0 * 0.17); x.lineTo(u * 78, fy2 + H0 * 0.04); x.lineTo(u * 72, fy2 - H0 * 0.02); x.stroke();
      x.fillStyle = "#2b2b2b"; x.beginPath(); x.moveTo(u * 69, fy2 - H0 * 0.01); x.lineTo(u * 75, fy2 - H0 * 0.04); x.lineTo(u * 76, fy2 + H0 * 0.01); x.fill();
      mug(x, u * 20, fy2 + H0 * 0.15, u * 2.2, u * 0.6, "#e9e4da");
      sprig(x, u * 90, fy2 + H0 * 0.17, H0 * 0.22, 0.1, u * 0.9, r);
    }
    light(x, W0, H0, 0.16); noise(x, W0, H0, 0.04);
    return cv;
  }
  // any portrait image centred on a soft 4:3 backdrop, so Etsy's thumbnail crop never cuts it
  function onBackdrop(src, bg = [240, 236, 229]) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100;
    const g = x.createLinearGradient(0, 0, 0, H0); g.addColorStop(0, css(mix(bg, [255, 255, 255], 0.3))); g.addColorStop(1, css(bg)); x.fillStyle = g; x.fillRect(0, 0, W0, H0);
    const k = Math.min(W0 * 0.8 / src.width, H0 * 0.88 / src.height), w = src.width * k, h = src.height * k;
    shadowed(x, u * 2.5, u * 1, 0.25, () => { x.fillStyle = "#fff"; x.fillRect((W0 - w) / 2, (H0 - h) / 2, w, h); });
    x.drawImage(src, (W0 - w) / 2, (H0 - h) / 2, w, h); noise(x, W0, H0, 0.03);
    return cv;
  }
  function detailCrop(art) { // close-up of the artwork's centre
    const cv = make(W0, H0), x = cv.getContext("2d"), sw = art.width * 0.72, sh = sw * H0 / W0;
    x.drawImage(art, (art.width - sw) / 2, (art.height - sh) / 2, sw, sh, 0, 0, W0, H0);
    badge(x, "Close-up detail", W0 / 2, H0 - W0 * 0.05, W0 / 100);
    return cv;
  }

  // "what's included": thumbnails of every page with labels
  function includedGrid(thumbs, info) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100;
    x.fillStyle = css(info.bg || [244, 240, 233]); x.fillRect(0, 0, W0, H0); noise(x, W0, H0, 0.04);
    x.fillStyle = css(info.ink || [40, 40, 40]); x.textAlign = "center";
    x.font = `800 ${u * 4.6}px Fraunces, Georgia, serif`; x.fillText(info.heading || "What's included", W0 / 2, u * 8);
    x.font = `500 ${u * 2.1}px Inter, Arial, sans-serif`; x.fillStyle = css(info.accent || [120, 100, 80]); x.fillText(info.sub || "", W0 / 2, u * 11.6);
    const n = thumbs.length, cols = n <= 3 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols);
    const top = u * 15, availH = H0 - top - u * 3, cellW = (W0 - u * 8) / cols, cellH = availH / rows;
    thumbs.forEach(([cvs, label], i) => {
      const col = i % cols, row = Math.floor(i / cols), maxW = cellW * 0.82, maxH = cellH - u * 5.5;
      const k = Math.min(maxW / cvs.width, maxH / cvs.height), w = cvs.width * k, h = cvs.height * k;
      const inRow = Math.min(cols, n - row * cols), offset = (cols - inRow) * cellW / 2;
      const cx = u * 4 + offset + col * cellW + cellW / 2, y = top + row * cellH + (maxH - h) / 2;
      shadowed(x, u * 1.2, u * 0.4, 0.2, () => { x.fillStyle = "#fff"; x.fillRect(cx - w / 2, y, w, h); });
      x.drawImage(cvs, cx - w / 2, y, w, h);
      x.fillStyle = css(info.ink || [40, 40, 40]); x.font = `600 ${u * 1.7}px Inter, Arial, sans-serif`;
      const l = wrap(x, label, cellW * 0.95)[0]; x.fillText(l, cx, top + row * cellH + maxH + u * 2.9);
    });
    return cv;
  }
  // details: what the buyer gets and how it works
  function detailsCard(info) {
    const cv = make(W0, H0), x = cv.getContext("2d"), u = W0 / 100, acc = css(info.accent || [104, 135, 104]), ink = css(info.ink || [35, 35, 35]);
    x.fillStyle = css(info.bg || [246, 243, 238]); x.fillRect(0, 0, W0, H0); noise(x, W0, H0, 0.035);
    x.fillStyle = acc; x.fillRect(0, 0, u * 1.2, H0);
    x.textAlign = "left"; x.fillStyle = ink; x.font = `800 ${u * 4.4}px Fraunces, Georgia, serif`;
    wrap(x, info.heading || "Good to know", W0 * 0.5).slice(0, 2).forEach((l, i) => x.fillText(l, u * 7, u * 10 + i * u * 5));
    let y = u * 22;
    for (const f of info.features.slice(0, 6)) {
      x.fillStyle = acc; x.beginPath(); x.arc(u * 9, y - u * 0.8, u * 1.6, 0, 7); x.fill();
      x.strokeStyle = "#fff"; x.lineWidth = u * 0.42; x.lineCap = "round"; x.beginPath(); x.moveTo(u * 8.2, y - u * 0.8); x.lineTo(u * 8.9, y - u * 0.1); x.lineTo(u * 10, y - u * 1.6); x.stroke();
      x.fillStyle = ink; x.font = `600 ${u * 2.3}px Inter, Arial, sans-serif`; x.fillText(f[0], u * 12.5, y - u * 0.2);
      if (f[1]) { x.font = `400 ${u * 1.75}px Inter, Arial, sans-serif`; x.fillStyle = "rgba(0,0,0,.6)"; x.fillText(wrap(x, f[1], W0 * 0.4)[0], u * 12.5, y + u * 2.6); }
      y += u * 8.6;
    }
    const sx = W0 * 0.58, sw = W0 * 0.36, steps = info.steps || [["Buy", "Checkout on Etsy"], ["Download", "Files appear right away"], ["Print", "At home or at a print shop"]];
    x.fillStyle = "#fff"; shadowed(x, u * 2, u * 0.6, 0.12, () => { x.beginPath(); x.roundRect(sx, u * 18, sw, H0 - u * 24, u * 2); x.fill(); });
    x.fillStyle = acc; x.font = `700 ${u * 1.8}px Inter, Arial, sans-serif`; x.textAlign = "center"; x.fillText("HOW IT WORKS", sx + sw / 2, u * 24);
    steps.forEach(([t, s], i) => {
      const cy = u * 33 + i * u * 12.5;
      x.fillStyle = acc; x.beginPath(); x.arc(sx + sw / 2, cy, u * 2.8, 0, 7); x.fill(); x.fillStyle = "#fff"; x.font = `700 ${u * 2.6}px Inter, Arial, sans-serif`; x.fillText(String(i + 1), sx + sw / 2, cy + u * 0.9);
      x.fillStyle = ink; x.font = `700 ${u * 2.2}px Inter, Arial, sans-serif`; x.fillText(t, sx + sw / 2, cy + u * 5.6);
      x.fillStyle = "rgba(0,0,0,.6)"; x.font = `400 ${u * 1.6}px Inter, Arial, sans-serif`; x.fillText(s, sx + sw / 2, cy + u * 8.2);
    });
    if (info.note) { x.textAlign = "left"; x.fillStyle = "rgba(0,0,0,.55)"; x.font = `500 ${u * 1.6}px Inter, Arial, sans-serif`; x.fillText(info.note, u * 7, H0 - u * 4); }
    return cv;
  }

  // ---- full photo sets per product (lazy: each function draws one photo when called) ------------
  function photoSet(it) {
    const d = it.data, seed = hash(it.id), D = window.EB_DESIGNS, K = window.EB_KDP, A = window.EB_ART;
    const out = [];
    if (it.kind === "printable") {
      const p = { bundle: d.bundle, theme: d.theme, shortName: d.shortName, title: d.title }, th = D.THEMES[d.theme] || D.THEMES.Sage;
      const pages = d.bundle.pages, label = k => (D.LAYOUTS[k] || [k])[0], n = pages.length;
      const page = (k, w = 1100) => D.pageOnly(p, k, w);
      const info = { accent: th.accent, bg: mix(th.light, [255, 255, 255], 0.35), ink: [38, 38, 38] };
      out.push(["cover", () => D.coverCanvas(p, 2000)]);
      out.push(["desk", () => { const pg = page(pages[0]); const c = deskScene(pg, seed, { badge: "Instant download · A4 + US Letter" }); free(pg); return c; }]);
      out.push(["included", () => { const t = pages.map(k => [page(k, 520), label(k)]); const c = includedGrid(t, { ...info, sub: `${n} printable page${n > 1 ? "s" : ""} · A4 + US Letter · low-ink versions included` }); t.forEach(([c2]) => free(c2)); return c; }]);
      out.push(["clipboard", () => { const pg = page(pages[1 % n]); const c = clipboardScene(pg, seed); free(pg); return c; }]);
      out.push(["tablet", () => { const pg = page(pages[2 % n]); const c = tabletScene(pg, seed); free(pg); return c; }]);
      out.push(["details", () => detailsCard({ ...info, heading: d.shortName || "Good to know", features: [
        ["Instant digital download", "No physical item will be shipped"], [`${n} page${n > 1 ? "s" : ""}`, pages.map(label).join(", ")],
        ["A4 and US Letter PDFs", `${Object.keys(D.SIZES).length * 2} files in total`], ["Low-ink versions included", "Saves printer ink"],
        ["Print as many as you need", "For personal use"]], note: "Colours may look slightly different depending on your screen and printer." })]);
      pages.forEach(k => out.push([`page:${k}`, () => D.pageCanvas(p, k, 2000)]));
    } else if (it.kind === "wallart") {
      const art = () => A.artCanvas(it, "2x3", 1400), pal = A.ART_PALETTES[d.palette % A.ART_PALETTES.length];
      const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
      for (const style of ["living", "bedroom", "office"]) out.push([`room:${style}`, () => { const a = art(); const c = roomScene(a, style, seed); free(a); return c; }]);
      out.push(["art", () => { const a = A.artCanvas(it, "2x3", 1800); const c = onBackdrop(a, hexRgb(pal.bg).map(v => Math.max(0, v - 18))); free(a); return c; }]);
      out.push(["sizes", () => { const t = A.SIZES.map(([key]) => [A.artCanvas(it, key, 520), key === "ISO" ? "A sizes" : key === "11x14" ? "11x14 in" : `${key} ratio`]); const c = includedGrid(t, { heading: "5 files, every common size", sub: A.SIZES.map(s => s[3].split(",")[0]).join(" · "), bg: hexRgb(pal.bg), ink: [40, 40, 40], accent: hexRgb(pal.c[0]) }); t.forEach(([c2]) => free(c2)); return c; }]);
      out.push(["details", () => detailsCard({ accent: hexRgb(pal.c[0]), bg: hexRgb(pal.bg), ink: [40, 40, 40], heading: "Printable wall art", features: [
        ["Instant digital download", "No physical item will be shipped"], ["5 high-resolution JPG files", "One for each print ratio"],
        ["Sizes from 4x6 to 24x36 in", "Plus A5 to A1"], ["Frame not included", "Frames in photos are for display only"]],
        steps: [["Buy", "Checkout on Etsy"], ["Download", "Files appear right away"], ["Print", "At home, a print shop or online"]] })]);
      out.push(["closeup", () => { const a = A.artCanvas(it, "2x3", 2400); const c = detailCrop(a); free(a); return c; }]);
    } else if (it.kind === "worksheet") {
      const n = d.seeds.length;
      out.push(["cover", () => { const c0 = K.cover(it, 1500); const c = onBackdrop(c0); free(c0); return c; }]);
      out.push(["desk", () => { const pg = K.worksheetPage(it, 0); const c = deskScene(pg, seed, { badge: "Instant download · US Letter PDF" }); free(pg); return c; }]);
      out.push(["clipboard", () => { const pg = K.worksheetPage(it, 0, true); const c = clipboardScene(pg, seed, { badge: "Answer keys included" }); free(pg); return c; }]);
      out.push(["included", () => { const t = [...d.seeds.slice(0, 3).map((_, i) => [K.worksheetPage(it, i, false, 520), `Practice ${i + 1}`]), [K.worksheetPage(it, 0, true, 520), "Answer key"]]; const c = includedGrid(t, { heading: "What's included", sub: `${n} practice pages + ${n} answer keys · 30 problems each`, accent: [70, 90, 140] }); t.forEach(([c2]) => free(c2)); return c; }]);
      out.push(["details", () => detailsCard({ heading: d.opName ? `${d.opName} practice` : "Good to know", accent: [70, 90, 140], features: [
        ["Instant digital download", "No physical item will be shipped"], [`${n * 2} pages`, `${n} practice pages and ${n} answer keys`],
        ["30 problems per page", "With name, date and score lines"], ["US Letter PDF", "Prints fine on A4 too (fit to page)"], ["Print for your class or family", "Personal and classroom use"]] })]);
      if (n > 1) out.push(["tablet", () => { const pg = K.worksheetPage(it, 1); const c = tabletScene(pg, seed); free(pg); return c; }]);
    }
    const B3 = window.EB_BOTS3;
    if (B3 && it.kind === "dplanner") {
      const { out: pages, plan } = B3.plannerBuilders(d), pg = (i, w = 1400) => B3.renderPage(pages[i](), w);
      const fit = c => { const o = onBackdrop(c, [236, 233, 228]); free(c); return o; };
      out.push(["tablet:cover", () => { const c = pg(0); const o = tabletLandscape(c, seed, { badge: "Hyperlinked: tap a tab or a day to jump there" }); free(c); return o; }]);
      out.push(["tablet:month", () => { const c = pg(plan.month(new Date().getMonth()) - 1); const o = tabletLandscape(c, seed + 1); free(c); return o; }]);
      out.push(["included", () => { const t = [[0, "Cover"], [1, "Year at a glance"], [2, "Goals"], [plan.month(0) - 1, "12 monthly pages"], [plan.week(0) - 1, `${plan.weeks.length} weekly pages`], [plan.habit - 1, "Habit tracker"], [plan.todo - 1, "To-do list"], [plan.notes - 1, "8 notes pages"]].map(([i, l]) => [pg(i, 520), l]); const c = includedGrid(t, { heading: "What's inside", sub: `${plan.total} hyperlinked pages · landscape PDF for tablets`, accent: (B3.PL_THEMES[d.theme] || {}).accent }); t.forEach(([c2]) => free(c2)); return c; }]);
      out.push(["tablet:week", () => { const c = pg(plan.week(Math.min(plan.weeks.length - 1, 10)) - 1); const o = tabletLandscape(c, seed + 2); free(c); return o; }]);
      out.push(["details", () => detailsCard({ accent: (B3.PL_THEMES[d.theme] || {}).accent, heading: `${d.year || "Undated"} digital planner`, features: [
        ["Hyperlinked tabs on every page", "Year, January to December, Notes"], ["Tap a day to open its week", d.year ? "Every week of " + d.year : "52 undated weeks"],
        ["For iPad and Android tablets", "Any PDF app that supports links"], [`${plan.total} pages`, "Goals, habits, to-do, lined and dot notes"], ["Instant digital download", "No physical item will be shipped"]],
        steps: [["Buy", "Checkout on Etsy"], ["Download", "Save the PDF to your tablet"], ["Open", "In your note-taking app and write"]] })]);
      out.push(["page:year", () => fit(pg(1, 1600))]);
    } else if (B3 && it.kind === "paperpack") {
      const pal = B3.PAPER_PALETTES[d.palette % B3.PAPER_PALETTES.length], acc = hexRgb(pal.c[1]);
      out.push(["preview", () => B3.paperPreview(d, 2000)]);
      out.push(["fan", () => { const cs = [0, 3, 6, 9].map(i => B3.paperCanvas(d, i, 700)); const c = fanScene(cs, seed, { w: W0 * 0.3, spread: 0.18, badge: "Seamless: repeats with no visible edges" }); cs.forEach(free); return c; }]);
      out.push(["closeup", () => { const p = B3.paperCanvas(d, 1, 2000); const c = make(W0, H0); c.getContext("2d").drawImage(p, 0, (2000 - 1500) / 2, 2000, 1500, 0, 0, W0, H0); free(p); return c; }]);
      out.push(["included", () => { const t = d.papers.map((pp, i) => [B3.paperCanvas(d, i, 400), pp.style[0].toUpperCase() + pp.style.slice(1)]); const c = includedGrid(t, { heading: "12 patterns included", sub: "3600 x 3600 px JPG · 12 x 12 in at 300 dpi", bg: hexRgb(pal.c[0]), accent: acc }); t.forEach(([c2]) => free(c2)); return c; }]);
      out.push(["details", () => detailsCard({ accent: acc, bg: hexRgb(pal.c[0]), heading: `${pal.name} digital paper`, features: [
        ["12 seamless patterns", "Tile them for any size"], ["3600 x 3600 px JPG", "12 x 12 in at 300 dpi"], ["Commercial use allowed", "On products you make and sell"],
        ["Not for resale as patterns", "Files can't be shared or resold as-is"], ["Instant digital download", "2 ZIP files, no physical item"]],
        steps: [["Buy", "Checkout on Etsy"], ["Download", "Unzip the 2 folders"], ["Create", "Print, craft or design"]] })]);
    } else if (B3 && it.kind === "partygame") {
      const pages = B3.partyBuilders(d), pg = (i, w = 1100) => B3.renderPage(pages[i](), w), acc = d.accent;
      out.push(["cover", () => { const c = pg(0, 1400); const o = onBackdrop(c, mix(d.light, [230, 225, 218], 0.5)); free(c); return o; }]);
      out.push(["desk:bingo", () => { const c = pg(2); const o = deskScene(c, seed, { badge: "30 different bingo cards + caller list" }); free(c); return o; }]);
      out.push(["included", () => { const t = [[2, "Bingo (30 cards)"], [17, "Word scramble"], [19, "Word search"], [21, "Would you rather"], [22, "Find the guest"], [20, "Answer keys"]].map(([i, l]) => [pg(i, 520), l]); const c = includedGrid(t, { heading: "5 games included", sub: `${pages.length}-page PDF · US Letter and A4`, accent: acc, bg: mix(d.light, [255, 255, 255], 0.4) }); t.forEach(([c2]) => free(c2)); return c; }]);
      out.push(["clipboard:scramble", () => { const c = pg(17); const o = clipboardScene(c, seed, { badge: "Answer keys included" }); free(c); return o; }]);
      out.push(["details", () => detailsCard({ accent: acc, bg: mix(d.light, [255, 255, 255], 0.5), heading: `${d.occasion} games`, features: [
        ["5 printable games", "Bingo, scramble, word search and more"], ["30 unique bingo cards", "2 per page, with a caller list"], ["Answer keys included", "For the scramble and the word search"],
        ["US Letter and A4", "Print at actual size"], ["Instant digital download", "No physical item will be shipped"]] })]);
      out.push(["desk:find", () => { const c = pg(22); const o = deskScene(c, seed + 3); free(c); return o; }]);
    } else if (B3 && it.kind === "carddeck") {
      const cards = n => Array.from({ length: n }, (_, i) => B3.cardCanvas(d, Math.floor(i * d.cards.length / n), 700));
      const pages = B3.deckBuilders(d);
      out.push(["cover", () => B3.deckCover(d, 2000)]);
      out.push(["fan", () => { const cs = [...cards(4), B3.cardCanvas(d, 0, 700, true)]; const c = fanScene(cs, seed, { w: W0 * 0.16, spread: 0.18, badge: "Playing-card size: 2.5 x 3.5 in" }); cs.forEach(free); return c; }]);
      out.push(["desk:sheet", () => { const c = B3.renderPage(pages[1](), 1100); const o = deskScene(c, seed, { badge: "9 cards per page, with crop marks" }); free(c); return o; }]);
      out.push(["included", () => { const t = cards(6).map((c, i) => [c, `Card ${Math.floor(i * d.cards.length / 6) + 1}`]); t.push([B3.cardCanvas(d, 0, 400, true), "Card back"]); const c = includedGrid(t, { heading: `${d.cards.length} cards + card backs`, sub: "Print, cut and use", accent: d.accent, bg: mix(d.light, [255, 255, 255], 0.4) }); t.forEach(([c2]) => free(c2)); return c; }]);
      out.push(["details", () => detailsCard({ accent: d.accent, bg: mix(d.light, [255, 255, 255], 0.5), heading: d.name, features: [
        [`${d.cards.length} printable cards`, d.short], ["2.5 x 3.5 in cards", "9 per page, with crop marks"], ["Card back page included", "Print on the reverse or glue"],
        ["US Letter and A4", "Print at actual size on card stock"], ["Instant digital download", "No physical item will be shipped"]] })]);
    }
    return out;
  }

  // write the photo set into a zip folder (numbered, Etsy order), freeing each canvas as it goes
  async function addPhotos(it, folder, max = 10) {
    let i = 1;
    for (const [name, draw] of photoSet(it).slice(0, max)) {
      const cv = draw(), blob = await window.EB.Files.canvasBlob(cv, "image/jpeg", 0.9); free(cv);
      folder.file(`${String(i++).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-")}.jpg`, blob); await U.sleep(0);
    }
    return i - 1;
  }

  window.EB_SCENES = { addPhotos,  deskScene, clipboardScene, tabletScene, roomScene, includedGrid, detailsCard, detailCrop, photoSet, hash };
})();
