// 키트 놓기 규칙(2026-10-11) — 「물레방아는 물가에 걸쳐서만」처럼 그림이 뜻을 갖는 자리. stamp_object 가 찍기 전에 검사해
// 어기면 거절한다. 조수(AI)·마을 시공기·사람 모두 이 도구를 지나므로 프롬프트가 아니라 실행기가 지킨다.
//
// 왜: 사용자 지적 — 물레방아·배·잔교·다리는 「물 위에만 건설 가능」 같은 규칙이 있어야 하고 AI 가 반드시 따라야 한다.
// 판정은 찍을 맵의 1층 칸 그림 뜻(tileMeta.tags 의 water / 이름의 「얼음」)으로 한다. 2층 덧그림(물가 둑)은 보지 않는다.
import { stairApproachProblem } from "./stairs/placement";
import type { GameMap, StructureKitDef, TilesetDef } from "./types";
import { reliefLevel, rampAt } from "./relief/walk";
import { passageMarkForTile } from "./tilesetPassage";
import { checkGroundSupportForStamp } from "./groundSupport";

export type PlacementSurface = "water" | "ice" | "land";
interface CellRule {
  /** 키트 안 칸 좌표들. "bottom" = 맨 아래 줄, "all" = 그림이 있는 모든 칸, "deck" = 맨 위·아래 줄을 뺀 가운데 줄들의 가운데 열들. */
  cells: "bottom" | "all" | "deck" | readonly (readonly [number, number])[];
  on: PlacementSurface;
  /** 이 칸들 가운데 최소 몇 개(비율이면 0~1)가 그 바닥이어야 하나. 생략 = 전부. */
  atLeast?: number;
}
export interface KitPlacementRule { rules: readonly CellRule[]; why: string }

const WATER_ALL: KitPlacementRule = { rules: [{ cells: "all", on: "water" }], why: "배·물새·수련은 물 위에만 놓는다(둘레가 뭍이면 안 된다)." };
const BRIDGE: KitPlacementRule = {
  rules: [{ cells: "deck", on: "water", atLeast: 0.5 }],
  why: "다리는 물을 건너야 한다 — 다리 바닥(가운데 줄)의 절반 이상이 물 위여야 한다. 물이 없는 곳에 다리를 놓지 않는다.",
};

/** 키트 id → 규칙. 같은 그림의 다른 이름도 같이 적는다. */
export const KIT_PLACEMENT_RULES: Readonly<Record<string, KitPlacementRule>> = {
  "bd-pick-riverside-mill-waterwheel": {
    rules: [{ cells: [[0, 3], [1, 3], [2, 3]], on: "water", atLeast: 1 }, { cells: [[0, 3], [1, 3], [2, 3]], on: "land", atLeast: 1 }],
    why: "물레방아는 물가에 걸친다 — 바퀴 밑 줄에 물 칸과 뭍 칸이 둘 다 있어야 한다(물 한가운데·뭍 한가운데 금지).",
  },
  "bd-pick-swamp-stilt-rowboat": WATER_ALL, "bd-pick-swamp-stilt-fishing-boat": WATER_ALL, "bd-pick-sea-cave-boat": WATER_ALL,
  "bd-pick-swamp-stilt-ducks": WATER_ALL, "bd-pick-desert-oasis-lily": WATER_ALL,
  "bd-pick-coast-cliff-road-rowboat": { rules: [{ cells: "all", on: "water" }], why: "나룻배는 물 위에만 놓는다." },
  "bd-pick-fishing-port-upturned-boat": { rules: [{ cells: "all", on: "land" }], why: "엎어 둔 배는 뭍(물가)에 둔다." },
  "bd-pick-snowfield-ice-boat": { rules: [{ cells: "all", on: "ice" }], why: "얼음 위 배는 얼음 위에만." },
  "bd-pick-snowfield-ice-hole": { rules: [{ cells: "all", on: "ice" }], why: "얼음 구멍은 얼음 위에만." },
  "bd-pick-snowfield-ice-row": { rules: [{ cells: "all", on: "ice" }], why: "얼음 낚시 줄은 얼음 위에만." },
  "bd-pick-fishing-port-jetty-stem": { rules: [{ cells: "all", on: "water", atLeast: 0.6 }], why: "잔교 몸통은 물로 뻗는다 — 60% 이상이 물 위여야 한다." },
  "bd-pick-fishing-port-jetty-head": { rules: [{ cells: "all", on: "water", atLeast: 0.8 }], why: "잔교 머리는 물 위에 놓는다." },
  "bd-pick-fishing-port-jetty-west": { rules: [{ cells: "all", on: "water", atLeast: 0.6 }], why: "작은 부두는 물로 뻗는다." },
  "bd-pick-fishing-port-jetty-post": { rules: [{ cells: "bottom", on: "water" }], why: "잔교 말뚝은 물에 박는다." },
  "bd-pick-fishing-port-fish-market": { rules: [{ cells: "bottom", on: "water", atLeast: 1 }], why: "생선 시장은 물가에 걸친다 — 맨 아래 줄에 물 칸이 하나 이상." },
  "bd-bridge-arch": BRIDGE, "bd-pick-riverside-mill-plank-footbridge": BRIDGE, "bd-pick-mountain-pass-stone-bridge": BRIDGE,
  "bd-river-bridge": BRIDGE,
};

