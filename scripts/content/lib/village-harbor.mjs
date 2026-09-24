// Harbor pieces for forest-village maps (review 2026-09-24: 「판자만 놓고 끝나니까 별로다. 배는?」). A pier must end in
// something: rowboats moored beside its sea end, mooring posts along its edges, and the harbor's gear (coiled rope,
// anchor, barrels, crates) gathered on land at its root. Reusable by any forest_harmony map with a pier:
//   ensureHarborGrafts(tileset)  — grafts the harbor kit (public/assets/harbor-kit, scripts/content/build-harbor-kit.py)
//                                  into free forest_harmony slots; idempotent; returns { part: [tile ids] }.
//   placeHarbor({ map, dock, ... }) — places the pieces round a pier rectangle and returns the placements.
import fs from "node:fs";

export const HARBOR_TEXTURE = "tex_harbor_kit";
// Unused slots of the forest-village tileset (「미사용」 or blank, no graft).
export const HARBOR_SLOTS = [...range(2657, 2669), ...range(2695, 2699), ...range(2703, 2729)];
function range(a, b) { return Array.from({ length: b - a + 1 }, (_, k) => a + k); }
const SOLID = { up: false, down: false, left: false, right: false };

export function loadHarborKit(root = ".") {
  return JSON.parse(fs.readFileSync(`${root}/public/assets/harbor-kit/parts.json`, "utf8"));
}

export function ensureHarborGrafts(tileset, kit) {
  assert(kit.count <= HARBOR_SLOTS.length, "harbor kit larger than the free slots");
  const ids = {}, grafts = tileset.tileGrafts ??= [];
  for (const [name, part] of Object.entries(kit.parts)) {
    ids[name] = part.tiles.map((k) => HARBOR_SLOTS[k]);
    part.tiles.forEach((k, n) => {
      const target = HARBOR_SLOTS[k];
      const own = grafts.find((g) => g.targetTile === target);
      assert(!own || (own.sourceChipset === HARBOR_TEXTURE && own.sourceTile === k), "harbor slot taken: " + target);
      if (!own) grafts.push({ sourceChipset: HARBOR_TEXTURE, sourceTile: k, targetTile: target });
      tileset.passability[target] = { ...SOLID };
      tileset.priority[target] = "upper";
      tileset.terrain[target] = 0;
      tileset.tileMeta[target] = { role: "prop", label: part.w * part.h > 1 ? `${part.label} ${n % part.w + 1},${Math.floor(n / part.w) + 1}` : part.label,
        source: "user", userLocked: true, defaultLayer: "upper", passage: "solid", layerBacking: "none",
        description: `항구 조각(${part.license}, ${part.source}). 물 위(배·말뚝) 또는 부두 뿌리 땅 위(밧줄·닻·통·상자)에 둔다.` };
    });
  }
  const group = { id: "harbor-kit", name: "항구 조각 · 나룻배·계류 말뚝·부두 짐", role: "prop", source: "user", confidence: "high", defaultLayer: "upper",
    tileIds: Object.values(ids).flat(),
    description: `나룻배 ${kit.parts.rowboat.w}×${kit.parts.rowboat.h}(뱃머리 왼쪽, 윗레이어, 물 위) ${ids.rowboat.join(",")}; 계류 말뚝 ${ids.post}; 감긴 밧줄 ${ids.rope}; 닻 ${ids.anchor}; 오크통 ${ids.barrel}; 나무 상자 ${ids.crate}; 열린 통 ${ids.openBarrel}. 모두 통행 불가.`,
    placementRules: "부두(판자)는 끝이 있어야 한다: 바다 쪽 끝 옆 물에 나룻배를 한 칸 띄워 대고, 부두 가장자리 물 칸에 계류 말뚝을 3~4칸 간격으로, 부두 뿌리 땅에 밧줄·닻·통·상자를 한 덩이(붙여서)로 모은다. 들판 한가운데나 부두와 먼 곳에 두지 않는다." };
  const at = tileset.tileGroups.findIndex((g) => g.id === group.id);
  if (at >= 0) tileset.tileGroups[at] = group; else tileset.tileGroups.push(group);
  return ids;
}
function assert(ok, message) { if (!ok) throw new Error(message); }

/**
 * Pieces round a pier `dock = [x, y, w, h]` (boards on the upper layer over water). `isWater(x, y)` = open water with
 * nothing on it; `isLand(x, y)` = free plain ground a prop may take; `accept(cells)` = the caller's reachability check
 * (rolled back when false). Returns placements { name, x, y, w, h, kind: "harbor-prop", owner: "dock", upper }.
 */
