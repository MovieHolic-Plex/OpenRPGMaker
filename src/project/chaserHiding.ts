// 추격자 맵의 은신처(2026-10-29 standin horror 「폐병원」): 추격자가 순찰하고 잡으면 게임 오버인데 숨을 곳이 0곳이었다.
// make_chase_scene 은 hidingSpots 를 받을 때만 은신처를 만들었고, 조수는 주지 않았다. 추격자를 놓는 길과 끝맺음이
// 이 함수로 맵에 이미 있는 숨을 만한 가구(옷장·사물함·침대·커튼…) 1~2곳을 순찰 길 가까이에서 결정적으로 골라 interaction hiding 을 건다.
// 새 그림은 그리지 않는다 — 맵에 그런 가구가 없으면 빈 목록과 이유를 돌려준다(출하 검사가 막는다).
import { canMove, isPassable } from "@/project/collision";
import { objectClusterAt } from "@/project/objectFootprint";
import type { Dir, EventPage, GameEvent, GameMap, Project } from "@/project/types";

/** 숨을 만한 가구 이름(낮을수록 먼저). 침대 «옆 협탁»·모니터처럼 이름에 침대가 들어간 딴 물건은 뺀다. */
const HIDE_RANKS: readonly (readonly [number, RegExp])[] = [
  [0, /옷장|장롱|사물함|락커|로커|캐비닛|캐비넷|청소\s*도구함|도구함|수납장|붙박이장|벽장|locker|wardrobe|closet|cabinet/iu],
  [1, /침대|병상|이송\s*침대|bed\b/iu],
  [2, /커튼|책상|교탁|curtain|desk/iu],
];
const NOT_HIDE = /협탁|모니터|걸대|옆|램프|시계|창|그림|액자|화분|lamp|clock|window/iu;

export function hideRankForLabel(label: string): number | null {
  if (!label || NOT_HIDE.test(label)) return null;
  for (const [rank, re] of HIDE_RANKS) if (re.test(label)) return rank;
  return null;
}

const STEP: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** 추격 페이지(movement.type chase)가 있는 이벤트들. */
export function chaserEvents(map: GameMap): GameEvent[] {
  return (map.events ?? []).filter((ev) => (ev.pages ?? []).some((page) => page.movement?.type === "chase"));
}

/** 추격자 집 칸 + 순찰(route) 칸들. */
export function chaserPatrolCells(map: GameMap, chaser: GameEvent): { x: number; y: number }[] {
  const page = (chaser.pages ?? []).find((p) => p.movement?.type === "chase");
  const cells = [{ x: chaser.x, y: chaser.y }];
  let at = { x: chaser.x, y: chaser.y };
  for (const move of page?.movement?.route?.moves ?? []) {
    const dir = (move as { kind?: string; dir?: Dir }).kind === "move" ? (move as { dir?: Dir }).dir : undefined;
    if (!dir || !STEP[dir]) continue;
    at = { x: at.x + STEP[dir][0], y: at.y + STEP[dir][1] };
    if (at.x < 0 || at.y < 0 || at.x >= map.width || at.y >= map.height) break;
    cells.push(at);
  }
  return cells;
}

/** 이 맵의 은신 이벤트(interaction hiding) 칸. */
export function mapHidingEvents(map: GameMap): GameEvent[] {
  return (map.events ?? []).filter((ev) => (ev.pages ?? []).some((page) => (page.interaction as { kind?: string } | undefined)?.kind === "hiding"));
}

export interface HidingPick { readonly x: number; readonly y: number; readonly label: string; readonly from: { x: number; y: number }; readonly distance: number }

/** 순찰 칸들에서 걸어서 몇 걸음인가(canMove 다중 출발 BFS). 벽 너머는 맨해튼으로 가까워도 멀다 — 닿지 않는 칸은 없음. */
function walkSteps(project: Project, map: GameMap, starts: readonly { x: number; y: number }[]): Map<number, number> {
  const W = map.width;
  const steps = new Map<number, number>();
  const queue: { x: number; y: number }[] = [];
  for (const s of starts) { const i = s.y * W + s.x; if (!steps.has(i)) { steps.set(i, 0); queue.push(s); } }
  for (let k = 0; k < queue.length; k += 1) {
    const c = queue[k]!;
    const d = steps.get(c.y * W + c.x)!;
    for (const [dx, dy] of Object.values(STEP)) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.height) continue;
      const j = ny * W + nx;
      if (steps.has(j) || !canMove(project, map, c.x, c.y, nx, ny)) continue;
      steps.set(j, d + 1);
      queue.push({ x: nx, y: ny });
    }
  }
  return steps;
}

/**
 * 순찰 길 가까이(발 칸이 길에서 걸어서 2~14걸음)의 숨을 만한 가구 칸을 고른다. 같은 입력이면 같은 답(정렬: 거리 구간 → 가구 순위 → 거리 → y → x).
 * 고른 칸은 가구 칸(이벤트 없음), 그 옆 걷는 칸(from)에서 바라보고 조사한다. 둘째 곳은 첫째와 4칸 넘게 떨어진 다른 가구.
 */