/** 입구가 있는 건물은 물 위에 짓지 않는다(규칙 표에 따로 적힌 키트는 그 규칙만). 기둥 위 오두막처럼 물에 서는 집은 예외. */
const WATER_BUILDINGS = /pierhut|stilt-(?:e|n|s|w)\d|fish-market|waterwheel|lighthouse/;

function surfaceOf(map: GameMap, ts: TilesetDef, x: number, y: number): PlacementSurface | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  const t = map.lowerTiles[y * map.width + x] ?? -1;
  if (t < 0) return "land";
  const meta = ts.tileMeta?.[t];
  const tags = meta?.tags ?? [];
  if (tags.includes("water")) return "water";
  if (/얼음|ice/i.test(meta?.label ?? "")) return "ice";
  return "land";
}

function ruleCells(kit: StructureKitDef, cells: CellRule["cells"]): [number, number][] {
  const drawn = (dx: number, dy: number) => { const r = kit.rows[dy]; return !!r && ((r.tiles[dx] ?? -1) >= 0 || (r.upperTiles?.[dx] ?? -1) >= 0); };
  if (cells === "bottom") return Array.from({ length: kit.width }, (_, dx) => [dx, kit.height - 1] as [number, number]).filter(([dx, dy]) => drawn(dx, dy));
  if (cells === "all") { const out: [number, number][] = []; for (let dy = 0; dy < kit.height; dy += 1) for (let dx = 0; dx < kit.width; dx += 1) if (drawn(dx, dy)) out.push([dx, dy]); return out; }
  if (cells === "deck") {
    const out: [number, number][] = [];
    const y0 = kit.height > 2 ? 1 : 0, y1 = kit.height > 2 ? kit.height - 2 : kit.height - 1;
    const x0 = kit.width > 2 ? 1 : 0, x1 = kit.width > 2 ? kit.width - 2 : kit.width - 1;
    for (let dy = y0; dy <= y1; dy += 1) for (let dx = x0; dx <= x1; dx += 1) out.push([dx, dy]);
    return out;
  }
  return cells.map(([dx, dy]) => [dx, dy] as [number, number]);
}

const SURFACE_KO: Record<PlacementSurface, string> = { water: "물", ice: "얼음", land: "뭍" };

