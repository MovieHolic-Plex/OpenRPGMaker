/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  actionCombatProjectFingerprint,
  isVerifiedActionCombatProof,
} from "@/testing/actionCombatProof";
import { runActionCombatTest } from "@/editor/actionCombatRuntimeProbe";

describe("runtime-owned action proof", () => {
  it("rejects missing and model-forged receipts even with all claimed outcomes", () => {
    const project = createBlankProject();
    expect(isVerifiedActionCombatProof(undefined, project, project.startMapId)).toBe(false);
    expect(isVerifiedActionCombatProof({
      version: 1, status: "verified", pass: true,
      projectFingerprint: actionCombatProjectFingerprint(project),
      mapId: project.startMapId, scenarioId: "action-combat-v1", runId: "forged",
      observations: ["swing-hit", "enemy-defeat", "player-damage", "dodge-rejection",
        "stamina-spent", "stamina-recovered", "enemy-projectile", "reward-granted"]
        .map((outcome, sequence) => ({ outcome, sequence, mapId: project.startMapId, before: 1, after: 0 })),
    }, project, project.startMapId)).toBe(false);
  });

  it("binds fingerprints to authored content, not object identity or key order", () => {
    const project = createBlankProject();
    const clone = JSON.parse(JSON.stringify(project));
    expect(actionCombatProjectFingerprint(clone)).toBe(actionCombatProjectFingerprint(project));
    clone.meta.title += " changed";
    expect(actionCombatProjectFingerprint(clone)).not.toBe(actionCombatProjectFingerprint(project));
  });

  it("returns cancelled without creating a player or accepting any evidence", async () => {
    const project = createBlankProject();
    const controller = new AbortController();
    controller.abort();
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId, signal: controller.signal });
    expect(receipt.status).toBe("cancelled");
    expect(receipt.pass).toBe(false);
    expect(receipt.observations).toEqual([]);
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(false);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("does not verify an unavailable or wrong-map run", async () => {
    const project = createBlankProject();
    const receipt = await runActionCombatTest(project, { mapId: "absent" });
    expect(receipt.status).toBe("unverified");
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(false);
    project.meta.title += " stale";
    expect(isVerifiedActionCombatProof(receipt, project, "absent")).toBe(false);
  });
});
