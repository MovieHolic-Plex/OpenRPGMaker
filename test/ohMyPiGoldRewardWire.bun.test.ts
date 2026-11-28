import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { PLAY_TOOLS } from "../src/editor/tools/playTools.ts";
import { runTool } from "../src/editor/tools/index.ts";
import { createBlankProject } from "../src/project/defaults.ts";

describe("goldDelta at the @earendil-works/pi-ai tool validation and native scene boundaries", () => {
  test("preserves exact and atLeast currency values and executes scene test cleanly", () => {
    const tool = PLAY_TOOLS.find(entry => entry.name === "run_scene_test");
    if (!tool) throw new Error("Missing scene tool");
    const project = createBlankProject();
    project.session.gold = 37;
    project.maps[project.startMapId].events = [{
      id: "chief", name: "Chief", x: 2, y: 3, trigger: { kind: "action" }, commands: [{
        kind: "fork", condition: { kind: "selfSwitch", key: "A", value: false }, then: [
          { kind: "changeGold", op: "+=", amount: 20 }, { kind: "setSelfSwitch", key: "A", value: true },
        ],
      }],
    }];
    const argsFor = (first: unknown, repeat: unknown) => ({
      mapId: project.startMapId, start: { x: 2, y: 2 }, steps: [
        { kind: "snapshotRewards" }, { kind: "interact", eventId: "chief" },
        { kind: "expect", goldDelta: first, inventoryDelta: { gold: 0 }, interactionComplete: true },
        { kind: "snapshotRewards" }, { kind: "interact", eventId: "chief" },
        { kind: "expect", goldDelta: repeat, inventoryDelta: { gold: 0 }, interactionComplete: true },
      ],
    });
    for (const args of [argsFor(20, 0), argsFor({ atLeast: 15 }, 0)]) {
      const validated = validateToolArguments(tool as never, { type: "toolCall", id: "c1", name: tool.name, arguments: args } as never);
      const result = runTool({ project }, tool.name, validated);
      assert.equal(result.ok, true, result.summary);
      assert.equal((result.data as { ok?: boolean })?.ok, true);
    }
  });
});
