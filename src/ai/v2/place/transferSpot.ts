// 자동 연결(장소 잇기)의 이동 칸을 어디에 둘까 — 문 그림 없는 맵 가장자리·방 가운데에 투명 이동 칸이 생기던 것(2026-10-28 스위트
// standin magic: 별빛 마법학교 (29,4) 방 위쪽 바닥 ↔ 관측실)을 고친다. 순서(모두 시작점·착지점에서 걸어 닿는 칸만):
//  1) 아직 아무 데도 이어지지 않은 건물 입구 — 칩셋의 건물 키트가 문이라고 적어 둔 칸(place/entrances.ts)의 문 앞 칸 + doorAt.
//     건너편이 방일 때만(buildingDoor) — 바깥 맵끼리는 집 문으로 잇지 않는다: 집에 들어갔는데 다른 바깥 맵으로 나오면 맨바닥 이동 칸보다 나쁘다.
//  2) 위·아래층 장소(…층·탑·지하·관측실·다락)면 계단 그림 칸.
//  3) 바깥 맵이면 맵 가장자리에 닿는 길 끝 칸.
// 하나도 못 찾으면 undefined — 부르는 쪽이 걸어 닿는 칸에 이동 칸을 둔다. 문 그림을 지어내 깔지 않는다:
// 이름표가 「…문」으로 끝나는 타일을 벽에 깔던 옛 4단계는 동굴 벽·숲 나무 줄에 마을 집 문을, 일본 집 벽에 「신문」을 깔았고,
// 이름표로 읽은 문 그림(1단계)은 걸어서 지나는 성문 한가운데에 이동 칸을 두어 맵을 둘로 끊었다(2026-11-11 단계×테마 표).
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { reachableCells } from "../judge/eventReach";
import { buildingEntrances, declaredStairCells } from "./entrances";
import { kitOf } from "./exitDress";
import { roadCellSet } from "./cells";
import type { BuildRun, Side } from "../shared/types";
import { pickDungeonGateSpot } from "@/editor/tools/dungeonLinkTools";

type Cell = { x: number; y: number };
interface TransferSpot { readonly x: number; readonly y: number; readonly doorAt?: Cell; readonly note: string }

const VERTICAL_PLACE = /\d\s*층|지하|탑|관측|다락|옥상|위층|아래층|floor|tower|basement|attic/iu;
const sideScore = (map: GameMap, c: Cell, side: Side) => {
  const d = side === "north" ? c.y : side === "south" ? map.height - 1 - c.y : side === "west" ? c.x : map.width - 1 - c.x;
  const mid = side === "north" || side === "south" ? Math.abs(c.x - map.width / 2) : Math.abs(c.y - map.height / 2);
  return d * 4 + mid;
};

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

/** 맵 가장자리에 닿는 길 끝 칸(시작점·착지점에서 걸어 닿는 것, side 쪽 먼저). */
function roadEndSpot(project: Project, map: GameMap, side: Side): TransferSpot | undefined {
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

/** 이 맵이 방이라고 적혀 있나 — 실내 기후이거나 그 칩셋 방 키트의 천장 띠가 깔려 있다. */
const isRoomMap = (project: Project, map: GameMap): boolean =>
  (map as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor" || !!kitOf(project, map);

interface TransferSpotOptions {
  readonly side: Side;
  readonly vertical?: boolean;
  readonly outdoor?: boolean;
  /** 건너편 맵의 이름 — 위·아래층 장소인지, 방인지를 읽는다. */
  readonly otherName?: string;
  /**
   * 건물 입구(집 문)를 자리로 써도 되는가. 건너편이 방(실내)이면 true, 바깥 맵이면 false 를 준다.
   * 안 주면 건너편 맵(otherName)이 방이라고 적혀 있을 때만 쓴다 — 모르면 쓰지 않는다(바깥 맵끼리 집 문으로 잇지 않는다).
   */
  readonly buildingDoor?: boolean;
}

/** 자동 연결 이동 칸 자리 — 맵은 바꾸지 않는다. */
export function pickTransferSpot(run: BuildRun, mapId: string, opts: TransferSpotOptions): TransferSpot | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return undefined;
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  const w = map.width;
  const vertical = opts.vertical ?? VERTICAL_PLACE.test(opts.otherName ?? "");
  const rank = <T extends Cell>(cs: readonly T[]): T[] => [...cs].sort((a, b) => sideScore(map, a, opts.side) - sideScore(map, b, opts.side) || a.y - b.y || a.x - b.x);
  const other = opts.otherName ? Object.values(project.maps).find((m) => m.id !== mapId && m.name === opts.otherName) : undefined;
  const buildingDoor = opts.buildingDoor ?? (!!other && isRoomMap(project, other));
  // 1) 비어 있는 건물 입구 — 건너편이 방일 때만.
  for (const e of buildingDoor ? rank(buildingEntrances(project, map)) : []) {
    if (!reach[e.front.y * w + e.front.x] || occupiedNear(map, e, 1) || occupiedNear(map, e.front, 0)) continue;
    return { x: e.front.x, y: e.front.y, doorAt: { x: e.x, y: e.y }, note: `건물 입구 「${e.kit}」(${e.x},${e.y})` };
  }
  // 2) 계단(위·아래층 장소).
  if (vertical) {
    // 선언된 계단 칸(방 키트의 계단 기물 · 칩셋 표면 계약의 계단) — 이름표의 「계단」 글자로 읽지 않는다(「지구라트(계단 신전)」「비상계단 아파트」).
    const stairs: Cell[] = declaredStairCells(project, map);
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
  return undefined;
}
