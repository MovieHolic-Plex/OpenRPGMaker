// 출하 검사 「입구 그림 옆 맨바닥의 이벤트」(entrance-off-art)는 칩셋이 적어 둔 입구 그림만 입구로 본다 — 이름표의 「문」「구멍」「입구」 글자가 아니다.
// 2026-11-11 명세 은행(저장된 Terra 판을 모델 없이 다시 지음): 얼어붙은 호수의 이야기 이벤트와 길 끝 출구가 호숫가 「가문비」 옆이라고,
// 피라미드 길 끝 출구 셋이 「무너진 아치 문」 조각 옆이라고 출하가 막혔다. 출하 기본값(moveEntrancesOntoArt)은 같은 판정으로 그 이벤트를 그림 위로 옮긴다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { isDoorArtCell } from "@/project/staging/doorCells";
import type { GameEvent, Project } from "@/project/types";
import { offArtEntrances } from "@/ai/v2/judge/discoverability";
import { buildingEntrances, entranceArtCells } from "@/ai/v2/place/entrances";
import { moveEntrancesOntoArt } from "@/ai/v2/story/shipObjectiveDefaults";

type Ctx = { project: Project };
type Meta = { label?: string } | undefined;

function tileOf(project: Project, tilesetId: string, label: RegExp, pass?: boolean): number {
  const tileset = project.tilesets[tilesetId]!;
  const tile = (tileset.tileMeta as unknown as Meta[]).findIndex((m, t) => !!m?.label && label.test(m.label) && (pass === undefined || Object.values(tileset.passability[t] ?? {}).some(Boolean) === pass));
  expect(tile, `${tilesetId} ${label}`).toBeGreaterThanOrEqual(0);
  return tile;
}
/** 밟으면 다른 맵으로 가는 투명 이벤트 — 길 끝 출구·맨바닥 문. */
const exit = (id: string, x: number, y: number, to = "map_other"): GameEvent => ({
  id, name: "나가는 길", x, y, trigger: { kind: "playerTouch" }, commands: [],
  pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: to, x: 2, y: 2, direction: "down" }] }],
}) as unknown as GameEvent;
/** 한 가지 바닥을 깐 12×8 맵에 그림 타일과 이벤트를 놓는다 — lower 는 바닥층에 놓을 것(물). */
function flat(tilesetId: string, ground: RegExp, art: { upper?: readonly (readonly [number, number, RegExp])[]; lower?: readonly (readonly [number, number, RegExp])[] }, events: GameEvent[]): Project {
  const ctx: Ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: "map_t", name: "시험", width: 12, height: 8, tilesetId }).ok).toBe(true);
  expect(runTool(ctx, "create_map", { id: "map_other", name: "다른 곳", width: 8, height: 8, tilesetId }).ok).toBe(true);
  const map = structuredClone(ctx.project.maps.map_t!);
  const floor = tileOf(ctx.project, tilesetId, ground, true);
  for (let i = 0; i < map.width * map.height; i++) { (map.lowerTiles as number[])[i] = floor; (map.upperTiles as number[])[i] = -1; }
  for (const [x, y, label] of art.upper ?? []) (map.upperTiles as number[])[y * map.width + x] = tileOf(ctx.project, tilesetId, label);
  for (const [x, y, label] of art.lower ?? []) (map.lowerTiles as number[])[y * map.width + x] = tileOf(ctx.project, tilesetId, label);
  map.events = events;
  return { ...ctx.project, maps: { ...ctx.project.maps, map_t: map }, startMapId: "map_t", startPos: { x: 1, y: 6 } } as Project;
}

