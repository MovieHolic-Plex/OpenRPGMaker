import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent } from "@/project/types";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { crossMapVerification } from "./fixtures/verificationOwnership";

describe("run_scene_test", () => {
  it("cross-map reused event IDs and identical final map cannot discharge mapA using mapB", () => {
    const f = crossMapVerification();
    const evidence = new ToolVerificationEvidence();
    const acceptance = new AssistantAcceptanceLedger("cross-map", "Frozen route", f.project);
    acceptance.adopt([{ id: "size", title: "Map", criteria: [{ kind: "mapDimensions", target: { mapId: f.root.id }, width: f.root.width, height: f.root.height }] }]);
    const failed = runTool({ project: f.project }, "run_scene_test", { ...f.a });
    const passed = runTool({ project: f.project }, "run_scene_test", { ...f.b });
    expect(failed).toMatchObject({ ok: true, data: { ok: false, finalState: { mapId: f.root.id }, interactions: [
      { stepIndex: 0, mapId: f.root.id, eventId: "doorA" }, { stepIndex: 2, mapId: "mapA", eventId: "shared_npc" },
      { stepIndex: 3, mapId: "mapA", eventId: "exit" },
    ] } });
    expect(passed).toMatchObject({ ok: true, data: { ok: true, finalState: { mapId: f.root.id } } });
    evidence.adopt({ checkId: "routeA", ownerId: "accepted", name: "run_scene_test", args: { ...f.a },
      interactionTargets: [{ stepIndex: 2, mapId: "mapA", eventId: "shared_npc" }] });
    evidence.observe("run_scene_test", { ...f.a }, failed);
    evidence.observe("run_scene_test", { ...f.b }, passed);
    expect(evidence.correction("routeA", f.b)).toBeNull();
    expect(acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status).toBe("blocked");
    // Even the same input must not alias after a project edit reroutes the transfer.
    f.root.events[0]!.pages![0]!.commands = [{ kind: "transfer", mapId: "mapB", x: 2, y: 2 }];
    const rerouted = runTool({ project: f.project }, "run_scene_test", { ...f.a });
    expect(rerouted).toMatchObject({ ok: true, data: { ok: true } });
    evidence.observe("run_scene_test", { ...f.a }, rerouted, "explicit", "accepted", "routeA");
    expect(evidence.snapshot().requirements[0]?.status).toBe("unverified");
    expect(evidence.snapshot().findings).toHaveLength(1);
    expect(acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status).toBe("blocked");
  });

  it("missing early-interaction trace is not evidence for changed navigation or facing", () => {
    const f = crossMapVerification();
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_scene_test", { ...f.a }, { ok: true, data: { ok: false } });
    const id = evidence.snapshot().findings[0]!.checkId;
    const args = { ...f.a, steps: [{ kind: "face", dir: "down" }, ...f.a.steps] };
    expect(evidence.correction(id, args)).toBeNull();
    evidence.observe("run_scene_test", args, { ok: true, data: { ok: true } });
    expect(evidence.snapshot().findings).toHaveLength(1);
  });
  it("executes the existing choice cancellation branch for index minus one", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    project.switches.push({ id: "sw_cancelled", name: "Cancelled" });
    map.events.push({
      id: "ev_cancel_choice", x: 2, y: 3, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: "cancel-page", name: "Cancel choice", conditions: [], graphic: { transparent: true },
        trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{
          kind: "choices", options: [{ text: "Continue", branch: [] }],
          cancelBehavior: "branch",
          cancelBranch: [{ kind: "setSwitch", switchId: "sw_cancelled", value: true }],
        }],
      }],
    });

    const result = runSceneTest(project, {
      mapId: map.id, start: { x: 2, y: 2 },
      steps: [{ kind: "interact" }, { kind: "choose", index: -1 }, { kind: "expect", switchOn: "sw_cancelled" }],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.finalState.switchesOn).toContain("sw_cancelled");
  });

  it("accepts structurally compatible start points from existing scene callers", () => {
    const project = createBlankProject();
    const start = { x: 2, y: 2, dir: "right" };
    const result = runSceneTest(project, { mapId: project.startMapId, start,
      steps: [{ kind: "expect", playerAt: { x: 2, y: 2 } }] });
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("preflights direct runner scripts before autoruns or earlier valid steps", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.events.push({ id: "autorun", x: 1, y: 1, trigger: { kind: "auto" },
      commands: [{ kind: "setSwitch", switchId: "auto_ran", value: true }] });
    const result = runSceneTest(project, {
      mapId: map.id, start: { x: 2, y: 2 },
      steps: [{ kind: "set", switches: { earlier_ran: true } }, { kind: "wait", ticks: -1 }],
    });
    expect(result.ok).toBe(false);
    expect(result.stepsRun).toBe(0);
    expect(result.finalState.switchesOn).not.toContain("earlier_ran");
    expect(result.finalState.switchesOn).not.toContain("auto_ran");
  });

  it.each([
    { kind: "move", dir: "north" },
    { kind: "move", direction: "right" },
    { kind: "move", dir: "right", to: { x: 3, y: 2 } },
    { kind: "move", to: { x: 1.5, y: 2 } },
    { kind: "wait", ticks: -1 },
    { kind: "choose", index: -2 },
    { kind: "expect", enemyDefeated: true },
    { kind: "attack" },
  ])("rejects malformed steps before executing an earlier valid step: %j", malformed => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const result = runTool({ project }, "run_scene_test", {
      mapId, start: { x: 2, y: 2 }, steps: [{ kind: "move", dir: "right" }, malformed],
    });
    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it("walks every intermediate tile and executes player-touch events instead of jumping to the target", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    project.switches.push({ id: "sw_walk_touch", name: "Walk touch" });
    map.events.push({
      id: "ev_walk_touch",
      x: 3,
      y: 2,
      trigger: { kind: "playerTouch" },
      commands: [],
      pages: [{
        id: "page_walk_touch",
        name: "Intermediate touch",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "setSwitch", switchId: "sw_walk_touch", value: true }],
      }],
    });

    const result = runSceneTest(project, {
      mapId: map.id,
      start: { x: 2, y: 2 },
      steps: [
        { kind: "walk", to: { x: 4, y: 2 } } as SceneStep,
        { kind: "expect", switchOn: "sw_walk_touch", playerAt: { x: 4, y: 2 } },
      ],
    });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
  });

  it("validates an interaction switch and a ticked camera pan", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    project.switches.push({ id: "sw_scene_camera", name: "Scene Camera" });
    const event: GameEvent = {
      id: "ev_scene_camera",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "page_scene_camera",
          name: "Camera cue",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            { kind: "setSwitch", switchId: "sw_scene_camera", value: true },
            {
              kind: "m2Command",
              commandId: "m2-201-camera-control",
              fields: { mode: "panTo", target: "screen", x: 4, y: 5, durationMs: 32, wait: false },
            },
          ],
        },
      ],
    };
    map.events.push(event);

    const result = runTool(
      { project },
      "run_scene_test",
      {
        mapId: map.id,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "interact" },
          { kind: "expect", switchOn: "sw_scene_camera" },
          { kind: "wait", ticks: 2 },
          {
            kind: "expect",
            cameraAt: { cx: characterSpriteX(4), cy: characterSpriteY(5), tolerance: 0.001 },
          },
        ],
      }
    );

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("scene test 성공");
    expect(result.data).toMatchObject({
      ok: true,
      finalState: {
        x: 2,
        y: 2,
        spawnedCount: 0,
      },
    });
  });
});
