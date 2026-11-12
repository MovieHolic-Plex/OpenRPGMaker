// 장면 검사(scene-transfer-off-door)의 「문 그림」은 부르는 쪽이 준 읽기로 본다 — 도구 실행기와 run_lint 는 칩셋이 적어 둔 입구(isEntranceArt)를 준다.
// 이름표 낱말로 읽던 때는 쓰기 도구마다 「가문비」 밑 출구에 «트리거를 문 칸 (나무 칸) 으로 옮겨라» 가 모델에게 갔다
// (2026-11-12 문 그림 읽기 × 테마 표의 scene-lint 줄: 설원 네 장에서 심은 16건 모두).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { lintScenePolish, newScenePolishIssues } from "@/project/lint/scenePolishLint";
import type { GameEvent, Project } from "@/project/types";
import { buildingEntrances, isEntranceArt } from "@/ai/v2/place/entrances";

type Ctx = { project: Project };
type Meta = { label?: string } | undefined;
const SLOW = 60_000;

function tileOf(project: Project, tilesetId: string, label: RegExp, pass?: boolean): number {
  const tileset = project.tilesets[tilesetId]!;
  const tile = (tileset.tileMeta as unknown as Meta[]).findIndex((m, t) => !!m?.label && label.test(m.label) && (pass === undefined || Object.values(tileset.passability[t] ?? {}).some(Boolean) === pass));
  expect(tile, `${tilesetId} ${label}`).toBeGreaterThanOrEqual(0);
  return tile;
}
/** 눈밭만 깐 12×8 맵 두 장 — map_t 의 (5,3) 에 가문비 한 그루. */
function spruceMap(): Ctx {
  const ctx: Ctx = { project: createBlankProject() };
  for (const id of ["map_t", "map_other"]) expect(runTool(ctx, "create_map", { id, name: id, width: 12, height: 8, tilesetId: "snow_north" }).ok).toBe(true);
  const floor = tileOf(ctx.project, "snow_north", /^눈밭/u, true);
  const maps = { ...ctx.project.maps };
  for (const id of ["map_t", "map_other"]) {
    const map = structuredClone(maps[id]!);
    for (let i = 0; i < map.width * map.height; i++) { (map.lowerTiles as number[])[i] = floor; (map.upperTiles as number[])[i] = -1; }
    if (id === "map_t") (map.upperTiles as number[])[3 * map.width + 5] = tileOf(ctx.project, "snow_north", /^큰 가문비/u);
    maps[id] = map;
  }
  ctx.project = { ...ctx.project, maps, startMapId: "map_t", startPos: { x: 1, y: 6 } } as Project;
  return ctx;
}
const exit = (id: string, x: number, y: number, to = "map_other"): GameEvent => ({
  id, name: "나가는 길", x, y, trigger: { kind: "playerTouch" }, commands: [],
  pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: to, x: 6, y: 6, direction: "down" }] }],
}) as unknown as GameEvent;
const withEvent = (project: Project, mapId: string, event: GameEvent): Project =>
  ({ ...project, maps: { ...project.maps, [mapId]: { ...project.maps[mapId]!, events: [...project.maps[mapId]!.events, event] } } }) as Project;
const offDoor = (issues: { code: string; message: string }[]): string[] => issues.filter((i) => i.code === "scene-transfer-off-door").map((i) => i.message);

describe("scene-transfer-off-door names a door cell only where the chipset declares one", () => {
  it("an exit under a spruce is not told to move onto the tree", () => {
    const { project } = spruceMap();
    const after = withEvent(project, "map_t", exit("ev_road_end", 5, 4));
    // 읽기를 안 주면 이름표 낱말(옛 동작 — 올린 시트용): 「가문비」가 문 그림이다.
    expect(offDoor(lintScenePolish(after)).join("\n")).toContain("문 칸 (5,3)");
    const declared = offDoor(newScenePolishIssues(project, after, { doorArt: isEntranceArt }));
    expect(declared.join("\n")).not.toContain("(5,3)");
    // 맵 한가운데 맨바닥의 출구라는 말은 그대로 한다.
    expect(declared).toHaveLength(1);
    expect(declared[0]).toContain("맨바닥");
  });

  it("the tool runner gives the declared reader: linking under a spruce warns about bare ground, not about the tree", () => {
    const ctx = spruceMap();
    const r = runTool(ctx, "create_transfer_pair", { a: { mapId: "map_t", x: 5, y: 4 }, b: { mapId: "map_other", x: 6, y: 6 } });
    expect(r.ok, r.summary).toBe(true);
    const warned = (r.diff?.warnings ?? []).join("\n");
    expect(warned).not.toContain("문 칸 (5,3)");
  });

  it("still tells an exit on the cell in front of a building's door to move onto the door", () => {
    const ctx: Ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_d", name: "바자르", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_other", name: "집 안", width: 12, height: 10, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_d", kind: "bazaar", seed: 1 }).ok).toBe(true);
    const built = ctx.project.maps.map_d!;
    const door = buildingEntrances(ctx.project, built).find((d) => !built.events.some((e) => Math.abs(e.x - d.x) <= 1 && Math.abs(e.y - d.y) <= 2))!;
    expect(door).toBeDefined();
    const after = withEvent(ctx.project, "map_d", exit("ev_front", door.front.x, door.front.y));
    expect(offDoor(newScenePolishIssues(ctx.project, after, { doorArt: isEntranceArt })).join("\n")).toContain(`문 칸 (${door.x},${door.y})`);
  }, SLOW);
});
