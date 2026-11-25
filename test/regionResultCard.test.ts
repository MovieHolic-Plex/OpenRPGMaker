// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { closeRegionResultCard, countRegionChanges, regionResultSummary, regionTurnTouched, showRegionResultCardOnRegionMap } from "@/editor/regionResultCard";
import { editorState } from "@/editor/editorState";
import type { Project } from "@/project/types";

function project(lower: number[], events: { id: string; x: number; y: number }[] = []): Project {
  return { maps: { m1: { id: "m1", width: 4, height: 3, lowerTiles: lower, upperTiles: new Array(12).fill(0), events } } } as unknown as Project;
}

describe("region result card counts", () => {
  const base = new Array(12).fill(1);

  it("counts only changed cells inside the region", () => {
    const after = base.slice();
    after[0] = 5; // (0,0) inside
    after[5] = 5; // (1,1) inside
    after[11] = 5; // (3,2) outside
    const counts = countRegionChanges(project(base), project(after), "m1", { x: 0, y: 0, width: 2, height: 2 });
    expect(counts).toEqual({ cells: 2, events: 0 });
    expect(regionResultSummary(counts)).toBe("칸 2개 바뀜");
  });

  it("counts added, moved and removed events in the region", () => {
    const before = project(base, [{ id: "a", x: 0, y: 0 }, { id: "b", x: 1, y: 1 }, { id: "far", x: 3, y: 2 }]);
    const after = project(base, [{ id: "a", x: 1, y: 0 }, { id: "c", x: 0, y: 1 }, { id: "far", x: 3, y: 2 }]);
    const counts = countRegionChanges(before, after, "m1", { x: 0, y: 0, width: 2, height: 2 });
    expect(counts).toEqual({ cells: 0, events: 3 });
    expect(regionResultSummary(counts)).toBe("이벤트 3개 바뀜");
  });

  it("names maps the instruction created outside the region (shop interior)", () => {
    const before = project(base);
    const after = project(base.map((tile, i) => (i === 0 ? 9 : tile)));
    (after.maps as Record<string, unknown>).inner = { id: "inner", name: "도구점", width: 2, height: 2, lowerTiles: [0, 0, 0, 0], upperTiles: [0, 0, 0, 0], events: [] };
    const counts = countRegionChanges(before, after, "m1", { x: 0, y: 0, width: 2, height: 2 });
    expect(counts).toEqual({ cells: 1, events: 0, newMaps: ["도구점"] });
    expect(regionResultSummary(counts)).toBe("칸 1개 바뀜 · 새 맵 도구점");
  });

  it("shows the card for the region map even when the turn also made an interior", () => {
    const before = project(base);
    const after = project(base.map((tile, i) => (i === 0 ? 9 : tile)));
    (after.maps as Record<string, unknown>).inner = { id: "inner", name: "집", width: 2, height: 2, lowerTiles: [0, 0, 0, 0], upperTiles: [0, 0, 0, 0], events: [] };
    expect(regionTurnTouched(before, after, "m1", { x: 0, y: 0, width: 2, height: 2 })).toBe(true);
    expect(regionTurnTouched(before, project(base), "m1", { x: 0, y: 0, width: 2, height: 2 })).toBe(false);
    expect(regionTurnTouched(before, after, "gone", { x: 0, y: 0, width: 2, height: 2 })).toBe(false);
  });

  it("goes back to the region map when the turn left the view on the new interior, then shows the card there", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const before = project(base);
    const after = project(base.map((tile, i) => (i === 0 ? 9 : tile)));
    (after.maps as Record<string, unknown>).inner = { id: "inner", name: "도구점", width: 2, height: 2, lowerTiles: [0, 0, 0, 0], upperTiles: [0, 0, 0, 0], events: [] };
    const input = { mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 }, instruction: "여기 상점 만들어 줘", before, after, onUndo: () => {} };
    editorState.set({ currentMapId: "inner" });
    const opened: string[] = [];
    const card = showRegionResultCardOnRegionMap(input, (id) => { opened.push(id); editorState.set({ currentMapId: id }); return true; }, host);
    expect(opened).toEqual(["m1"]);
    expect(card?.querySelector("[data-testid=region-result-count]")?.textContent).toBe("칸 1개 바뀜 · 새 맵 도구점");
    closeRegionResultCard();
    editorState.set({ currentMapId: "inner" });
    expect(showRegionResultCardOnRegionMap(input, () => false, host)).toBeNull();
    host.remove();
  });

  it("says nothing changed when the region is untouched", () => {
    expect(regionResultSummary(countRegionChanges(project(base), project(base), "m1", { x: 0, y: 0, width: 4, height: 3 }))).toBe("이 영역은 그대로");
  });
});
