// 조수 v2 기계 검사 — 지은 맵을 사람이 보기 전에 결정론으로 잰다. 비평가(눈)와 따로 돌고, 둘 다 통과해야 「다 됐다」고 말할 수 있다.
//  · 도달: 들어오는 칸에서 걸어서 닿는 칸 비율(실내는 빌더가 이미 0 미도달을 보장한다).
//  · 출입: 이동 이벤트마다 도착 맵·칸이 실제로 있고 걸을 수 있는가, 출발 칸이 걸어서 닿는 자리인가(계단·문 계약).
//  · 빈 곳: 실내는 보정된 맨바닥 자(bareFloor.ts ≤15%), 바깥은 아무것도 안 깔린 칸 비율.
//  · 사람: NPC 가 걸을 수 있는 칸에 서 있고 걸어서 말 걸 수 있는가.
import { isPassable } from "@/project/collision";
import { terrainReachability } from "@/project/terrainReachability";
import { INTERIOR_BARE_FLOOR_LIMIT, measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import { roomSpecOf } from "@/editor/handInterior/builder";
import type { GameMap, Project } from "@/project/types";

export interface MachineCheck {
  readonly id: string;
  readonly mapId: string;
  readonly ok: boolean;
  readonly detail: string;
  /** 문제 칸(비평가 major 처럼 고치기에 쓴다). */
  readonly at?: { readonly x: number; readonly y: number };
}

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

function transfers(map: GameMap): { eventId: string; x: number; y: number; to: { mapId: string; x: number; y: number } }[] {
  const out: { eventId: string; x: number; y: number; to: { mapId: string; x: number; y: number } }[] = [];
  for (const event of map.events ?? []) for (const page of event.pages ?? []) for (const command of page.commands ?? []) {
    const c = command as { kind?: string; mapId?: string; x?: number; y?: number };
    if (c.kind === "transfer" && typeof c.mapId === "string" && typeof c.x === "number" && typeof c.y === "number") out.push({ eventId: event.id, x: event.x, y: event.y, to: { mapId: c.mapId, x: c.x, y: c.y } });
  }
  return out;
}

function nearReach(reach: Uint8Array, map: GameMap, x: number, y: number): boolean {
  if (x >= 0 && y >= 0 && x < map.width && y < map.height && reach[y * map.width + x]) return true;
  return DIRS.some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < map.width && Y < map.height && reach[Y * map.width + X] === 1; });
}

/** 지도에서 걸어 들어올 칸: 주어진 입구 → 시작 위치(이 맵이면) → 이 맵으로 오는 이동의 도착 칸 → 아무 걸을 수 있는 칸. */
function startCell(project: Project, map: GameMap, entrance?: { mapId: string; x: number; y: number }): { x: number; y: number } | undefined {
  if (entrance?.mapId === map.id && isPassable(project, map, entrance.x, entrance.y)) return entrance;
  if (project.startMapId === map.id && isPassable(project, map, project.startPos.x, project.startPos.y)) return project.startPos;
  for (const other of Object.values(project.maps)) for (const t of transfers(other)) if (t.to.mapId === map.id && isPassable(project, map, t.to.x, t.to.y)) return t.to;
  for (let y = map.height - 1; y >= 0; y--) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) return { x, y };
  return undefined;
}

