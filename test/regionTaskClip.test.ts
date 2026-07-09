import { describe, expect, it } from "vitest";
import { clearAgentGhostPreview, subscribeAgentGhostPreview, type AgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { clipMapCellsToRegion, type RegionRect } from "@/editor/regionTask/clipToRegion";
import { runRegionTask, type RegionTaskDeps } from "@/editor/regionTask/runRegionTask";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

const MAP_ID = "map_clip";
const W = 10;

function baseProject(width = W, height = W): Project {
  const context = { project: createBlankProject() };
  const result = runTool(context, "create_map", { id: MAP_ID, name: "클립 테스트", width, height });
  expect(result.ok, result.summary).toBe(true);
  return context.project;
}

function idx(x: number, y: number): number {
  return y * W + x;
}

const REGION: RegionRect = { x: 1, y: 1, width: 3, height: 3 }; // x,y ∈ {1,2,3}

describe("clipMapCellsToRegion", () => {
  it("영역 밖 lower/upper 변경을 base로 되돌리고 영역 안은 보존한다", () => {
    const base = baseProject();
    base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
    base.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(2, 2)] = 5; // 영역 안
    proposed.maps[MAP_ID].lowerTiles[idx(8, 8)] = 7; // 영역 밖
    proposed.maps[MAP_ID].upperTiles[idx(8, 7)] = 9; // 영역 밖

    const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

    expect(project.maps[MAP_ID].lowerTiles[idx(2, 2)]).toBe(5);
    expect(project.maps[MAP_ID].lowerTiles[idx(8, 8)]).toBe(TILE.EMPTY);
    expect(project.maps[MAP_ID].upperTiles[idx(8, 7)]).toBe(TILE.EMPTY);
    expect(clippedCells).toBe(2); // (8,8), (8,7)
  });

  it("영역 안 변경만 있으면 clippedCells=0이고 proposed를 그대로 반환한다", () => {
    const base = baseProject();
    base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(1, 1)] = 3;
    proposed.maps[MAP_ID].lowerTiles[idx(3, 3)] = 4;

    const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

    expect(clippedCells).toBe(0);
    expect(project).toBe(proposed); // 무클립 시 동일 참조
  });

  it("base를 변형하지 않는다(순수)", () => {
    const base = baseProject();
    base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
    const beforeLower = base.maps[MAP_ID].lowerTiles.slice();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].lowerTiles[idx(9, 9)] = 42;

    clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

    expect(base.maps[MAP_ID].lowerTiles).toEqual(beforeLower);
  });

  it("영역 밖 tileStacks도 base 상태로 복원한다", () => {
    const base = baseProject();
    base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].upperTileStacks = { [idx(9, 9)]: [1, 2], [idx(2, 2)]: [3] };

    const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

    // 영역 밖 (9,9) 스택은 제거(base엔 없음), 영역 안 (2,2) 스택은 보존.
    expect(project.maps[MAP_ID].upperTileStacks?.[idx(9, 9)]).toBeUndefined();
    expect(project.maps[MAP_ID].upperTileStacks?.[idx(2, 2)]).toEqual([3]);
    expect(clippedCells).toBe(1);
  });

  it("대상 맵의 비타일 필드와 다른 맵 변경은 통과시킨다", () => {
    const base = baseProject();
    base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
    const otherId = Object.keys(base.maps).find((id) => id !== MAP_ID);
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].name = "변경된 이름";
    proposed.maps[MAP_ID].lowerTiles[idx(8, 8)] = 7; // 클립 대상
    if (otherId) proposed.maps[otherId].lowerTiles[0] = 99;

    const { project } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

    expect(project.maps[MAP_ID].name).toBe("변경된 이름");
    expect(project.maps[MAP_ID].lowerTiles[idx(8, 8)]).toBe(TILE.EMPTY);
    if (otherId) expect(project.maps[otherId].lowerTiles[0]).toBe(99);
  });

  it("맵 크기가 다르면(리사이즈) 클립하지 않고 통과시킨다", () => {
    const base = baseProject();
    const proposed: Project = structuredClone(base);
    proposed.maps[MAP_ID].width = W + 2;
    proposed.maps[MAP_ID].lowerTiles = new Array((W + 2) * W).fill(3);

    const { project, clippedCells } = clipMapCellsToRegion(base, proposed, MAP_ID, REGION);

    expect(clippedCells).toBe(0);
    expect(project).toBe(proposed);
  });
});

describe("runRegionTask live ghost preview", () => {
  it("성공한 쓰기 tool_call 뒤 세션 draft diff 프리뷰를 발행하고 종료 시 clear한다", async () => {
    clearAgentGhostPreview();
    const base = baseProject();
    base.maps[MAP_ID].lowerTiles.fill(TILE.EMPTY);
    const draft: Project = structuredClone(base);
    draft.maps[MAP_ID].lowerTiles[idx(2, 2)] = 42;
    const seen: AgentGhostPreviewState[] = [];
    const unsubscribe = subscribeAgentGhostPreview((state) => seen.push(state));
    const deps: RegionTaskDeps = {
      getProject: () => base,
      applyProject: () => undefined,
      createSession: () => ({
        getProposedProject: () => draft,
        sendUserMessage: async (_message, onEvent) => {
          onEvent?.({
            type: "tool_call",
            name: "paint_tiles",
            args: { mapId: MAP_ID },
            result: { ok: true, summary: "타일 변경" },
          });
          return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
        },
      }),
    };

    const result = await runRegionTask({ mapId: MAP_ID, region: REGION, instruction: "칠해줘" }, deps);

    expect(result.ok).toBe(true);
    expect(seen.some((state) => state.previews.some((preview) =>
      preview.mapId === MAP_ID && preview.cells.some((cell) => cell.x === 2 && cell.y === 2 && cell.layer === "lower")
    ))).toBe(true);
    expect(seen.at(-1)?.previews).toEqual([]);
    unsubscribe();
  });
});
