// 청사진 턴 정산 — 표시된 상태와 저장소가 어긋나지 않는다.
//
// 실측 결함 1: 턴 끝 정산이 정상 종료 분기에만 있어서 시공 중에 중단하거나 턴이 오류로 끝나면
// 칸 하나가 노란 2px(짓는 중)로 얼어붙었다. 다음 턴 시작의 syncAgentBlueprintWithSpec 은 같은
// 사각형이면 상태를 **물려받으므로** 그 노란 칸은 세션을 버릴 때까지 풀리지 않는다.
//
// 실측 결함 2(1을 고치면서 들어왔다): 모든 종료 경로에서 building 을 done 으로 올렸는데, 다섯
// 종료 경로 중 셋 — 중단 return, catch 두 개 — 은 applyProposal **앞에서** 끝난다. 같은 툴콜을
// 정상 종료와 중단으로 각각 돌려 보면 store 변경은 true/false 로 갈리는데 청사진은 양쪽 다
// done 이었다(중단 쪽 로그에는 "적용" 이 없다). 게다가 markAgentBlueprintProgress 는 planned 가
// 아닌 칸을 다시 올리지 않으므로 그 거짓 완료는 세션이 죽을 때까지 남는다 — 손도 안 댄 타일
// 위에 회색 ✓ "완료" 가 영구히 박힌다. 그래서 아래 세 케이스는 **청사진과 저장소를 함께** 본다.
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

/**
 * 집 칸을 그대로 덮는 쓰기 툴콜 — 스펙 게이트 안(에셋 사각형과 동일)이고 타일을 **실제로** 바꾼다.
 * 종전 fixture 는 mirror_region 이었는데 빈 맵을 대칭시키면 바뀌는 타일이 0장이다 — 적용이
 * 들어갔는지로 정산을 판정하는 지금은 "변경 없음" 과 구분되지 않는다.
 */
const FILL_ARGS = { mapId: MAP_ID, rect: { x: 4, y: 4, w: 6, h: 5 }, material: "물" } as const;

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

/**
 * 턴이 실제로 끝날 때까지 기다린다 — 마이크로태스크를 정해진 횟수만 비우는 방식은 이제 못 쓴다.
 *
 * 정산이 applyProposal 의 await **뒤**로 옮겨졌기 때문이다(적용 결과로 판정한다). 적용 경로는
 * 커밋 로그·영속화까지 실제 타이머를 태우고 401 경로는 재시도 백오프도 낀다 — 고정 횟수로는
 * 어떤 실행에서는 닿고 어떤 실행에서는 못 닿아 결과가 흔들렸다(실측: 같은 코드로 done/building
 * 이 번갈아 나왔다). 패널은 턴이 끝날 때 `finally` 에서 중단 버튼을 감추므로 그것을 신호로 쓴다.
 */
async function flushUntilTurnEnd(panel: FakeElement): Promise<void> {
  for (let round = 0; round < 300; round += 1) {
    for (let i = 0; i < 50; i += 1) await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
    const abort = findByTestId(panel, "ai-abort") as unknown as FakeElement | null;
    if (round >= 3 && abort?.hidden === true) return;
  }
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

/** 툴콜 없는 마무리 응답 — 턴을 정상 종료로 끝낸다. */
function sseTextResponse(text: string): Response {
  const body = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
    "",
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}`,
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
        { name: "fill_region", args: FILL_ARGS },
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
  await flushUntilTurnEnd(panel);
}

function statusById(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of getAgentBlueprintState().entries) out[entry.id] = entry.status;
  return out;
}

describe("중단·오류로 끝난 턴의 청사진 정산", () => {
  it("시공 중 중단하면 짓던 칸이 planned 로 되돌아간다 — 저장소가 안 바뀌었는데 완료를 찍지 않는다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    scriptTurn(() => {
      // 사용자가 중단 버튼을 누른 시점 = 다음 라운드를 기다리는 중.
      (findByTestId(panel, "ai-abort") as unknown as HTMLElement).click();
      throw new Error("aborted by user");
    });

    await runTurn(panel);

    // 중단 통보가 붙었고(= 중단 분기를 지났다) 초안은 적용되지 않았다.
    const logText = (findByTestId(panel, "ai-chat-log") as unknown as FakeElement).textContent ?? "";
    expect(logText).toContain("사용자가 중단했습니다");
    expect(logText).not.toContain("적용했습니다");
    // 저장소는 한 글자도 안 바뀌었다 — applyProposedProject 만 store.replace 를 부른다.
    expect(store.getCurrent()).toBe(before);
    expect(getAgentBlueprintState().entries).toHaveLength(1);
    expect(statusById()).toEqual({ house_a: "planned" });
    // 노란 "짓는 중" 도 남기지 않는다(1차 결함) — 되돌린 상태는 planned 다.
    expect(getAgentBlueprintState().entries[0].status).not.toBe("building");
  });

  it("턴이 오류로 끝나도 남은 제안은 적용되므로 그 칸은 done 으로 확정된다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    scriptTurn(() => new Response("nope", { status: 401, headers: { "Content-Type": "text/plain" } }));

    await runTurn(panel);

    // 오류 분기는 적용 경로를 그대로 통과한다(제안이 0건이 아니다) — 시공이 실제로 들어갔다.
    expect(store.getCurrent()).not.toBe(before);
    expect(getAgentBlueprintState().entries).toHaveLength(1);
    expect(statusById()).toEqual({ house_a: "done" });
  });

  it("정상 종료 + 적용에서만 done 과 저장소 변경이 함께 간다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    scriptTurn(() => sseTextResponse("집을 지었습니다."));

    await runTurn(panel);

    expect(store.getCurrent()).not.toBe(before);
    expect(statusById()).toEqual({ house_a: "done" });
  });
});
