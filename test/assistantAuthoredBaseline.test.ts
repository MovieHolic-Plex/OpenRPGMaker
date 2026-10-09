import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import * as history from "@/editor/mapEditHistory";
import * as commits from "@/project/projectCommitLog";
import { approvedReviewResponse } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// 2026-09-17: 독립 검수(LLM) 호출이 사라져 「검수 요청이 들어오면 잡는다」 대기는 영원히 안 풀린다. 이제 초안이
// 완성된 뒤 모델의 마지막 응답(결정적 검사 직전)을 붙잡아 그 사이에 실 편집을 넣는다. 지키는 것은 같다 —
// 낡은 기준선 위의 초안은 검사가 통과해도 적용되지 않는다.
it.each([true, false])("rejects an actual held approval after a live price edit, before stale undo or commit (refresh=%s)", async refresh => {
  const project = createBlankProject();
  store.replace(project);
  history.resetMapEditHistory();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<ChatResult>();
  let wrote = false;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: ["set_title_screen"] }),
    chat: async () => {
      if (!wrote) {
        wrote = true;
        return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
          name: "set_title_screen", arguments: JSON.stringify({ title: "Reviewed title", reason: "Change requested title" }),
        } }] }, finishReason: "tool_calls" };
      }
      // The draft is complete; hold the final response so a live edit lands before the deterministic check.
      entered.resolve();
      return release.promise;
    },
  });
  const commit = vi.spyOn(commits, "recordProjectCommit");
  const turn = session.sendUserMessage("Change title", () => {}, undefined, { autonomous: true });
  const deadline = AbortSignal.timeout(60000);
  const expired = new Promise<never>((_resolve, reject) => deadline.addEventListener("abort", () => reject(new Error("Held draft deadline")), { once: true }));
  await Promise.race([entered.promise, expired]);
  expect(store.getCurrent().database.items.find(item => item.id === "item_potion")?.price).toBe(50);
  store.update(draft => {
    const potion = draft.database.items.find(item => item.id === "item_potion");
    if (!potion) throw new Error("Missing potion fixture");
    potion.price = 9876;
  }, { scope: "project", origin: "human", label: "Edit potion price" });
  if (refresh) session.refreshAcceptance(store.getCurrent());
  release.resolve({ message: { role: "assistant", content: "Finished" }, finishReason: "stop" });
  const result = await Promise.race([turn, expired]);
  expect(store.getCurrent().database.items.find(item => item.id === "item_potion")?.price).toBe(9876);
  expect(store.getCurrent().system.titleScreen).toEqual(project.system.titleScreen);
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
  expect(commit).not.toHaveBeenCalled();
  expect(result.appliedCalls ?? []).toEqual([]);
  expect(result.stoppedReason).toBe("error");
  expect(session.isDraftReviewApproved()).toBe(false);
});

it.each(["standalone", "wiki-checkpoint"] as const)("keeps %s ownership independent of unrelated live authored state", async mode => {
  const project = createBlankProject();
  const unrelated = structuredClone(project);
  unrelated.meta.title = "Unrelated live project";
  store.replace(mode === "standalone" ? unrelated : project);
  history.resetMapEditHistory();
  let wrote = false;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: ["set_title_screen"] }),
    prepareProjectWiki: mode === "standalone" ? undefined : async () => {
      history.recordProjectSnapshot("Wiki checkpoint");
      store.update(live => { live.world = { entities: [{ id: "w_checkpoint", type: "guideline", name: "User decision", summary: "Preserve this checkpoint", origin: "user", locked: true }], relations: [] }; });
      session.refreshAcceptance(store.getCurrent());
      return store.getCurrent().world;
    },
    chat: async (_config, request) => {
      const review = approvedReviewResponse(request);
      if (review) return review;
      if (wrote) return { message: { role: "assistant", content: "Finished" }, finishReason: "stop" };
      wrote = true;
      return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
        name: "set_title_screen", arguments: JSON.stringify({ title: "Reviewed title", reason: "Change requested title" }),
      } }] }, finishReason: "tool_calls" };
    },
  });
  const result = await session.sendUserMessage("Change title", () => {}, undefined, { autonomous: mode === "wiki-checkpoint" });
  expect(result.review?.status, result.error).toBe("approved");
  if (mode === "standalone") {
    expect(store.getCurrent()).toEqual(unrelated);
    expect(result.proposedCalls).toHaveLength(1);
    expect(history.getMapEditHistoryEntries()).toHaveLength(0);
  } else {
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen"]);
    expect(history.getMapEditHistoryEntries()).toHaveLength(2);
    expect(history.undoMapEdit()).toBe(true);
    expect(store.getCurrent().system.titleScreen).toEqual(project.system.titleScreen);
    expect(store.getCurrent().world?.entities).toMatchObject([{ id: "w_checkpoint", locked: true }]);
  }
});
