import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent } from "@/project/types";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";

describe("run_scene_test", () => {
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
