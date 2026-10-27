import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { applyMapLighting, litShotNote } from "@/ai/v2/vqaLighting";

const setup = (ambient: number) => {
  const project = createBlankProject() as Project;
  const map = project.maps[project.startMapId]!;
  map.defaultLighting = { ambient, sources: [{ id: "torch", at: { x: 1, y: 1 }, radius: 1 }] };
  const tile = 4, w = map.width * tile, h = map.height * tile;
  const rgba = new Uint8Array(w * h * 4).fill(200);
  return { project, map, rgba, w, h, tile };
};

describe("VQA map shots carry game lighting (J79 rerun)", () => {
  it("darkens the map by ambient and leaves the light centre bright", () => {
    const { project, map, rgba, w, h, tile } = setup(0.88);
    const lit = applyMapLighting(rgba, w, h, map, project);
    expect(lit.applied).toBe(true);
    const at = (x: number, y: number) => rgba[(y * w + x) * 4]!;
    expect(at(w - 1, h - 1)).toBe(Math.round(200 * 0.12));
    expect(at(Math.floor(1.5 * tile), Math.floor(1.5 * tile))).toBeGreaterThan(150);
    expect(litShotNote(lit)).toContain("어둠 0.88");
  });
  it("does nothing without darkness", () => {
    const { project, map, rgba, w, h } = setup(0);
    expect(applyMapLighting(rgba, w, h, map, project).applied).toBe(false);
    expect(rgba[0]).toBe(200);
  });
});
