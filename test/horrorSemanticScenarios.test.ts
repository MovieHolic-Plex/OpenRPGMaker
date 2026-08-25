import { describe, expect, it } from "vitest";
import {
  createHorrorMysteryPrototypeProject,
  HORROR_MYSTERY_MAP_IDS,
  HORROR_MYSTERY_SWITCH_IDS,
} from "@/project/examples/horrorMysteryPrototype";
import type { GameMap, Project } from "@/project/types";
import { getSessionCheckpoint, hasSessionCheckpoint } from "@/player/checkpoints";
import { isPassable } from "@/project/collision";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { evaluateHorrorExperienceQa } from "@/testing/horrorExperienceQa";
import { createHorrorMysteryQaScenarios } from "@/testing/horrorMysteryQaPlan";

function transferExitEvent(map: GameMap, targetMapId: string): { x: number; y: number } {
  const event = map.events.find((candidate) =>
    (candidate.commands ?? []).some((cmd) => cmd.kind === "transfer" && cmd.mapId === targetMapId)
    || (candidate.pages ?? []).some((page) => page.commands.some((cmd) => cmd.kind === "transfer" && cmd.mapId === targetMapId)),
  );
  if (!event) throw new Error(`no transfer event to ${targetMapId} on ${map.id}`);
  return { x: event.x, y: event.y };
}

describe("horror scene-runner semantic scenario contracts", () => {
  it("CRITICAL-PATH-AUTHORING: forbids move-to jumps and set teleports", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const critical = createHorrorMysteryQaScenarios(project, manifest)
      .find((scenario) => scenario.role === "critical-path");
    expect(critical).toBeDefined();
    const navigation = critical!.input.steps as readonly Array<{ kind: string; to?: unknown }>;
    expect(navigation.some((step) => step.kind === "set")).toBe(false);
    expect(navigation.some((step) => step.kind === "move" && step.to !== undefined)).toBe(false);
    expect(navigation.some((step) => step.kind === "walk")).toBe(true);
  });

  it("LOCKED-GATE-FEEDBACK: exposes the locked message so a silent no-op cannot count as feedback", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const result = runSceneTest(project, {
      mapId: HORROR_MYSTERY_MAP_IDS.gallery,
      start: { x: manifest.gallery.itemGateAt.x, y: manifest.gallery.itemGateAt.y },
      steps: [{ kind: "interact" }],
    });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
    // The tool cabinet must have emitted its locked message to the runner-observable transcript.
    expect(result.finalState.messages.some((body) => body.includes("푸른 안료로 굳어"))).toBe(true);
  });

  it("WRONG-ANSWER-RECOVERY: a wrong sequence press resets progress and emits feedback rather than being ignored", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const [left] = manifest.gallery.sequenceAt;
    const result = runSceneTest(project, {
      mapId: HORROR_MYSTERY_MAP_IDS.gallery,
      start: { x: left!.x, y: left!.y },
      steps: [{ kind: "interact" }],
    });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
    // Wrong node press must (a) reset the sequence progress variable and (b) show a wrong-answer message.
    expect(result.finalState.variables["var_gallery_sequence_step"]).toBe(0);
    expect(result.finalState.messages.some((body) => body.includes("순서가 틀렸다"))).toBe(true);
  });

  it("CRITICAL-PATH: contiguous legal movement through actual transfers lands passable and keeps BGM active", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const [left, center, right] = manifest.gallery.sequenceAt;
    const galleryExit = transferExitEvent(project.maps[HORROR_MYSTERY_MAP_IDS.gallery]!, HORROR_MYSTERY_MAP_IDS.chase);

    const steps: SceneStep[] = [
      // Start at the true project start and execute every intermediate tile. Action events
      // stop adjacent; the transfer is fired by stepping onto its real exit tile.
      { kind: "walk", to: { x: manifest.gallery.keyAt.x, y: manifest.gallery.keyAt.y }, adjacent: true },
      { kind: "interact" },
      { kind: "walk", to: { x: manifest.gallery.itemGateAt.x, y: manifest.gallery.itemGateAt.y }, adjacent: true },
      { kind: "interact" },
      { kind: "walk", to: { x: center!.x, y: center!.y }, adjacent: true },
      { kind: "interact" },
      { kind: "walk", to: { x: left!.x, y: left!.y }, adjacent: true },
      { kind: "interact" },
      { kind: "walk", to: { x: right!.x, y: right!.y }, adjacent: true },
      { kind: "interact" },
      { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.sequenceSolved },
      { kind: "walk", to: { x: galleryExit.x, y: galleryExit.y } },
      { kind: "expect", mapId: HORROR_MYSTERY_MAP_IDS.chase },
    ];
    const result = runSceneTest(project, {
      mapId: project.startMapId,
      start: { x: project.startPos.x, y: project.startPos.y },
      steps,
    });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
    const chase = project.maps[HORROR_MYSTERY_MAP_IDS.chase]!;
    // The transfer landing tile must be passable.
    expect(isPassable(project, chase, result.finalState.x, result.finalState.y)).toBe(true);
    // Active BGM runtime state must reflect the entered map's custom resource id.
    expect(result.finalState.bgm).toBe("cc0-bgm-battle");
    // A checkpoint snapshot must have been captured at the actual post-transfer landing.
    expect(hasSessionCheckpoint(result.session)).toBe(true);
    expect(getSessionCheckpoint(result.session)?.session.currentMapId).toBe(HORROR_MYSTERY_MAP_IDS.chase);
  });

  it("AUDIO-RESOLUTION: a broken custom BGM resource id blocks the build", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject() as { project: Project; manifest: Parameters<typeof createHorrorMysteryQaScenarios>[1] };
    project.maps[HORROR_MYSTERY_MAP_IDS.finale]!.bgm = {
      mode: "custom",
      resourceId: "cc0-bgm-this-does-not-exist",
      fadeInMs: 500,
    };

    const report = evaluateHorrorExperienceQa(
      project,
      createHorrorMysteryQaScenarios(project, manifest),
    );

    expect(report.blockers).toContainEqual(expect.objectContaining({ id: "audio:unresolved-resource" }));
    expect(report.verdict).toBe("fail");
  });
});