/** 규칙을 어기면 사람이 읽을 이유를 돌려준다(통과면 null). kit 은 찍을 키트 정의, (x, y) 는 왼쪽 위 칸. */
export function checkKitPlacement(map: GameMap, ts: TilesetDef, kitId: string, kit: StructureKitDef, x: number, y: number): string | null {
  // 받침 규칙(2026-10-14, groundSupport.ts): 던전 키트는 허공(천장) 위·벽 위에 놓지 않고, 벽 앞면은 바닥을 마주 본다.
  const unsupported = checkGroundSupportForStamp(map, ts, kit, x, y);
  if (unsupported) return unsupported;
  // 계단 입구 계약(project/stairs): 들어서는 앞 칸이 바닥으로 열려 있어야 한다.
  const stair = stairApproachProblem(map, ts, { id: kitId, name: kit.name }, x, y);
  if (stair) return stair;
  const rule = KIT_PLACEMENT_RULES[kitId];
  if (rule) {
    for (const r of rule.rules) {
      const cells = ruleCells(kit, r.cells);
      if (!cells.length) continue;
      const hits = cells.filter(([dx, dy]) => surfaceOf(map, ts, x + dx, y + dy) === r.on).length;
      const need = r.atLeast === undefined ? cells.length : r.atLeast < 1 ? Math.ceil(r.atLeast * cells.length) : r.atLeast;
      if (hits < need) return `「${kit.name ?? kitId}」 놓기 규칙: ${rule.why} (${SURFACE_KO[r.on]} 칸 ${hits}/${cells.length}, 필요 ${need})`;
    }
    return null;
  }
  const isBuilding = (kit.parts ?? []).some((p) => p.kind === "entrance");
  if (isBuilding && !WATER_BUILDINGS.test(kitId)) {
    const wet = ruleCells(kit, "all").filter(([dx, dy]) => surfaceOf(map, ts, x + dx, y + dy) === "water");
    if (wet.length) return `「${kit.name ?? kitId}」 놓기 규칙: 건물은 물 위에 짓지 않는다 — 물 칸 ${wet.length}개(${wet.slice(0, 4).map(([dx, dy]) => `(${x + dx},${y + dy})`).join(" ")}). 뭍으로 옮기거나 물을 메운 뒤 놓는다.`;
  }
  return null;
}

// ---------- 높이 단(map.relief) 규칙 (2026-10-11) ----------
// 마을 도구(author_beodeul_town)는 키트를 한 단 위에만 앉히지만, 이후 조수가 품질 수리로 stamp_object 를 부르면 높이를 몰라
// 대추 돗자리 3×2 가 0단과 1단에 걸쳐 절벽 띠에 잘렸다(2026-10-11 실제 입력창 검수, 사막 오아시스 (54,9)).
// 렌더러는 칸마다 그 칸 단만큼 그림을 들어 올리므로(relief/screen.ts) 두 단에 걸친 그림은 갈라지고, 남쪽 칸이 높으면
// 3/4 시점에서 그 칸의 윗면이 그림 아랫줄을 덮는다. 그래서 찍기 전에 발자국(그림 있는 칸)을 본다:
//   1) 발자국 전부 한 단(L)          2) 경사로·계단 칸(ramps 1~8) 위에 놓지 않는다(경사로는 길이다)
//   3) 가림: 그림 맨 아랫칸에서 남쪽으로 k줄 떨어진 칸은 단 L + k − 1 이하(beodeulVillage.ts flatOn 과 같은 규칙)
// 예외 — 높이와 무관한 그림:
//   · 바닥 칠(1층만, 전부 통행 o): 땅은 원래 단을 따라 깔린다(fill_region 도 높이를 보지 않는다)
//   · 그림자(id/이름 shadow·그림자): 2층 투명 바닥 장식
//   · 다리(BRIDGE 규칙·id bridge·이름 「다리」): 골짜기·물을 건너는 것이 뜻이다
//   · 한 줄 바닥 장식(높이 1, 너비 ≤ 2, 전부 통행 o — 풀꽃·뼈·헤더): 두 단·가림은 보지 않고 경사로만 막는다

/** 찍을 그림(행 우선, -1 = 비움). stamp_object 가 층 선택(layers)까지 반영한 뒤 넘긴다. */
export interface ReliefStampPattern {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}

type ReliefExemption = "ground" | "shadow" | "bridge" | "decal" | null;

