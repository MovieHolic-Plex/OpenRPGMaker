const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { createRequire } = require("module");

// Load lake helpers via dynamic - use vitest-free pure reimplementation for classification report
// Actually spawn vitest for logic + pngjs for render

const OUT = path.join("output", "evidence", "lake-render-qa");
fs.mkdirSync(OUT, { recursive: true });

const COL = 30;
const TS = 16;
const Q = 8;

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

async function loadMap() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL.replace(/\/$/, "");
  const key = env.VITE_SUPABASE_ANON_KEY;
  const r = await fetch(url + "/rest/v1/projects?project_id=eq.rpg-zzu-house-template-gallery&select=current_json", {
    headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json", "Accept-Profile": "rpg_zzu" },
  });
  const p = (await r.json())[0].current_json;
  return p.maps.map_lake_village;
}

// Inline quarter logic matching lakeAutotile.ts (keep in sync)
const LAKE = { OUTER: 0, INNER: 90, EDGE_W: 30, EDGE_N: 60, EDGE_S: 60, BODY: 120 };
const WATER_SET = new Set();
// shore 0-2 rows cols 0-2 and body rows 4-7 cols 0-2
for (let r = 0; r <= 3; r++) for (let c = 0; c <= 2; c++) WATER_SET.add(r * COL + c);
for (let r = 4; r <= 7; r++) for (let c = 0; c <= 2; c++) WATER_SET.add(r * COL + c);

function isWater(map, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return WATER_SET.has(map.lowerTiles[y * map.width + x]);
}

function sourceQuarter(tile, dest) {
  const base = tile === 91 || tile === 92 ? 90 : tile === 61 || tile === 62 ? 60 : tile === 31 || tile === 32 ? 30 : tile;
  if (base === 90) return dest;
  return dest;
}

function quarters(map, x, y) {
  const N = isWater(map, x, y - 1);
  const S = isWater(map, x, y + 1);
  const W = isWater(map, x - 1, y);
  const E = isWater(map, x + 1, y);
  const contexts = [
    { q: "nw", v: N, h: W, d: isWater(map, x - 1, y - 1) },
    { q: "ne", v: N, h: E, d: isWater(map, x + 1, y - 1) },
    { q: "sw", v: S, h: W, d: isWater(map, x - 1, y + 1) },
    { q: "se", v: S, h: E, d: isWater(map, x + 1, y + 1) },
  ];
  return contexts.map((c) => {
    let tile;
    if (!c.v && !c.h) tile = LAKE.OUTER;
    else if (!c.v) tile = c.q === "nw" || c.q === "ne" ? LAKE.EDGE_N : LAKE.EDGE_S;
    else if (!c.h) tile = LAKE.EDGE_W;
    else if (!c.d) tile = LAKE.INNER;
    else tile = LAKE.BODY;
    return { dest: c.q, tile, source: sourceQuarter(tile, c.q), offsetX: c.q.includes("e") ? 8 : 0, offsetY: c.q.includes("s") ? 8 : 0 };
  });
}

function classifyCell(map, x, y) {
  if (!isWater(map, x, y)) return "land";
  const N = isWater(map, x, y - 1), S = isWater(map, x, y + 1), W = isWater(map, x - 1, y), E = isWater(map, x + 1, y);
  const landN = !N, landS = !S, landW = !W, landE = !E;
  const landCount = [landN, landS, landW, landE].filter(Boolean).length;
  if (landCount === 0) return "body";
  if (landCount === 1) {
    if (landN) return "edge-north";
    if (landS) return "edge-south";
    if (landW) return "edge-west";
    return "edge-east";
  }
  if (landCount === 2) {
    if (landN && landW) return "outer-nw";
    if (landN && landE) return "outer-ne";
    if (landS && landW) return "outer-sw";
    if (landS && landE) return "outer-se";
    return "edge-complex";
  }
  return "edge-complex";
}

function blitQuarter(chip, tile, sourceQ, dest, outPng, cellPx, scale) {
  const col = tile % COL, row = Math.floor(tile / COL);
  const sq = { nw: [0, 0], ne: [8, 0], sw: [0, 8], se: [8, 8] }[sourceQ];
  const dq = { nw: [0, 0], ne: [8, 0], sw: [0, 8], se: [8, 8] }[dest];
  for (let y = 0; y < Q; y++) {
    for (let x = 0; x < Q; x++) {
      const sx = col * TS + sq[0] + x;
      const sy = row * TS + sq[1] + y;
      const si = (sy * chip.width + sx) * 4;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const ox = cellPx + (dq[0] + x) * scale + dx;
          const oy = cellPx + (dq[1] + y) * scale + dy; // cell origin passed as base
          // fixed below
        }
      }
    }
  }
}

