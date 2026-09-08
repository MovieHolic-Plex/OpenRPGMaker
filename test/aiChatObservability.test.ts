// V3C 채팅 관측성 회귀: 글자 크기 3단(영속) / 병합 추론 원문 전체 / 도구 호출 상세 아코디언.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_FONT_SIZE_KEY, applyAiFontSize, loadAiFontSize, renderAiChatPanel, renderToolActivityEntry, saveAiFontSize, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";

import { clearConversations, conversationScopeKey, saveConversation } from "@/ai/conversationStore";
import { clearAgentGhostPreview, getAgentGhostPreviewState, subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { closeAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

import * as activityLog from "@/ai/activityLog";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { emptyWikiResponse, isWikiExtraction } from "./wikiTransportFixture";
import * as applyStore from "@/editor/tools/applyChangesetToStore";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(async () => {
  vi.spyOn(activityLog, "recordAiActivity").mockImplementation(async (entry) => {
    return activityLog.buildAiActivityLogRecord(entry);
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
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
  await clearConversations();
});

afterEach(async () => {
  // 진행 중 턴이 패널보다 오래 살아 죽은 DOM 에 쓰는 것을 막는다(위 uxRepairs 와 동일 이유).
  closeAiSettingsModal();
  findByTestId(document.body as unknown as FakeElement, "ai-gate-modal-close")?.click();
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  await clearConversations();
  clearAgentGhostPreview();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Subscribe before clicking. The runner publishes this after terminal UI cleanup;
// storage/restore settlement alone does not mean the chat turn has completed.
function nextTerminalActivity(): Promise<activityLog.AiActivityLogInput> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Chat turn did not publish terminal activity")), 10_000);
    vi.mocked(activityLog.recordAiActivity).mockImplementation(async (entry) => {
      if (entry.channel === "chat" && entry.result.pending !== true) {
        clearTimeout(timeout);
        resolve(entry);
      }
      return activityLog.buildAiActivityLogRecord(entry);
    });
  });
}

function renderPanel(): FakeElement {
  return renderAiChatPanel() as unknown as FakeElement;
}

const sse = (lines: string[]): string => [...lines.map((line) => `data: ${line}`), "data: [DONE]", ""].join("\n\n");
const toolCallLine = (id: string, name: string, args = "{}"): string =>
  JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: args } }] } }] });
const reasoningLine = (text: string): string => JSON.stringify({ choices: [{ delta: { reasoning: text } }] });

