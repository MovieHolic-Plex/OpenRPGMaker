// 청사진 턴 정산 — 중단/오류로 끝난 턴도 "짓는 중"을 남기지 않는다.
//
// 실측 결함: finishAgentBlueprint() 가 정상 종료 분기에서만 호출돼, 시공 중에 중단하거나 턴이
// 오류로 끝나면 칸 하나가 노란 2px(짓는 중)로 얼어붙었다. 다음 턴 시작의
// syncAgentBlueprintWithSpec 은 같은 사각형이면 상태를 **물려받으므로** 그 노란 칸은 세션을
// 버릴 때까지(새 대화·프로젝트 전환) 풀리지 않는다 — 1차 리뷰가 없애려던 "영구 짓는 중"이다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearConversations } from "@/ai/conversationStore";
import { clearAgentBlueprint, getAgentBlueprintState } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const MAP_ID = "map_blank_start";

/** 20×15 빈 맵 안에 들어가는 최소 계획 — 집 한 채. */
const SPEC = {
  mapId: MAP_ID,
  title: "작은 마을",
  assets: [{ id: "house_a", kind: "house", x: 4, y: 4, w: 6, h: 5 }],
} as const;

/** 집 칸을 그대로 덮는 쓰기 툴콜 — 스펙 게이트 대상이 아니어서 결정적으로 성공한다. */
const MIRROR_ARGS = { mapId: MAP_ID, x: 4, y: 4, w: 6, h: 5, axis: "horizontal" } as const;

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
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
  clearConversations();
  // chat 모드 = 턴 1개(플래너 라운드 없음). 스크립트 라운드 수를 예측 가능하게 만든다.
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test", agentMode: "chat", maxToolCalls: 4 }));
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

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 200; i += 1) await Promise.resolve();
}

function sseToolCallsResponse(calls: readonly { readonly name: string; readonly args: unknown }[]): Response {
  const deltas = calls.map((call, index) => ({
    index,
    id: `call_${index}`,
    type: "function",
    function: { name: call.name, arguments: JSON.stringify(call.args) },
  }));
  const body = [
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: deltas } }] })}`,
    "",
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}`,
    "",
    "data: [DONE]",
    "",
    "",
  ].join("\n");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

/**
 * 1라운드는 밑그림 확정 + 집 칸 시공, 2라운드부터는 `afterFirstRound()` 가 턴을 끝낸다.
 * (중단이면 abort 를 누르고 던지고, 오류면 401 을 돌려준다.)
 */
function scriptTurn(afterFirstRound: () => Response | never): void {
  let round = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    round += 1;
    if (round === 1) {
      return sseToolCallsResponse([
        { name: "set_build_spec", args: SPEC },
        { name: "mirror_region", args: MIRROR_ARGS },
      ]);
    }
    return afterFirstRound();
  }));
}

async function runTurn(panel: FakeElement): Promise<void> {
  const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
  // "야외" 표지가 없으면 intentClarify 가 실내/야외를 되묻고 툴 라운드로 가지 않는다.
  input.value = "야외에 집 한 채 지어줘";
  (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
  await flushAsync();
}

function statusById(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of getAgentBlueprintState().entries) out[entry.id] = entry.status;
  return out;
}

describe("중단·오류로 끝난 턴의 청사진 정산", () => {
  it("시공 중 중단해도 짓던 칸이 done 으로 확정된다 — 노란 칸이 세션 끝까지 얼어붙지 않는다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    scriptTurn(() => {
      // 사용자가 중단 버튼을 누른 시점 = 다음 라운드를 기다리는 중.
      (findByTestId(panel, "ai-abort") as unknown as HTMLElement).click();
      throw new Error("aborted by user");
    });

    await runTurn(panel);

    // 중단 통보가 붙었고(= 중단 분기를 지났다) 시공은 이미 맵에 들어갔다.
    expect((findByTestId(panel, "ai-chat-log") as unknown as FakeElement).textContent ?? "").toContain("사용자가 중단했습니다");
    expect(getAgentBlueprintState().entries).toHaveLength(1);
    expect(statusById()).toEqual({ house_a: "done" });
  });

  it("턴이 오류로 끝나도 짓던 칸이 done 으로 확정된다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    scriptTurn(() => new Response("nope", { status: 401, headers: { "Content-Type": "text/plain" } }));

    await runTurn(panel);

    expect(getAgentBlueprintState().entries).toHaveLength(1);
    expect(statusById()).toEqual({ house_a: "done" });
  });
});
