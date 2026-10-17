// project/lint/campusDoorLint.ts
// 캠퍼스(modern_campus) 맵의 「죽은 문」 규칙을 projectLint 로 올린다. 판정 자체는 순수 함수 campusDoors.findCampusDeadDoors.
//  - campus-dead-door (error)   문 그림 아래 접근칸이 막혔거나 시작 칸에서 닿지 못한다 — 어디서든 틀린 문이다.
//  - campus-dead-door (error)   composer 가 짠 맵(건물 위치 표식 campus-building 이 있다)의 문 그림이 어디로도 이어지지 않는다.
//  - campus-dead-door (warning) 손으로 찍은 캠퍼스 맵의 문 그림이 아직 이어지지 않았다(건물을 찍은 뒤 이음 도구를 부르는 중간 상태를 막지 않는다).
import { campusPaletteFromTileset, type CampusKit } from "../campusComposer";
import { campusDoorTileIds, findCampusDeadDoors, isCampusTileset } from "../campusDoors";
import { isPassable } from "../collision";
import type { GameMap, Project } from "../types";
import type { LintIssue } from "./projectLint";

function kitsOf(def: { readonly structureKits?: readonly unknown[] }): CampusKit[] {
  const pal = campusPaletteFromTileset(def as Parameters<typeof campusPaletteFromTileset>[0]);
  const out: CampusKit[] = [];
  for (const raw of def.structureKits ?? []) {
    const id = (raw as { id?: unknown })?.id;
    const kit = typeof id === "string" ? pal.kit(id) : undefined;
    if (kit) out.push(kit);
  }
  return out;
}

/** 이 맵에 «들어오는 자리» — 시작 위치(이 맵이 시작 맵이면)와 다른 맵 이동 이벤트의 착지 칸. */
function entryAnchors(project: Project, map: GameMap): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (project.startMapId === map.id) out.push({ ...project.startPos });
  const seen = new Set<string>();
  const visit = (commands: unknown): void => {
    if (!Array.isArray(commands)) return;
    for (const raw of commands) {
      const c = raw as { kind?: unknown; mapId?: unknown; x?: unknown; y?: unknown; then?: unknown; else?: unknown };
      if (c?.kind === "transfer" && c.mapId === map.id && typeof c.x === "number" && typeof c.y === "number") {
        const key = `${c.x},${c.y}`;
        if (!seen.has(key)) { seen.add(key); out.push({ x: c.x, y: c.y }); }
      }
      visit(c?.then); visit(c?.else);
    }
  };
  for (const other of Object.values(project.maps)) {
    if (other.id === map.id) continue;
    for (const event of other.events ?? []) { visit(event.commands); for (const page of event.pages ?? []) visit(page.commands); }
  }
  return out;
}

export function checkCampusDoors(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    const def = project.tilesets[map.tilesetId];
    if (!isCampusTileset(def)) continue;
    const { bottom } = campusDoorTileIds(kitsOf(def!));
    if (bottom.size === 0) continue;
    const upper = map.upperTiles ?? [];
    // 문 그림 타일이 하나도 없으면 아래 BFS 는 필요 없다.
    if (!map.lowerTiles.some((id) => bottom.has(id)) && !upper.some((id) => bottom.has(id))) continue;
    const anchors = entryAnchors(project, map).filter((a) => a.x >= 0 && a.y >= 0 && a.x < map.width && a.y < map.height && isPassable(project, map, a.x, a.y));
    const seen = new Set<number>(anchors.map((a) => a.y * map.width + a.x));
    const queue = [...anchors];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx, ny = c.y + dy, k = ny * map.width + nx;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(k) || !isPassable(project, map, nx, ny)) continue;
        seen.add(k); queue.push({ x: nx, y: ny });
      }
    }
    const composed = (map.locations ?? []).some((l) => (l.tags ?? []).includes("campus-building"));
    const dead = findCampusDeadDoors({
      width: map.width, height: map.height, lowerTiles: map.lowerTiles, upperTiles: upper, events: map.events ?? [],
      doorBottomIds: bottom, passable: (x, y) => isPassable(project, map, x, y),
      reach: anchors.length ? (x, y) => seen.has(y * map.width + x) : null,
      mapExists: (id) => !!project.maps[id],
    });
    for (const d of dead) {
      issues.push({
        severity: d.reason === "no-exit-link" && !composed ? "warning" : "error",
        code: "campus-dead-door", mapId: map.id, x: d.x, y: d.y,
        message: `캠퍼스 ${map.name}: ${d.message}. link_campus_interior 로 실내에 잇거나, 안으로 이어지지 않는 문은 그리지 않는다(장식 문 금지).`,
      });
    }
  }
}
