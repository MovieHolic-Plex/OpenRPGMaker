import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassableLanding } from "@/project/collision";

type Point = { x: number; y: number };
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const coord = (p: Point) => `${p.x},${p.y}`;
const isTransfer = (e: GameEvent) => JSON.stringify(e.pages ?? e.commands).includes('"kind":"transfer"');

/** connect() 가 놓은 길 출구 하나 — name 은 문 이벤트 id(`<지도 id>_to_<대상 id>`), commands 는 그 이동 명령(잠긴 길이면 잠금 fork 포함). */
export interface EdgeDoor { map: GameMap; name: string; at: Point; commands: Command[] }

/** 문 칸에서 가장자리까지 걸어 닿을 수 있는 칸들(문 칸 포함). 문이 가장자리에서 4칸보다 멀면 문 칸뿐이다. */
export function edgeLaneTiles(project: Project, map: GameMap, at: Point): Point[] {
  const dist = { N: at.y, S: map.height - 1 - at.y, W: at.x, E: map.width - 1 - at.x };
  const [side, near] = Object.entries(dist).sort((a, b) => a[1] - b[1])[0]! as ["N" | "S" | "W" | "E", number];
  if (near > 4) return [at];
  const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[side];
  const along = side === "N" || side === "S" ? [1, 0] : [0, 1];
  const open = (p: Point, q: Point) => q.x >= 0 && q.y >= 0 && q.x < map.width && q.y < map.height && isPassableLanding(project, map, q.x, q.y) && canMove(project, map, p.x, p.y, q.x, q.y);
  const lane = (p: Point) => { let q = p; for (let i = 0; i < near; i++) { const n = { x: q.x + out[0]!, y: q.y + out[1]! }; if (!open(q, n)) return false; q = n; } return true; };
  const found: Point[] = [at];
  for (const sign of [-1, 1]) for (let from = at; ;) {
    const q = { x: from.x + sign * along[0]!, y: from.y + sign * along[1]! };
    if (!open(from, q)) break;
    if (lane(q)) found.push(q);
    from = q;
  }
  // 곧은 열은 아니어도 돌아서 가장자리 줄에 닿는 통행 칸(문 주변 띠 안)도 문이다 — 막다른 가장자리 칸에 서면 더 갈 곳이 없다.
  const toEdge = (p: Point) => side === "N" ? p.y : side === "S" ? map.height - 1 - p.y : side === "W" ? p.x : map.width - 1 - p.x;
  const seen = new Set([coord(at)]), queue = [at];
  for (let n = 0; n < queue.length; n++) {
    const q = queue[n]!;
    if (toEdge(q) === 0 && !found.some(f => f.x === q.x && f.y === q.y)) found.push(q);
    for (const [dx, dy] of directions) {
      const r = { x: q.x + dx, y: q.y + dy };
      if (!seen.has(coord(r)) && r.x >= 0 && r.y >= 0 && r.x < map.width && r.y < map.height && toEdge(r) <= near && open(q, r)) { seen.add(coord(r)); queue.push(r); }
    }
  }
  return found;
}

/** 길 출구마다 폭 전체에 같은 이동 이벤트(잠긴 길은 같은 잠금)를 깐다. 세계를 다 지은 뒤 한 번 부른다. */
export function placeEdgeDoors(project: Project, doors: readonly EdgeDoor[], place: (map: GameMap, suffix: string, at: Point, commands: Command[]) => void): void {
  for (const d of doors) for (const p of edgeLaneTiles(project, d.map, d.at)) {
    // 이미 문이 선 칸·사람·표지판이 막은 칸은 건너뛴다(막힌 칸은 걸어 닿지 못한다).
    if (d.map.events.some(e => e.x === p.x && e.y === p.y && (e.pages?.[0]?.overlapForbidden || isTransfer(e)))) continue;
    place(d.map, `${d.name.slice(d.map.id.length + 1)}_edge_${p.x}_${p.y}`, p, structuredClone(d.commands));
  }
}
