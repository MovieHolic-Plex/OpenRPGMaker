/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { callAgentModeTool, newAgentTurn } from "@/editor/agentMode/agentModeTools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

function firstMapId(project: Project): string {
  const id = Object.keys(project.maps)[0];
  if (!id) throw new Error("fixture project has no maps");
  return id;
}

function lowerTiles(): readonly number[] {
  const project = store.getCurrent();
  return project.maps[firstMapId(project)]!.lowerTiles;
}

describe("agent mode: one turn = one undo", () => {
  beforeEach(() => {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  it("undoes every write of a turn with a single undo, and keeps the previous turn", async () => {
    const mapId = firstMapId(store.getCurrent());
    const original = [...lowerTiles()];

    const first = newAgentTurn("첫 턴");
    const a = await callAgentModeTool("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, first);
    expect(a.isError).toBe(false);
    const afterFirstTurn = [...lowerTiles()];
    expect(afterFirstTurn).not.toEqual(original);

    const second = newAgentTurn("둘째 턴");
    const b = await callAgentModeTool("oprn_call", { name: "paint_tiles", args: { mapId, layer: "lower", mode: "cells", tile: 2, cells: [{ x: 3, y: 0 }] } }, second);
    const c = await callAgentModeTool("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 2, cells: [{ x: 5, y: 0 }] }, second);
    expect(b.isError).toBe(false);
    expect(c.isError).toBe(false);
    expect(lowerTiles()).not.toEqual(afterFirstTurn);

    expect(undoMapEdit()).toBe(true);
    expect([...lowerTiles()]).toEqual(afterFirstTurn);
    expect(undoMapEdit()).toBe(true);
    expect([...lowerTiles()]).toEqual(original);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("does not record history for read tools", async () => {
    const turn = newAgentTurn("읽기");
    const result = await callAgentModeTool("get_project_summary", {}, turn);
    expect(result.isError).toBe(false);
    expect(turn.recorded).toBe(false);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
});
