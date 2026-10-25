// 시작점·체크포인트가 추격자 시야(또는 순찰 길) 바로 곁이면 태어나자마자 잡히고 「다시 시도」가 같은 자리로 돌려
// 게임 오버가 끝없이 반복된다(2026-10-25 심판 J61, 공포 학교: 시작 (11,8) · 추격자 (15,8) · 같은 줄 · 시야 5).
// 정적 판정 — 추격자의 집 칸과 순찰 경유 칸에서 시야 범위(맨해튼)·벽 가림(통행 불가 칸) 직선으로 보이거나 몇 걸음 안이면 위험.
// 순수 함수: 저작 도구(set_start_position·make_chase_scene)와 조수 끝맺음 검사가 같이 부른다.
import { isPassable } from "@/project/collision";
import type { Dir, GameEvent, GameMap, Project } from "@/project/types";

/** 시작·복귀 칸에서 이만큼 걸음 안에 추격자 집·순찰 칸이 있으면 위험(시야가 없어도 곧 닿는다). */
export const CHASER_SPAWN_MIN_STEPS = 6;
const DEFAULT_SIGHT = 8;
const STEP: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export interface ChaserThreat {
  readonly eventId: string;
  readonly name: string;
  readonly at: { readonly x: number; readonly y: number };
  readonly distance: number;
  readonly reason: "sight" | "near";
}

type Movementish = { type?: string; sight?: { range?: number }; sightRange?: number; route?: { moves?: readonly { kind?: string; dir?: string }[] } };

/** 추격자(movement.type 'chase') 페이지를 가진 이벤트와 그 집·순찰 칸. 전투로 끝나는 필드 적은 잡혀도 게임 오버가 아니라 뺀다. */
function chaserCells(event: GameEvent): { range: number; gated: boolean; cells: { x: number; y: number }[] } | undefined {
  const page = (event.pages ?? []).find((entry) => (entry.movement as Movementish | undefined)?.type === "chase");
  if (!page) return undefined;
  if (JSON.stringify(page.commands ?? []).includes("battleProcessing")) return undefined;
  const movement = page.movement as Movementish;
  const range = Math.max(0, Math.trunc(movement.sight?.range ?? movement.sightRange ?? DEFAULT_SIGHT));
  const cells = [{ x: event.x, y: event.y }];
  let at = { x: event.x, y: event.y };
  for (const move of movement.route?.moves ?? []) {
    if (move.kind !== "move" || !move.dir || !(move.dir in STEP)) continue;
    const [dx, dy] = STEP[move.dir as Dir];
    at = { x: at.x + dx, y: at.y + dy };
    cells.push(at);
  }
  const gated = Array.isArray((page as { conditions?: unknown }).conditions) && ((page as { conditions?: unknown[] }).conditions ?? []).length > 0;
  return { range, gated, cells };
}

/** from→to 사이 칸(양 끝 제외)이 모두 통행 가능하면 보인다(벽이 시야를 가린다 — 런타임 lineOfSight 와 같은 뜻). */
function clearLine(project: Project, map: GameMap, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const dx = to.x - from.x, dy = to.y - from.y;
  const nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  let x = from.x, y = from.y, ix = 0, iy = 0;
  while (ix < nx || iy < ny) {
    const a = (1 + 2 * ix) * ny, b = (1 + 2 * iy) * nx;
    if (a === b) { x += sx; y += sy; ix++; iy++; } else if (a < b) { x += sx; ix++; } else { y += sy; iy++; }
    if (x === to.x && y === to.y) return true;
    if (!isPassable(project, map, x, y)) return false;
  }
  return true;
}

/** 걸어서 몇 걸음인가(통행 칸 BFS, limit 걸음까지). 못 가면 Infinity. */
function walkSteps(project: Project, map: GameMap, from: { x: number; y: number }, targets: ReadonlySet<string>, limit: number): number {
  if (targets.has(`${from.x},${from.y}`)) return 0;
  const seen = new Set([`${from.x},${from.y}`]);
  let frontier = [from];
  for (let depth = 1; depth <= limit && frontier.length; depth++) {
    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) for (const [dx, dy] of Object.values(STEP)) {
      const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (targets.has(key)) return depth;
      if (!isPassable(project, map, x, y)) continue;
      next.push({ x, y });
    }
    frontier = next;
  }
  return Infinity;
}

