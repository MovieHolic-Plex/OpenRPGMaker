// "여기에 마을 깔아줘" = 사용자가 보고 있는 화면에 마을. bounds 생략 시 맵 전체를 재포장하던
// 기존 동작(측정: villageBuildArea 의 {0,0,w,h} 폴백)을 뷰포트 중심 사각형으로 좁힌다.
// 단언 seam: createAuthorVillageTool 의 build 의존성이 받는 args.bounds — 실제로 시공 범위가 되는 값.
import { afterEach, describe, expect, it } from "vitest";
import { createAuthorVillageTool } from "@/editor/tools/authorVillageTool";
import { viewportVillageBounds } from "@/editor/tools/authorVillageSupport";
import { setEditorMapViewport } from "@/editor/editorMapViewport";
import { buildVillageDomain, inspectVillageBuild, type VillageBuildDomainArgs } from "@/editor/tools/villageBuilder";
import { MIN_SIZE } from "@/editor/tools/village/constants";
import type { ToolResult } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import { createExistingProject, EXISTING_TARGET, runFacade } from "./authorVillageFacadeFixtures";

afterEach(() => {
  setEditorMapViewport(null);
});

/** build 의존성만 감싸 실제 시공을 그대로 돌리면서 bounds 를 기록한다. */
function runWithRecordedBounds(project: Project): {
  readonly result: ToolResult;
  readonly calls: readonly VillageBuildDomainArgs[];
} {
  const calls: VillageBuildDomainArgs[] = [];
  const tool = createAuthorVillageTool({
    build(draft, args) {
      calls.push(args);
      return buildVillageDomain(draft, args);
    },
    inspect: inspectVillageBuild,
  });
  const result = runFacade(project, {
    target: EXISTING_TARGET,
    houseCount: 2,
    countPolicy: "exact",
    seed: 7,
    interior: false,
  }, tool);
  return { result, calls };
}

function publishViewport(mapId: string, centerX: number, centerY: number): void {
  setEditorMapViewport({ mapId, centerX, centerY, x: centerX - 8, y: centerY - 8, w: 16, h: 16 });
}

describe("viewportVillageBounds", () => {
  it("뷰포트 중심을 최소 한 변(minSpan) 사각형의 가운데로 둔다", () => {
    expect(viewportVillageBounds({ mapId: "m1", centerX: 60, centerY: 40 }, { width: 200, height: 200 }, 20))
      .toEqual({ x: 50, y: 30, w: 20, h: 20 });
  });

  it("맵 모서리 근처 중심은 맵 안으로 밀어 넣는다", () => {
    expect(viewportVillageBounds({ mapId: "m1", centerX: 2, centerY: 2 }, { width: 200, height: 200 }, 20))
      .toEqual({ x: 0, y: 0, w: 20, h: 20 });
    expect(viewportVillageBounds({ mapId: "m1", centerX: 198, centerY: 199 }, { width: 200, height: 200 }, 20))
      .toEqual({ x: 180, y: 180, w: 20, h: 20 });
  });

  it("맵이 minSpan 보다 작으면 맵 크기로 줄인다", () => {
    expect(viewportVillageBounds({ mapId: "m1", centerX: 6, centerY: 6 }, { width: 12, height: 12 }, 20))
      .toEqual({ x: 0, y: 0, w: 12, h: 12 });
    expect(viewportVillageBounds({ mapId: "m1", centerX: 6, centerY: 40 }, { width: 12, height: 200 }, 20))
      .toEqual({ x: 0, y: 30, w: 12, h: 20 });
  });
});

describe("author_village + 뷰포트 bounds", () => {
  it("bounds 를 생략하면 사용자가 보던 화면 중심 사각형이 시공 범위가 된다", () => {
    const project = createExistingProject(50);
    const before = [...project.maps.map_existing.lowerTiles];
    publishViewport("map_existing", 34, 34);

    const { result, calls } = runWithRecordedBounds(project);

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].bounds).toEqual({ x: 24, y: 24, w: MIN_SIZE, h: MIN_SIZE });

    const map = project.maps.map_existing;
    const outside = [0, 10 * 50 + 10, 45 * 50 + 45];
    for (const index of outside) expect(map.lowerTiles[index]).toBe(before[index]);
    const changed = map.lowerTiles.filter((tile, index) => tile !== before[index]).length;
    expect(changed).toBeGreaterThan(0);
  });

  it("뷰포트 스냅샷이 없으면 기존 전체 재포장 동작이 그대로다", () => {
    const project = createExistingProject(50);
    const { result, calls } = runWithRecordedBounds(project);

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(calls[0].bounds).toBeUndefined();
    expect((result.diff?.warnings ?? []).some((entry) => entry.includes("bounds 를 생략해"))).toBe(true);
  });

  it("스냅샷이 다른 맵을 보고 있으면 뷰포트를 쓰지 않는다", () => {
    const project = createExistingProject(50);
    publishViewport("map_other", 34, 34);

    const { result, calls } = runWithRecordedBounds(project);

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(calls[0].bounds).toBeUndefined();
  });
});
