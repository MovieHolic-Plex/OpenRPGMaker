import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import * as functionalEvaluation from "@/ai/functionalAcceptanceEvaluation";
import { fixedDeclarer } from "./intentFixture";
import { functionalFixture } from "./fixtures/functionalAcceptance";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "http://functional-proof.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "functional-proof-test");
  vi.stubGlobal("window", { location: { hostname: "127.0.0.1", pathname: "/", search: "" }, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function fixture(withDraft = false) {
  const f = functionalFixture();
  let row: { project_id: string; current_json: Project; current_sha256: string } | undefined;
  let canonicalRead = false;
  let onRead: (() => void) | undefined;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    if (path === "/rest/v1/projects") {
      if (method !== "GET") {
        row = JSON.parse(String(init?.body));
        return Response.json(method === "PATCH" ? [row] : []);
      }
      canonicalRead = true;
      onRead?.();
      return Response.json(row ? [row] : []);
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
    throw new Error(`Unexpected transport: ${method} ${path}`);
  }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(f.project);
  store._setPersistedBaselineForTest(null);
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  let wrote = false;
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test" },
    declareIntent: fixedDeclarer({ mode: "modify", functionalAcceptance: [{ kind: "shopPurchase", target: { mapId: f.origin.id },
      start: f.project.startPos, seller: { eventId: f.seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 }] }),
    chat: async () => {
      if (withDraft && !wrote) {
        wrote = true;
        return { message: { role: "assistant", content: null, tool_calls: [{ id: "draft", type: "function", function: {
          name: "set_title_screen", arguments: JSON.stringify({ title: "Unapplied draft" }),
        } }] }, finishReason: "tool_calls" };
      }
      return { message: { role: "assistant", content: "COMPLETE" }, finishReason: "stop" };
    },
  });
  await session.sendUserMessage("Make the requested purchase work", () => {});
  return { ...f, session, read: () => canonicalRead, onRead: (callback: () => void) => { onRead = callback; } };
}

describe("functional acceptance on accepted canonical reload", () => {
  it("reruns real functional criteria on reloaded content before publishing verified persistence", async () => {
    const f = await fixture();
    const original = functionalEvaluation.evaluateFunctionalCriterion;
    let reloadedChecks = 0;
    vi.spyOn(functionalEvaluation, "evaluateFunctionalCriterion").mockImplementation((criterion, input) => {
      if (f.read()) { reloadedChecks++; expect(input.project).not.toBe(store.getCurrent()); }
      return original(criterion, input);
    });
    const proof = await f.session.proveAppliedRevision();
    expect(proof).toMatchObject({ status: "succeeded", verified: true, receipt: { projectId: "functional-proof-test" } });
    expect(reloadedChecks).toBeGreaterThan(0);
  });
  it("does not certify a newer applied broken purchase using an earlier acceptance pass", async () => {
    const f = await fixture();
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    store.update(project => { project.session.gold = 1; });
    const verifySpy = vi.spyOn(store, "verifyPersistedRevision");
    const reloadSpy = vi.spyOn(store, "reloadFromRemote");
    const evaluationSpy = vi.spyOn(functionalEvaluation, "evaluateFunctionalCriterion");
    const proof = await f.session.proveAppliedRevision();
    expect(proof.verified).toBe(false);
    expect(proof).toMatchObject({ status: "failed", reason: "failed" });
    expect(f.read()).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
    const [receipt, options] = verifySpy.mock.calls[0]!;
    const validate = options?.validate;
    if (!validate) throw new Error("Missing canonical validation callback");
    expect(verifySpy).toHaveBeenCalledExactlyOnceWith(receipt, { signal: undefined, validate });
    expect(proof.receipt).toBe(receipt);
    // The real store invokes the validator on the identity-matched canonical read.
    const canonical = evaluationSpy.mock.calls[0]![1].project;
    expect(canonical).not.toBe(store.getCurrent());
    expect(canonical.session.gold).toBe(1);
    expect(validate(f.project)).toBeUndefined();
    const problem = validate(canonical);
    expect(problem).toBeTypeOf("string");
    expect(problem).not.toBe("");
    expect(proof.proof).toEqual({ kind: "failed", receipt, message: problem });
    expect(f.session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.startsWith("agent_run_saved "))).toBe(false);
  });
  it("cannot publish functional proof while a newer proposal remains unapplied", async () => {
    const f = await fixture(true);
    expect(f.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(await f.session.proveAppliedRevision()).toMatchObject({ status: "failed", verified: false, reason: "unapplied-functional-draft" });
  });
  it("rejects a canonical read overtaken by a new applied edit", async () => {
    const f = await fixture();
    f.onRead(() => store.update(project => { project.session.gold = 1; }));
    expect(await f.session.proveAppliedRevision()).toMatchObject({ status: "failed", verified: false, reason: "stale" });
  });
});
