import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { AssistantSession } from "../../../src/ai/assistantSession";
import { defaultAiConfig } from "../../../src/ai/llmClient";
import { deserialize } from "../../../src/project/io";
import { fixedDeclarer } from "../../../test/intentFixture";

const path = process.argv[2];
assert(path, "Supply the read-only captured project JSON path");
const source = readFileSync(path, "utf8");
const project = deserialize(source);
const session = new AssistantSession(project, {
  config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 1 },
  declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
  yieldToUi: async () => {},
  chat: async () => ({ message: { role: "assistant", content: "SCRIPTED_COMPLETION_ATTEMPT" }, finishReason: "stop" }),
});
const result = await session.sendUserMessage("Assess current final artifact");
const quality = result.completionAssessment?.checks.find(check => check.name === "evaluate_game_quality");
assert(quality?.result.issues?.some(issue => issue.code === "ending-uninvoked"));
assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), createHash("sha256").update(source).digest("hex"));
console.log(JSON.stringify({
  sourcePath: path, sourceSha256: createHash("sha256").update(source).digest("hex"),
  stoppedReason: result.stoppedReason,
  checks: result.completionAssessment?.checks.map(check => ({ name: check.name, ok: check.result.ok,
    issues: check.result.issues?.map(issue => ({ code: issue.code, severity: issue.severity })) })),
  terminalVerification: result.completionAssessment?.verification,
}, null, 2));