function renderCell(chip, map, x, y, scale = 8) {
  const size = TS * scale;
  const png = new PNG({ width: size, height: size });
  // fill magenta for missing
  for (let i = 0; i < size * size; i++) {
    png.data[i * 4] = 255; png.data[i * 4 + 1] = 0; png.data[i * 4 + 2] = 255; png.data[i * 4 + 3] = 255;
  }
  const parts = quarters(map, x, y);
  for (const p of parts) {
    const col = p.tile % COL, row = Math.floor(p.tile / COL);
    const sq = { nw: [0, 0], ne: [8, 0], sw: [0, 8], se: [8, 8] }[p.source];
    const dq = { nw: [0, 0], ne: [8, 0], sw: [0, 8], se: [8, 8] }[p.dest];
    for (let y0 = 0; y0 < Q; y0++) {
      for (let x0 = 0; x0 < Q; x0++) {
        const sx = col * TS + sq[0] + x0;
        const sy = row * TS + sq[1] + y0;
        const si = (sy * chip.width + sx) * 4;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const ox = (dq[0] + x0) * scale + dx;
            const oy = (dq[1] + y0) * scale + dy;
            const di = (oy * size + ox) * 4;
            png.data[di] = chip.data[si];
            png.data[di + 1] = chip.data[si + 1];
            png.data[di + 2] = chip.data[si + 2];
            png.data[di + 3] = chip.data[si + 3];
          }
        }
      }
    }
  }
  return { png, parts };
}

(async () => {
  const map = await loadMap();
  const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));

  // sample points: known edges from rebuild + scan
  const samples = [
    { x: 20, y: 23, expect: "body" },
    { x: 24, y: 30, expect: "edge-south" },
    { x: 30, y: 25, expect: "edge-east" },
    { x: 19, y: 25, expect: "edge-west" },
    { x: 25, y: 19, expect: "edge-north" },
  ];
  // find outer corners of water blob
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (!isWater(map, x, y)) continue;
      const c = classifyCell(map, x, y);
      if (c.startsWith("outer-") && samples.length < 12) {
        if (!samples.some((s) => s.x === x && s.y === y)) samples.push({ x, y, expect: c });
      }
    }
  }

  const report = { map: map.name, samples: [] };
  for (const s of samples) {
    if (!isWater(map, s.x, s.y) && s.expect !== "land") {
      report.samples.push({ ...s, skip: "not water" });
      continue;
    }
    const cls = classifyCell(map, s.x, s.y);
    const { png, parts } = renderCell(chip, map, s.x, s.y, 10);
    const uses90 = parts.some((p) => p.tile === 90 || p.tile === 91 || p.tile === 92);
    const usesInnerOk = cls.includes("outer") || cls === "body" || cls.startsWith("edge");
    // rule: straight edges must not use 90
    const straight = cls.startsWith("edge-");
    const ok = !(straight && uses90);
    const fname = `cell_${s.x}_${s.y}_${cls}.png`;
    fs.writeFileSync(path.join(OUT, fname), PNG.sync.write(png));
    report.samples.push({
      x: s.x,
      y: s.y,
      expect: s.expect,
      classified: cls,
      parts,
      uses90,
      straightEdgeOk: ok,
      image: fname,
    });
  }

  // summary board: 3x3 around center lake
  const scale = 4;
  const boardW = 14, boardH = 14;
  const ox = 18, oy = 18;
  const bw = boardW * TS * scale, bh = boardH * TS * scale;
  const board = new PNG({ width: bw, height: bh });
  for (let by = 0; by < boardH; by++) {
    for (let bx = 0; bx < boardW; bx++) {
      const mx = ox + bx, my = oy + by;
      if (mx >= map.width || my >= map.height) continue;
      if (isWater(map, mx, my)) {
        const { png } = renderCell(chip, map, mx, my, scale);
        for (let py = 0; py < TS * scale; py++) {
          for (let px = 0; px < TS * scale; px++) {
            const si = (py * TS * scale + px) * 4;
            const di = ((by * TS * scale + py) * bw + (bx * TS * scale + px)) * 4;
            board.data[di] = png.data[si];
            board.data[di + 1] = png.data[si + 1];
            board.data[di + 2] = png.data[si + 2];
            board.data[di + 3] = png.data[si + 3];
          }
        }
      } else {
        // grass-ish
        for (let py = 0; py < TS * scale; py++) {
          for (let px = 0; px < TS * scale; px++) {
            const di = ((by * TS * scale + py) * bw + (bx * TS * scale + px)) * 4;
            board.data[di] = 70; board.data[di + 1] = 140; board.data[di + 2] = 55; board.data[di + 3] = 255;
          }
        }
      }
    }
  }
  fs.writeFileSync(path.join(OUT, "lake-region-board.png"), PNG.sync.write(board));

  report.summary = {
    total: report.samples.length,
    straightWith90: report.samples.filter((s) => s.straightEdgeOk === false).length,
    board: "lake-region-board.png",
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("samples", report.samples.map((s) => `${s.x},${s.y} ${s.classified} 90=${s.uses90} ok=${s.straightEdgeOk}`).join("\n"));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