export function pickChaserHidingSpots(project: Project, map: GameMap, chaser: GameEvent, max = 2): HidingPick[] {
  const W = map.width;
  const patrol = chaserPatrolCells(map, chaser);
  const reach = walkSteps(project, map, patrol);
  const taken = new Set((map.events ?? []).map((ev) => ev.y * W + ev.x));
  const seenCluster = new Set<number>();
  const candidates: (HidingPick & { rank: number; cluster: number })[] = [];
  for (let i = 0; i < W * map.height; i += 1) {
    if (seenCluster.has(i)) continue;
    const x = i % W, y = (i - x) / W;
    const cluster = objectClusterAt(project, map, x, y);
    if (!cluster) continue;
    for (const c of cluster.cells) seenCluster.add(c);
    const rank = hideRankForLabel(cluster.label);
    if (rank === null) continue;
    const id = Math.min(...cluster.cells);
    let best: (HidingPick & { rank: number; cluster: number }) | null = null;
    for (const cell of [...cluster.cells].sort((a, b) => a - b)) {
      if (taken.has(cell)) continue;
      const cx = cell % W, cy = (cell - cx) / W;
      // 가구 칸은 막힌 칸이어야 한다 — 걷는 칸에 은신 이벤트를 세우면 길을 막는다.
      if (isPassable(project, map, cx, cy)) continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]] as const) {
        const fx = cx + dx, fy = cy + dy;
        if (fx < 0 || fy < 0 || fx >= W || fy >= map.height) continue;
        const f = fy * W + fx;
        if (!reach.has(f) || taken.has(f)) continue;
        const distance = reach.get(f)!;
        const pick = { x: cx, y: cy, label: cluster.label, from: { x: fx, y: fy }, distance, rank, cluster: id };
        if (!best || score(pick) < score(best)) best = pick;
      }
    }
    if (best) candidates.push(best);
  }
  candidates.sort((a, b) => score(a) - score(b) || a.y - b.y || a.x - b.x);
  const out: HidingPick[] = [];
  for (const c of candidates) {
    if (out.length >= max) break;
    if (out.some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= 4)) continue;
    // 가까운 곳을 하나라도 골랐으면 먼 가구(길에서 0~1칸·8칸 넘게)로 둘째를 채우지 않는다 — 가까운 곳이 없을 때만 먼 곳 하나.
    if (out.length && score(c) >= 1000) continue;
    out.push({ x: c.x, y: c.y, label: c.label, from: c.from, distance: c.distance });
  }
  return out;
}

function score(c: { distance: number; rank: number }): number {
  // 길 위(0~1걸음)는 추격자가 밟고 지나가는 자리, 14걸음 넘게는 «가까이» 가 아니다.
  const band = c.distance >= 2 && c.distance <= 14 ? 0 : 1;
  return band * 1000 + c.rank * 100 + c.distance;
}

/** 은신 페이지(make_chase_scene hidingSpots·configure_object_behavior hiding 과 같은 모양). */
function hidingEvent(id: string, x: number, y: number, label: string): GameEvent {
  const page: EventPage = {
    id: `${id}_hide`, name: "은신처", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" },
    priority: "same", overlapForbidden: true, animationType: "fixedGraphic",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
    interaction: { kind: "hiding" },
  } as EventPage;
  return { id, name: `숨을 곳: ${label}`, x, y, trigger: { kind: "action" }, commands: [], pages: [page] } as GameEvent;
}

/**
 * 추격자가 있는데 이 맵에 은신처가 없으면 숨을 만한 가구 1~2곳에 은신 이벤트를 건다. 이미 은신처가 있으면 아무것도 안 한다.
 * id 는 결정적(`ev_hide_<추격자>_<n>`). 반환: 만든 칸들(없으면 빈 배열) + 못 만든 이유.
 */
export function ensureChaserHidingSpots(project: Project, map: GameMap, chaserId?: string, max = 2): { placed: (HidingPick & { eventId: string })[]; note?: string } {
  const chasers = chaserEvents(map);
  if (!chasers.length || mapHidingEvents(map).length) return { placed: [] };
  const chaser = chasers.find((ev) => ev.id === chaserId) ?? chasers[0]!;
  const picks = pickChaserHidingSpots(project, map, chaser, max);
  if (!picks.length) return { placed: [], note: `「${map.name}」 추격자 ${chaser.id} 둘레에 숨을 만한 가구(옷장·사물함·침대·커튼)가 없다` };
  const placed = picks.map((pick, n) => {
    const eventId = `ev_hide_${chaser.id.replace(/^ev_/u, "")}_${n + 1}`;
    map.events = [...(map.events ?? []), hidingEvent(eventId, pick.x, pick.y, pick.label)];
    return { ...pick, eventId };
  });
  return { placed };
}

/** 추격자가 있는데 은신처가 0인 맵(출하 검사). */
export function chaserMapsWithoutHiding(project: Project): { mapId: string; mapName: string; chaserId: string }[] {
  const out: { mapId: string; mapName: string; chaserId: string }[] = [];
  for (const map of Object.values(project.maps)) {
    const chasers = chaserEvents(map);
    if (!chasers.length) continue;
    // 은신처는 추격자와 같은 맵에서 센다 — 쫓기는 동안 닿는 곳이어야 한다.
    if (mapHidingEvents(map).length) continue;
    out.push({ mapId: map.id, mapName: map.name, chaserId: chasers[0]!.id });
  }
  return out;
}
