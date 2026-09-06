import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ACCEPTANCE_TOOLS } from "@/ai/assistantAcceptanceTools";
import { WORK_PLAN_TOOLS } from "@/ai/assistantSession";
import { ACCEPTANCE_EXAMPLES, acceptanceRecord, parseAcceptanceCriteria } from "@/ai/assistantAcceptance";

function record(value: unknown): Record<string, unknown> {
  if (!acceptanceRecord(value)) throw new Error("Expected a schema object");
  return value;
}

describe("acceptance at the installed Antigravity schema boundary", () => {
  it("retains every scoped canonical shape and selector through Google then CCA normalization", () => {
    // Execute the installed provider's actual two normalization stages in its Bun runtime.
    const input = [...WORK_PLAN_TOOLS.filter(tool => tool.function.name === "set_work_plan"), ...ACCEPTANCE_TOOLS];
    const result = spawnSync("bun", ["-e", `
      import {normalizeSchemaForGoogle, normalizeSchemaForCCA} from "./node_modules/@oh-my-pi/pi-ai/src/utils/schema/normalize.ts";
      const tools = await Bun.stdin.json();
      console.log(JSON.stringify(tools.map(tool => ({name: tool.function.name,
        parameters: normalizeSchemaForCCA(normalizeSchemaForGoogle(tool.function.parameters))}))));
    `], { cwd: process.cwd(), input: JSON.stringify(input), encoding: "utf8", timeout: 15000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const normalized: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(normalized)) throw new Error("Expected normalized tools");
    expect(normalized).toHaveLength(3);
    for (const entry of normalized) {
      const tool = record(entry);
      const properties = record(record(tool.parameters).properties);
      if (tool.name === "review_acceptance") {
        expect(record(properties.verdict).enum).toEqual(["pass", "fail"]);
        continue;
      }
      const criteria = tool.name === "set_work_plan"
        ? record(record(record(properties.acceptance).items).properties).criteria : properties.criteria;
      const item = record(record(criteria).items);
      expect(item.oneOf).toBeUndefined();
      const fields = record(item.properties);
      expect(Object.keys(fields)).toEqual(expect.arrayContaining(["kind", "target", "targets", "count", "from", "to"]));
      for (const selector of [fields.target, record(fields.targets).items]) {
        expect(Object.keys(record(record(selector).properties))).toEqual(["mapId", "newMapName"]);
        expect(record(selector).oneOf).toBeUndefined();
      }
      if (typeof item.description !== "string") throw new Error("Canonical shapes lost in provider transport");
      const shapes = record(JSON.parse(item.description.slice(item.description.indexOf("{"))));
      expect(shapes).toEqual(ACCEPTANCE_EXAMPLES);
      expect(parseAcceptanceCriteria(Object.values(shapes))).toHaveLength(7);
      expect(shapes.mapCount).toMatchObject({ count: 2, targets: [{ mapId: "map_id" }, { newMapName: "New map" }] });
      const duplicate = { kind: "mapCount", count: 1, targets: [{ mapId: "map_id", newMapName: "New map" }] };
      expect(parseAcceptanceCriteria([shapes.preserve, duplicate])).toBeNull();
    }
  });
});
