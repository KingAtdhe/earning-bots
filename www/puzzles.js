/* Puzzle Book Bot engine: Sudoku and Word Search generators, KDP-ready interior PDF and front cover. */
(function () {
  "use strict";
  const { U } = window.EB;

  // ---- Sudoku ---------------------------------------------------------------------
  function cands(g, i) {
    const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3;
    let used = 0;
    for (let k = 0; k < 9; k++) {
      used |= 1 << g[r * 9 + k]; used |= 1 << g[k * 9 + c];
      used |= 1 << g[(br + Math.floor(k / 3)) * 9 + bc + k % 3];
    }
    const out = []; for (let v = 1; v <= 9; v++) if (!(used & (1 << v))) out.push(v);
    return out;
  }
  function countSolutions(g, limit) {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const c = cands(g, i); if (!c.length) return 0;
      if (best < 0 || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
    }
    if (best < 0) return 1;
    let n = 0;
    for (const v of bestC) { g[best] = v; n += countSolutions(g, limit - n); if (n >= limit) break; }
    g[best] = 0; return n;
  }
  function fill(g) {
    const i = g.indexOf(0); if (i < 0) return true;
    for (const v of U.shuffle(cands(g, i))) { g[i] = v; if (fill(g)) return true; }
    g[i] = 0; return false;
  }
  const CLUES = { easy: 40, medium: 32, hard: 27 };
  function sudoku(level) {
    const sol = Array(81).fill(0); fill(sol);
    const puz = sol.slice(), target = CLUES[level] || 32;
    let clues = 81;
    for (const i of U.shuffle([...Array(81).keys()])) {
      if (clues <= target) break;
      const j = 80 - i; // symmetric pairs look more professional
      const a = puz[i], b = puz[j];
      puz[i] = 0; puz[j] = 0;
      if (countSolutions(puz.slice(), 2) !== 1) { puz[i] = a; puz[j] = b; }
      else clues -= i === j ? 1 : 2;
    }
    return { p: puz.join(""), s: sol.join("") };
  }

  // ---- Word search --------------------------------------------------------------------
  const THEMES = {
    Animals: "ELEPHANT GIRAFFE ZEBRA LION TIGER MONKEY PANDA KOALA KANGAROO DOLPHIN WHALE OTTER BEAVER RABBIT SQUIRREL HEDGEHOG FOX WOLF BEAR MOOSE DEER CAMEL LLAMA HIPPO RHINO CHEETAH LEOPARD JAGUAR GORILLA LEMUR SLOTH ARMADILLO PENGUIN PARROT FLAMINGO PEACOCK OWL EAGLE FALCON SWAN TURTLE TORTOISE LIZARD IGUANA FROG TOAD SALAMANDER BADGER RACCOON SKUNK PORCUPINE MEERKAT HYENA BISON BUFFALO YAK GOAT SHEEP PIG HORSE DONKEY",
    Food: "APPLE BANANA CHERRY GRAPE LEMON MANGO ORANGE PEACH PEAR PLUM KIWI MELON PAPAYA COCONUT AVOCADO TOMATO CARROT POTATO ONION GARLIC PEPPER SPINACH LETTUCE CABBAGE BROCCOLI CELERY CUCUMBER PUMPKIN BREAD BUTTER CHEESE YOGURT PASTA RICE NOODLES PIZZA BURGER TACO SALAD SOUP CURRY SUSHI WAFFLE PANCAKE MUFFIN COOKIE BROWNIE CUPCAKE DONUT PRETZEL POPCORN HONEY CINNAMON VANILLA CHOCOLATE CARAMEL OATMEAL",
    Travel: "PASSPORT LUGGAGE SUITCASE AIRPORT TICKET BOARDING JOURNEY VOYAGE CRUISE TRAIN STATION HOTEL HOSTEL CAMPING BEACH MOUNTAIN ISLAND DESERT JUNGLE CITY MUSEUM CASTLE TEMPLE MARKET SOUVENIR POSTCARD CAMERA MAP COMPASS GUIDE TOURIST EXPLORE ADVENTURE ROADTRIP BACKPACK VISA CUSTOMS SUNSET HARBOR BRIDGE TOWER PALACE CATHEDRAL CANYON WATERFALL VOLCANO GLACIER VALLEY LAGOON RESORT ITINERARY EXCURSION SAFARI",
    Nature: "FOREST MEADOW RIVER STREAM LAKE POND OCEAN WAVE TIDE CLIFF CAVE HILL VALLEY CANYON DESERT PRAIRIE SWAMP MARSH JUNGLE TUNDRA GLACIER RAINBOW THUNDER LIGHTNING BREEZE CLOUD SUNSHINE MOONLIGHT STARS DEW FROST SNOWFLAKE BLOSSOM DAISY TULIP ROSE LILY ORCHID SUNFLOWER FERN MOSS OAK MAPLE BIRCH WILLOW PINE CEDAR ACORN PEBBLE BOULDER SEED ROOT BRANCH LEAF PETAL",
    Sports: "SOCCER FOOTBALL BASKETBALL BASEBALL TENNIS GOLF HOCKEY RUGBY CRICKET VOLLEYBALL BADMINTON SWIMMING DIVING ROWING SAILING SURFING SKIING SKATING CYCLING RUNNING MARATHON SPRINT HURDLES JAVELIN DISCUS ARCHERY FENCING BOXING KARATE JUDO WRESTLING GYMNASTICS BOWLING DARTS SNOOKER CLIMBING HIKING TRIATHLON REFEREE COACH STADIUM TROPHY MEDAL CHAMPION TEAM GOAL SCORE PENALTY TOURNAMENT LEAGUE",
    Christmas: "SANTA REINDEER SLEIGH CHIMNEY STOCKING PRESENT GIFT RIBBON WREATH HOLLY MISTLETOE TINSEL ORNAMENT CANDLE SNOWMAN SNOWFLAKE ICICLE CAROL CHOIR ANGEL STAR BELLS ELF WORKSHOP NORTHPOLE GINGERBREAD COOKIES EGGNOG CANDYCANE FIREPLACE COCOA SCARF MITTENS SWEATER WINTER FROST JOLLY MERRY FESTIVE NOEL NUTCRACKER LANTERN GARLAND PINECONE FAMILY FEAST TURKEY PUDDING SPARKLE",
    Ocean: "OCEAN SEA WAVE TIDE CORAL REEF SHARK WHALE DOLPHIN OCTOPUS SQUID JELLYFISH STARFISH SEAHORSE CRAB LOBSTER SHRIMP CLAM OYSTER MUSSEL SCALLOP SEAL WALRUS OTTER PELICAN SEAGULL ALBATROSS TURTLE STINGRAY EEL TUNA SALMON MARLIN SWORDFISH ANCHOVY PLANKTON KELP SEAWEED SAND SHELL LIGHTHOUSE HARBOR ANCHOR SAILBOAT SUBMARINE DIVER SNORKEL ISLAND LAGOON CURRENT TRENCH ABYSS",
    Space: "GALAXY PLANET STAR COMET ASTEROID METEOR NEBULA ORBIT GRAVITY ROCKET SHUTTLE SATELLITE ASTRONAUT COSMONAUT TELESCOPE OBSERVATORY MERCURY VENUS EARTH MARS JUPITER SATURN URANUS NEPTUNE PLUTO MOON SUN ECLIPSE CRATER LUNAR SOLAR COSMOS UNIVERSE QUASAR PULSAR SUPERNOVA BLACKHOLE CONSTELLATION ORION LAUNCH CAPSULE MISSION SPACEWALK HELMET MILKYWAY ANDROMEDA STARDUST LIGHTYEAR ROVER PROBE",
  };
  const DIRS_EASY = [[0, 1], [1, 0], [1, 1]];
  const DIRS_ALL = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function wordSearch(words, size = 15, hard = false) {
    const g = Array(size * size).fill(""), placed = [], dirs = hard ? DIRS_ALL : DIRS_EASY;
    const list = U.shuffle(words.map(w => w.toUpperCase().replace(/[^A-Z]/g, "")).filter(w => w.length >= 3 && w.length <= size))
      .sort((a, b) => b.length - a.length);
    for (const w of list) {
      if (placed.length >= 18) break;
      let ok = false;
      for (let t = 0; t < 200 && !ok; t++) {
        const [dr, dc] = U.pick(dirs), r = Math.floor(Math.random() * size), c = Math.floor(Math.random() * size);
        const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
        if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
        let fits = true;
        for (let k = 0; k < w.length; k++) { const cell = g[(r + dr * k) * size + c + dc * k]; if (cell && cell !== w[k]) { fits = false; break; } }
        if (!fits) continue;
        for (let k = 0; k < w.length; k++) g[(r + dr * k) * size + c + dc * k] = w[k];
        placed.push([w, r, c, dr, dc]); ok = true;
      }
    }
    for (let i = 0; i < g.length; i++) if (!g[i]) g[i] = ABC[Math.floor(Math.random() * 26)];
    return { g: g.join(""), n: size, w: placed };
  }

  // ---- book generation ---------------------------------------------------------------------
  async function makeBook(spec, onProgress) {
    const puzzles = [];
    if (spec.type === "sudoku") {
      for (let i = 0; i < spec.count; i++) {
        puzzles.push(sudoku(spec.level));
        if (i % 5 === 4) { onProgress && onProgress(i + 1, spec.count); await U.sleep(0); }
      }
    } else {
      for (let i = 0; i < spec.count; i++) {
        const words = spec.lists ? spec.lists[i % spec.lists.length].words : U.shuffle(THEMES[spec.theme].split(" ")).slice(0, 26);
        const topic = spec.lists ? spec.lists[i % spec.lists.length].topic : `${spec.theme} #${i + 1}`;
        puzzles.push({ ...wordSearch(words, 15, spec.level === "hard"), t: topic });
        if (i % 10 === 9) await U.sleep(0);
      }
    }
    return puzzles;
  }

  // ---- interior PDF (8.5 x 11 in, large print) -------------------------------------------------
  const W = 612, H = 792, M = 54;
  function pageNum(doc, n) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120); doc.text(String(n), W / 2, H - 28, { align: "center" }); }

  function drawSudoku(doc, x, y, size, p, fontSize, solution) {
    const cell = size / 9;
    doc.setDrawColor(30); doc.setTextColor(20);
    for (let i = 0; i <= 9; i++) {
      doc.setLineWidth(i % 3 === 0 ? 2 : 0.5);
      doc.line(x, y + i * cell, x + size, y + i * cell); doc.line(x + i * cell, y, x + i * cell, y + size);
    }
    for (let i = 0; i < 81; i++) {
      const v = p[i]; if (v === "0") continue;
      const given = !solution || solution.given[i] !== "0";
      doc.setFont("helvetica", given ? "bold" : "normal"); doc.setFontSize(fontSize);
      doc.setTextColor(given ? 20 : 110);
      doc.text(v, x + (i % 9) * cell + cell / 2, y + Math.floor(i / 9) * cell + cell / 2 + fontSize * 0.35, { align: "center" });
    }
  }

  function drawWordSearch(doc, x, y, size, pz, fontSize, solved) {
    const n = pz.n, cell = size / n;
    if (solved) {
      doc.setDrawColor(150); doc.setLineWidth(cell * 0.62); doc.setLineCap && doc.setLineCap("round");
      doc.setDrawColor(200, 200, 200);
      for (const [w, r, c, dr, dc] of pz.w) {
        const x1 = x + c * cell + cell / 2, y1 = y + r * cell + cell / 2;
        const x2 = x1 + dc * (w.length - 1) * cell, y2 = y1 + dr * (w.length - 1) * cell;
        doc.line(x1, y1, x2, y2);
      }
      doc.setLineCap && doc.setLineCap("butt");
    }
    doc.setDrawColor(30); doc.setLineWidth(1.2); doc.rect(x - 4, y - 4, size + 8, size + 8);
    doc.setFont("courier", "bold"); doc.setFontSize(fontSize); doc.setTextColor(20);
    for (let i = 0; i < n * n; i++) {
      doc.text(pz.g[i], x + (i % n) * cell + cell / 2, y + Math.floor(i / n) * cell + cell / 2 + fontSize * 0.33, { align: "center" });
    }
  }

  function interiorPdf(item) {
    const d = item.data, doc = new window.jspdf.jsPDF({ unit: "pt", format: [W, H], compress: true });
    const author = d.author || "Earning Bots Press";
    let page = 1;
    // title page
    doc.setFont("helvetica", "bold"); doc.setFontSize(34); doc.setTextColor(20);
    doc.text(doc.splitTextToSize(d.title.toUpperCase(), W - 2 * M), W / 2, 260, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(16);
    doc.text(doc.splitTextToSize(d.subtitle, W - 2 * M - 40), W / 2, 380, { align: "center" });
    doc.setFontSize(13); doc.text(author, W / 2, 470, { align: "center" });
    // copyright
    doc.addPage(); page++;
    doc.setFontSize(10); doc.setTextColor(90);
    doc.text([`Copyright © ${new Date().getFullYear()} ${author}`, "All rights reserved.", "",
      "No part of this book may be reproduced without written permission,", "except for personal use of the puzzles."], M, H - 140);
    // how to play
    doc.addPage(); page++;
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text("How to Play", M, 120);
    doc.setFont("helvetica", "normal"); doc.setFontSize(14);
    const rules = d.type === "sudoku"
      ? ["Fill every empty square with a number from 1 to 9.", "", "Each row, each column and each 3 x 3 box must contain every number from 1 to 9 exactly once.", "", "Every puzzle has exactly one solution. Solutions start after the last puzzle.", "", "Tip: start with the rows, columns and boxes that already have the most numbers."]
      : ["Find every word from the list hidden in the grid.", "", d.level === "hard" ? "Words can run in any direction: across, down, diagonally, and backwards." : "Words run across, down or diagonally, always forwards.", "", "Circle each word as you find it and tick it off the list.", "", "Solutions start after the last puzzle."];
    doc.text(rules.flatMap(l => l ? doc.splitTextToSize(l, W - 2 * M) : [""]), M, 170);
    pageNum(doc, page);

    // puzzles, one per page
    d.puzzles.forEach((pz, i) => {
      doc.addPage(); page++;
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20);
      if (d.type === "sudoku") {
        doc.text(`Puzzle ${i + 1}`, W / 2, 95, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(110);
        doc.text(`Level: ${d.level[0].toUpperCase() + d.level.slice(1)}`, W / 2, 114, { align: "center" });
        const size = W - 2 * M - 30; drawSudoku(doc, (W - size) / 2, 150, size, pz.p, 26);
      } else {
        doc.text(`${i + 1}. ${pz.t}`, W / 2, 85, { align: "center" });
        const size = W - 2 * M - 20; drawWordSearch(doc, (W - size) / 2, 110, size, pz, 19);
        const words = pz.w.map(w => w[0]).sort(), cols = 3, colW = (W - 2 * M) / cols, top = 110 + size + 40;
        doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(20);
        words.forEach((w, k) => doc.text(w, M + 20 + (k % cols) * colW, top + Math.floor(k / cols) * 20));
      }
      pageNum(doc, page);
    });

    // solutions
    doc.addPage(); page++;
    doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(20); doc.text("Solutions", W / 2, H / 2, { align: "center" });
    pageNum(doc, page);
    const per = 4, gap = 30, size = (W - 2 * M - gap) / 2;
    for (let i = 0; i < d.puzzles.length; i += per) {
      doc.addPage(); page++;
      for (let k = 0; k < per && i + k < d.puzzles.length; k++) {
        const pz = d.puzzles[i + k], x = M + (k % 2) * (size + gap), y = 80 + Math.floor(k / 2) * (size + 70);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20);
        doc.text(d.type === "sudoku" ? `Puzzle ${i + k + 1}` : `${i + k + 1}. ${pz.t}`, x, y - 10);
        if (d.type === "sudoku") drawSudoku(doc, x, y, size, pz.s, 13, { given: pz.p });
        else drawWordSearch(doc, x, y, size, pz, 8.5, true);
      }
      pageNum(doc, page);
    }
    if (page % 2) { doc.addPage(); page++; doc.setFontSize(12); doc.setTextColor(140); doc.text("Notes", M, 90); }
    return { blob: doc.output("blob"), pages: page };
  }

  // ---- front cover (8.5 x 11 in at 300 dpi) ---------------------------------------------------------
  const COVER_COLORS = [["#16324f", "#f2c14e"], ["#2d6a4f", "#f1faee"], ["#7b2d26", "#f6d8ae"], ["#3d348b", "#f7b801"], ["#0b525b", "#ffd6a5"], ["#5a189a", "#ffd166"]];
  function coverCanvas(item, width = 2550) {
    const d = item.data, H2 = Math.round(width * 11 / 8.5), cv = document.createElement("canvas");
    cv.width = width; cv.height = H2;
    const x = cv.getContext("2d"), [bg, fg] = COVER_COLORS[d.palette % COVER_COLORS.length], u = width / 100;
    x.fillStyle = bg; x.fillRect(0, 0, width, H2);
    // decorative grid
    x.globalAlpha = 0.09; x.strokeStyle = fg; x.lineWidth = u * 0.3;
    for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(i * u * 8, 0); x.lineTo(i * u * 8, H2); x.stroke(); x.beginPath(); x.moveTo(0, i * u * 10); x.lineTo(width, i * u * 10); x.stroke(); }
    x.globalAlpha = 1;
    x.fillStyle = fg; x.textAlign = "center";
    x.font = `400 ${u * 6}px "Bebas Neue", Impact, sans-serif`; x.fillText("LARGE PRINT", width / 2, u * 14);
    const main = d.type === "sudoku" ? "SUDOKU" : "WORD SEARCH";
    let fs = u * (d.type === "sudoku" ? 24 : 17);
    x.font = `400 ${fs}px "Bebas Neue", Impact, sans-serif`;
    while (x.measureText(main).width > width * 0.9) { fs -= u; x.font = `400 ${fs}px "Bebas Neue", Impact, sans-serif`; }
    x.fillText(main, width / 2, u * 14 + fs * 0.95);
    x.font = `600 ${u * 4.6}px Fraunces, Georgia, serif`;
    const sub = d.type === "sudoku" ? `${d.count} ${d.level[0].toUpperCase() + d.level.slice(1)} Puzzles` : `${d.theme}: ${d.count} Puzzles`;
    x.fillText(sub, width / 2, u * 14 + fs + u * 7);
    // sample grid
    const gs = width * 0.62, gx = (width - gs) / 2, gy = H2 * 0.42;
    x.fillStyle = "#fff"; x.fillRect(gx - u, gy - u, gs + 2 * u, gs + 2 * u);
    x.fillStyle = "#111"; x.textBaseline = "middle";
    const pz = d.puzzles[0];
    if (d.type === "sudoku") {
      const cs = gs / 9; x.strokeStyle = "#111";
      for (let i = 0; i <= 9; i++) { x.lineWidth = i % 3 ? u * 0.15 : u * 0.6; x.beginPath(); x.moveTo(gx, gy + i * cs); x.lineTo(gx + gs, gy + i * cs); x.stroke(); x.beginPath(); x.moveTo(gx + i * cs, gy); x.lineTo(gx + i * cs, gy + gs); x.stroke(); }
      x.font = `700 ${cs * 0.55}px Inter, Arial, sans-serif`;
      for (let i = 0; i < 81; i++) if (pz.p[i] !== "0") x.fillText(pz.p[i], gx + (i % 9) * cs + cs / 2, gy + Math.floor(i / 9) * cs + cs / 2 + u * 0.2);
    } else {
      const n = pz.n, cs = gs / n; x.font = `700 ${cs * 0.6}px "Courier New", monospace`;
      x.fillStyle = fg; x.globalAlpha = 0.85; x.lineCap = "round"; x.strokeStyle = fg; x.lineWidth = cs * 0.7;
      for (const [w, r, c, dr, dc] of pz.w.slice(0, 4)) { x.beginPath(); x.moveTo(gx + c * cs + cs / 2, gy + r * cs + cs / 2); x.lineTo(gx + (c + dc * (w.length - 1)) * cs + cs / 2, gy + (r + dr * (w.length - 1)) * cs + cs / 2); x.stroke(); }
      x.globalAlpha = 1; x.fillStyle = "#111";
      for (let i = 0; i < n * n; i++) x.fillText(pz.g[i], gx + (i % n) * cs + cs / 2, gy + Math.floor(i / n) * cs + cs / 2);
    }
    x.textBaseline = "alphabetic"; x.fillStyle = fg;
    x.font = `600 ${u * 3.4}px Inter, Arial, sans-serif`;
    x.fillText("ONE PUZZLE PER PAGE  ·  SOLUTIONS INCLUDED", width / 2, H2 - u * 9);
    return cv;
  }

  window.EB_PUZZLES = { sudoku, wordSearch, makeBook, interiorPdf, coverCanvas, THEMES };
})();
