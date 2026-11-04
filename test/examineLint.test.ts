// 조사 이벤트 검사(scene-examine-*) — 2026-11-04 폴른 스타 월드 정비의 망원경·사당·수레.
import { describe, expect, it } from "vitest";
import { lintExamineEvents } from "@/ai/v2/examineLint";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { objectClusterAt } from "@/project/objectFootprint";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";

const examinePage = (): EventPage => ({
  id: "p", name: "살핀다", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
  overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "오래된 물건이다." }],
} as unknown as EventPage);

const examine = (id: string, x: number, y: number): GameEvent => ({ id, name: "물건", x, y, pages: [examinePage()] } as unknown as GameEvent);

function fixture(): { project: Project; map: GameMap; object: number; wall: number } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.events = [];
  project.startPos = { x: 1, y: 1 };
  const upper = (map as unknown as { upperTiles: number[] }).upperTiles;
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta: Array<{ label?: string } | undefined> }).tileMeta;
  const blockedSingle = (pattern: RegExp): number => meta.findIndex((m, t) => {
    if (!pattern.test(m?.label ?? "")) return false;
    const i = 5 * map.width + 5, old = upper[i]!;
    upper[i] = t;
    const ok = !isPassable(project, map, 5, 5) && objectClusterAt(project, map, 5, 5)?.cells.length === 1;
    upper[i] = old;
    return ok;
  });
  const object = blockedSingle(/· (우물|나무통|술통|궤짝|나무 상자|바위|그루터기)( |$|\()/u);
  expect(object, "막힌 1칸 기물 칸이 번들 칩셋에 있어야 한다").toBeGreaterThan(0);
  return { project, map, object, wall: object };
}

const codes = (project: Project): string[] => lintExamineEvents(project).map((issue) => `${issue.code}:${issue.eventId}`).sort();

describe("scene-examine-*", () => {
  it("열린 칸 옆 기물의 조사 하나는 조용하다", () => {
    const { project, map, object } = fixture();
    (map as unknown as { upperTiles: number[] }).upperTiles[5 * map.width + 5] = object;
    map.events.push(examine("ex_ok", 5, 5));
    expect(codes(project)).toEqual([]);
  });

  it("사방이 막힌 기물의 조사는 닿지 못한다고 한다", () => {
    const { project, map, object, wall } = fixture();
    const upper = (map as unknown as { upperTiles: number[] }).upperTiles;
    upper[5 * map.width + 5] = object;
    for (const [x, y] of [[4, 5], [6, 5], [5, 4], [5, 6]] as const) upper[y * map.width + x] = wall;
    map.events.push(examine("ex_sealed", 5, 5));
    expect(codes(project)).toContain("scene-examine-unreachable:ex_sealed");
  });

  it("이미 이벤트가 있는 물건에 조사를 하나 더 달면 겹친다고 한다", () => {
    const { project, map, object } = fixture();
    (map as unknown as { upperTiles: number[] }).upperTiles[5 * map.width + 5] = object;
    map.events.push(examine("ex_first", 5, 5), examine("ex_second", 5, 5));
    expect(codes(project)).toContain("scene-examine-duplicate:ex_second");
  });
});
