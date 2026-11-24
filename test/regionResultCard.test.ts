import { describe, expect, it } from "vitest";
import { countRegionChanges, regionResultSummary } from "@/editor/regionResultCard";
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

  it("says nothing changed when the region is untouched", () => {
    expect(regionResultSummary(countRegionChanges(project(base), project(base), "m1", { x: 0, y: 0, width: 4, height: 3 }))).toBe("이 영역은 그대로");
  });
});
