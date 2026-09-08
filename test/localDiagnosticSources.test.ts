/** @vitest-environment happy-dom */
import { afterEach, expect, it } from "vitest";
import { LocalDiagnosticSession } from "@/util/localDiagnosticSession";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { recordPlayBootDiagnostic } from "@/player/playBootDiagnostics";
import { diagnosticToken } from "@/util/diagnosticObserver";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
const diagnostics = new LocalDiagnosticSession();
afterEach(() => diagnostics.clear());
it("local diagnostics project asset boot and missing-resource signals without QA state", () => {
  diagnostics.start(true, ["asset"]);
  const host = document.createElement("div");
  const overlay = new RuntimeDomOverlay(() => host);
  overlay.syncMissingResourceError(new Set(["private-secret-resource"]));
  recordPlayBootDiagnostic({ stage: "assets", ok: true }, undefined, diagnosticToken());
  expect(diagnostics.snapshot().receipts).toEqual(expect.arrayContaining([
    expect.objectContaining({ category: "asset", phase: "missing", count: 1 }),
    expect.objectContaining({ category: "asset", phase: "assets", ok: true }),
  ]));
  expect(overlay.instrumented).toBe(false);
  expect(JSON.stringify(diagnostics.snapshot())).not.toContain("private-secret-resource");
});
it("local diagnostics capture only newly authored user/assistant metadata at the existing audit boundary", async () => {
  diagnostics.start(true, ["conversation"]);
  const session = new AssistantSession(createBlankProject(), {
    config: { ...defaultAiConfig(), apiKey: "test-only" },
    chat: async () => ({ message: { role: "assistant", content: "private output" }, finishReason: "stop" }),
  });
  await session.sendUserMessage("private input", () => undefined, undefined, { instruction: "private input", composerMode: "ask" });
  expect(diagnostics.snapshot().receipts).toEqual(expect.arrayContaining([
    expect.objectContaining({ category: "conversation", phase: "user", count: 13 }),
    expect.objectContaining({ category: "conversation", phase: "assistant", count: 14 }),
  ]));
  expect(JSON.stringify(diagnostics.snapshot())).not.toContain("private");
});
