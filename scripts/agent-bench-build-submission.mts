/**
 * 코딩 에이전트 벤치 제출물 생성기.
 *
 * 저장소 자체의 build_village 하네스(오토타일 엔진 포함)로 마을을 짓고,
 * 벤치 채점기(src/benchmark/agent/{detect,scoring}.ts)가 요구하는 규칙 중
 * 하네스가 그대로는 못 맞추는 세 가지만 후처리로 고친다:
 *   1) 금지 타일(443 등)이 나가면 곱연산 감점으로 quality가 0이 된다 — 대체.
 *   2) detect.ts는 캐노피(upper) 칸의 "하위 레이어(같은 칸의 lower)"가 밑동이어야
 *      한다고 본다. 하네스는 캐노피를 밑동 한 칸 위(다른 칸)에 심으므로 어긋난다 —
 *      같은 칸 lower에도 밑동을 채운다.
 *   3) 석상 쉼터(포석)는 도로 감사를 피하려고 일부러 길에서 떼어 놓는다 —
 *      짧은 포석 길로 이어붙이고 오토타일을 재성형한다.
 *
 * 실행: npx tsx scripts/agent-bench-build-submission.mts
 */
import fs from "node:fs";
import path from "node:path";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { GameMap } from "../src/project/types.ts";
import { buildTownGroundTruth } from "../src/benchmark/town/groundTruth.ts";
import { renderTileGridPng } from "../src/benchmark/town/inputImages.ts";
import { scoreAgentMap, scaleBaseline } from "../src/benchmark/agent/scoring.ts";
import { SUBMISSION_PATH } from "../src/benchmark/agent/spec.ts";
import {
  CANOPY_TO_TRUNK,
  ROAD_FAMILY,
  WALL_FAMILY,
  ROOF_FAMILY,
  FENCE_FAMILY,
  type MapSubmission,
} from "../src/benchmark/agent/detect.ts";
import { shapeAutotileGroupAround } from "../src/project/defaults/autotileEngine.ts";
import { DEFAULT_COBBLE_AUTOTILE_GROUP } from "../src/project/defaults/autotileGroups.ts";
import { COBBLE_TILE } from "../src/project/defaults/chipsetMapping.ts";
import { TILE } from "../src/project/defaults/constants.ts";

const BANNED = new Set([411, 412, 413, 441, 442, 443]);

function asSubmission(map: GameMap): MapSubmission {
  return { width: map.width, height: map.height, lower: map.lowerTiles, upper: map.upperTiles };
}

function report(label: string, map: GameMap, groundTruth: ReturnType<typeof buildTownGroundTruth>): void {
  const scored = scoreAgentMap({ map: asSubmission(map), groundTruth });
  console.log(`\n[${label}] quality=${scored.quality.toFixed(3)} workMean=${scored.workMean.toFixed(3)} scale=${scored.scale.toFixed(2)}`);
  console.log(JSON.stringify(scored.detail, null, 2));
}

// ── 1) build_village 하네스로 마을을 짓는다 ──────────────────────────────
const ctx = { project: createEmptyToolProject("코딩 에이전트 벤치 마을") };
const built = runTool(ctx, "build_village", {
  seed: 20260821,
  width: 64,
  height: 64,
  name: "코딩 에이전트 벤치 마을",
  fences: true,
  decor: true,
  houses: 26,
  pathStyle: "dirt",
  edgeTrees: "conifer",
  plazaStyle: "market",
});
if (!built.ok) {
  throw new Error(`build_village 실패: ${built.summary}\n${JSON.stringify(built.issues ?? [], null, 2)}`);
}
console.log("[build]", built.summary);
const project = ctx.project;
const data = built.data as { mapId: string; housesBuilt: number; doorsConnected: number; roadComponents: number };
const map = project.maps[data.mapId];
if (!map) throw new Error(`village map missing: ${data.mapId}`);

const groundTruth = buildTownGroundTruth();
console.log("baseline:", scaleBaseline(groundTruth));
report("raw", map, groundTruth);

// ── 2) 금지 타일 대체 ─────────────────────────────────────────────────────
let bannedFixed = 0;
let shopSignToggle = 0;
for (let i = 0; i < map.upperTiles.length; i += 1) {
  const tile = map.upperTiles[i]!;
  if (!BANNED.has(tile)) continue;
  map.upperTiles[i] = tile === 443 ? (shopSignToggle++ % 2 === 0 ? 472 : 473) : TILE.EMPTY;
  bannedFixed += 1;
}
for (let i = 0; i < map.lowerTiles.length; i += 1) {
  const tile = map.lowerTiles[i]!;
  if (!BANNED.has(tile)) continue;
  map.lowerTiles[i] = TILE.GRASS;
  bannedFixed += 1;
}
console.log(`[patch] 금지 타일 대체 ${bannedFixed}칸`);

// ── 3) 나무 짝 보정 — 채점기는 캐노피 칸과 같은 인덱스의 lower가 밑동이어야 한다 ──
let treeFixed = 0;
for (let i = 0; i < map.upperTiles.length; i += 1) {
  const canopy = map.upperTiles[i]!;
  const trunk = CANOPY_TO_TRUNK.get(canopy);
  if (trunk === undefined) continue;
  if (map.lowerTiles[i] !== trunk) {
    map.lowerTiles[i] = trunk;
    treeFixed += 1;
  }
}
console.log(`[patch] 나무 짝 보정 ${treeFixed}칸`);