/** 높이 규칙 예외 종류. source 는 그림 번호가 속한 타일셋(통행 표시를 읽는다). */
export function reliefExemption(source: TilesetDef, objectId: string, name: string, pattern: ReliefStampPattern): ReliefExemption {
  const kitId = objectId.slice(objectId.lastIndexOf("/") + 1);
  if (KIT_PLACEMENT_RULES[kitId] === BRIDGE || /bridge/i.test(objectId) || /(?<!사)다리/.test(name)) return "bridge";
  if (/shadow/i.test(objectId) || /그림자/.test(name)) return "shadow";
  const drawn: number[] = [];
  let upperUsed = false;
  for (let i = 0; i < pattern.width * pattern.height; i += 1) {
    const lo = pattern.lower[i] ?? -1, up = pattern.upper[i] ?? -1;
    if (lo >= 0) drawn.push(lo);
    if (up >= 0) { drawn.push(up); upperUsed = true; }
  }
  if (!drawn.length) return null;
  const allOpen = drawn.every((t) => t < source.passability.length && passageMarkForTile(source, t) === "o");
  if (!allOpen) return null;
  if (!upperUsed) return "ground";
  if (pattern.height === 1 && pattern.width <= 2) return "decal";
  return null;
}

function cellsText(cells: readonly (readonly [number, number])[]): string {
  if (!cells.length) return "";
  const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return x0 === x1 && y0 === y1 ? `(${x0},${y0})` : `(${x0},${y0})~(${x1},${y1})`;
}

/** 높이 규칙만 본 판정(통과면 null, 아니면 어긴 종류와 근거). exempt 가 decal 이면 경사로만 본다. */
function reliefBreak(map: GameMap, pattern: ReliefStampPattern, x: number, y: number, exempt: ReliefExemption):
  { kind: "straddle"; byLevel: Map<number, [number, number][]> } | { kind: "ramp"; cells: [number, number][] }
  | { kind: "occluded"; level: number; cells: { x: number; y: number; level: number; k: number }[] } | null {
  const r = map.relief!;
  const foot: [number, number][] = [];
  const bottom = new Map<number, number>(); // 열(맵 x) → 그림 맨 아랫칸 y
  for (let dy = 0; dy < pattern.height; dy += 1) for (let dx = 0; dx < pattern.width; dx += 1) {
    const i = dy * pattern.width + dx;
    if ((pattern.lower[i] ?? -1) < 0 && (pattern.upper[i] ?? -1) < 0) continue;
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= map.width || Y >= map.height) continue;
    foot.push([X, Y]);
    bottom.set(X, Math.max(bottom.get(X) ?? -1, Y));
  }
  if (!foot.length) return null;
  const ramps = foot.filter(([X, Y]) => rampAt(r, X, Y));
  if (ramps.length) return { kind: "ramp", cells: ramps };
  if (exempt === "decal") return null;
  const byLevel = new Map<number, [number, number][]>();
  for (const c of foot) { const L = reliefLevel(r, c[0], c[1]); const list = byLevel.get(L); if (list) list.push(c); else byLevel.set(L, [c]); }
  if (byLevel.size > 1) return { kind: "straddle", byLevel };
  const L = [...byLevel.keys()][0]!;
  const covered: { x: number; y: number; level: number; k: number }[] = [];
  for (const [X, B] of bottom) for (let k = 1; B + k < map.height; k += 1) {
    const lv = reliefLevel(r, X, B + k);
    if (lv > L + k - 1) covered.push({ x: X, y: B + k, level: lv, k });
    if (L + k - 1 >= 14) break; // RELIEF_MAX_LEVEL — 더 내려가도 덮을 수 없다
  }
  return covered.length ? { kind: "occluded", level: L, cells: covered } : null;
}

