import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ToolContext } from "@/editor/tools/types";

beforeEach(() => {
  vi.unstubAllGlobals();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

describe("history tools", () => {
  it("revert_last_edit replaces the tool draft with the previous snapshot", () => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("첫 칠하기", mapId);
    store.update((project) => {
      project.maps[mapId].lowerTiles[0] = 111;
    });
    const previous = structuredClone(store.getCurrent());
    recordProjectSnapshot("둘째 칠하기", mapId);
    store.update((project) => {
      project.maps[mapId].lowerTiles[0] = 222;
    });

    const ctx: ToolContext = { project: store.getCurrent() };
    const result = runTool(ctx, "revert_last_edit", { steps: 1 }, { dryRun: false });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("둘째 칠하기");
    expect(result.diff?.tilesChanged).toBeGreaterThan(0);
    expect(ctx.project).toEqual(previous);
  });

  it("revert_last_edit reports an empty history without changing the draft", () => {
    const project = store.getCurrent();
    const ctx: ToolContext = { project };

    const result = runTool(ctx, "revert_last_edit", {}, { dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("되돌릴 이전 상태가 없습니다");
    expect(ctx.project).toBe(project);
  });

  it("list_edit_history returns labels filtered by map", () => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("현재 맵 편집", mapId);
    store.update((project) => {
      project.maps[mapId].lowerTiles[0] = 111;
    });
    recordProjectSnapshot("다른 맵 편집", "map_other");

    const ctx: ToolContext = { project: store.getCurrent() };
    const result = runTool(ctx, "list_edit_history", { mapId, limit: 5 });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toEqual({
      entries: [
        expect.objectContaining({ label: "현재 맵 편집", mapId }),
      ],
    });
  });
});
