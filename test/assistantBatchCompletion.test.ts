import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { runTool } from "@/editor/tools";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";

type Call = { name: string; args: Record<string, unknown> };
type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;
const call = (name: string, args: Record<string, unknown> = {}): Call => ({ name, args });
const title = call("set_title_screen", { title: "Batch complete" });
const complete = call("complete_work_item");
const plan = call("set_work_plan", {
  goal: "제목 설정",
  layers: [{ title: "설정", items: [{ title: "제목 설정", instruction: "set_title_screen", successTools: ["set_title_screen"] }] }],
});

afterEach(() => {
  resetIntentDeclarationCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function harness(rounds: Call[][]) {
  const context = { project: createBlankProject() };
  expect(runTool(context, "create_map", { id: "map_other", name: "Other", width: 20, height: 15 }).ok).toBe(true);
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "test-batch");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(context.project);
  resetMapEditHistory();
  let next = 0;
  const session = new AssistantSession(context.project, {
    config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 8192, maxToolCalls: 12 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
    chat: async (): Promise<ChatResult> => {
      const batch = rounds[next++];
      return batch
        ? { message: { role: "assistant", content: null, tool_calls: batch.map((entry, index) => ({
          id: `batch-${next}-${index}`, type: "function", function: { name: entry.name, arguments: JSON.stringify(entry.args) },
        })) }, finishReason: "tool_calls" }
        : { message: { role: "assistant", content: "검증 종료" }, finishReason: "stop" };
    },
  });
  const events: ToolEvent[] = [];
  const collect = (event: SessionEvent): void => { if (event.type === "tool_call") events.push(event); };
  return { session, events, collect, project: context.project };
}

describe("audit batch dependency and completion lifecycle", () => {
  it("defers same-map spec-free props after a rejected spec but allows another map", async () => {
    const startMapId = createBlankProject().startMapId;
    const props = (mapId: string) => call("place_props", {
      mapId, material: "침엽수", count: 1, area: { x: 2, y: 2, w: 4, h: 4 },
    });
    const h = harness([[
      call("set_build_spec", { mapId: startMapId, assets: [{ id: "invalid", kind: "terrain", x: 0, y: 0, w: 40, h: 15 }] }),
      props(startMapId), call("get_project_summary"), props("map_other"),
    ]]);
    await h.session.sendUserMessage("두 맵의 소품 배치 검증", h.collect);
    expect(h.events[1]?.result).toMatchObject({
      ok: false, data: { code: "tool-deferred", executed: false, reason: "build-spec-dependency-failed" },
    });
    expect(h.events[2]?.result.ok).toBe(true);
    expect(h.events[3]?.result.ok).toBe(true);
    expect(h.session.getProposedProject().maps[startMapId]).toEqual(h.project.maps[startMapId]);
    expect(h.session.getProposedProject().maps.map_other).not.toEqual(h.project.maps.map_other);
  });

  it("defers premature completion, then accepts correction of the failed write in the same batch", async () => {
    const h = harness([[plan], [
      call("set_title_screen", { invalid: true }), complete,
      call("get_project_summary"), title, complete,
    ]]);
    const result = await h.session.sendUserMessage("제목 설정 검증", h.collect, undefined, { autonomous: true });
    const completions = h.events.filter((event) => event.name === "complete_work_item");
    expect(completions[0]?.result).toMatchObject({
      ok: false, data: { code: "tool-deferred", executed: false, reason: "work-dependency-failed" },
    });
    expect(completions[1]?.result.ok).toBe(true);
    expect(h.events.find((event) => event.name === "get_project_summary")?.result.ok).toBe(true);
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(result.appliedCalls?.map((entry) => entry.name)).toEqual(["set_title_screen"]);
  });

  it("acknowledges an already completed plan without an item ID or another application", async () => {
    const h = harness([[plan], [title], [complete]]);
    const result = await h.session.sendUserMessage("제목 설정 검증", h.collect, undefined, { autonomous: true });
    expect(h.events.find((event) => event.name === "complete_work_item")?.result).toMatchObject({
      ok: true, data: { alreadyComplete: true },
    });
    expect(result.appliedCalls?.map((entry) => entry.name)).toEqual(["set_title_screen"]);
    expect(result.proposedCalls).toEqual([]);
  });

  it("does not acknowledge a missing plan", async () => {
    const missing = harness([[complete]]);
    await missing.session.sendUserMessage("완료 요청 검증", missing.collect);
    expect(missing.events[0]?.result.ok).toBe(false);
  });

  it("does not acknowledge an explicitly unknown item", async () => {
    const unknown = harness([[plan], [title], [call("complete_work_item", { itemId: "unknown" })]]);
    await unknown.session.sendUserMessage("제목 설정 검증", unknown.collect, undefined, { autonomous: true });
    expect(unknown.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
  });

  it("does not acknowledge skipped work as already completed", async () => {
    const h = harness([[plan], [call("skip_work_item")], [complete]]);
    await h.session.sendUserMessage("제목 설정 검증", h.collect);
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("skipped");
    expect(h.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
  });

  it("does not bypass open acceptance when every work item is done", async () => {
    const mapId = createBlankProject().startMapId;
    const promised = call("set_work_plan", {
      ...plan.args,
      acceptance: [{ id: "map-change", title: "Map change", criteria: [
        { kind: "targetChange", target: { mapId }, region: { x: 2, y: 2, w: 2, h: 2 } },
      ] }],
    });
    const h = harness([[promised], [title], [complete]]);
    await h.session.sendUserMessage("제목과 지도 검증", h.collect, undefined, { autonomous: true });
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(h.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(h.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
  });

  it("does not acknowledge completion after a later explicit verification failure", async () => {
    const h = harness([[plan], [title], [call("run_lint", { reachability: false })], [complete]]);
    await h.session.sendUserMessage("제목 설정 후 검증", h.collect, undefined, { autonomous: true });
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(h.events.find((event) => event.name === "run_lint" && event.args.reachability === false)?.result.ok).toBe(false);
    expect(h.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
  });
});