describe("entrance-off-art reads declared entrance art only", () => {
  it("a spruce by the lake is not an entrance — 「가문비」 has 「문」 in it", () => {
    const project = flat("snow_north", /^눈밭/u, { upper: [[5, 3, /^큰 가문비/u]] }, [exit("ev_road_end", 5, 4)]);
    // 이름표 낱말로 읽는 쪽(도구·런타임이 아직 쓰는 isDoorArtCell)은 이 나무를 문 그림으로 본다.
    expect(isDoorArtCell(project, project.maps.map_t!, 5, 3)).toBe(true);
    expect(entranceArtCells(project, project.maps.map_t!).size).toBe(0);
    expect(offArtEntrances(project)).toEqual([]);
    // 출하 기본값도 출구를 나무 위로 옮기지 않는다.
    expect(moveEntrancesOntoArt(project)).toEqual([]);
    expect(project.maps.map_t!.events[0]).toMatchObject({ x: 5, y: 4 });
  });

  it("open water in the ice (「얼음 구멍」) and a fallen arch piece (「무너진 아치 문」) are not entrances", () => {
    expect(offArtEntrances(flat("snow_north", /^눈밭/u, { lower: [[5, 3, /^얼음 구멍·여울/u]] }, [exit("ev_story", 5, 4)]))).toEqual([]);
    // 맵 가장자리의 길 끝 출구 두 칸 옆에 유적 조각.
    expect(offArtEntrances(flat("desert_east", /^모래/u, { upper: [[2, 4, /^무너진 아치 문/u]] }, [exit("ev_world_gate", 0, 4)]))).toEqual([]);
  });

  it("still names a door a building kit declares, and the ship default moves the event onto it", () => {
    const ctx: Ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_d", name: "바자르", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_d", kind: "bazaar", seed: 1 }).ok).toBe(true);
    const built = ctx.project.maps.map_d!;
    let start = { x: 0, y: 0 };
    for (let x = 0; x < built.width; x++) if (isPassable(ctx.project, built, x, built.height - 1)) { start = { x, y: built.height - 1 }; break; }
    // 지은 그대로는 짚을 것이 없다.
    expect(offArtEntrances({ ...ctx.project, startMapId: "map_d", startPos: start } as Project)).toEqual([]);
    const door = buildingEntrances(ctx.project, built).find((d) => isPassable(ctx.project, built, d.x + 1, d.y + 1) && !built.events.some((e) => Math.abs(e.x - d.x) <= 2 && Math.abs(e.y - d.y) <= 2))!;
    expect(door).toBeDefined();
    // 문 앞 칸의 옆 칸(맨바닥)에 선 투명 출입 이벤트.
    const map = { ...built, events: [...built.events, exit("ev_side", door.x + 1, door.y + 1, "map_inside")] };
    const project = { ...ctx.project, maps: { ...ctx.project.maps, map_d: map }, startMapId: "map_d", startPos: start } as Project;
    expect(offArtEntrances(project)).toMatchObject([{ eventId: "ev_side", door: { x: door.x, y: door.y } }]);
    expect(moveEntrancesOntoArt(project)).toHaveLength(1);
    const moved = project.maps.map_d!.events.find((e) => e.id === "ev_side")!;
    expect(moved).toMatchObject({ x: door.x, y: door.y });
    // 문 칸은 막힌 그림이라 부딪혀 열린다.
    expect(moved.pages![0]).toMatchObject({ priority: "same", overlapForbidden: true });
    expect(offArtEntrances(project)).toEqual([]);
  }, 60_000);

  it("still names stairs a room kit declares", () => {
    const ctx: Ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_t", name: "방", width: 14, height: 12, tilesetId: "jp_city" }).ok).toBe(true);
    const spec = roomSpecOf(ctx.project.tilesets.jp_city)!;
    const map = structuredClone(ctx.project.maps.map_t!);
    const floor = tileOf(ctx.project, "jp_city", /플로어 바닥$/u, true);
    for (let i = 0; i < map.width * map.height; i++) { (map.lowerTiles as number[])[i] = floor; (map.upperTiles as number[])[i] = -1; }
    for (const [dx, dy, tile] of spec.objects["stairs-up-wood"]!.cells) (map.upperTiles as number[])[(4 + dy!) * map.width + 9 + dx!] = tile!;
    map.events = [exit("ev_up", 8, 4, "map_upstairs")];
    const project = { ...ctx.project, maps: { ...ctx.project.maps, map_t: map }, startMapId: "map_t", startPos: { x: 1, y: 10 } } as Project;
    expect(offArtEntrances(project)).toMatchObject([{ eventId: "ev_up", door: { x: 9, y: 4 } }]);
  });
});
