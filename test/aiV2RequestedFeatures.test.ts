import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { REQUESTED_FEATURES, requestedFeatureGaps, shipBlockers } from "@/ai/v2/shipChecks";

const want = (text: string) => REQUESTED_FEATURES.filter((f) => f.words.test(text)).map((f) => f.id);

describe("requested feature coverage (J71/J73)", () => {
  it("reads chaser, darkness and hiding from a horror request", () => {
    expect(want("밤의 학교에서 쫓아오는 귀신을 피해 탈출하는 공포 게임. 복도는 캄캄하고 사물함에 숨을 수 있다")).toEqual(["chaser", "darkness", "hiding"]);
  });
  it("does not read them from look-alike words or negations", () => {
    expect(want("범인을 쫓는 탐정 게임. 숨어 있는 비밀을 찾는다. dark fantasy")).toEqual([]);
    expect(want("추격자 없이 퍼즐만 있는 게임")).toEqual([]);
  });
  it("blocks a whole game that lacks a requested chaser and darkness, and clears once built", () => {
    const project = createBlankProject() as Project;
    const task = "검은 장미 저택 공포 게임을 만들어 줘. 쫓아오는 것이 있고 어둡게.";
    expect(requestedFeatureGaps(project, task).map((b) => b.evidence.split(":")[0])).toEqual(["chaser", "darkness"]);
    expect(shipBlockers(project, task).some((b) => b.id === "requested-feature-missing")).toBe(true);
    const map = Object.values(project.maps)[0]!;
    map.defaultLighting = { ambient: 0.85, sources: [] };
    map.events = [{ id: "ghost", name: "그것", x: 1, y: 1, pages: [{ id: "p1", movement: { type: "chase" }, commands: [] }] } as never];
    expect(requestedFeatureGaps(project, task)).toEqual([]);
  });
  it("treats dim lighting under 0.5 as not dark", () => {
    const project = createBlankProject() as Project;
    Object.values(project.maps)[0]!.defaultLighting = { ambient: 0.2, sources: [] };
    expect(requestedFeatureGaps(project, "어두운 복도 게임 만들어 줘").map((b) => b.evidence.split(":")[0])).toEqual(["darkness"]);
  });
});
