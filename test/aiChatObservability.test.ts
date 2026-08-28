// V3C 채팅 관측성 회귀: 글자 크기 3단(영속) / 병합 추론 원문 전체 / 도구 호출 상세 아코디언.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_FONT_SIZE_KEY,
  applyAiFontSize,
  loadAiFontSize,
  renderAiChatPanel,
  renderToolActivityEntry,
  saveAiFontSize,
} from "@/editor/panels/aiChatPanel";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearConversations, conversationScopeKey, saveConversation } from "@/ai/conversationStore";
import { clearAgentGhostPreview, getAgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  clearAgentGhostPreview();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
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
});

afterEach(() => {
  clearAgentGhostPreview();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

function renderPanel(): FakeElement {
  return renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
}

describe("글자 크기 3단 (V3C ①)", () => {
  it("기본값은 '보통'이고 저장하면 localStorage(oprn:ai-font-size)에 영속된다 — 무효값은 보통으로 방어", () => {
    expect(loadAiFontSize()).toBe("normal");
    saveAiFontSize("large");
    expect(storage.get(AI_FONT_SIZE_KEY)).toBe("large");
    expect(loadAiFontSize()).toBe("large");
    storage.set(AI_FONT_SIZE_KEY, "garbage");
    expect(loadAiFontSize()).toBe("normal");
  });

  it("설정의 글자 크기 select(ai-font-size)를 바꾸면 즉시 패널에 반영·영속되고, 재부팅 시 다시 적용된다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test" }));
    const panel = renderPanel();
    const select = findByTestId(panel, "ai-font-size") as unknown as FakeElement;
    expect(select).toBeTruthy();
    // 기본 적용 상태(보통).
    expect(panel.dataset.aiFontSize).toBe("normal");
    select.value = "large";
    select.dispatchEvent(new Event("change"));
    expect(storage.get(AI_FONT_SIZE_KEY)).toBe("large");
    expect(panel.dataset.aiFontSize).toBe("large");
    expect(panel.style["--ai-font-scale"]).toBe("1.2");
    // 새 패널(재부팅)도 저장된 크기로 시작한다.
    const rebooted = renderPanel();
    expect(rebooted.dataset.aiFontSize).toBe("large");
  });

  it("applyAiFontSize는 data 속성과 CSS 변수(--ai-font-scale)를 함께 설정한다", () => {
    const target = document.createElement("div") as unknown as FakeElement;
    applyAiFontSize(target as unknown as HTMLElement, "small");
    expect(target.dataset.aiFontSize).toBe("small");
    expect(target.style["--ai-font-scale"]).toBe("0.85");
  });
});

describe("도구 호출 상세 아코디언 (V3C ③)", () => {
  it("성공 라인은 한 줄 요약만 보여 JSON 인자/결과 원문 노이즈를 숨긴다", () => {
    const entry = renderToolActivityEntry(
      "paint_tiles",
      { ok: true, summary: "타일 5칸 칠함", data: { tilesTouched: 5 } },
      { args: { mapId: "m1", tile: 42 }, index: 3 }
    ) as unknown as FakeElement;
    expect(entry.tagName).toBe("DIV");
    expect(entry.textContent).toContain("paint_tiles");
    expect(entry.textContent).toContain("타일 5칸 칠함");
    expect(findByTestId(entry, "ai-tool-detail-3")).toBeNull();
    const legacy = renderToolActivityEntry("paint_tiles", { ok: true, summary: "타일 5칸 칠함" }) as unknown as FakeElement;
    expect(legacy.tagName).toBe("DIV");
  });

  it("실패 라인은 기존 testid를 유지하면서 아코디언 안에 오류 원문(summary/issues)을 그대로 담는다", () => {
    const entry = renderToolActivityEntry(
      "set_build_spec",
      {
        ok: false,
        summary: "밑그림 검증 실패(2회) — id를 생략하고 다시 보내세요",
        issues: [{ severity: "error", code: "bad-args", message: "id 필드는 서버가 발급합니다" }],
      },
      { args: { id: "dup" }, index: 7 }
    ) as unknown as FakeElement;
    const summary = findByTestId(entry, "ai-tool-failure-summary")?.textContent ?? "";
    expect(summary).toContain("밑그림 검증 실패(2회) — id를 생략하고 다시 보내세요");
    expect(summary).toContain("id 필드는 서버가 발급합니다");
    expect(summary).toContain("내부 재시도 2회");
    const detail = findByTestId(entry, "ai-tool-detail-7");
    const text = detail?.textContent ?? "";
    expect(text).toContain("id를 생략하고 다시 보내세요"); // 오류 원문(재전송 예시) 그대로.
    expect(text).toContain("id 필드는 서버가 발급합니다");
    expect(text).toContain('"id": "dup"');
  });

  it("복원된 대화의 도구 로그는 한 줄 요약으로 남고 JSON 상세는 숨긴다", () => {
    saveConversation({
      id: "conv_tool",
      title: "복원",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [
        { kind: "user", text: "칠해줘" },
        { kind: "tool", name: "paint_tiles", args: { mapId: "map_a", tile: 9 }, ok: true, summary: "타일 3칸" },
      ],
    });
    const panel = renderPanel();
    const activity = findByTestId(panel, "ai-tool-activity");
    expect(activity).toBeTruthy();
    expect(activity?.textContent).toContain("paint_tiles");
    expect(activity?.textContent).toContain("타일 3칸");
    expect(findByTestId(panel, "ai-tool-detail-1")).toBeNull();
  });
});

