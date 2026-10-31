// NPC 가 설 칸은 «플레이어가 걸어 와서 말을 걸 수 있는» 칸이어야 한다.
//
// 왜(2026-10-31 이세계 고딩 맵 VQA): 왕도 근위병 (57,25) 이 덤불 주머니 안 통행 칸에 섰다. 칸 자체는 걸을 수 있었지만
// 시작점·입구에서는 닿지 않아 말을 걸 수 없었다 — 진행이 막히는 자리다. place_npc 의 착지 보정은 «작은 덩이(5칸 미만)» 만
// 걸렀으므로 큰 고립 덩이(왕도 고립 171칸)나 맵 끝 착지 칸 (58,27) 위에는 그대로 사람을 세웠다.
//
// 규칙(런타임 충돌 canMove 와 같은 BFS):
//  - 앵커 = 시작 위치(이 맵이면)·다른 맵에서 이 맵으로 들어오는 착지 칸. 앵커가 없는 맵(아직 입구가 없는 새 맵)은 판단하지 않는다.
//  - 사람을 그 칸에 세운 뒤에도 앵커에서 걸어 닿는 이웃 칸이 하나 있어야 한다(그 칸이 «말 거는 앞칸»).
//    카운터 너머(카운터 칸 1~2개를 사이에 둔) 닿는 칸도 앞칸으로 친다 — 상점 주인은 카운터 뒤 닫힌 칸에 선다.
//  - 착지 칸 위에는 세우지 않는다(들어오자마자 사람과 겹친다).
//  - 이 맵의 이벤트가 changeTile 로 바꾸는 칸(베는 덤불·여는 덩굴 문)은 지나갈 수 있다고 본다 — 퍼즐 너머 관장을 입구 앞으로 끌어내면
//    퍼즐을 건너뛴다(transferReachability.sameMapPassages 와 같은 이유). 장치를 실제로 켤 수 있는지는 자동 플레이가 본다.
import { canMove, isPassable } from "@/project/collision";
import { isCounterCell, MAX_COUNTER_REACH } from "@/project/counterTiles";
import type { GameMap, Project } from "@/project/types";
import { playerAnchors, sameMapPassages } from "./transferReachability";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export interface NpcStandReach {
  /** 앵커에서 걸어 닿는 칸(땅만 본다). */
  readonly reach: Uint8Array;
  /** 이 칸에 사람을 세워도 플레이어가 걸어 와 말을 걸 수 있는가(착지 칸이면 거짓). */
  talkable(x: number, y: number): boolean;
  /** talkable 일 때 말 거는 앞칸 하나. */
  frontCell(x: number, y: number): { x: number; y: number } | null;
}

type Passage = { at: { x: number; y: number }; to: { x: number; y: number }[] };

/** 앵커에서 걷는 BFS. 같은 맵 안 이동 이벤트(퍼즐 문·덤불 틈) 옆에 닿으면 그 도착 칸에서 이어 걷는다(eventReach.reachFrom 과 같다). */
/** 이 맵의 이벤트가 changeTile 로 바꾸는 칸. */
function openableCells(map: GameMap): Set<number> {
  const out = new Set<number>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.kind === "changeTile" && (record.mapId === undefined || record.mapId === map.id) && typeof record.x === "number" && typeof record.y === "number"
      && record.x >= 0 && record.y >= 0 && record.x < map.width && record.y < map.height) out.add(record.y * map.width + record.x);
    for (const value of Object.values(record)) if (value && typeof value === "object") visit(value);
  };
  for (const event of map.events ?? []) visit(event.pages ?? event.commands);
  return out;
}

function bfs(project: Project, map: GameMap, seeds: readonly number[], blocked: ReadonlySet<number>, passages: readonly Passage[], openable: ReadonlySet<number>): Uint8Array {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  const q: number[] = [];
  for (const s of seeds) if (!seen[s] && !blocked.has(s)) { seen[s] = 1; q.push(s); }
  const used = new Set<number>();
  const near = (c: { x: number; y: number }) => !!seen[c.y * w + c.x] || DIRS.some(([dx, dy]) => {
    const x = c.x + dx, y = c.y + dy;
    return x >= 0 && y >= 0 && x < w && y < map.height && !!seen[y * w + x];
  });
  for (let k = 0; ; k++) {
    if (k >= q.length) {
      let grew = false;
      passages.forEach((p, n) => {
        if (used.has(n) || !near(p.at)) return;
        used.add(n);
        for (const t of p.to) { const i = t.y * w + t.x; if (!seen[i] && !blocked.has(i)) { seen[i] = 1; q.push(i); grew = true; } }
      });
      if (!grew) break;
    }
    const i = q[k]!, x = i % w, y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (seen[j] || blocked.has(j)) continue;
      const step = openable.has(i) || openable.has(j)
        ? openable.has(j) || isPassable(project, map, nx, ny)
        : canMove(project, map, x, y, nx, ny);
      if (!step) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

/** 이 맵의 «말 걸 수 있는 자리» 판정기. 앵커가 없으면 null(판단 보류 — 호출자는 예전 규칙을 쓴다). */
export function npcStandReach(project: Project, map: GameMap): NpcStandReach | null {
  if (map.worldmapSource) return null;
  const w = map.width;
  const anchors = playerAnchors(project, map).filter((a) => isPassable(project, map, a.x, a.y)).map((a) => a.y * w + a.x);
  if (anchors.length === 0) return null;
  const anchorSet = new Set(anchors);
  // 이벤트는 막힘으로 세지 않는다 — 땅(런타임 canMove)만 본다. 줄 선 모험가처럼 대화 뒤 비켜 주는 사람까지 벽으로 보면 그 너머 여관 주인을
  // «못 닿는 자리»로 끌어냈다(이세계 고딩 길드). 사람이 한 칸 통로를 영영 막는 경우는 passageBlockWarning(eventsCutOffBy)이 따로 본다.
  const blocked = new Set<number>();
  const passages = sameMapPassages(map);
  const reach = bfs(project, map, anchors, blocked, passages, openableCells(map));
  const tileset = project.tilesets?.[map.tilesetId] ?? null;
  const cache = new Map<number, { x: number; y: number } | null>();
  const frontCell = (x: number, y: number): { x: number; y: number } | null => {
    if (x < 0 || y < 0 || x >= w || y >= map.height) return null;
    const i = y * w + x;
    if (cache.has(i)) return cache.get(i)!;
    let out: { x: number; y: number } | null = null;
    if (!anchorSet.has(i)) {
      // 닿는 칸이면 BFS 에서 그 칸에 먼저 들어온 이웃은 그 칸을 지나지 않고 닿는다 — 사람이 서도 그 이웃이 앞칸이다.
      // 닿지 않는 칸(카운터 뒤·덤불 주머니)이면 닿는 이웃이나 카운터 너머 닿는 칸이 있어야 한다.
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
        if (reach[ny * w + nx]) { out = { x: nx, y: ny }; break; }
        // 카운터 너머: 카운터 칸을 1~MAX_COUNTER_REACH 개 지나 닿는 칸.
        let cx = nx, cy = ny;
        for (let crossed = 0; crossed < MAX_COUNTER_REACH && isCounterCell(tileset, map, cx, cy); crossed++) {
          cx += dx; cy += dy;
          if (cx < 0 || cy < 0 || cx >= w || cy >= map.height) break;
          if (reach[cy * w + cx]) { out = { x: cx, y: cy }; break; }
        }
        if (out) break;
      }
    }
    cache.set(i, out);
    return out;
  };
  return { reach, talkable: (x, y) => frontCell(x, y) !== null, frontCell };
}
