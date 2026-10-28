// 자동 연결(장소 잇기)의 이동 칸을 어디에 둘까 — 문 그림 없는 맵 가장자리·방 가운데에 투명 이동 칸이 생기던 것(2026-10-28 스위트
// standin magic: 별빛 마법학교 (29,4) 방 위쪽 바닥 ↔ 관측실)을 고친다. 순서(모두 시작점·착지점에서 걸어 닿는 칸만):
//  1) 아직 아무 데도 이어지지 않은 문 그림 칸(칩셋 이름표 「…문」). 문이 못 걷는 칸이면 문앞 칸 + doorAt.
//  2) 위·아래층 장소(…층·탑·지하·관측실·다락)면 계단 그림 칸.
//  3) 바깥 맵이면 맵 가장자리에 닿는 길 끝 칸.
//  4) 없으면 그 맵 칩셋에 있는 문 그림(1칸 또는 위아래 2칸)을 벽 칸에 하나 깔고 그 문앞으로(새 그림 없음).
// 하나도 못 찾으면 undefined — 부르는 쪽이 예전처럼 가장자리 칸을 쓴다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { doorArtCells, isDoorArtLabel, reachableCells } from "./eventReach";
import { roadCellSet, tileLabel } from "./people";
import type { BuildRun } from "./types";
import { pickDungeonGateSpot } from "@/editor/tools/dungeonLinkTools";

type Cell = { x: number; y: number };
export type Side = "north" | "south" | "east" | "west";
export interface TransferSpot { readonly x: number; readonly y: number; readonly doorAt?: Cell; readonly note: string }

const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
const VERTICAL_PLACE = /\d\s*층|지하|탑|관측|다락|옥상|위층|아래층|floor|tower|basement|attic/iu;
const STAIRS_ART = /계단/u;
const NOT_STAIRS_ART = /계단 단|관중석|봉인|두 계단/u;
// 깔 문에서 뺄 것: 감옥·성문·장치 문(사람이 드나드는 문으로 안 보인다).
const NOT_STAMP_DOOR = /쇠창살|창살|성문|정문|비밀|수문|울타리|고패|잠긴/u;

const sideScore = (map: GameMap, c: Cell, side: Side) => {
  const d = side === "north" ? c.y : side === "south" ? map.height - 1 - c.y : side === "west" ? c.x : map.width - 1 - c.x;
  const mid = side === "north" || side === "south" ? Math.abs(c.x - map.width / 2) : Math.abs(c.y - map.height / 2);
  return d * 4 + mid;
};

function labelsAt(project: Project, map: GameMap, x: number, y: number): string[] {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  return LAYERS.map((k) => tileLabel(project, map, m[k]?.[y * map.width + x])).filter(Boolean);
}

/** 이벤트가 이미 있거나 그 둘레에 이동 이벤트가 있는 칸은 쓰지 않는다. */
function occupiedNear(map: GameMap, c: Cell, r: number): boolean {
  return (map.events ?? []).some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= r);
}

/** 그림 칸 g(못 걷거나 걷는 칸)에 맞는 이동 칸: g 가 걷는 칸이면 g 자신, 아니면 바로 남쪽 문앞 + doorAt. */
function endpointFor(project: Project, map: GameMap, reach: Uint8Array, g: Cell): { x: number; y: number; doorAt?: Cell } | undefined {
  const w = map.width;
  if (isPassable(project, map, g.x, g.y) && reach[g.y * w + g.x]) return { x: g.x, y: g.y };
  const s = { x: g.x, y: g.y + 1 };
  if (s.y >= map.height || !isPassable(project, map, s.x, s.y) || !reach[s.y * w + s.x]) return undefined;
  return { x: s.x, y: s.y, doorAt: { x: g.x, y: g.y } };
}

/** 칩셋에서 깔 수 있는 문 그림 — 1칸((0,0)만) 또는 위아래 2칸((0,-1)·(0,0)). 사람 드나드는 문을 먼저. */
function stampableDoor(project: Project, map: GameMap): { bottom: number; top?: number; label: string } | undefined {
  const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const groups = new Map<string, Map<string, number>>();
  meta.forEach((t, i) => {
    const label = t?.label;
    if (!label || !isDoorArtLabel(label) || /프레임/u.test(label)) return;
    const coord = /\((-?\d+),\s*(-?\d+)\)/u.exec(label);
    const base = label.replace(/\s*\((-?\d+),\s*(-?\d+)\)/gu, "").trim();
    if (NOT_STAMP_DOOR.test(base)) return;
    const key = coord ? `${coord[1]},${coord[2]}` : "0,0";
    const g = groups.get(base) ?? new Map<string, number>();
    if (!g.has(key)) g.set(key, i);
    groups.set(base, g);
  });
  const out: { bottom: number; top?: number; label: string; rank: number }[] = [];
  for (const [base, g] of groups) {
    const keys = [...g.keys()];
    if (keys.length === 1 && keys[0] === "0,0") out.push({ bottom: g.get("0,0")!, label: base, rank: 0 });
    else if (keys.length === 2 && g.has("0,0") && g.has("0,-1")) out.push({ bottom: g.get("0,0")!, top: g.get("0,-1")!, label: base, rank: 0 });
  }
  out.sort((a, b) => a.rank - b.rank || a.bottom - b.bottom);
  return out[0];
}

