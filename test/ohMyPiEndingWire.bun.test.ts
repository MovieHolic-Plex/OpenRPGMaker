import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { completeProvider } from "../scripts/lib/ohMyPiPiAiRuntime.ts";
import { validateJsonSchemaValue } from "../node_modules/@oh-my-pi/pi-ai/src/utils/schema/json-schema-validator.ts";
import { PLAY_TOOLS } from "../src/editor/tools/playTools.ts";
import { runTool } from "../src/editor/tools/index.ts";
import { isSceneTestInput } from "../src/testing/sceneTestRunner.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { offlineFetch } from "./helpers/offlineFetch.ts";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected wire object");
  return value as Record<string, unknown>;
}
describe("endingReached emitted provider schema and native scene agreement", () => {
  for (const model of ["gemini-3.7-flash", "claude-opus-4-6"]) test(`${model} carries a nonempty ending ID, never a boolean`, async () => {
    assert.notEqual(process.env.RPG_ZZU_OH_MY_PI_TEST_STUB, "1");
    const tool = PLAY_TOOLS.find(entry => entry.name === "run_scene_test");
    if (!tool) throw new Error("Missing scene tool");
    const project = createBlankProject();
    project.endings = [{ id: "ending_escape", name: "Escape", conditions: [], priority: 1 }];
    project.maps[project.startMapId].events = [{ id: "exit", name: "Exit", x: 2, y: 3, trigger: { kind: "action" },
      commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] }];
    const calls = ["ending_escape", true, "", "   ", "not_the_ending"].map(endingReached => ({
      mapId: project.startMapId, start: { x: 2, y: 2 }, steps: [{ kind: "interact", eventId: "exit" }, { kind: "expect", endingReached }],
    }));
    let requests = 0;
    const completion = await completeProvider("google-antigravity", { model, messages: [{ role: "user", content: "OFFLINE_ENDING_SCHEMA" }],
      tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }],
    }, { apiKey: JSON.stringify({ token: "offline-ending-sentinel", projectId: "offline-project" }), fetch: offlineFetch(async (_input, init) => {
      requests++;
      const wire = record(JSON.parse(String(init?.body)));
      const groups = record(wire.request).tools;
      if (!Array.isArray(groups)) throw new Error("Missing wire tools");
      const declarations = record(groups[0]).functionDeclarations;
      if (!Array.isArray(declarations)) throw new Error("Missing function declarations");
      const declaration = record(declarations[0]);
      let field = declaration.parameters;
      for (const key of ["properties", "steps", "items", "properties", "endingReached"]) field = record(field)[key];
      const schema = record(field);
      assert.equal(String(schema.type).toLowerCase(), "string");
      let nativeField: unknown = tool.parameters;
      for (const key of ["properties", "steps", "items", "properties", "endingReached"]) nativeField = record(nativeField)[key];
      assert.equal(record(nativeField).minLength, 1);
      for (const [index, args] of calls.entries()) {
        // The installed Google normalizer spills unsupported minLength/pattern into
        // descriptions. The emitted STRING rejects boolean; native schema AND
        // scene input enforce nonempty IDs, independently of that lossy transport.
        assert.equal(validateJsonSchemaValue(declaration.parameters, args).success, index !== 1);
        assert.equal(validateJsonSchemaValue(tool.parameters, args).success, index === 0 || index === 4);
        assert.equal(isSceneTestInput(args), index === 0 || index === 4);
      }
      return new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: { role: "model", parts: calls.map((args, index) => ({
        functionCall: { id: `ending-${index}`, name: tool.name, args },
      })) }, finishReason: "STOP" }] } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    }) });
    assert.equal(requests, 1);
    const message = completion.completion.choices[0].message;
    if (!("tool_calls" in message) || !message.tool_calls) throw new Error("Missing SDK tool calls");
    const roundtripped = message.tool_calls.map(call => JSON.parse(call.function.arguments));
    assert.deepEqual(roundtripped, calls);
    const results = roundtripped.map(args => runTool({ project }, "run_scene_test", args));
    assert.equal(results[0].ok, true);
    assert.equal(record(results[0].data).ok, true);
    assert.deepEqual(record(record(results[0].data).finalState).endingsReached, ["ending_escape"]);
    for (const result of results.slice(1, 4)) assert.equal(result.ok, false);
    assert.equal(record(results[4].data).ok, false); // Never invent an ending to satisfy the assertion.
    console.info(JSON.stringify({ model, controlledFetches: requests, nativeAccepted: calls.map(isSceneTestInput),
      scenePassed: results.map(result => result.ok && record(result.data).ok === true) }));
  });
});
