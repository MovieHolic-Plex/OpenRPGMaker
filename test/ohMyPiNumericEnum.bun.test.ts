import { describe, expect, test } from "bun:test";
import { completeProvider } from "../scripts/lib/ohMyPiPiAiRuntime.ts";
import { allTools, toOpenAiTools } from "../src/editor/tools/toolRegistry.ts";
import { WORK_PLAN_TOOLS } from "../src/ai/assistantSession.ts";
import { ACCEPTANCE_TOOLS } from "../src/ai/assistantAcceptanceTools.ts";
import capturedTools from "./fixtures/oh-my-pi/round4-tools.json";
import { offlineFetch } from "./helpers/offlineFetch.ts";

// The complete 48-tool execution receipt, plus live-corpus coverage. Only fetch
// is controlled: real adapter, SDK normalization, onPayload and response parser.
const apiKey = JSON.stringify({ token: "offline-enum-sentinel", projectId: "offline-project" });
const models = ["gemini-3.7-flash", "claude-opus-4-6"];
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
type SchemaNode = { type?: string; enum?: unknown[]; properties?: Record<string, SchemaNode>; items?: SchemaNode };
function numericEnumLeaves(value: unknown, path: string[] = []): { path: string[]; schema: SchemaNode }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const schema = value as SchemaNode;
  return [
    ...(schema.enum?.some(value => typeof value === "number") ? [{ path, schema }] : []),
    ...Object.entries(schema.properties ?? {}).flatMap(([key, child]) => numericEnumLeaves(child, [...path, "properties", key])),
    ...(schema.items ? numericEnumLeaves(schema.items, [...path, "items"]) : []),
  ];
}
function atPath(schema: SchemaNode, path: string[]): SchemaNode {
  let node: unknown = schema;
  for (const key of path) {
    if (!node || typeof node !== "object" || !(key in node)) throw new Error(`Missing wire schema ${path.join(".")}`);
    node = (node as Record<string, unknown>)[key];
  }
  return node as SchemaNode;
}
const responseCalls: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: "author_house", args: { kind: "single", mapId: "offline", stories: 2 } },
  { name: "author_house", args: { kind: "lots", mapId: "offline", houses: [{ stories: 3 }] } },
  { name: "start_interior_room_session", args: { exterior: { stories: 1 } } },
  { name: "run_interior_room_pipeline", args: { exterior: { stories: 2 } } },
];
function reply(calls: typeof responseCalls = []): Response {
  const parts = calls.length ? calls.map((call, index) => ({ functionCall: { id: `offline-${index}`, ...call } })) : [{ text: "READY" }];
  return new Response(`data: ${JSON.stringify({ response: { candidates: [
    { content: { role: "model", parts }, finishReason: "STOP" },
  ] } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
}
type Wire = {
  model: string;
  request: {
    contents: unknown[];
    tools?: { functionDeclarations: { name: string; parameters: SchemaNode }[] }[];
  };
};
const sparse = toOpenAiTools(allTools().filter(tool => tool.name === "upsert_autotile_group"));
const corpus = [...toOpenAiTools(allTools()), ...WORK_PLAN_TOOLS, ...ACCEPTANCE_TOOLS];

describe("numeric tool enums at the real Antigravity SDK wire boundary", () => {
  test("the captured set and full live registry cover all five numeric leaves", () => {
    expect(capturedTools).toHaveLength(48);
    const affected = allTools().filter(tool => numericEnumLeaves(tool.parameters as SchemaNode).length > 0);
    expect(affected.map(tool => tool.name)).toEqual([
      "author_house", "start_interior_room_session", "run_interior_room_pipeline", "upsert_autotile_group",
    ]);
    expect(affected.flatMap(tool => numericEnumLeaves(tool.parameters as SchemaNode))).toHaveLength(5);
    for (const tool of capturedTools) {
      for (const { path, schema } of numericEnumLeaves(tool.function.parameters)) {
        const live = atPath(affected.find(entry => entry.name === tool.function.name)!.parameters as SchemaNode, path);
        expect({ type: live.type, enum: live.enum }).toEqual({ type: schema.type, enum: schema.enum });
      }
    }
  });

  test("Opus text-only control reaches the real fetch and response parser", async () => {
    expect(process.env.OPRN_OH_MY_PI_TEST_STUB).not.toBe("1");
    let requests = 0;
    const result = await completeProvider("google-antigravity", {
      model: "claude-opus-4-6", messages: [{ role: "user", content: "READY" }],
    }, { apiKey, fetch: offlineFetch(async (_input, init) => {
      requests++;
      const wire = JSON.parse(String(init?.body)) as Wire;
      expect(wire.model).toBe("claude-opus-4-6-thinking");
      expect(wire.request.tools).toBeUndefined();
      return reply();
    }) });
    expect(requests).toBe(1);
    expect(result.completion.choices[0].message.content).toBe("READY");
  });

  for (const [label, tools] of [["captured48", capturedTools], ["captured48+sparse", [...capturedTools, ...sparse]], ["full-corpus", corpus]] as const) {
    test.each(models)(`${label}: preserves membership, numeric arguments and images on %s`, async (model: string) => {
      expect(process.env.OPRN_OH_MY_PI_TEST_STUB).not.toBe("1");
      const calls = label === "captured48" ? responseCalls : [...responseCalls,
        { name: "upsert_autotile_group", args: { group: { neighborhood: 8 } } }];
      const body = { model, tools, messages: [{ role: "user", content: [
        { type: "text", text: "READY" }, { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } },
      ] }] };
      const before = JSON.stringify(body);
      const registryBefore = JSON.stringify(allTools().map(tool => tool.parameters));
      let requests = 0;
      const result = await completeProvider("google-antigravity", body, { apiKey, fetch: offlineFetch(async (_input, init) => {
        requests++;
        const wire = JSON.parse(String(init?.body)) as Wire;
        expect(wire.model).toBe(model.startsWith("claude") ? "claude-opus-4-6-thinking" : "gemini-3.7-flash-low");
        const declarations = wire.request.tools![0].functionDeclarations;
        expect(declarations.map(declaration => declaration.name)).toEqual(tools.map(tool => tool.function.name));
        for (const declaration of declarations) {
          const tool = tools.find(entry => entry.function.name === declaration.name)!;
          for (const { path, schema } of numericEnumLeaves(tool.function.parameters)) {
            const node = atPath(declaration.parameters, path);
            expect(node.type?.toLowerCase()).toBe(schema.type);
            expect(node.enum).toEqual(schema.enum!.map(String));
          }
        }
        expect(declarations.find(tool => tool.name === "author_house")!.parameters.properties!.kind.enum).toEqual(["single", "lots"]);
        if (label === "full-corpus") {
          const criteria = declarations.find(tool => tool.name === "repair_acceptance")!.parameters.properties!.criteria.items!;
          expect(criteria.properties!.kind.enum).toContain("actionCombat");
          expect(Object.keys(criteria.properties!.target.properties!)).toEqual(["mapId", "newMapName"]);
          expect(declarations.find(tool => tool.name === "run_action_combat_test")!.parameters.properties!.mapId).toBeDefined();
          expect(declarations.find(tool => tool.name === "run_scene_test")!.parameters.properties!.steps.items!.properties!.inventoryDelta).toBeDefined();
        }
        expect(wire.request.contents).toEqual([{ role: "user", parts: [
          { text: "READY" }, { inlineData: { mimeType: "image/png", data: png } },
        ] }]);
        return reply(calls);
      }) });
      expect(requests).toBe(1);
      const message = result.completion.choices[0].message;
      if (!("tool_calls" in message) || !message.tool_calls) throw new Error("SDK did not return expected tool calls");
      expect(message.tool_calls.map(call => ({
        name: call.function.name, args: JSON.parse(call.function.arguments),
      }))).toEqual(calls);
      expect(result.completion).toMatchObject({ image_delivery: [{ messageIndex: 0, partIndex: 1 }] });
      expect(JSON.stringify(body)).toBe(before);
      expect(JSON.stringify(allTools().map(tool => tool.parameters))).toBe(registryBefore);
      console.info(`${label} ${model}: ${tools.length} declarations, numeric enums preserved, one controlled fetch`);
    });
  }

  test("Codex keeps native numeric enums, not CCA string encoding", async () => {
    let requests = 0;
    let outgoing: { input: { type: string; tools?: { parameters: SchemaNode }[] }[] } | undefined;
    await completeProvider("openai-codex", { messages: [{ role: "user", content: "READY" }], tools: [capturedTools[0]] }, {
      apiKey: "offline-codex", fetch: offlineFetch(async (_input, init) => {
        requests++;
        const text = init?.body instanceof Uint8Array ? new TextDecoder().decode(Bun.zstdDecompressSync(init.body)) : String(init?.body);
        outgoing = JSON.parse(text);
        return new Response(`data: ${JSON.stringify({ type: "response.completed", response: {
          id: "offline", status: "completed", output: [], usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 },
        } })}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
      }),
    });
    expect(requests).toBe(1);
    // The installed default Codex model uses Responses Lite's additional_tools item.
    const parameters = outgoing!.input.find(item => item.type === "additional_tools")!.tools![0].parameters;
    expect(parameters.properties!.stories.enum).toEqual([1, 2, 3]);
    expect(parameters.properties!.kind.enum).toEqual(["single", "lots"]);
  });
});
