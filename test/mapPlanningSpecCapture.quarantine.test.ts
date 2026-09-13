// 밑그림 → 보존 기획 「담기」(OPRN-019). 실제 턴이 `set_build_spec` 을 확정할 때 무슨 일이
// 벌어지는가를 실제 패널·실제 세션으로 잠근다.
//
// 계약 둘:
//  1. 밑그림 확정은 프로젝트를 **자동으로** 바꾸지 않는다 — 사용자가 「담기」를 눌러야 항목이 된다.
//     (밑그림의 세션 수명을 사용자 동의 없이 영구 지침으로 바꾸지 않는다 — 이슈의 명시 요구.)
//  2. 담긴 항목은 좌표를 남기고, 두 번 눌러도 늘어나지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearConversations } from "@/ai/conversationStore";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { clearAiActivityLogs } from "@/ai/activityLog";
import { editorState } from "@/editor/editorState";
import { listMapPlanningItems } from "@/editor/mapPlanningActions";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { emptyWikiResponse, isWikiExtraction } from "./wikiTransportFixture";

const MAP_ID = "map_blank_start";
const SPEC = {
  mapId: MAP_ID,
  title: "작은 마을",
  assets: [
    { id: "house_a", kind: "house", x: 4, y: 4, w: 6, h: 5, style: "붉은 지붕 집" },
    { id: "plaza", kind: "terrain", x: 12, y: 4, w: 5, h: 5 },
  ],
} as const;

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function isLlmRequest(input: unknown, init?: unknown): boolean {
  const url = typeof input === "string" ? input : String((input as { url?: unknown })?.url ?? input);
  if (!url.includes("/chat/completions")) return false;
  const body = (init as { body?: unknown } | undefined)?.body;
  return typeof body === "string" && body.includes("\"tools\"");
}

function toolCallsResponse(calls: readonly { readonly name: string; readonly args: unknown }[]): Response {
  return Response.json({
    choices: [{
      message: {
        role: "assistant",
        content: null,
        tool_calls: calls.map((call, index) => ({
          id: `call_${index}`,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.args) },
        })),
      },
      finish_reason: "tool_calls",
    }],
  });
}

function textResponse(text: string): Response {
  return Response.json({ choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }] });
}

/** 1라운드에 밑그림만 확정하고, 2라운드부터 끝낸다 — 담기 버튼이 붙는 최소 시나리오. */
function scriptSpecOnlyTurn(): void {
  let round = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body ?? "{}")) as { messages?: readonly { readonly content?: unknown }[] };
    if (isWikiExtraction(request.messages)) return emptyWikiResponse();
    if (!isLlmRequest(input, init)) {
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    round += 1;
    if (round === 1) return toolCallsResponse([{ name: "set_build_spec", args: SPEC }]);
    return textResponse("밑그림을 세웠습니다.");
  }));
}

beforeEach(async () => {
  clearAgentBlueprint();
  clearAgentGhostPreview();
  store.replace(createBlankProject());
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  editorState.set({ currentMapId: MAP_ID, selection: null });
  resetMapEditHistory();
  restoreDom = installFakeDom();
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  await clearConversations();
  clearAiActivityLogs();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(), apiKey: "sk-test", agentMode: "chat", maxToolCalls: 4,
  }));
});

afterEach(() => {
  teardownAiChatPanel();
  clearAgentBlueprint();
  clearAgentGhostPreview();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("밑그림 → 보존 기획 담기", () => {
  // 실측 10초대: 이 케이스는 실제 세션 루프(의도 선언 → 툴 라운드 → 마무리)를 통째로 돈다.
  // 기본 15초 상한은 부하가 걸린 머신에서 아슬아슬했다 — 기다림은 여전히 사건 기반이고,
  // 이 값은 「느린 머신에서도 그 사건을 놓치지 않는다」는 안전망일 뿐이다.
  it("밑그림 확정만으로는 보존 기획이 생기지 않고, 담기 버튼이 나온다", { timeout: 60_000 }, async () => {
    // Break: 세션 밑그림이 사용자 동의 없이 영구 지침으로 승격된다.
    scriptSpecOnlyTurn();
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "마을 밑그림 세워줘";
    findByTestId(panel, "ai-send")?.click();

    // 기다리는 신호는 시간이 아니라 **밑그림 요약이 로그에 붙은 사건** 이다 — 그것이 담기 버튼의 집이다.
    // 상한은 느린 머신을 부르는 안전망일 뿐이고, 통과 조건은 그 사건의 존재다.
    const capture = await vi.waitFor(
      () => {
        const node = findByTestId(panel, "ai-build-spec-capture");
        if (!node) throw new Error("build spec capture button not rendered yet");
        return node;
      },
      { timeout: 30_000, interval: 10 },
    );
    // 밑그림이 확정된 그 순간에도 프로젝트는 그대로다.
    expect(listMapPlanningItems(MAP_ID)).toEqual([]);

    capture?.click();
    const captured = listMapPlanningItems(MAP_ID);
    expect(captured).toHaveLength(2);
    expect(captured.map((row) => row.origin)).toEqual(["spec", "spec"]);
    expect(captured[0]?.text).toBe("붉은 지붕 집 — house (4,4) 6×5");
    expect(captured[0]?.specAssetId).toBe(`${MAP_ID}:house_a`);
    expect(capture?.textContent).toContain("2개 담았습니다");

    // 두 번 눌러도 늘지 않는다(버튼은 이미 비활성이지만 계약을 데이터로 확인한다).
    capture?.click();
    expect(listMapPlanningItems(MAP_ID)).toHaveLength(2);

    // 턴이 아직 달리고 있을 수 있다 — 떼어내기 전에 패널이 띄워 둔 보존·복원 작업을 정착시킨다.
    await whenAiChatPanelSettled();
  });
});
