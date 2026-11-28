import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { PLAY_TOOLS } from "../src/editor/tools/playTools.ts";
import { runTool } from "../src/editor/tools/index.ts";
import { isSceneTestInput } from "../src/testing/sceneTestRunner.ts";
import { createBlankProject } from "../src/project/defaults.ts";

describe("endingReached tool validation and native scene agreement", () => {
  test("carries a nonempty ending ID, never a boolean", () => {
    const tool = PLAY_TOOLS.find(entry => entry.name === "run_scene_test");
    if (!tool) throw new Error("Missing scene tool");
    const project = createBlankProject();
    project.endings = [{ id: "ending_escape", name: "Escape", conditions: [], priority: 1 }];
    project.maps[project.startMapId].events = [{ id: "exit", name: "Exit", x: 2, y: 3, trigger: { kind: "action" },
      commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] }];

    const validArgs = {
      mapId: project.startMapId, start: { x: 2, y: 2 },
      steps: [{ kind: "interact", eventId: "exit" }, { kind: "expect", endingReached: "ending_escape" }],
    };
    const validated = validateToolArguments(tool as never, { type: "toolCall", id: "c1", name: tool.name, arguments: validArgs } as never);
    assert.equal(isSceneTestInput(validated), true);
    const result = runTool({ project }, tool.name, validated);
    assert.equal(result.ok, true, result.summary);
    assert.equal((result.data as { ok?: boolean })?.ok, true);

    for (const invalid of [true, "", "   "]) {
      const badArgs = {
        mapId: project.startMapId, start: { x: 2, y: 2 },
        steps: [{ kind: "interact", eventId: "exit" }, { kind: "expect", endingReached: invalid }],
      };
      assert.equal(isSceneTestInput(badArgs), false);
    }
  });
});
