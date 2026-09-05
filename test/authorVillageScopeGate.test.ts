// author_village 적대 리뷰(P0–P2) 회귀 게이트.
// - 살아 있는 기존 맵 전체 재포장 차단(village-requires-scope) + fullMap 확인 경로
// - 허용 맵 집합의 빌더 자기신고 독립 검증(미연결 맵 거부)
// - 스코프 비교의 키 순서 안정성
// - NPC 90% 하한(1~2명 어긋남 통과)
// - plannedMap 생략(new 타깃) 허용
// - 16×16 bounds 허용
import { describe, expect, it } from "vitest";
import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import { AUTHOR_VILLAGE_TOOL, createAuthorVillageTool } from "@/editor/tools/authorVillageTool";
import { runToolDefinition } from "@/editor/tools/toolRunner";
import type { ToolExecResult } from "@/editor/tools/types";
import type { VillageBuildInspection } from "@/editor/tools/villageBuilder";
import { TILE } from "@/project/defaults/constants";
import { serialize } from "@/project/io";
import {
  createExistingProject,
  EXISTING_TARGET,
  inspection,
  runFacade,
  stubTool,
} from "./authorVillageFacadeFixtures";

const BASE = {
  target: EXISTING_TARGET,
  houseCount: 4,
  countPolicy: "exact",
  seed: 7,
  interior: false,
};

function livedProject(): ReturnType<typeof createExistingProject> {
  const project = createExistingProject();
  // 손댄 맵으로 만든다 — 기본 GRASS가 아닌 타일 1칸.
  project.maps.map_existing.lowerTiles[10] = TILE.PATH;
  return project;
}

describe("author_village lived-map scope gate", () => {
  it("rejects full-map rebuild on a lived map without bounds or fullMap", () => {
    const project = livedProject();
    const before = serialize(project);
    const tool = stubTool(4);

    const context = { project };
    const result = runToolDefinition(context, tool, BASE);

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-requires-scope");
    expect(serialize(project)).toBe(before);
  });

  it("accepts the same rebuild with target.fullMap:true", () => {
    const project = livedProject();
    const tool = stubTool(4);
    const result = runToolDefinition({ project }, tool, {
      ...BASE,
      target: { ...EXISTING_TARGET, fullMap: true },
    });

    expect(result.ok, JSON.stringify(result.issues ?? [])).toBe(true);
  });

  it("accepts the same rebuild with top-level fullMap:true", () => {
    const project = livedProject();
    const tool = stubTool(4);
    const result = runToolDefinition({ project }, tool, { ...BASE, fullMap: true });

    expect(result.ok, JSON.stringify(result.issues ?? [])).toBe(true);
  });

  it("부분 bounds와 fullMap이 충돌하면 범위를 조용히 줄이거나 넓히지 않는다", () => {
    const project = livedProject();
    const before = serialize(project);
    const result = runToolDefinition({ project }, stubTool(4), {
      ...BASE, target: { ...EXISTING_TARGET, fullMap: true, bounds: { x: 0, y: 0, w: 20, h: 20 } },
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-scope-conflict");
    expect(serialize(project)).toBe(before);
  });

  it("still builds a full empty map without any confirm", () => {
    const project = createExistingProject();
    const result = runFacade(project, BASE, AUTHOR_VILLAGE_TOOL);
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
  });

  it("rejects an unlinked extra map even when the builder declares it", () => {
    const project = createExistingProject();
    const before = serialize(project);
    const tool = createAuthorVillageTool({
      build(draft): ToolExecResult {
        draft.maps.map_existing.lowerTiles[0] = TILE.PATH;
        // 빌더가 interiorMapIds에 넣지만 문 transfer가 가리키지 않는 미연결 맵.
        draft.maps.map_rogue = { ...structuredClone(draft.maps.map_existing), id: "map_rogue", name: "Rogue" };
        draft.mapTree.children.push({ mapId: "map_rogue", children: [] });
        return { summary: "stub village", data: { ok: true } };
      },
      inspect(): VillageBuildInspection {
        return { ...inspection(4), interiorMapIds: ["map_rogue"] };
      },
    });
    const result = runToolDefinition({ project }, tool, BASE);

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-scope-violation");
    expect(serialize(project)).toBe(before);
  });
});

describe("author_village postconditions and parser", () => {
  it("passes NPC count within the 90% lower bound", () => {
    const project = createExistingProject();
    const tool = createAuthorVillageTool({
      build(draft): ToolExecResult {
        draft.maps.map_existing.lowerTiles[0] = TILE.PATH;
        return { summary: "stub village", data: { ok: true } };
      },
      inspect(): VillageBuildInspection {
        return { ...inspection(4), npcCount: 9 };
      },
    });
    const result = runToolDefinition({ project }, tool, { ...BASE, npcCount: 10 });

    expect(result.ok, JSON.stringify(result.issues ?? [])).toBe(true);
  });

  it("fails NPC count below the 90% lower bound as failed, not blocked", () => {
    const project = createExistingProject();
    const tool = createAuthorVillageTool({
      build(draft): ToolExecResult {
        draft.maps.map_existing.lowerTiles[0] = TILE.PATH;
        return { summary: "stub village", data: { ok: true } };
      },
      inspect(): VillageBuildInspection {
        return { ...inspection(4), npcCount: 5 };
      },
    });
    const result = runToolDefinition({ project }, tool, { ...BASE, npcCount: 10 });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-population-shortfall");
  });

  it("accepts a new target without plannedMap", () => {
    const request = parseAuthorVillageRequest({
      target: { kind: "new", mapId: "map_fresh", name: "Fresh", width: 50, height: 50 },
      houseCount: 2,
      countPolicy: "exact",
    });
    expect(request.target).toMatchObject({
      kind: "new",
      mapId: "map_fresh",
      width: 50,
      height: 50,
      plannedMap: { mapId: "map_fresh", width: 50, height: 50 },
    });
  });

  it("accepts 16x16 bounds", () => {
    const request = parseAuthorVillageRequest({
      target: { kind: "existing", mapId: "m", bounds: { x: 0, y: 0, w: 16, h: 16 } },
      houseCount: 1,
      countPolicy: "exact",
    });
    expect(request.target).toMatchObject({
      kind: "existing",
      bounds: { x: 0, y: 0, w: 16, h: 16 },
    });
  });

  it("rejects 15x15 bounds", () => {
    expect(() =>
      parseAuthorVillageRequest({
        target: { kind: "existing", mapId: "m", bounds: { x: 0, y: 0, w: 15, h: 15 } },
        houseCount: 1,
        countPolicy: "exact",
      }),
    ).toThrow();
  });
});