/** (mapId,x,y) 에 주인공을 세우면 곧바로 잡힐 추격자들. 스위치로 깨우는 추격자(조건 페이지)도 센다 — 깨운 뒤 그 자리로 되돌아올 수 있다. */
export function chaserThreatsAt(project: Project, mapId: string, x: number, y: number, minSteps = CHASER_SPAWN_MIN_STEPS, options: { skipGated?: boolean } = {}): ChaserThreat[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const out: ChaserThreat[] = [];
  for (const event of map.events ?? []) {
    const chaser = chaserCells(event);
    if (!chaser || (options.skipGated && chaser.gated)) continue;
    const seen = chaser.cells.find((cell) => Math.abs(cell.x - x) + Math.abs(cell.y - y) <= chaser.range && clearLine(project, map, cell, { x, y }));
    const steps = walkSteps(project, map, { x, y }, new Set(chaser.cells.map((cell) => `${cell.x},${cell.y}`)), minSteps);
    if (!seen && steps > minSteps) continue;
    const at = seen ?? chaser.cells[0]!;
    out.push({ eventId: event.id, name: event.name || event.id, at, distance: Math.abs(at.x - x) + Math.abs(at.y - y), reason: seen ? "sight" : "near" });
  }
  return out;
}

export function chaserThreatLine(where: string, threat: ChaserThreat): string {
  return `${where} 가 추격자 「${threat.name}」(${threat.eventId}) ${threat.reason === "sight" ? `시야 안(${threat.at.x},${threat.at.y} 에서 ${threat.distance}칸, 가리는 벽 없음)` : `가까이(${threat.at.x},${threat.at.y} 까지 몇 걸음)`}이다 — 태어나자마자 붙잡히고 「다시 시도」도 같은 자리라 게임 오버가 반복된다`;
}

/** 주인공이 다시 태어나는 칸: 시작 위치와 checkpointSave 를 부르는 이벤트 칸(잡히면 「다시 시도」가 그 체크포인트로 돌린다). */
export function spawnSpots(project: Project, mapId?: string): { mapId: string; label: string; x: number; y: number; spotEventId?: string }[] {
  const out: { mapId: string; label: string; x: number; y: number; spotEventId?: string }[] = [];
  if (project.startMapId && (!mapId || mapId === project.startMapId) && project.startPos) {
    out.push({ mapId: project.startMapId, label: `시작 위치 (${project.startPos.x}, ${project.startPos.y})`, x: project.startPos.x, y: project.startPos.y });
  }
  for (const map of Object.values(project.maps)) {
    if (mapId && map.id !== mapId) continue;
    for (const event of map.events ?? []) {
      if (!JSON.stringify(event.pages ?? []).includes('"checkpointSave"')) continue;
      out.push({ mapId: map.id, label: `체크포인트 「${event.name || event.id}」(${event.x}, ${event.y})`, x: event.x, y: event.y, spotEventId: event.id });
    }
  }
  return out;
}

/** 모든 시작·체크포인트 칸 중 추격자에게 곧바로 잡히는 곳(문장). */
export function unsafeSpawnLines(project: Project, mapId?: string): { mapId: string; eventId: string; spotEventId?: string; line: string }[] {
  const out: { mapId: string; eventId: string; spotEventId?: string; line: string }[] = [];
  for (const spot of spawnSpots(project, mapId)) {
    // 시작 칸에서는 스위치로 나중에 깨우는 추격자가 아직 없다; 체크포인트는 깨운 뒤 돌아오는 자리라 센다.
    for (const threat of chaserThreatsAt(project, spot.mapId, spot.x, spot.y, CHASER_SPAWN_MIN_STEPS, { skipGated: !spot.spotEventId })) out.push({ mapId: spot.mapId, eventId: threat.eventId, ...(spot.spotEventId ? { spotEventId: spot.spotEventId } : {}), line: chaserThreatLine(spot.label, threat) });
  }
  return out;
}
