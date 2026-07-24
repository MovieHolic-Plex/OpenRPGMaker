import { describe, expect, it } from "vitest";
import { DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import type { SceneStep } from "@/testing/sceneTestRunner";
import { battle, editorProject, firstMapId, referenceIssues, scene, updateDatabaseRecord } from "./parityRig";

describe("parity rig", () => {
  it("drives a real editor mutation through a serialize/deserialize round-trip", () => {
    const project = editorProject(() => updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { power: 77 }));

    const skill = project.database.skills.find((record) => record.id === DEFAULT_SKILL_ID);
    expect(skill?.power).toBe(77);
    expect(referenceIssues(project)).toEqual([]);
  });

  it("runs a seeded battle deterministically (two runs identical)", () => {
    const project = editorProject(() => {});

    const a = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 5 });
    const b = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 5 });

    expect(a.winRate).toBe(b.winRate);
    expect(a.avgTurns).toBe(b.avgTurns);
    expect(a.samples).toBe(b.samples);
    expect(a.samples).toBeGreaterThan(0);
  });

  it("propagates mutator errors instead of returning a stale project", () => {
    expect(() =>
      editorProject(() => {
        throw new Error("boom");
      })
    ).toThrowError("boom");
  });

  it("exposes the headless scene harness on the blank start map", () => {
    const project = editorProject(() => {});
    const steps: SceneStep[] = [{ kind: "wait", ticks: 1 }];

    const result = scene(project, { mapId: firstMapId(project), start: { x: 2, y: 2 }, steps });

    expect(result.totalSteps).toBe(1);
    expect(result.ok).toBe(true);
  });
});
