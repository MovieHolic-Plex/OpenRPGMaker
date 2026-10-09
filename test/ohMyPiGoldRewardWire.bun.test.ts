import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { completeProvider } from "../scripts/lib/ohMyPiPiAiRuntime.ts";
import { validateJsonSchemaValue } from "../node_modules/@oh-my-pi/pi-ai/src/utils/schema/json-schema-validator.ts";
import { PLAY_TOOLS } from "../src/editor/tools/playTools.ts";
import { runTool } from "../src/editor/tools/index.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { offlineFetch } from "./helpers/offlineFetch.ts";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected wire object");
  return value as Record<string, unknown>;
}
function fieldAt(schema: unknown, path: readonly string[]): Record<string, unknown> {
  let value = schema;
  for (const key of path) value = record(value)[key];
  return record(value);
}
const fieldPath = ["properties", "steps", "items", "properties", "goldDelta"];
const apiKey = JSON.stringify({ token: "offline-gold-sentinel", projectId: "offline-project" });

describe("goldDelta at the actual installed Antigravity wire and response boundaries", () => {
  for (const model of ["gemini-3.7-flash", "claude-opus-4-6"]) test(`${model} preserves exact and atLeast currency values without STRING defaulting`, async () => {
    assert.notEqual(process.env.OPRN_OH_MY_PI_TEST_STUB, "1");
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
    const calls = [argsFor(20, 0), argsFor({ atLeast: 1 }, { atLeast: 0 }), argsFor("20", "0")];
    const body = { model, messages: [{ role: "user", content: "OFFLINE_WIRE_TEST" }],
      tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }],
    };
    const before = JSON.stringify({ body, project });
    let requests = 0;
    let observedField: Record<string, unknown> | undefined;
    let observedModel: unknown;
    const completion = await completeProvider("google-antigravity", body, { apiKey, fetch: offlineFetch(async (_input, init) => {
      requests++;
      const wire = record(JSON.parse(String(init?.body)));
      observedModel = wire.model;
      const groups = record(wire.request).tools;
      if (!Array.isArray(groups)) throw new Error("Missing wire tools");
      const declarations = record(groups[0]).functionDeclarations;
      if (!Array.isArray(declarations) || declarations.length !== 1) throw new Error("Expected one declaration");
      const declaration = record(declarations[0]);
      assert.equal(declaration.name, "run_scene_test");
      assert.equal(declaration.parametersJsonSchema, undefined);
      observedField = fieldAt(declaration.parameters, fieldPath);
      // Validate machine-consumed values, not prompt/description wording. A STRING
      // default or a narrowed object schema would fail these checks before replay.
      for (const value of [20, 0, { atLeast: 1 }, { atLeast: 0 }]) {
        assert.equal(validateJsonSchemaValue(observedField, value).success, true);
      }
      for (const args of calls.slice(0, 2)) assert.equal(validateJsonSchemaValue(declaration.parameters, args).success, true);
      return new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: {
        role: "model", parts: calls.map((args, index) => ({ functionCall: { id: `gold-${index}`, name: tool.name, args } })),
      }, finishReason: "STOP" }] } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    }) });
    assert.equal(requests, 1);
    const message = completion.completion.choices[0].message;
    if (!("tool_calls" in message) || !message.tool_calls) throw new Error("Missing SDK tool calls");
    const roundtripped = message.tool_calls.map(call => JSON.parse(call.function.arguments));
    assert.deepEqual(roundtripped, calls);
    const results = roundtripped.map(args => runTool({ project }, "run_scene_test", args));
    for (const result of results.slice(0, 2)) {
      assert.equal(result.ok, true);
      assert.equal(record(result.data).ok, true);
      assert.equal(record(record(result.data).finalState).gold, 57);
    }
    assert.equal(results[2].ok, false); // Permissive wire does not weaken runtime validation.
    assert.equal(results[2].data, undefined);
    assert.equal(JSON.stringify({ body, project }), before);
    console.info(JSON.stringify({ requestedModel: model, wireModel: observedModel, normalizedGoldDelta: observedField,
      roundtripValues: roundtripped.map(args => [args.steps[2].goldDelta, args.steps[5].goldDelta]),
      scenePassed: results.map(result => result.ok && record(result.data).ok === true), controlledFetches: requests }));
  });
});
