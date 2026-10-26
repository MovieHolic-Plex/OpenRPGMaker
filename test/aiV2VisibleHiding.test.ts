import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { hidingSpots, requestedFeatureGaps } from "@/ai/v2/shipChecks";

const task = "학교 공포 게임 만들어 줘. 사물함에 숨을 수 있게.";
const withHiding = (graphic: Record<string, unknown>): Project => {
  const project = createBlankProject() as Project;
  const map = project.maps[project.startMapId]!;
  map.events = [{ id: "hide", x: 2, y: 2, pages: [{ id: "p", graphic, interaction: { kind: "hiding" }, movement: { type: "fixed" }, commands: [] }] } as never];
  return project;
};

describe("hiding spots must be visible (J81)", () => {
  it("a transparent hiding event on bare floor does not count as a hiding spot", () => {
    const project = withHiding({ transparent: true });
    expect(hidingSpots(project)[0]!.visible).toBe(false);
    expect(requestedFeatureGaps(project, task).map((b) => b.evidence.split(":")[0])).toEqual(["hiding"]);
  });
  it("a drawn hiding event counts", () => {
    const project = withHiding({ appearanceId: "locker" });
    expect(requestedFeatureGaps(project, task)).toEqual([]);
  });
});