/** (x, y) 둘레에서 높이 규칙을 지키는 왼위 자리를 단마다 하나씩(가까운 순). 맵 안에 다 들어가는 자리만. */
function reliefAlternatives(map: GameMap, pattern: ReliefStampPattern, x: number, y: number, exempt: ReliefExemption, wantLevels: readonly number[]): Map<number, [number, number]> {
  const found = new Map<number, [number, number]>();
  const r = map.relief!;
  const fits = (px: number, py: number) => px >= 0 && py >= 0 && px + pattern.width <= map.width && py + pattern.height <= map.height;
  for (let radius = 1; radius <= 8 && found.size < wantLevels.length; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const px = x + dx, py = y + dy;
      if (!fits(px, py) || reliefBreak(map, pattern, px, py, exempt)) continue;
      // 자리의 단 = 그림 첫 칸의 단
      let level = -1;
      for (let i = 0; i < pattern.width * pattern.height && level < 0; i += 1) {
        if ((pattern.lower[i] ?? -1) >= 0 || (pattern.upper[i] ?? -1) >= 0) level = reliefLevel(r, px + (i % pattern.width), py + Math.floor(i / pattern.width));
      }
      if (wantLevels.includes(level) && !found.has(level)) found.set(level, [px, py]);
    }
  }
  return found;
}

/**
 * 높이 단 규칙(맵에 relief 가 있을 때만). 어기면 사람이 읽을 이유와 대안 자리를, 지키면 null.
 * relief 가 없는 맵은 아무것도 보지 않는다(기존 동작 그대로).
 */
export function checkReliefPlacement(map: GameMap, source: TilesetDef, objectId: string, name: string, pattern: ReliefStampPattern, x: number, y: number): string | null {
  if (!map.relief) return null;
  const exempt = reliefExemption(source, objectId, name, pattern);
  if (exempt === "ground" || exempt === "shadow" || exempt === "bridge") return null;
  const broken = reliefBreak(map, pattern, x, y, exempt);
  if (!broken) return null;
  const head = `「${name}」 높이 규칙:`;
  const tail = (levels: readonly number[], labels: Record<number, string>) => {
    const alt = reliefAlternatives(map, pattern, x, y, exempt, levels);
    const list = levels.filter((L) => alt.has(L)).map((L) => `${labels[L] ?? `단 ${L}`} 에 왼위 (${alt.get(L)![0]},${alt.get(L)![1]})`);
    return list.length ? ` 대안: ${list.join(" · ")} — 높이만 본 후보다(물·길·다른 물체·놓기 규칙은 따로 확인).` : " 대안: 둘레 8칸 안에 한 단에 다 들어가는 자리가 없다 — 더 작은 키트를 쓰거나 다른 평평한 곳을 고른다.";
  };
  if (broken.kind === "straddle") {
    const levels = [...broken.byLevel.keys()].sort((a, b) => b - a);
    const labels: Record<number, string> = {};
    levels.forEach((L, i) => { labels[L] = `${i === 0 ? "높은" : i === levels.length - 1 ? "낮은" : "가운데"} 단 ${L}`; });
    const parts = levels.map((L) => `${labels[L]} ${broken.byLevel.get(L)!.length}칸 ${cellsText(broken.byLevel.get(L)!)}`);
    return `${head} 키트는 한 단 위에만 놓는다 — 그림이 두 단에 걸친다: ${parts.join(" / ")}. 걸치면 절벽 띠가 그림을 가른다.${tail(levels, labels)}`;
  }
  if (broken.kind === "ramp") {
    const r = map.relief;
    const levels = [...new Set(broken.cells.map(([X, Y]) => reliefLevel(r, X, Y)))];
    return `${head} 경사로·계단 칸 ${broken.cells.length}개 ${cellsText(broken.cells)} 에는 물체·집을 놓지 않는다(경사로는 단 사이 길이다 — 막으면 위·아래 단이 끊긴다).${tail(levels, {})}`;
  }
  const first = broken.cells[0]!;
  return `${head} 바로 남쪽이 더 높아 3/4 시점에서 그림 아랫줄이 덮인다 — (${first.x},${first.y}) 단 ${first.level} (키트 단 ${broken.level}, 남쪽 ${first.k}줄 칸은 단 ${broken.level + first.k - 1} 이하여야 한다)${broken.cells.length > 1 ? ` 외 ${broken.cells.length - 1}칸` : ""}.${tail([broken.level], {})}`;
}