describe("병합 추론 원문 전체 열람 (V3C ②)", () => {
  it("도구 사이 추론이 한 블록으로 병합돼도 각 추론의 원문 전체가 아이템으로 남고 토글은 횟수를 표시한다", async () => {
    // 환경 고정: .env/.env.local 의 VITE_LLM_API_URL 이 있으면 apiKey+cpen 모드가 되어
    // 스트리밍(이 테스트의 SSE 픽스처 전제)이 꺼진다. aiChatPanelSettings 와 동일하게 스텁한다.
    // agentMode:chat — 이 테스트는 단일 모델·플래너 없는 본문 루프의 SSE 본문 3개를 순서대로
    // 소비한다. 기본 auto 면 플래너 라운드가 첫 본문을 가져가 스트림이 한 칸씩 밀린다.
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat", apiKey: "sk-test" }));
    const sse = (lines: string[]): string => [...lines.map((line) => `data: ${line}`), "data: [DONE]", ""].join("\n\n");
    const toolCallLine = (id: string): string =>
      JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name: "get_project_summary", arguments: "{}" } }] } }] });
    const reasoningLine = (text: string): string => JSON.stringify({ choices: [{ delta: { reasoning: text } }] });
    const bodies = [
      sse([toolCallLine("c1")]),
      sse([reasoningLine("첫 번째 추론 원문입니다."), toolCallLine("c2")]),
      sse([reasoningLine("두 번째 추론 원문입니다."), JSON.stringify({ choices: [{ delta: { content: "완료했습니다" } }] })]),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bodies.shift() ?? sse([]), { status: 200, headers: { "Content-Type": "text/event-stream" } }))
    );

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "요약해줘";
    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
    for (let i = 0; i < 10; i += 1) await flushAsync();

    const reasoningBox = findByTestId(panel, "ai-reasoning") as unknown as FakeElement;
    expect(reasoningBox).toBeTruthy();
    const body = findByTestId(panel, "ai-reasoning-body") as unknown as FakeElement;
    const items = body.querySelectorAll(".ai-reasoning-item");
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toBe("첫 번째 추론 원문입니다.");
    expect(items[1]?.textContent).toBe("두 번째 추론 원문입니다.");
    // 병합 카운트가 토글 문구에 반영된다(💭 추론 2회).
    expect(reasoningBox.textContent).toContain("추론 2회");
    // 조회성 툴(get_*)은 목록 줄 없이 카운트만 — 활동 그룹은 남는다.
    const activity = findByTestId(panel, "ai-tool-activity");
    expect(activity).toBeTruthy();
    expect(findByTestId(panel, "ai-tool-activity-toggle")?.textContent).toMatch(/도구/);
    expect(findByTestId(panel, "ai-tool-detail-1")).toBeNull();
  });
});

describe("실시간 고스트 프리뷰 연결", () => {
  it("채팅 턴의 성공한 쓰기 tool_call 뒤 세션 draft diff 고스트를 발행한다", async () => {
    // 환경 고정(위와 동일) + agentMode:chat — model===liteModel 단일 모델(플래너 없음)의
    // 본문 루프 동작을 고정하는 형상 테스트다. 기본 auto 는 이 판정을 우회해 플래너 라운드가
    // 첫 SSE 본문을 소비한다.
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat", model: "ghost-test-model", liteModel: "ghost-test-model", apiKey: "sk-test" }));
    const sse = (lines: string[]): string => [...lines.map((line) => `data: ${line}`), "data: [DONE]", ""].join("\n\n");
    const createMapArgs = { id: "map_live_ghost", name: "라이브 고스트", width: 6, height: 5 };
    const bodies = [
      sse([
        JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: "c_live",
                function: { name: "create_map", arguments: JSON.stringify(createMapArgs) },
              }],
            },
          }],
        }),
      ]),
      sse([JSON.stringify({ choices: [{ delta: { content: "초안을 만들었습니다." } }] })]),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bodies.shift() ?? sse([]), { status: 200, headers: { "Content-Type": "text/event-stream" } }))
    );

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "새 맵 만들어줘";
    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
    for (let i = 0; i < 16; i += 1) await flushAsync();

    expect(getAgentGhostPreviewState().previews).toEqual([
      expect.objectContaining({
        mapId: "map_live_ghost",
        toolName: "live_project_diff",
        bounds: { x: 0, y: 0, width: 6, height: 5 },
      }),
    ]);
  });
});