export function runMachineChecks(project: Project, mapIds: readonly string[], entrance?: { mapId: string; x: number; y: number }): MachineCheck[] {
  const checks: MachineCheck[] = [];
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) { checks.push({ id: "exists", mapId, ok: false, detail: "맵이 없다" }); continue; }
    const start = startCell(project, map, entrance);
    if (!start) { checks.push({ id: "reach", mapId, ok: false, detail: "걸을 수 있는 칸이 하나도 없다" }); continue; }
    const reach = terrainReachability(project, map, start);
    let passable = 0, reached = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) { passable++; if (reach[y * map.width + x]) reached++; }
    const ratio = passable ? reached / passable : 0;
    const interior = !!roomSpecOf(project.tilesets[map.tilesetId]) && map.climate?.mode === "indoor";
    // 바깥 맵은 울타리 친 밭·지붕 위 같은 「못 가는 걸을 수 있는 칸」이 정상이다 — 실내만 엄격하게.
    const min = interior ? 0.97 : 0.6;
    checks.push({ id: "reach", mapId, ok: ratio >= min, detail: `들어오는 칸 (${start.x},${start.y})에서 걸을 수 있는 칸의 ${Math.round(ratio * 100)}%에 닿는다(기준 ${Math.round(min * 100)}%)` });
    // 출입(계단·문): 도착이 실제 걸을 수 있는 칸인가, 출발이 걸어서 닿는 자리인가.
    for (const t of transfers(map)) {
      const target = project.maps[t.to.mapId];
      if (!target) { checks.push({ id: "exit-target", mapId, ok: false, detail: `이동 이벤트 ${t.eventId}(${t.x},${t.y})의 도착 맵 ${t.to.mapId} 이 없다`, at: t }); continue; }
      const landOk = t.to.x >= 0 && t.to.y >= 0 && t.to.x < target.width && t.to.y < target.height && isPassable(project, target, t.to.x, t.to.y);
      checks.push({ id: "exit-landing", mapId, ok: landOk, detail: `이동 ${t.eventId}(${t.x},${t.y}) → ${target.name}(${t.to.x},${t.to.y}) ${landOk ? "도착 칸이 걸을 수 있다" : "도착 칸이 벽·물건이다(갇힘)"}`, at: t });
      const fromOk = nearReach(reach, map, t.x, t.y);
      checks.push({ id: "exit-reachable", mapId, ok: fromOk, detail: `이동 ${t.eventId}(${t.x},${t.y}) ${fromOk ? "에 걸어서 닿는다" : "에 걸어서 닿지 못한다(어디로도 안 가는 계단·문)"}`, at: t });
    }
    // 사람: 걸을 수 있는 칸·닿는 칸.
    for (const event of map.events ?? []) {
      const page = event.pages?.[0];
      const isPerson = !!page && (page.graphic as { kind?: string } | undefined)?.kind !== undefined && (page.commands ?? []).some((c) => (c as { kind?: string }).kind === "showText" || (c as { kind?: string }).kind === "text" || (c as { kind?: string }).kind === "message");
      if (!isPerson) continue;
      const ok = nearReach(reach, map, event.x, event.y);
      checks.push({ id: "npc-reachable", mapId, ok, detail: `${event.name ?? event.id}(${event.x},${event.y}) ${ok ? "에게 걸어가 말을 걸 수 있다" : "에게 걸어서 닿지 못한다"}`, at: { x: event.x, y: event.y } });
    }
    if (interior) {
      const bare = measureInteriorBareFloor(project, map);
      if (bare && bare.floorCells >= 40) {
        const big = [...bare.regions].sort((a, b) => b.w * b.h - a.w * a.h)[0];
        checks.push({ id: "bare-floor", mapId, ok: bare.pct <= INTERIOR_BARE_FLOOR_LIMIT + 5, detail: `맨바닥 덩이 ${bare.pct}%(기준 ${INTERIOR_BARE_FLOOR_LIMIT}%, 여유 5)${big ? ` — 가장 큰 덩이 (${big.x},${big.y}) ${big.w}×${big.h}` : ""}`, ...(big ? { at: { x: big.x, y: big.y } } : {}) });
      }
    } else {
      let empty = 0;
      for (let i = 0; i < map.width * map.height; i++) if ((map.lowerTiles[i] ?? -1) < 0) empty++;
      const pct = Math.round((empty / (map.width * map.height)) * 100);
      checks.push({ id: "void", mapId, ok: pct <= 15, detail: `아무것도 안 깔린 칸 ${pct}%(기준 15%)` });
    }
  }
  return checks;
}

export function summarizeChecks(checks: readonly MachineCheck[]): string {
  const bad = checks.filter((c) => !c.ok);
  return bad.length ? `기계 검사 ${checks.length - bad.length}/${checks.length} 통과 — 문제: ${bad.map((c) => `[${c.id}] ${c.detail}`).join(" / ").slice(0, 900)}` : `기계 검사 ${checks.length}개 모두 통과`;
}

/** 플레이어 시작 칸이 이 맵의 큰 덩이(걸어서 이어진 가장 넓은 땅)에 있지 않으면 그 덩이의 아래 가운데에 가까운 칸으로 옮긴다.
 * 마을 도구는 시작 칸을 옮기지 않는다 — 빈 프로젝트의 기본 시작 칸이 지붕 옆 막힌 틈에 남았다(2026-10-23 v2 연기 시험: 닿는 칸 5%). */
export function fixPlayerStart(project: Project, mapIds: readonly string[]): { project: Project; note?: string } {
  const map = project.maps[project.startMapId];
  if (!map || !mapIds.includes(map.id)) return { project };
  const seen = new Uint8Array(map.width * map.height);
  let best: number[] = [];
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || !isPassable(project, map, i % map.width, Math.floor(i / map.width))) continue;
    const reach = terrainReachability(project, map, { x: i % map.width, y: Math.floor(i / map.width) });
    const cells: number[] = [];
    for (let j = 0; j < reach.length; j++) if (reach[j]) { cells.push(j); seen[j] = 1; }
    seen[i] = 1;
    if (cells.length > best.length) best = cells;
    if (best.length > seen.length / 2) break;
  }
  const s = project.startPos;
  if (!best.length || best.includes(s.y * map.width + s.x)) return { project };
  const tx = map.width / 2, ty = map.height - 1;
  const pick = best.reduce((a, b) => (Math.hypot(b % map.width - tx, Math.floor(b / map.width) - ty) < Math.hypot(a % map.width - tx, Math.floor(a / map.width) - ty) ? b : a));
  const startPos = { ...s, x: pick % map.width, y: Math.floor(pick / map.width) };
  return { project: { ...project, startPos }, note: `시작 칸 (${s.x},${s.y})이 막힌 틈이라 큰 땅의 (${startPos.x},${startPos.y})로 옮겼다` };
}
