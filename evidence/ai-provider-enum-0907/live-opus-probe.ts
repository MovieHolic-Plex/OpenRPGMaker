// Explicitly authorized read-only transport probe. Never execute returned calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { completeProvider } from "../../scripts/lib/ohMyPiPiAiRuntime.ts";
import { defaultOhMyPiAuthPath } from "../../scripts/lib/ohMyPiAuthStore.mjs";
import { packRequestApiKey, type PortedOAuthCredentials } from "../../src/ai/oauth/credentials.ts";
import tools from "../../test/fixtures/oh-my-pi/round4-tools.json";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const path = defaultOhMyPiAuthPath();
const authBefore = readFileSync(path);
const row = JSON.parse(authBefore.toString()).providers["google-antigravity"] as PortedOAuthCredentials & { kind: string };
assert.equal(row.kind, "oauth");
// Packing checks expiry without refresh, adoption, login or any credential write.
const packed = JSON.parse(packRequestApiKey("google-antigravity", row));
delete packed.refreshToken;
const sourceBefore = JSON.stringify(tools);
const requests: unknown[] = [];
const startedAt = new Date().toISOString();
const realFetch = globalThis.fetch;
let completion: unknown;
let failure: string | undefined;
try {
  completion = await completeProvider("google-antigravity", {
    model: "claude-opus-4-6",
    messages: [{ role: "system", content: "Reply READY only. Do not call any tools." }, { role: "user", content: "READY" }],
    tools,
  }, { apiKey: JSON.stringify(packed), fetch: Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const wire = JSON.parse(String(init?.body));
    assert.equal(wire.model, "claude-opus-4-6-thinking");
    const declarations = wire.request.tools[0].functionDeclarations;
    assert.deepEqual(declarations.map((tool: { name: string }) => tool.name), tools.map(tool => tool.function.name));
    const leaves = [
      declarations[0].parameters.properties.stories,
      declarations[0].parameters.properties.houses.items.properties.stories,
      declarations[18].parameters.properties.exterior.properties.stories,
      declarations[20].parameters.properties.exterior.properties.stories,
    ];
    for (const leaf of leaves) {
      assert.equal(leaf.type, "integer");
      assert.deepEqual(leaf.enum, ["1", "2", "3"]);
    }
    const response = await realFetch(input, init);
    requests.push({ status: response.status, endpoint: new URL(String(input)).origin,
      wireModel: wire.model, toolCount: declarations.length,
      toolNames: declarations.map((tool: { name: string }) => tool.name),
      enumLeaves: leaves.map(leaf => ({ type: leaf.type, enum: leaf.enum })),
      bodySha256: digest(String(init?.body)),
    });
    return response;
  }, { preconnect: realFetch.preconnect }) });
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  const authUnchanged = readFileSync(path).equals(authBefore);
  const sourceUnchanged = JSON.stringify(tools) === sourceBefore;
  const receipt = { startedAt, finishedAt: new Date().toISOString(), requestedModel: "claude-opus-4-6",
    sourceToolsSha256: digest(sourceBefore), requests, completion, failure,
    authUnchanged, sourceUnchanged, executedToolCalls: 0,
    productionFiles: Object.fromEntries(["scripts/lib/ohMyPiPiAiRuntime.ts", "scripts/lib/ohMyPiToolEnums.ts"].map(file => [file, digest(readFileSync(file))])),
  };
  writeFileSync("evidence/ai-provider-enum-0907/live-opus-proof.json", JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));
  assert.ok(authUnchanged, "Auth file changed during read-only probe");
  assert.ok(sourceUnchanged, "Source tools changed during probe");
}
