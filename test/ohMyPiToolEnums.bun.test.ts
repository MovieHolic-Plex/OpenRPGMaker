import { describe, expect, test } from "bun:test";
import { complete } from "@oh-my-pi/pi-ai";
import { getBundledModel } from "@oh-my-pi/pi-catalog";
import { buildRequest } from "@oh-my-pi/pi-ai/providers/google-gemini-cli";
import { antigravityToolEnumPayload, ToolSchemaTransportError } from "../scripts/lib/ohMyPiToolEnums.ts";
import { completeProvider } from "../scripts/lib/ohMyPiPiAiRuntime.ts";
import { allTools } from "../src/editor/tools/toolRegistry.ts";
import { offlineFetch } from "./helpers/offlineFetch.ts";

const apiKey = JSON.stringify({ token: "offline-enum", projectId: "offline-project" });
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const original = allTools().find(tool => tool.name === "upsert_autotile_group")!;
const tools = [{ name: original.name, description: original.description, parameters: { ...original.parameters } }];
function bundled(id: string) {
  return getBundledModel("google-antigravity", id)! as Parameters<typeof buildRequest>[0];
}
function context() {
  return { messages: [{ role: "user" as const, content: "READY", timestamp: 0 }], tools };
}
// Mutable JSON payload at the untyped SDK hook boundary, not a replacement serializer.
type Node = { type?: unknown; enum?: unknown; properties?: Record<string, Node>; items?: Node };
type Payload = { request: { tools: { functionDeclarations: { name?: string; parameters?: Node; parametersJsonSchema?: Node }[] }[] } };
function group(payload: unknown): Node {
  return (payload as Payload).request.tools[0].functionDeclarations[0].parameters!.properties!.group;
}

