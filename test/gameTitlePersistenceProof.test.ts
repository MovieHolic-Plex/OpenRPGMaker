import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import * as evaluation from "@/ai/assistantAcceptanceEvaluation";
import { createBlankProject } from "@/project/defaults";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { fixedDeclarer } from "./intentFixture";

const title = "작은 열쇠";
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "http://title-proof.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "title-proof-test");
  vi.stubGlobal("window", { location: { hostname: "127.0.0.1", pathname: "/", search: "" }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function fixture(draftTitle?: string) {
  const project = createBlankProject();
  project.meta.title = "Metadata is not the displayed title";
  project.system.titleScreen = { ...defaultTitleScreenSettings(), title };
  let row: { project_id: string; current_json: Project; current_sha256: string } | undefined;
  let canonicalRead = false;
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    if (path === "/rest/v1/projects") {
      if (method !== "GET") {
        row = JSON.parse(String(init?.body));
        return Response.json(method === "PATCH" ? [row] : []);
      }
      canonicalRead = true;
      return Response.json(row ? [row] : []);
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
    throw new Error(`Unexpected transport: ${method} ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  store._setPersistedBaselineForTest(null);
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  const calls = [
    { name: "set_work_plan", args: { goal: "Literal title", layers: [{ title: "Title", items: [{ id: "work", title: "Title", instruction: "Set title" }] }],
      requirements: [{ id: "req_title", title, criteria: [{ kind: "gameTitle", title: true }] }] } },
    { name: "repair_acceptance", args: { itemId: "req_title", criteria: [{ kind: "gameTitle", title }] } },
    { name: "skip_work_item", args: { itemId: "work" } },
    ...(draftTitle === undefined ? [] : [{ name: "set_title_screen", args: { title: draftTitle } }]),
  ];
  let index = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 10 },
    declareIntent: fixedDeclarer({ mode: "modify" }),
    chat: async (): Promise<ChatResult> => {
      const call = calls[index++];
      return call ? { message: { role: "assistant", content: null, tool_calls: [{ id: String(index), type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } }] }, finishReason: "tool_calls" }
        : { message: { role: "assistant", content: "TITLE_COMPLETE" }, finishReason: "stop" };
    },
  });
  await session.sendUserMessage("Display the requested title", event => events.push(event));
  expect(events.find(event => event.type === "tool_call" && event.name === "repair_acceptance")).toMatchObject({ result: { ok: true } });
  return { session, read: () => canonicalRead, fetchMock };
}

describe("literal title on the real accepted-revision canonical reload path", () => {
  it.each([false, true])("reruns exact title evaluation after identity-matched reload (wrong=%s)", async wrong => {
    const f = await fixture();
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    if (wrong) store.update(project => {
      project.meta.title = title;
      project.system.titleScreen = { ...defaultTitleScreenSettings(), title: "Wrong visible title" };
    });
    const original = evaluation.evaluateAcceptanceCriterion;
    const reloadVerdicts: boolean[] = [];
    vi.spyOn(evaluation, "evaluateAcceptanceCriterion").mockImplementation((criterion, input) => {
      const result = original(criterion, input);
      if (f.read() && criterion.kind === "gameTitle") {
        expect(input.project).not.toBe(store.getCurrent());
        reloadVerdicts.push(result.passed);
      }
      return result;
    });
    const proof = await f.session.proveAppliedRevision();
    expect(f.read()).toBe(true);
    expect(reloadVerdicts).toEqual([!wrong]);
    expect(proof.verified).toBe(!wrong);
    expect(proof.status).toBe(wrong ? "failed" : "succeeded");
    if (wrong) expect(proof.proof?.kind).toBe("failed");
    else expect(proof.receipt?.projectId).toBe("title-proof-test");
    expect(f.session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.startsWith("agent_run_saved "))).toBe(!wrong);
  });

  it("never publishes title proof while a registered title-tool draft is unapplied", async () => {
    const f = await fixture("Unapplied wrong title");
    expect(f.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    f.fetchMock.mockClear();
    expect(await f.session.proveAppliedRevision()).toMatchObject({ status: "failed", verified: false, reason: "unapplied-functional-draft" });
    expect(f.read()).toBe(false);
    expect(f.fetchMock).not.toHaveBeenCalled();
  });
});
