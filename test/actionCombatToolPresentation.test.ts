import { expect, it } from "vitest";
import { aiActivityFamilySource } from "@/editor/aiActivityNarration";
import { toolGroup, toolIconKey } from "@/editor/panels/aiToolLabels";

it("classifies the action proof as an explicit inspection activity", () => {
  expect(toolGroup("run_action_combat_test")).toBe("inspect");
  expect(toolIconKey("run_action_combat_test")).toBe("shield");
  expect(aiActivityFamilySource("run_action_combat_test")).toBe("mapped");
});