describe("post-normalization CCA enum preservation", () => {
  test.each(["claude-opus-4-6", "gemini-3.7-flash"])("changes only numeric enum arrays and is idempotent on %s", (id: string) => {
    const model = bundled(id);
    const sourceBefore = JSON.stringify(tools);
    const wire = buildRequest(model, context(), "offline-project", {}, true);
    const before = JSON.stringify(wire);
    const encode = antigravityToolEnumPayload(id, tools);
    const encoded = encode(wire);
    expect(group(encoded).properties!.neighborhood).toMatchObject({ type: "integer", enum: ["4", "8"] });
    const expected = structuredClone(wire);
    group(expected).properties!.neighborhood.enum = ["4", "8"];
    expect(encoded).toEqual(expected); // Only this machine-consumed field may differ.
    expect(encode(encoded)).toEqual(encoded);
    expect(JSON.stringify(wire)).toBe(before);
    expect(JSON.stringify(tools)).toBe(sourceBefore);
  });

  test("does not protobuf-encode parametersJsonSchema or instance data", () => {
    const wire = buildRequest(bundled("claude-opus-4-6"), context(), "offline-project", {}, true) as Payload;
    const declaration = wire.request.tools[0].functionDeclarations[0];
    declaration.parametersJsonSchema = declaration.parameters;
    delete declaration.parameters;
    const before = structuredClone(wire);
    expect(antigravityToolEnumPayload("claude-opus-4-6", tools)(wire)).toEqual(before);
    const literal = { type: "object", properties: { enum: { type: "string", enum: ["1", "2"] } },
      default: { type: "integer", enum: [1, 2] }, examples: [{ type: "integer", enum: [] }] };
    const payload = { request: { tools: [{ functionDeclarations: [{ name: "literal", parameters: literal }] }] } };
    expect(antigravityToolEnumPayload("claude-opus-4-6", [{ name: "literal", parameters: literal }])(payload)).toBe(payload);
  });

  test.each([
    { type: "integer", enum: [] }, { type: "integer", enum: [1, "2"] },
    { type: "integer", enum: [1, 1.5] }, { type: "integer", enum: [1, Number.MAX_SAFE_INTEGER + 1] },
    { type: "integer", enum: [1, true] }, { type: "integer", enum: [1, null] },
    { type: "integer", enum: [1, 1] }, { type: "number", enum: [1, 2] },
    { type: "string", enum: [1, 2] }, { type: ["integer", "null"], enum: [1, 2] },
    { type: "integer", enum: "1,2" },
  ])("rejects unsupported source numeric enum %j before fetch, without image acknowledgement", async (leaf) => {
    let fetches = 0;
    const body = { model: "claude-opus-4-6", messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } },
    ] }], tools: [{ type: "function", function: { name: "unsupported", parameters: {
      type: "object", properties: { stories: leaf },
    } } }] };
    await expect(completeProvider("google-antigravity", body, { apiKey, fetch: offlineFetch(async () => {
      fetches++; throw new Error("unexpected outbound fetch");
    }) })).rejects.toMatchObject({ status: 400, code: "tool-schema-transport", message: expect.stringContaining(
      "google-antigravity/claude-opus-4-6 tool=unsupported parameters.properties.stories",
    ) });
    expect(fetches).toBe(0);
  });

  test("a source path erased by real SDK combiner normalization fails before fetch", async () => {
    let fetches = 0;
    await expect(completeProvider("google-antigravity", {
      model: "claude-opus-4-6", messages: [{ role: "user", content: "READY" }],
      tools: [{ type: "function", function: { name: "collapsed", parameters: {
        type: "object", properties: { value: { anyOf: [{ type: "integer", enum: [4, 8] }] } },
      } } }],
    }, { apiKey, fetch: offlineFetch(async () => { fetches++; throw new Error("unexpected fetch"); }) })).rejects.toMatchObject({
      status: 400, message: expect.stringContaining("tool-schema-transport: google-antigravity/claude-opus-4-6 tool=collapsed"),
    });
    expect(fetches).toBe(0);
  });

  const corruptions: [string, (payload: unknown) => void][] = [
    ["lost field", payload => { delete group(payload).properties!.neighborhood; }],
    ["changed type", payload => { group(payload).properties!.neighborhood.type = "string"; }],
    ["broadened membership", payload => { group(payload).properties!.neighborhood.enum = [4, 6, 8]; }],
    ["narrowed membership", payload => { group(payload).properties!.neighborhood.enum = [4]; }],
    ["mixed membership", payload => { group(payload).properties!.neighborhood.enum = [4, "8"]; }],
    ["duplicate membership", payload => { group(payload).properties!.neighborhood.enum = [4, 4]; }],
    ["noncanonical spelling", payload => { group(payload).properties!.neighborhood.enum = ["04", "8"]; }],
    ["lost declaration", payload => { (payload as Payload).request.tools[0].functionDeclarations = []; }],
    ["ambiguous declaration", payload => {
      const declarations = (payload as Payload).request.tools[0].functionDeclarations;
      declarations.push(structuredClone(declarations[0]));
    }],
  ];
  test.each(corruptions)("%s: real SDK onPayload errors retain HTTP400 and never fetch", async (_label, corrupt) => {
    let fetches = 0;
    const model = bundled("claude-opus-4-6");
    const encode = antigravityToolEnumPayload(model.id, tools);
    const result = await complete(model, context(), { apiKey,
      onPayload(payload) {
        // Corrupt a genuinely normalized SDK payload to simulate an incompatible SDK translation.
        corrupt(payload);
        const before = JSON.stringify(payload);
        try { return encode(payload); }
        catch (error) {
          expect(error).toBeInstanceOf(ToolSchemaTransportError);
          expect(JSON.stringify(payload)).toBe(before);
          throw error;
        }
      },
      fetch: offlineFetch(async () => { fetches++; throw new Error("unexpected outbound fetch"); }),
    });
    expect(result).toMatchObject({ stopReason: "error", errorStatus: 400, errorMessage: expect.stringContaining(
      "google-antigravity/claude-opus-4-6 tool=upsert_autotile_group parameters.properties.group.properties.neighborhood",
    ) });
    expect(result.content).toEqual([]);
    expect(fetches).toBe(0);
  });
});
