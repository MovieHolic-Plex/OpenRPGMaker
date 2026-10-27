import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { createLlmIntentDeclarer, resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { functionalFixture } from "./fixtures/functionalAcceptance";
import { parseRequestCoverage } from "@/ai/requestCoverage";

const config = { ...defaultAiConfig(), agentMode: "chat" as const, autonomyLevel: undefined, model: "test", liteModel: "test", maxToolCalls: 8 };
const reply = (value: unknown): ChatResult => ({ message: { role: "assistant", content: JSON.stringify(value) }, finishReason: "stop" });
afterEach(resetIntentDeclarationCache);

// Removed the ledger cases ("keeps the original goal incomplete after failed NPC repair…", "retains words omitted…",
// "cannot satisfy a partial plan after %s coverage", "links every independently extracted clause…",
// "keeps grouped R2 clarification and resume coverage distinct"): they read obligations back from the acceptance
// ledger, which was removed on purpose on 2026-09-17 (src/ai/assistantSession.ts adoptAcceptance: "2026-09-17 수용
// 원장(acceptance ledger) 해체" — getAcceptanceSnapshot is always null). Same retirement as #3780.
describe("independent request coverage", () => {
  it("accepts the JSON fence returned by the live companion without dropping any clauses", () => {
    const facts = { userText: "Keep the sunset time undecided", currentMap: null, selection: null, maps: [], facilityLabels: [], toolNames: [], hasActivePlan: false };
    const requirements = [{ text: facts.userText, criteria: [{ kind: "functionalUnresolved", reason: "No sunset evaluator" }] }];
    expect(parseRequestCoverage("```json\n" + JSON.stringify({ requirements }) + "\n```", facts, [])).toEqual(requirements);
  });
  it("does not create obligations or run an audit for genuine questions", async () => {
    const { project } = functionalFixture();
    let calls = 0;
    const session = new AssistantSession(project, { config, chat: async () => reply("ANSWER"),
      declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat: async () => { calls++; return reply({ mode: "question" }); } }),
    });
    await session.sendUserMessage("How do shops work?", () => {}, undefined, { composerMode: "ask" });
    expect(calls).toBe(1);
    expect(session.getAcceptanceSnapshot()).toBeNull();
  });

});