/** 맵 가장자리에 닿는 길 끝 칸(시작점·착지점에서 걸어 닿는 것, side 쪽 먼저). */
export function roadEndSpot(project: Project, map: GameMap, side: Side): TransferSpot | undefined {
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  const w = map.width;
  const ends: Cell[] = [];
  for (const i of roadCellSet(project, map)) {
    const x = i % w, y = Math.floor(i / w);
    if ((x === 0 || y === 0 || x === w - 1 || y === map.height - 1) && reach[i] && !occupiedNear(map, { x, y }, 1)) ends.push({ x, y });
  }
  ends.sort((a, b) => sideScore(map, a, side) - sideScore(map, b, side) || a.y - b.y || a.x - b.x);
  const end = ends[0];
  return end ? { ...end, note: `가장자리 길 끝(${end.x},${end.y})` } : undefined;
}

/** 던전 바깥 문 자리 — 정본은 dungeonLinkTools.pickDungeonGateSpot(갱구가 맞는 길 곁 칸 → 갱구 자리 → 가장자리 길 끝 → 가장자리). side 쪽 먼저. */
export function dungeonGateSpot(project: Project, map: GameMap, side: Side): TransferSpot | undefined {
  const at = pickDungeonGateSpot(project, map, (c) => sideScore(map, c, side));
  return at ? { x: at.x, y: at.y, note: `던전 문 자리 ${at.why}(${at.x},${at.y})` } : undefined;
}

/** 자동 연결 이동 칸 자리. stamp 가 일어나면 run.ctx.project 의 맵을 바꾼다. */
export function pickTransferSpot(run: BuildRun, mapId: string, opts: { side: Side; vertical?: boolean; outdoor?: boolean; otherName?: string }): TransferSpot | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return undefined;
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  const w = map.width;
  const vertical = opts.vertical ?? VERTICAL_PLACE.test(opts.otherName ?? "");
  const rank = (cs: Cell[]) => [...cs].sort((a, b) => sideScore(map, a, opts.side) - sideScore(map, b, opts.side) || a.y - b.y || a.x - b.x);
  // 1) 비어 있는 문 그림.
  for (const d of rank(doorArtCells(project, map))) {
    const ep = endpointFor(project, map, reach, d);
    if (!ep || occupiedNear(map, d, 1) || occupiedNear(map, ep, 0)) continue;
    return { ...ep, note: `문 그림 「${labelsAt(project, map, d.x, d.y).find(isDoorArtLabel) ?? "문"}」(${d.x},${d.y})` };
  }
  // 2) 계단(위·아래층 장소).
  if (vertical) {
    const stairs: Cell[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) {
      const hit = labelsAt(project, map, x, y).some((l) => STAIRS_ART.test(l) && !NOT_STAIRS_ART.test(l));
      const below = y + 1 < map.height && labelsAt(project, map, x, y + 1).some((l) => STAIRS_ART.test(l) && !NOT_STAIRS_ART.test(l));
      if (hit && !below) stairs.push({ x, y });
    }
    for (const s of rank(stairs)) {
      const ep = endpointFor(project, map, reach, s);
      if (!ep || occupiedNear(map, s, 1) || occupiedNear(map, ep, 0)) continue;
      return { ...ep, note: `계단 그림(${s.x},${s.y})` };
    }
  }
  // 3) 바깥 맵: 가장자리의 길 끝.
  if (opts.outdoor) {
    const end = roadEndSpot(project, map, opts.side);
    if (end) return end;
  }
  // 4) 칩셋 문 그림을 벽에 깐다.
  const door = stampableDoor(project, map);
  if (door) {
    const walls: Cell[] = [];
    for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (isPassable(project, map, x, y) || !reach[(y + 1) * w + x] || !isPassable(project, map, x, y + 1)) continue;
      if (door.top !== undefined && isPassable(project, map, x, y - 1)) continue;
      // 문 양옆도 벽이어야 벽에 난 문으로 보인다(가구 칸·기둥 하나에 붙이지 않는다).
      if (isPassable(project, map, x - 1, y) || isPassable(project, map, x + 1, y)) continue;
      const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
      if ((m.upperTiles?.[y * w + x] ?? -1) >= 0 || (door.top !== undefined && (m.upperTiles?.[(y - 1) * w + x] ?? -1) >= 0)) continue;
      if (occupiedNear(map, { x, y: y + 1 }, 1)) continue;
      walls.push({ x, y });
    }
    const at = rank(walls)[0];
    if (at) {
      const copy = structuredClone(map);
      const upper = (copy.upperTiles ?? new Array(w * map.height).fill(-1)) as number[];
      upper[at.y * w + at.x] = door.bottom;
      if (door.top !== undefined) upper[(at.y - 1) * w + at.x] = door.top;
      (copy as { upperTiles: number[] }).upperTiles = upper;
      run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: copy } } as Project;
      return { x: at.x, y: at.y + 1, doorAt: at, note: `칩셋 문 그림 「${door.label}」을 벽(${at.x},${at.y})에 깔았다` };
    }
  }
  return undefined;
}
