// Room kit for the atlas interiors (about a hundred Tibo interiors). The same grammar as author-rpg-interiors.mjs —
// interiorRoomPipeline plan→floor→walls for the shell, named Tibo kits for the furniture — with stricter checks:
//  - nothing is stamped over another upper-layer piece (overlap throws);
//  - a chair faces its table: 267 (front view) stands north of a table, 268 (back view) south of it, 297/580/584/588
//    (facing east) west of it, 298 (facing west) east of it. A stool (816/817/813) may stand on any side;
//  - a table is its top and its legged front (table()/cloth() swap the island's bottom row for 198~201/2140~2147);
//  - pews are the back view 2070~2083 (the congregation faces north); the sheet's front-view pew is refused;
//  - tabletop things stand on a table top, wall hangings inside the two wall-face rows, floor furniture on the floor;
//  - every walkable floor cell is reachable from the entrance (runtime canMove), and every target too.
// Usage: const K = createKit(api, base); const r = K.room(id, name, w, h, shellSpec); r.stamp(...); r.done({...});
import assert from "node:assert/strict";

export function createKit(api, base) {
  const TIBO = structuredClone(base.tilesets.tibo_interior_expanded);
  delete TIBO.referenceDocuments;
  const INT = base.tilesets.easyrpg_chipset_interior;
  const kits = new Map(TIBO.structureKits.map((k) => [k.id, k]));
  const group = (ts, id) => ts.autotileGroups.find((g) => g.id.endsWith(id));

  // ── roles ──
  const K = (s) => s.split(/\s+/).filter(Boolean).map((n) => `tibo-${n}`);
  const TOP_KITS = new Set(K(`library-001 library-002 library-003 library-004 library-005 library-006 library-007 library-008
    library-010 library-020 library-032 library-033 library-035 library-036 library-073 library-076
    library-079 library-080 library-090 library-091 library-095 library-096 library-107 library-112
    library-113 library-114 library-120 library-121 library-122 library-128 library-135 library-136
    library-139 library-146 library-148 library-150 library-152 library-153 library-155 library-157 library-158 library-160
    library-165 library-168 library-170 library-171 library-172 library-177 library-187 library-189 library-201 library-213
    library-238 library-189 v11-1-0 v10-1-1 v4-4-1 v4-5-1 v12-1-0 v12-1-1 bell balance-scale library-121 accordion`));
  const HANG_KITS = new Set(K(`hanging-herbs library-009 library-011 library-012 library-021 library-075 library-088 library-089
    library-099 library-108 library-138 library-144 library-163 library-164 library-217
    library-218 library-219 library-220 library-221 library-222 library-223 library-224 library-225 library-226 library-227
    library-228 v6-1-0 v6-2-0 v8-1-0 v9-1-0 library-159`));
  const SEAT_KITS = new Set(K(`library-027 library-028 library-029 library-030 library-202 v3-3-1 v7-1-2 v7-2-2 v7-3-2`));
  const TABLE_KITS = new Set(K(`library-025 library-026 library-140 library-161 v4-4-0 v4-4-2 v4-5-2 v7-1-3 v7-2-3 v7-3-3
    fantasy-dining-set medieval-banquet-table medieval-scribe-desk warm-scribe-desk fantasy-alchemy-desk fantasy-prep-table
    fantasy-bar-counter chessboard fantasy-washstand library-040 library-085 library-110 library-125 atlas-jewel-counter atlas-teller-counter
    atlas-roulette medieval-smith-bench fantasy-anvil-bench`));
  const HANG_TILES = new Set([24, 54, 56, 57, 58, 59, 84, 85, 86, 142, 143, 144, 172, 173, 174, 202, 203, 260, 261, 262, 290, 388, 418, 472,
    2050, 2060, 2061, 2088, 2089, 2090, 2091, 2092, 2093, 2094, 2095, 2096, 2097]);
  const SEAT_TILES = new Set([267, 268, 297, 298, 446, 476]);
  const TABLE_TILES = new Set([325, 326, 327, 328, 234, 235, 236, 264, 294, 329]);
  for (const id of TABLE_KITS) for (const r of kits.get(id).rows) for (const t of r.upperTiles ?? []) if (t >= 0) TABLE_TILES.add(t);
  const DECK = group(TIBO, "terrain-deck"), CLOTH = group(TIBO, "white-table");
  const TABLE_LOWER = new Set([...DECK.memberTileIds, ...Object.values(DECK.variantMap), ...CLOTH.memberTileIds, ...Object.values(CLOTH.variantMap),
    198, 199, 200, 201, 228, 229, 230, 231, 2140, 2141, 2142, 2143, 2144, 2145, 2146, 2147]);
  TABLE_LOWER.delete(127);
  // wall faces (upper row, lower row; left, middle, right, solo) — the pipeline's cream face plus retints
  const FACES = {
    cream: [[74, 75, 76, 77], [104, 105, 106, 107]], "stone-brick": [[134, 135, 136, 137], [164, 165, 166, 167]],
    "gold-brick": [[314, 315, 316, 317], [344, 345, 346, 347]], "purple-brick": [[14, 15, 16, 17], [44, 45, 46, 47]],
    "dark-stone": [[194, 195, 196, 197], [224, 225, 226, 227]], "moss-stone": [[254, 255, 256, 257], [284, 285, 286, 287]],
    log: [[1980, 1981, 1982, 1981], [1983, 1984, 1985, 1984]], sandstone: [[1986, 1987, 1988, 1987], [1989, 1990, 1991, 1990]],
    basalt: [[1992, 1993, 1994, 1993], [1995, 1996, 1997, 1996]],
  };
  const FACE = new Set(Object.values(FACES).flat(2));
  const roleOfKit = (id) => (TOP_KITS.has(id) ? "top" : HANG_KITS.has(id) ? "hang" : SEAT_KITS.has(id) ? "seat" : TABLE_KITS.has(id) ? "table" : "furn");
  const roleOfTile = (t) => (HANG_TILES.has(t) ? "hang" : SEAT_TILES.has(t) ? "seat" : TABLE_TILES.has(t) ? "table" : "furn");
  const CEIL = group(INT, "ceiling"), CEIL_TILES = [...new Set(Object.values(CEIL.variantMap))];
  const isCeil = (t) => t === 430 || CEIL_TILES.includes(t);
  const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
  // chairs: tile → the side its table must be on
  const FACING = { 267: [0, 1], 268: [0, -1], 297: [1, 0], 580: [1, 0], 584: [1, 0], 588: [1, 0], 298: [-1, 0] };
  const PLAIN = new Set([42, 72, 73, 102, 103, 163, 222, 223, 192, 1998, 1999, 12, 13, 43, 162]);   // floors (object cut, emptiness)

  const places = [], objects = [], overlaps = [];
  function room(id, name, w, h, spec) {
    const m = { width: w, height: h, lowerTiles: [], upperTiles: [] };
    const placed = [], stairCells = [], owner = new Map();   // owner: upper cell index → what put it there
    const idx = (x, y) => y * w + x;
    const get = (x, y, layer = "lowerTiles") => m[layer][idx(x, y)];
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const put = (x, y, t, layer = "upperTiles", who = "?") => {
      assert(inside(x, y), `${id}: ${who} off the map at ${x},${y}`);
      if (layer === "upperTiles") {
        const k = idx(x, y);
        if (m.upperTiles[k] >= 0 && owner.get(k) !== who) { overlaps.push(`${id}: ${who} overlaps ${owner.get(k)} at ${x},${y}`); return; }
        owner.set(k, who);
      }
      m[layer][idx(x, y)] = t;
    };
    const autotile = (g, members = g.memberTileIds, boxLimit) => {
      const mem = new Set(members), con = new Set([...(g.connectTileIds ?? g.memberTileIds), ...mem]), src = [...m.lowerTiles];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!mem.has(src[idx(x, y)])) continue;
        if (boxLimit && (x < boxLimit[0] || y < boxLimit[1] || x > boxLimit[2] || y > boxLimit[3])) continue;
        let mask = 0;
        for (const [dx, dy, bit] of DIRS) {
          const X = x + dx, Y = y + dy;
          if (!inside(X, Y) || con.has(src[Y * w + X])) mask |= bit;
        }
        const v = g.variantMap[String(mask)];
        if (v !== undefined) m.lowerTiles[idx(x, y)] = v;
      }
    };
    const U = FACES.cream[0], L = FACES.cream[1];
    const renormFaces = () => {
      for (const set of [U, L]) for (let y = 0; y < h; y++) {
        const row = [...Array(w).keys()].map((x) => set.includes(get(x, y)));
        for (let x = 0; x < w; x++) if (row[x]) {
          const l = x > 0 && row[x - 1], r = x < w - 1 && row[x + 1];
          m.lowerTiles[idx(x, y)] = set[l && r ? 1 : r ? 0 : l ? 2 : 3];
        }
      }
    };
    const reshapeCeiling = () => autotile(CEIL, CEIL_TILES);
    // ── shell: the pipeline's plan/floor/walls ──
    const plan = { mapId: "shell", name: "shell", width: w, height: h, wings: spec.wings ?? [], ...(spec.rooms ? { rooms: spec.rooms } : {}),
      ...(spec.innerDoors ? { innerDoors: spec.innerDoors } : {}), door: spec.door, theme: "storage", seed: 1, ...(spec.openPlan ? { openPlan: true } : {}) };
    let pm = api.createEmptyRoomMap(plan);
    for (const layer of ["plan", "floor", "walls"]) {
      const r = api.applyInteriorRoomLayer(pm, plan, layer);
      assert(r.ok, `${id} ${layer}: ${r.warnings.join(";")}`);
      pm = r.map;
    }
    m.lowerTiles = [...pm.lowerTiles]; m.upperTiles = [...pm.upperTiles];
    // A partition's ceiling that stops under two wall-face rows is carried up through them into the ceiling above.
    {
      const isFace = (t) => U.includes(t) || L.includes(t);
      let hit = 0;
      for (let y = 3; y < h; y++) for (let x = 0; x < w; x++) {
        if (isCeil(get(x, y)) && isFace(get(x, y - 1)) && isFace(get(x, y - 2)) && isCeil(get(x, y - 3))) {
          m.lowerTiles[idx(x, y - 1)] = 430; m.lowerTiles[idx(x, y - 2)] = 430; hit++;
        }
      }
      if (hit) { reshapeCeiling(); renormFaces(); }
    }
    for (const x of spec.northDoors ?? []) {
      let y = 0; while (y < h && !U.includes(get(x, y))) y++;
      assert(y < h, `${id}: north door ${x}`);
      m.lowerTiles[idx(x, y)] = 116; m.lowerTiles[idx(x, y + 1)] = 146;
      placed.push({ kind: "doorway", x, y, w: 1, h: 2, role: "doorway" });
      renormFaces();
    }
    const wall = spec.wall ?? "cream";
    if (wall !== "cream") {
      const [nu, nl] = FACES[wall]; assert(nu, `${id}: wall ${wall}`);
      m.lowerTiles = m.lowerTiles.map((t) => { const a = U.indexOf(t), b = L.indexOf(t); return a >= 0 ? nu[a] : b >= 0 ? nl[b] : t; });
    }
    const faceU = FACES[wall][0], faceL = FACES[wall][1];
    const isFaceAt = (x, y) => inside(x, y) && FACE.has(get(x, y));
    const walkable = (x, y) => { const q = TIBO.passability[get(x, y)]; return !!q && (q.up || q.down || q.left || q.right) && !FACE.has(get(x, y)); };

    const r = {
      id, m, w, h, placed, wall,
      get, inside, isFaceAt, walkable,
      floor(t, box) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (box && (x < box[0] || y < box[1] || x > box[2] || y > box[3])) continue;
          if (get(x, y) === 72) m.lowerTiles[idx(x, y)] = t;
        }
        return r;
      },
      fill(x0, y0, x1, y1, t) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { assert(walkable(x, y) || PLAIN.has(get(x, y)), `${id}: fill ${t} on non-floor ${x},${y}`); m.lowerTiles[idx(x, y)] = t; }
        placed.push({ kind: "floor", tile: t, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, role: "floor" });
        return r;
      },
      block(x, y, rows, layer = "upperTiles", role) {
        const r0 = role ?? (layer === "lowerTiles" ? "floor" : roleOfTile(rows.flat().find((t) => t >= 0)));
        const who = `tiles ${rows.flat().filter((t) => t >= 0)[0]}@${x},${y}#${placed.length}`;
        placed.push({ kind: "tiles", layer: layer.replace("Tiles", ""), x, y, w: rows[0].length, h: rows.length, rows, role: r0 });
        rows.forEach((row, dy) => row.forEach((t, dx) => { if (t >= 0) put(x + dx, y + dy, t, layer, who); }));
        return r;
      },
      one(x, y, t, layer = "upperTiles", role) { return r.block(x, y, [[t]], layer, role); },
      stamp(kitId, x, y) {
        const k = kits.get(kitId); assert(k, `${id}: no kit ${kitId}`);
        assert(kitId !== "tibo-fantasy-pew", `${id}: the front-view pew faces away from an altar — use tibo-atlas-pew-back`);
        const who = `${kitId}@${x},${y}#${placed.length}`;
        placed.push({ kind: "tibo-kit", kitId, name: k.name, x, y, w: k.width, h: k.height, role: roleOfKit(kitId) });
        k.rows.forEach((row, dy) => (row.upperTiles ?? []).forEach((t, dx) => { if (t >= 0) put(x + dx, y + dy, t, "upperTiles", who); }));
        return r;
      },
      // several kits in a row, each at its own x (a shelf wall, a row of barrels)
      row(kitId, xs, y) { for (const x of xs) r.stamp(kitId, x, y); return r; },
      // islands (rugs, table tops) are shaped on their own so two never merge
      island(name, kind, x0, y0, x1, y1) {
        const g = group(TIBO, name);
        placed.push({ kind, group: g.id, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, role: kind });
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { assert(walkable(x, y) || TABLE_LOWER.has(get(x, y)) || g.memberTileIds.includes(get(x, y)), `${id}: ${name} on non-floor ${x},${y}`); m.lowerTiles[idx(x, y)] = g.variantMap["255"]; }
        const mem = new Set(g.memberTileIds), saved = [];
        for (let i = 0; i < m.lowerTiles.length; i++) {
          const x = i % w, y = (i / w) | 0;
          if (mem.has(m.lowerTiles[i]) && (x < x0 || y < y0 || x > x1 || y > y1)) { saved.push([i, m.lowerTiles[i]]); m.lowerTiles[i] = -2; }
        }
        autotile(g);
        for (const [i, t] of saved) m.lowerTiles[i] = t;
        return r;
      },
      rug(color, x0, y0, x1, y1) { return r.island(color === "teal" ? "teal-carpet" : "red-carpet", "rug", x0, y0, x1, y1); },
      // one rug island made of several rectangles (a T before a throne), shaped once
      rugShape(rects, color = "red") {
        const g = group(TIBO, color === "teal" ? "teal-carpet" : "red-carpet"), mem = new Set(g.memberTileIds), saved = [];
        for (let i = 0; i < m.lowerTiles.length; i++) if (mem.has(m.lowerTiles[i])) { saved.push([i, m.lowerTiles[i]]); m.lowerTiles[i] = -2; }
        for (const [x0, y0, x1, y1] of rects) {
          placed.push({ kind: "rug", group: g.id, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, role: "rug" });
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.lowerTiles[idx(x, y)] = g.variantMap["255"];
        }
        autotile(g);
        for (const [i, t] of saved) m.lowerTiles[i] = t;
        return r;
      },
      // 3x3 nine-slice floor pieces (straw mat 108~170, white fur 2000~2008)
      nine(tiles, x0, y0, x1, y1) {
        placed.push({ kind: "rug", tiles: tiles[4], x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, role: "rug" });
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          assert(walkable(x, y), `${id}: mat on non-floor ${x},${y}`);
          const c = x === x0 ? 0 : x === x1 ? 2 : 1, rr = y === y0 ? 0 : y === y1 ? 2 : 1;
          m.lowerTiles[idx(x, y)] = tiles[rr * 3 + c];
        }
        return r;
      },
      mat(x0, y0, x1, y1) { return r.nine([108, 109, 110, 138, 139, 140, 168, 169, 170], x0, y0, x1, y1); },
      fur(x0, y0, x1, y1) { return r.nine([2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008], x0, y0, x1, y1); },
      // a table: the deck/cloth top island with its bottom row swapped for the legged front
      table(x0, y0, x1, y1, cloth = false) {
        r.island(cloth ? "white-table" : "terrain-deck", "tabletop", x0, y0, x1, y1);
        const f = cloth ? (y1 > y0 ? [228, 229, 230, 2147] : [2143, 2144, 2145, 231]) : (y1 > y0 ? [198, 199, 200, 2146] : [2140, 2141, 2142, 201]);
        for (let x = x0; x <= x1; x++) m.lowerTiles[idx(x, y1)] = x0 === x1 ? f[3] : x === x0 ? f[0] : x === x1 ? f[2] : f[1];
        return r;
      },
      cloth(x0, y0, x1, y1) { return r.table(x0, y0, x1, y1, true); },
      // chairs by the side their table is on: "n" = north of the table (faces south, 267), "s" (268), "w" (297), "e" (298)
      chair(side, x, y, style) {
        const t = { n: 267, s: 268, w: style === "red" ? 580 : style === "blue" ? 584 : 297, e: 298 }[side];
        if (style && side === "w") return r.stamp(style === "red" ? "tibo-v7-1-2" : style === "blue" ? "tibo-v7-2-2" : "tibo-v7-3-2", x, y);
        return r.one(x, y, t, "upperTiles", "seat");
      },
      stool(x, y, tall = false) { return r.stamp(tall ? "tibo-library-029" : "tibo-library-030", x, y); },
      // pews facing north, n rows from y, 4 or 3 wide; gap = empty rows between rows
      pews(x, y, n, { width = 4, gap = 1 } = {}) {
        for (let i = 0; i < n; i++) r.stamp(width === 3 ? "tibo-atlas-pew-back-3" : "tibo-atlas-pew-back", x, y + i * (2 + gap));
        return r;
      },
      bed(x, y, kind = "plain") {
        if (kind === "plain") return r.block(x, y, [[324], [354]], "upperTiles", "furn");
        return r.stamp({ wood: "tibo-fantasy-bed", canopy: "tibo-medieval-canopy-bed", red: "tibo-v3-3-0" }[kind], x, y);
      },
      pillar(x, y) { return r.block(x, y, [[89], [119]], "upperTiles", "furn"); },
      statue(x, y) { return r.block(x, y, [[88], [118]], "upperTiles", "furn"); },
      armour(x, y) { return r.block(x, y, [[87], [117]], "upperTiles", "furn"); },
      curtain(x, y) { return r.block(x, y, [[142, 143], [172, 173], [202, 203]], "upperTiles", "furn"); },
      bookcase(x, y) { return r.block(x, y, [[18, 19, 20], [48, 49, 50], [78, 79, 80]], "lowerTiles", "furn"); },
      shelf(x, y) { return r.block(x, y, [[147], [177]], "upperTiles", "furn"); },
      throne(x, y) { return r.block(x, y, [[447, 448, 449], [477, 478, 479]], "upperTiles", "furn"); },
      redChair(x, y) { return r.block(x, y, [[446], [476]], "upperTiles", "furn"); },
      bars(x0, x1, y, doorX) {
        for (let x = x0; x <= x1; x++) r.one(x, y, x === doorX ? 2087 : x === x0 ? 2084 : x === x1 ? 2086 : 2085, "upperTiles", "furn");
        return r;
      },
      // stage: plank floor rows y0..y1-1 and the front face on y1 (steps at stepX)
      stage(x0, y0, x1, y1, stepX) {
        r.fill(x0, y0, x1, y1 - 1, 102);
        for (let x = x0; x <= x1; x++) m.lowerTiles[idx(x, y1)] = x === stepX ? 2133 : x === x0 ? 2130 : x === x1 ? 2131 + 1 : 2131;
        placed.push({ kind: "stage", x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, role: "floor" });
        return r;
      },
      closeDoor(x, y) {
        for (let yy = y; yy < h; yy++) m.lowerTiles[idx(x, yy)] = 430;
        for (let yy = y - 1; yy < h; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (inside(xx, yy) && CEIL_TILES.includes(get(xx, yy))) m.lowerTiles[idx(xx, yy)] = 430;
        reshapeCeiling();
        return r;
      },
      // Up: the horizontal stone flight 141|111|171 three rows deep (first floor row + the two wall-face rows above).
      // x = the flight's east column, y = its first floor row. Down: 474 alone (1x1), never side by side.
      stairsUp(x, y) {
        for (let d = 0; d < 3; d++) assert(walkable(x - d, y) && FACE.has(get(x - d, y - 1)) && FACE.has(get(x - d, y - 2)), `${id}: wall stairs ${x - d},${y}`);
        r.block(x - 2, y - 2, [[141, 111, 171], [141, 111, 171], [141, 111, 171]], "lowerTiles", "stairs");
        for (let dy = -2; dy <= 0; dy++) for (let dx = -2; dx <= 0; dx++) stairCells.push([x + dx, y + dy, false]);
        return r;
      },
      stairsDown(x, y) {
        assert(walkable(x, y), `${id}: stairs down on floor ${x},${y}`);
        r.one(x, y, 474, "upperTiles", "stairs");
        stairCells.push([x, y, true]);
        return r;
      },
      // a reusable piece for the shared object catalog: a rectangle of this map
      object(oid, oname, category, x, y, ow, oh, tags, ownerText) {
        objects.push({ id: `interiors/${oid}`, name: oname, category, tags, tilesetId: "tibo_interior_expanded", width: ow, height: oh, rect: [x, y], owner: ownerText, sourceMap: id, _room: r });
        return r;
      },
      done(meta) {
        assert(meta.entry && meta.use && meta.note, `${id}: done() needs entry, use, note`);
        places.push({ id, name, tilesetId: "tibo_interior_expanded", map: m, ...meta, targets: meta.targets ?? [], placements: placed, stairCells, wall });
        return m;
      },
    };
    return r;
  }

  // ── checks on finished maps ──
  function check(project) {
    const rules = [...overlaps], report = [];
    for (const p of places) {
      const mm = p.map, W = mm.width;
      const lo = (x, y) => mm.lowerTiles[y * W + x], up = (x, y) => mm.upperTiles[y * W + x];
      const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < mm.height;
      const face = (x, y) => inside(x, y) && FACE.has(lo(x, y));
      const tableAt = (x, y) => inside(x, y) && (TABLE_LOWER.has(lo(x, y)) || TABLE_TILES.has(up(x, y)));
      const cells = (q) => { const c = []; for (let dy = 0; dy < q.h; dy++) for (let dx = 0; dx < q.w; dx++) c.push([q.x + dx, q.y + dy]); return c; };
      for (const q of p.placements) {
        const c = cells(q), bad = (why) => rules.push(`${p.id}: ${q.kitId ?? q.rows?.flat().join("/") ?? q.kind} @${q.x},${q.y} — ${why}`);
        if (q.role === "top" && !c.every(([x, y]) => TABLE_LOWER.has(lo(x, y)))) bad("tabletop item off a table");
        if (q.role === "hang" && !c.every(([x, y]) => face(x, y))) bad("wall hanging crosses the wall-face rows");
        if (q.role === "seat" && !c.some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tableAt(x + dx, y + dy)))) bad("seat without a table");
        if ((q.role === "furn" || q.role === "table" || q.role === "seat" || q.role === "top") && q.layer !== "lower") {
          const bottom = c.filter(([, y]) => y === q.y + q.h - 1);
          if (bottom.some(([x, y]) => face(x, y) || (inside(x, y) && (lo(x, y) === 430 || CEIL_TILES.includes(lo(x, y)))))) bad("floor furniture floating on the wall");
        }
      }
      // chair facing: every facing chair tile has its table on the side it faces
      for (let y = 0; y < mm.height; y++) for (let x = 0; x < W; x++) {
        const f = FACING[up(x, y)];
        if (f && !tableAt(x + f[0], y + f[1])) rules.push(`${p.id}: chair ${up(x, y)} @${x},${y} faces (${f}) but has no table there`);
      }
      for (const [x, y, down] of p.stairCells) {
        const u = up(x, y);
        if (down ? u !== 474 : u !== -1) rules.push(`${p.id}: @${x},${y} — something stands on the stairs (upper ${u})`);
      }
      if ([...mm.upperTiles].some((t) => t >= 1814 && t <= 1847 && [1814, 1815, 1816, 1817, 1844, 1845, 1846, 1847].includes(t))) rules.push(`${p.id}: front-view pew used`);
      // reachability with the runtime move rule
      const map = { id: p.id, name: p.name, width: W, height: mm.height, tileSize: 16, tilesetId: p.tilesetId, lowerTiles: mm.lowerTiles, upperTiles: mm.upperTiles, events: [] };
      const proj = { maps: { [p.id]: map }, tilesets: project.tilesets };
      const seen = new Set([p.entry[1] * W + p.entry[0]]), queue = [p.entry];
      while (queue.length) {
        const [x, y] = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy, k = Y * W + X;
          if (!seen.has(k) && api.canMove(proj, map, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
        }
      }
      const ts = project.tilesets[p.tilesetId];
      const walk = (t) => { const q = ts.passability[t]; return q && (q.up || q.down || q.left || q.right); };
      const floorCells = [];
      for (let k = 0; k < W * mm.height; k++) if (walk(mm.lowerTiles[k]) && mm.upperTiles[k] < 0 && !FACE.has(mm.lowerTiles[k])) floorCells.push(k);
      const sealedAt = (x, y) => (p.sealed ?? []).some(([x0, y0, x1, y1]) => x >= x0 && y >= y0 && x <= x1 && y <= y1);
      const pockets = floorCells.filter((k) => !seen.has(k)).map((k) => [k % W, (k / W) | 0]).filter(([x, y]) => !sealedAt(x, y));
      const targets = [...p.targets, ...p.stairCells.filter(([, , d]) => d).map(([x, y]) => [x, y])];
      // an up flight is reached when its bottom row is
      for (const [x, y, d] of p.stairCells) if (!d && walk(mm.lowerTiles[(y + 1) * W + x]) && !FACE.has(lo(x, y + 1)) && !targets.some(([a, b]) => a === x && b === y)) {
        if (!p.stairCells.some(([a, b]) => a === x && b === y + 1)) targets.push([x, y]);
      }
      const blocked = targets.filter(([x, y]) => !seen.has(y * W + x));
      report.push({ id: p.id, entry: p.entry, targets, reachable: seen.size, walkable: floorCells.length, blocked, pockets });
    }
    return { rules, report };
  }

  // Object rectangles → lower/upper arrays (plain floor becomes -1 so the piece stands on any floor).
  function cutObjects() {
    return objects.map(({ _room, rect, ...o }) => {
      const mm = _room.m, lower = [], upper = [];
      for (let y = rect[1]; y < rect[1] + o.height; y++) for (let x = rect[0]; x < rect[0] + o.width; x++) {
        const lo = mm.lowerTiles[y * mm.width + x], up = mm.upperTiles[y * mm.width + x];
        lower.push(PLAIN.has(lo) ? -1 : lo);
        upper.push(up);
      }
      assert(upper.some((t) => t >= 0) || lower.some((t) => t >= 0), `${o.id}: empty object`);
      return { ...o, lower, upper };
    });
  }

  return { TIBO, kits, places, objects, room, check, cutObjects, FACE, PLAIN, kitName: (id) => kits.get(id)?.name };
}