function stubChat(tools: readonly string[], bodies: readonly string[]): { intent: number; chat: number } {
  const requests = { intent: 0, chat: 0 };
  // OAuth is the shipped config contract. agentMode:chat alone no longer disables
  // planning: the balanced autonomy dial enables it unless intent says single-step.
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), agentMode: "chat" }));
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    if (!String(url).endsWith("/v1/chat/completions")) return new Response("{}");
    const payload: { stream: boolean; response_format?: { type: string }; messages: { role: string; content?: unknown }[] } = JSON.parse(String(init?.body));
    if (isWikiExtraction(payload.messages)) return emptyWikiResponse();
    if (payload.response_format?.type === "json_object") {
      requests.intent += 1;
      expect(payload.stream).toBe(false);
      const intent = tools.includes("create_map")
        ? {
            mode: "create",
            space: "none",
            needsPlan: false,
            tools,
            requestRequirements: {
              entries: [{
                source: [{ start: 0, end: 8, quote: "새 맵 만들어줘" }],
                criteria: [
                  { kind: "mapDimensions", target: { newMapName: "라이브 고스트" }, width: 6, height: 5 },
                  { kind: "mapCount", targets: [{ newMapName: "라이브 고스트" }], count: 1 },
                ],
                bindings: [],
              }],
            },
          }
        : { mode: "question", space: "none", needsPlan: false, tools };
      return new Response(JSON.stringify({ choices: [{ message: {
        role: "assistant", content: JSON.stringify(intent),
      }, finish_reason: "stop" }] }), { headers: { "Content-Type": "application/json" } });
    }
    requests.chat += 1;
    expect(payload.stream).toBe(true);
    // Route by actual tool results, not by a shared fetch queue. Intent/persistence
    // traffic cannot steal a chat response; unexpected extra rounds fail loudly.
    const completedTools = payload.messages.filter((message) => message.role === "tool").length;
    const body = bodies[completedTools];
    if (body === undefined) throw new Error(`Unexpected chat round after ${completedTools} tools`);
    return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
  }));
  return requests;
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
    // 글자 크기 select 는 채팅 본문 인라인 폼이 아니라 **전용 설정 모달** 안에 있다(UX P0/P1 에서
    // 인라인 ai-config 폼을 걷어냈다). 패널 테스트는 톱바가 없어서 ☰ 설정으로 연다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test" }));
    const panel = renderPanel();
    (findByTestId(panel, "ai-command-menu-settings") as unknown as FakeElement).click();
    const modal = findByTestId(document.body as unknown as FakeElement, "ai-settings-modal") as unknown as FakeElement;
    expect(modal).toBeTruthy();
    const select = findByTestId(modal, "ai-font-size") as unknown as FakeElement;
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

  it("기록 줌 스테퍼는 없다 — Ctrl+휠이 글자 크기를 바꾸고 영속한다", () => {
    // Break: − 100% + 크롬이 되살아나거나, Ctrl+휠 경로가 저장·데이터 속성을 안 바꾼다.
    const panel = renderPanel();
    expect(findByTestId(panel, "ai-log-zoom")).toBeNull();
    const body = findByTestId(panel, "ai-chat-body") as unknown as FakeElement;
    const wheel = (deltaY: number): Event => {
      const event = new Event("wheel", { cancelable: true });
      Object.defineProperties(event, { ctrlKey: { value: true }, deltaY: { value: deltaY } });
      return event;
    };
    body.dispatchEvent(wheel(-100));
    expect(storage.get(AI_FONT_SIZE_KEY)).toBe("large");
    expect(panel.dataset.aiFontSize).toBe("large");
    expect(panel.style["--ai-font-scale"]).toBe("1.2");
    body.dispatchEvent(wheel(100));
    expect(panel.dataset.aiFontSize).toBe("normal");
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
    // 출하 계약: 성공 라인은 도구 id 가 아니라 사람이 읽는 요약 한 줄이다(활동 내레이션,
    // aiChatRenderers.formatToolActivityLine — 요약이 비었을 때만 도구 이름으로 떨어진다).
    expect(entry.textContent).toContain("타일 5칸 칠함");
    expect(entry.textContent).not.toContain("mapId");
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

  it("복원된 대화의 도구 로그는 한 줄 요약으로 남고 JSON 상세는 숨긴다", async () => {
    await saveConversation({
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
    await whenAiChatPanelSettled();
    const activity = findByTestId(panel, "ai-tool-activity");
    expect(activity).toBeTruthy();
    // 복원 경로도 실시간 경로와 같은 렌더러를 쓴다 — 요약 한 줄, 도구 id·JSON 없음.
    expect(activity?.textContent).toContain("타일 3칸");
    expect(activity?.textContent).not.toContain("map_a");
    expect(findByTestId(panel, "ai-tool-detail-1")).toBeNull();
  });
});

describe("병합 추론 원문 전체 열람 (V3C ②)", () => {
  it("도구 사이 추론이 한 블록으로 병합돼도 각 추론의 원문 전체가 아이템으로 남고 토글은 횟수를 표시한다", async () => {
    const regionArgs = { mapId: store.getCurrent().startMapId, x: 0, y: 0, w: 2, h: 2 };
    const requests = stubChat(["get_project_summary", "get_map_region"], [
      sse([toolCallLine("c1", "get_project_summary")]),
      sse([reasoningLine("reasoning-first-sentinel"), toolCallLine("c2", "get_map_region", JSON.stringify(regionArgs))]),
      sse([reasoningLine("reasoning-second-sentinel"), JSON.stringify({ choices: [{ delta: { content: "answer-sentinel" } }] })]),
    ]);

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    const terminal = nextTerminalActivity();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "요약해줘";
    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
    const result = await terminal;
    expect(result.result).toMatchObject({ ok: true, stoppedReason: "final" });
    expect(requests).toEqual({ intent: 1, chat: 3 });
    expect(result.toolCalls).toMatchObject([
      { name: "get_project_summary", ok: true },
      { name: "get_map_region", ok: true },
    ]);

    const reasoningBox = findByTestId(panel, "ai-reasoning") as unknown as FakeElement;
    expect(reasoningBox).toBeTruthy();
    const body = findByTestId(panel, "ai-reasoning-body") as unknown as FakeElement;
    const items = body.querySelectorAll(".ai-reasoning-item");
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toBe("reasoning-first-sentinel");
    expect(items[1]?.textContent).toBe("reasoning-second-sentinel");
    // 병합 카운트가 토글 문구에 반영된다(💭 추론 2회).
    expect(reasoningBox.querySelector(".ai-reasoning-toggle")?.textContent).toMatch(/\b2\b/);
    expect(body.hidden).toBe(true);
    reasoningBox.querySelector(".ai-reasoning-toggle")?.click();
    expect(body.hidden).toBe(false);
    // 조회성 툴(get_*)은 목록 줄 없이 카운트만 — 활동 그룹은 남는다.
    const activity = findByTestId(panel, "ai-tool-activity");
    expect(activity).toBeTruthy();
    // Distinct reads preserve two real tool rounds without duplicate-call merging.
    const activityLog = findByTestId(panel, "ai-chat-log") as unknown as FakeElement;
    const toggle = findByTestId(panel, "ai-tool-activity-toggle");
    expect(toggle?.textContent).toMatch(/\b2\b/);
    expect(activityLog.textContent ?? "").not.toContain("get_project_summary");
    expect(findByTestId(panel, "ai-tool-detail-1")).toBeNull();
  });
});

describe("실시간 고스트 프리뷰 연결", () => {
  it("채팅 턴의 성공한 쓰기 tool_call 뒤 세션 draft diff 고스트를 발행한다", async () => {
    const createMapArgs = { id: "map_live_ghost", name: "라이브 고스트", width: 6, height: 5 };
    const requests = stubChat(["create_map"], [
      sse([toolCallLine("c_live", "create_map", JSON.stringify(createMapArgs))]),
    ]);

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    const terminal = nextTerminalActivity();
    // 턴 **도중** 발행된 초안 고스트를 구독으로 잡는다. 적용이 즉시 저장소를 바꾸면
    // 초안 diff 가 사라져 관측할 수 없다 — 실제 apply 를 고스트 이벤트까지 붙잡아 둔다.
    const observed: { mapId: string; toolName: string; bounds: unknown }[] = [];
    let applyReleased = false;
    let releaseApply = (): void => undefined;
    const applyGate = new Promise<void>((resolve) => {
      releaseApply = () => {
        if (applyReleased) return;
        applyReleased = true;
        resolve();
      };
    });
    const originalApply = applyStore.applyProposedProject;
    const applySpy = vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async (proposed, options) => {
      await applyGate;
      return originalApply(proposed, options);
    });
    let unsubscribeGhost = (): void => undefined;
    let ghostTimer: ReturnType<typeof setTimeout> | undefined;
    const liveGhost = new Promise<void>((resolve, reject) => {
      ghostTimer = setTimeout(() => reject(new Error("Live ghost preview did not publish")), 10_000);
      unsubscribeGhost = subscribeAgentGhostPreview((state) => {
        for (const preview of state.previews) {
          observed.push({ mapId: preview.mapId, toolName: preview.toolName, bounds: preview.bounds });
          if (preview.mapId === "map_live_ghost" && preview.toolName === "live_project_diff") resolve();
        }
      });
    });
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "새 맵 만들어줘";
    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
    let result: activityLog.AiActivityLogInput | undefined;
    let failure: unknown;
    try {
      await liveGhost;
      releaseApply();
      result = await terminal;
    } catch (error) {
      failure = error;
    } finally {
      if (ghostTimer !== undefined) clearTimeout(ghostTimer);
      unsubscribeGhost();
      releaseApply();
      if (failure) {
        findByTestId(panel, "ai-abort")?.click();
        await whenAiChatPanelSettled();
        await Promise.resolve(terminal).then(() => undefined, () => undefined);
      }
      applySpy.mockRestore();
    }
    if (failure) throw failure;
    if (!result) throw new Error("Chat turn did not publish terminal activity");
    expect(result.result).toMatchObject({ ok: true, stoppedReason: "final", appliedCalls: 1 });
    expect(requests).toEqual({ intent: 1, chat: 1 });
    expect(result.toolCalls).toEqual(expect.arrayContaining([expect.objectContaining({ name: "create_map", ok: true })]));
    expect(store.getCurrent().maps.map_live_ghost).toMatchObject(createMapArgs);

    expect(observed).toEqual(
      expect.arrayContaining([
        {
          mapId: "map_live_ghost",
          toolName: "live_project_diff",
          bounds: { x: 0, y: 0, width: 6, height: 5 },
        },
      ])
    );
    // 적용이 끝난 뒤에는 초안 고스트가 남지 않는다(실제 변경이 됐으므로).
    expect(getAgentGhostPreviewState().previews).toEqual([]);
  });
});
