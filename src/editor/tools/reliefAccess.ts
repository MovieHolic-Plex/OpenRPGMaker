// 높은 땅에 걸어 올라갈 수 있는지(F3·F7). 단 차이는 경사로 없이는 막히므로(relief/walk.ts reliefAllowsStep),
// 조수·사람이 언덕을 쌓고 경사로를 안 놓으면 그 땅은 장식이 된다. 실제 통행(canMove)으로 세고, 놓을 수 있는 경사로 자리를 제안한다.
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { isPassable } from "@/project/collision";
import { terrainReachability } from "@/project/terrainReachability";
import type { GameMap, Project } from "@/project/types";

type Box = [number, number, number, number];
export interface ReliefUnreachableRegion { rect: Box; cells: number; minLevel: number; maxLevel: number; ramp: { x: number; y: number } | null }
export interface ReliefAccessReport {
  start: { x: number; y: number } | null;
  highCells: number;
  unreachableHigh: number;
  regions: ReliefUnreachableRegion[];
  text: string;
}

const N4 = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

function pickStart(project: Project, map: GameMap, levels: readonly number[]): { x: number; y: number } | null {
  const start = project.startMapId === map.id ? project.startPos : undefined;
  if (start && isPassable(project, map, start.x, start.y)) return start;
  // 출발점이 없는 맵: 가장 낮은 단에서 가장 넓게 이어진 걸을 수 있는 땅의 한 칸.
  const min = Math.min(...levels);
  const seen = new Uint8Array(levels.length);
  let best: { x: number; y: number } | null = null, bestSize = 0;
  for (let i = 0; i < levels.length; i++) {
    if (seen[i] || levels[i] !== min) continue;
    const x = i % map.width, y = Math.floor(i / map.width);
    if (!isPassable(project, map, x, y)) { seen[i] = 1; continue; }
    const reached = terrainReachability(project, map, { x, y });
    let size = 0;
    for (let j = 0; j < reached.length; j++) if (reached[j]) { size++; if (levels[j] === min) seen[j] = 1; }
    if (size > bestSize) { bestSize = size; best = { x, y }; }
    if (bestSize * 2 > levels.length) break;
  }
  return best;
}

function rampFor(map: GameMap, cells: readonly number[], reached: Uint8Array): { x: number; y: number } | null {
  let tried = 0;
  for (const i of cells) {
    const x = i % map.width, y = Math.floor(i / map.width);
    const touches = N4.some(([dx, dy]) => {
      const X = x + dx, Y = y + dy;
      return X >= 0 && Y >= 0 && X < map.width && Y < map.height && reached[Y * map.width + X] === 1;
    });
    if (!touches) continue;
    if (++tried > 40) break;
    if (planReliefRamp(map, { x, y, face: "top" }, 2, false).ok) return { x, y };
  }
  return null;
}

/** 출발점(시작 맵이면 시작 위치)에서 실제로 걸어 닿지 못하는 높은 땅을 센다. 높이가 없으면 null. */
export function reliefAccess(project: Project, map: GameMap): ReliefAccessReport | null {
  const levels = map.relief?.levels;
  if (!levels || !levels.some((v) => v > 0)) return null;
  const start = pickStart(project, map, levels);
  const reached = start ? terrainReachability(project, map, start) : new Uint8Array(levels.length);
  const base = start ? levels[start.y * map.width + start.x] ?? 0 : 0;
  const lost = new Uint8Array(levels.length);
  let highCells = 0, unreachableHigh = 0;
  for (let i = 0; i < levels.length; i++) {
    if ((levels[i] ?? 0) <= base) continue;
    const x = i % map.width, y = Math.floor(i / map.width);
    if (!isPassable(project, map, x, y)) continue;
    highCells++;
    if (!reached[i]) { lost[i] = 1; unreachableHigh++; }
  }
  const found: { region: ReliefUnreachableRegion; cells: number[] }[] = [];
  for (let i = 0; i < lost.length; i++) {
    if (lost[i] !== 1) continue;
    const cells: number[] = [], queue = [i], box: Box = [map.width, map.height, 0, 0];
    let minLevel = Infinity, maxLevel = 0;
    lost[i] = 2;
    while (queue.length) {
      const c = queue.pop()!, x = c % map.width, y = Math.floor(c / map.width);
      cells.push(c);
      minLevel = Math.min(minLevel, levels[c] ?? 0); maxLevel = Math.max(maxLevel, levels[c] ?? 0);
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
      for (const [dx, dy] of N4) {
        const X = x + dx, Y = y + dy, j = Y * map.width + X;
        if (X >= 0 && Y >= 0 && X < map.width && Y < map.height && lost[j] === 1) { lost[j] = 2; queue.push(j); }
      }
    }
    found.push({ region: { rect: box, cells: cells.length, minLevel, maxLevel, ramp: null }, cells });
  }
  found.sort((a, b) => b.cells.length - a.cells.length);
  for (const entry of found.slice(0, 5)) entry.region.ramp = rampFor(map, entry.cells, reached);
  const regions = found.map((entry) => entry.region);
  const top = regions.slice(0, 5);
  const startText = start ? `(${start.x},${start.y})` : "없음";
  const lines = [`통행: 출발점 ${startText}에서 걸어 닿는 높은 땅 ${highCells - unreachableHigh}/${highCells}칸, 도달 못 하는 높은 땅 ${unreachableHigh}칸`];
  if (unreachableHigh > 0) {
    const levelText = (g: ReliefUnreachableRegion) => g.minLevel === g.maxLevel ? `${g.minLevel}단` : `${g.minLevel}~${g.maxLevel}단`;
    lines.push(`  ${top.map((g) => `${JSON.stringify(g.rect)} ${levelText(g)} ${g.cells}칸` + (g.ramp ? ` → place_terrain_ramp at {"x":${g.ramp.x},"y":${g.ramp.y}}` : " → 둘레가 고르지 않아 경사로 자리 없음, 가장자리를 곧게 다듬거나 단을 낮춰라")).join("; ")}`);
    lines.push("제안: 단 차이는 경사로 없이는 오를 수 없다. 여러 단이면 아래 단부터 한 단씩 경사로를 놓고 check_relief 로 다시 본다. 장식이면 그대로 둔다.");
  }
  return { start, highCells, unreachableHigh, regions, text: lines.join("\n") };
}