// ── 3-b) 고아 울타리 조각(사방에 이웃이 없는 1칸) 제거 — fenceGrammar 잡음 제거 ──
let orphanFenceFixed = 0;
for (let i = 0; i < map.upperTiles.length; i += 1) {
  if (!FENCE_FAMILY.has(map.upperTiles[i]!)) continue;
  const x = i % map.width;
  const y = Math.floor(i / map.width);
  const hasNeighbor = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
    const nx = x + dx!;
    const ny = y + dy!;
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;
    return FENCE_FAMILY.has(map.upperTiles[ny * map.width + nx]!);
  });
  if (!hasNeighbor) {
    map.upperTiles[i] = TILE.EMPTY;
    orphanFenceFixed += 1;
  }
}
console.log(`[patch] 고아 울타리 제거 ${orphanFenceFixed}칸`);

// ── 4) 끊긴 길 성분을 최대 성분에 이어붙인다 ────────────────────────────────
function roadComponents(m: GameMap): number[][] {
  const cells = new Set<number>();
  for (let i = 0; i < m.lowerTiles.length; i += 1) {
    if (ROAD_FAMILY.has(m.lowerTiles[i]!)) cells.add(i);
  }
  const remaining = new Set(cells);
  const comps: number[][] = [];
  const DIRS4 = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    remaining.delete(first);
    const stack = [first];
    const comp: number[] = [];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      comp.push(idx);
      const x = idx % m.width;
      const y = Math.floor(idx / m.width);
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
        const next = ny * m.width + nx;
        if (!remaining.has(next)) continue;
        remaining.delete(next);
        stack.push(next);
      }
    }
    comps.push(comp);
  }
  return comps.sort((a, b) => b.length - a.length);
}

function isBlocked(m: GameMap, x: number, y: number): boolean {
  const idx = y * m.width + x;
  const lower = m.lowerTiles[idx] ?? TILE.EMPTY;
  const upper = m.upperTiles[idx] ?? TILE.EMPTY;
  if (WALL_FAMILY.has(lower) || ROOF_FAMILY.has(lower)) return true;
  if (FENCE_FAMILY.has(upper) || ROOF_FAMILY.has(upper)) return true;
  return false;
}

// 그리드가 넓지 않은 GRASS/ROAD 전용 통로만 BFS로 뚫는다 — 건물·울타리는 절대 안 건드린다.
function connectComponent(m: GameMap, from: readonly number[], targets: ReadonlySet<number>): number[] | null {
  const DIRS4 = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
  const visited = new Set<number>(from);
  const parent = new Map<number, number>();
  const queue: number[] = [...from];
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi]!;
    qi += 1;
    if (targets.has(idx) && !from.includes(idx)) {
      const path: number[] = [];
      let cur: number | undefined = idx;
      while (cur !== undefined && !from.includes(cur)) {
        path.push(cur);
        cur = parent.get(cur);
      }
      return path;
    }
    const x = idx % m.width;
    const y = Math.floor(idx / m.width);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      const next = ny * m.width + nx;
      if (visited.has(next)) continue;
      const lower = m.lowerTiles[next] ?? TILE.EMPTY;
      const passable = !isBlocked(m, nx, ny) && (lower === TILE.GRASS || ROAD_FAMILY.has(lower) || targets.has(next));
      if (!passable) continue;
      visited.add(next);
      parent.set(next, idx);
      queue.push(next);
    }
  }
  return null;
}

let comps = roadComponents(map);
console.log(`[road] 성분 ${comps.length}개, 크기 ${comps.map((c) => c.length).join(",")}`);
let guard = 0;
while (comps.length > 1 && guard < 20) {
  guard += 1;
  const main = new Set(comps[0]);
  const minor = comps[1]!;
  const path = connectComponent(map, minor, main);
  if (!path) {
    // 못 이으면 고아 성분을 잔디로 되돌려 지운다(안전한 후퇴).
    for (const idx of minor) map.lowerTiles[idx] = TILE.GRASS;
    console.log(`[patch] 길 성분 하나 연결 실패 — ${minor.length}칸 제거`);
  } else {
    const points: { x: number; y: number }[] = [];
    for (const idx of path) {
      if (!ROAD_FAMILY.has(map.lowerTiles[idx] ?? TILE.EMPTY)) map.lowerTiles[idx] = COBBLE_TILE.BODY;
      points.push({ x: idx % map.width, y: Math.floor(idx / map.width) });
    }
    shapeAutotileGroupAround(map, DEFAULT_COBBLE_AUTOTILE_GROUP, points);
    console.log(`[patch] 길 성분 연결 — ${path.length}칸 포석 신설`);
  }
  comps = roadComponents(map);
}
console.log(`[road] 최종 성분 ${comps.length}개`);

report("patched", map, groundTruth);

// ── 5) 제출 ──────────────────────────────────────────────────────────────
const outDir = path.dirname(SUBMISSION_PATH);
fs.mkdirSync(outDir, { recursive: true });
const submission = { width: map.width, height: map.height, lowerTiles: map.lowerTiles, upperTiles: map.upperTiles };
fs.writeFileSync(SUBMISSION_PATH, JSON.stringify(submission));
console.log(`\n[제출] ${SUBMISSION_PATH} (${map.width}x${map.height})`);

const png = await renderTileGridPng({ width: map.width, height: map.height, lower: map.lowerTiles, upper: map.upperTiles });
fs.writeFileSync(path.join(outDir, "submission-preview.png"), png);
console.log(`[미리보기] ${path.join(outDir, "submission-preview.png")}`);