export function placeHarbor({ map, dock, ids, kit, isWater, isLand, accept, boats = 2 }) {
  const W = map.width, at = (x, y) => y * W + x, [dx0, dy0, dw, dh] = dock, placed = [];
  const horizontal = dw >= dh;
  // Which end meets the sea: the end whose next cell along the pier is water.
  const endA = horizontal ? isWater(dx0 - 1, dy0) : isWater(dx0, dy0 - 1), endB = horizontal ? isWater(dx0 + dw, dy0) : isWater(dx0, dy0 + dh);
  const seaAtFar = endB || !endA;
  const put = (name, x, y, w, h, tiles) => {
    const cells = [];
    for (let k = 0; k < w * h; k++) cells.push({ x: x + k % w, y: y + Math.floor(k / w), t: tiles[k] });
    const saved = cells.map((c) => map.upperTiles[at(c.x, c.y)]);
    for (const c of cells) if (c.t >= 0) map.upperTiles[at(c.x, c.y)] = c.t;
    if (!accept(cells)) { cells.forEach((c, k) => { map.upperTiles[at(c.x, c.y)] = saved[k]; }); return false; }
    placed.push({ name, x, y, w, h, kind: "harbor-prop", owner: "dock", upper: tiles });
    return true;
  };
  const boat = kit.parts.rowboat, boatTiles = ids.rowboat.map((t, k) => (boatCellEmpty(kit, k) ? -1 : t));
  const clearWater = (x, y, w, h, pad) => { for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (!isWater(xx, yy)) return false; return true; };
  // Rowboats: beside the sea end of the pier, one row of water between boat and boards.
  if (horizontal) {
    const endX = seaAtFar ? dx0 + dw - 1 : dx0;
    const sides = [dy0 - 1 - boat.h, dy0 + dh + 1];
    for (const by of sides) {
      if (placed.filter((p) => p.name === "나룻배").length >= boats) break;
      for (let shift = 0; shift < 6; shift++) {
        const bx = seaAtFar ? endX - boat.w + 1 - shift : endX + shift;
        if (clearWater(bx, by, boat.w, boat.h, 0) && put("나룻배", bx, by, boat.w, boat.h, boatTiles)) break;
      }
    }
  } else {
    const endY = seaAtFar ? dy0 + dh - 1 : dy0;
    for (const bx of [dx0 - 1 - boat.w, dx0 + dw + 1]) {
      if (placed.filter((p) => p.name === "나룻배").length >= boats) break;
      for (let shift = 0; shift < 6; shift++) {
        const by = seaAtFar ? endY - boat.h + 1 - shift : endY + shift;
        if (clearWater(bx, by, boat.w, boat.h, 0) && put("나룻배", bx, by, boat.w, boat.h, boatTiles)) break;
      }
    }
  }
  // Mooring posts: water cells along both long edges, every four cells from the sea end, clear of the boats.
  const taken = new Set(placed.flatMap((p) => Array.from({ length: p.w * p.h }, (_, k) => at(p.x + k % p.w, p.y + Math.floor(k / p.w)))));
  const near = (x, y) => taken.has(at(x, y)) || [[1, 0], [-1, 0]].some(([a, b]) => taken.has(at(x + a, y + b)) && !placed.some((p) => p.name === "나룻배"));
  const len = horizontal ? dw : dh;
  for (let s = 0; s < len; s += 4) {
    const along = seaAtFar ? len - 1 - s : s;
    for (const side of [-1, 1]) {
      const x = horizontal ? dx0 + along : side < 0 ? dx0 - 1 : dx0 + dw, y = horizontal ? (side < 0 ? dy0 - 1 : dy0 + dh) : dy0 + along;
      if (isWater(x, y) && !near(x, y) && put("계류 말뚝", x, y, 1, 1, ids.post)) taken.add(at(x, y));
    }
  }
  // Gear at the root: one tight clump of land cells next to the landward end.
  const rootX = horizontal ? (seaAtFar ? dx0 : dx0 + dw - 1) : dx0, rootY = horizontal ? dy0 : (seaAtFar ? dy0 : dy0 + dh - 1);
  const gear = [["감긴 밧줄", ids.rope], ["닻", ids.anchor], ["오크통", ids.barrel], ["나무 상자", ids.crate], ["열린 통", ids.openBarrel], ["나무 상자", ids.crate]];
  const land = [];
  for (let r = 1; r <= 4; r++) for (let y = rootY - r; y <= rootY + r + (horizontal ? dh - 1 : 0); y++) for (let x = rootX - r; x <= rootX + r; x++)
    if (isLand(x, y) && !land.some(([a, b]) => a === x && b === y)) land.push([x, y]);
  // Nearest free land cell first, then grow the clump over free land touching it (a tight pile, never a line).
  land.sort((a, b) => Math.hypot(a[0] - rootX, a[1] - rootY) - Math.hypot(b[0] - rootX, b[1] - rootY));
  const clump = [], failed = new Set();
  while (clump.length < gear.length) {
    const next = land.find(([x, y]) => !failed.has(at(x, y)) && !clump.some(([a, b]) => a === x && b === y)
      && (!clump.length || clump.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1)));
    if (!next) break;
    const [name, tiles] = gear[clump.length];
    if (put(name, next[0], next[1], 1, 1, tiles)) clump.push(next); else failed.add(at(next[0], next[1]));
  }
  return placed;
}
// The rowboat's first cell of the last row is outside the hull (fully transparent in the kit).
function boatCellEmpty(kit, k) { return (kit.parts.rowboat.empty ?? []).includes(k); }
