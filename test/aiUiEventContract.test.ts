// 의미 이벤트 계측이 «조용히 빠지는 것» 을 그 자리에서 막는다.
//
// 왜 소스 원문을 읽는가: 위임 리스너는 앞으로 추가되는 버튼까지 자동으로 잡지만, 결과 수치가
// 필요한 액션(압축·되감기·복원 등)은 명시 호출이라 지우면 아무도 모른다. 그리고 그게 이 작업의
// 출발점이었다 — 「uiEvents」 필드는 타입에 있었지만 chat 채널에서 항상 비어 있었고, 채우는
// 코드가 없다는 사실을 아무 테스트도 잡지 못했다. 도달 불가 결함을 소스로 잠근
// aiPanelDockChrome.test.ts 와 같은 방식이다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AI_UI_ACTIONS, AI_UI_EVENT_SURFACES } from "@/ai/uiEventTypes";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const PANEL = read("src/editor/panels/aiChatPanel.ts");
const HISTORY_MODAL = read("src/editor/panels/aiConversationHistoryModal.ts");
const INSTRUCTIONS_MODAL = read("src/editor/panels/aiInstructionsModal.ts");
const MODE = read("src/app/mode.ts");
const UI_EVENT_LOG = read("src/ai/uiEventLog.ts");

/** 액션 키 → 그 계측이 있어야 하는 파일. 하나라도 사라지면 이 테스트가 그 이름을 말해 준다. */
const CALL_SITES: Readonly<Record<keyof typeof AI_UI_ACTIONS, string>> = {
  contextCompact: PANEL,
  contextCompactUndo: PANEL,
  conversationRestore: HISTORY_MODAL,
  conversationDelete: HISTORY_MODAL,
  conversationExport: PANEL,
  instructionsSave: INSTRUCTIONS_MODAL,
  turnRewind: PANEL,
  dockSwitch: PANEL,
  panelCollapse: PANEL,
  newConversation: PANEL,
  turnAbort: PANEL,
  turnRetry: PANEL,
  temperatureSwitch: PANEL,
};

describe("ai ui event 계측 계약", () => {
  it("every named action has a live call site", () => {
    const missing = Object.keys(AI_UI_ACTIONS).filter((key) => {
      const source = CALL_SITES[key as keyof typeof AI_UI_ACTIONS];
      return !source.includes(`AI_UI_ACTIONS.${key}`);
    });
    expect(missing).toEqual([]);
  });

  it("covers every action name in the constant — 표를 늘리면 계측도 늘어야 한다", () => {
    expect(Object.keys(CALL_SITES).sort()).toEqual(Object.keys(AI_UI_ACTIONS).sort());
  });

  it("action names stay kebab-case and unique — DB 색인이 이 문자열을 그대로 쓴다", () => {
    const values = Object.values(AI_UI_ACTIONS);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value).toMatch(/^[a-z]+(?:-[a-z]+)*$/u);
  });

  it("wires the delegated collector into the app once", () => {
    expect(MODE).toContain("installAiUiEventCapture()");
    expect(MODE).toContain("setAiUiEventSink(");
    expect(MODE).toContain("recordAiUiActionBatch(");
  });

  it("the collector never swallows input", () => {
    // 전면 투명 레이어가 맵 클릭을 삼킨 2026-08-19 P0 과 같은 실패 방식을 원문에서 막는다.
    expect(UI_EVENT_LOG).not.toMatch(/\bpreventDefault\(/u);
    expect(UI_EVENT_LOG).not.toMatch(/\bstopPropagation\(/u);
    expect(UI_EVENT_LOG).not.toMatch(/\bstopImmediatePropagation\(/u);
  });

  it("excludes the map canvas and tile palette from the captured surfaces", () => {
    // 계측 범위는 «AI 표면 전부» 로 합의됐다. 맵 드래그 같은 연속 입력이 섞이면 로그량이
    // 수십 배가 되고 별도 샘플링이 필요하다(승인된 범위 밖).
    const selectors = AI_UI_EVENT_SURFACES.map(([selector]) => selector).join(" ");
    expect(selectors).not.toMatch(/map-canvas|tile-palette|database-studio/u);
    for (const [selector] of AI_UI_EVENT_SURFACES) expect(selector).toMatch(/ai-|ai-harness-modal/u);
  });

  it("the chat turn row carries both audit and front actions", () => {
    // 턴 행이 «턴 구간» audit 을 쓰는지(세션 전체가 아니라) + 프론트 액션을 싣는지.
    expect(PANEL).toContain("sessionAuditCountAtTurnStart");
    expect(PANEL).toContain("takeAiUiEventsSince(uiEventMarkerAtTurnStart)");
    expect(PANEL).toContain("uiActions: turnUiActions");
    // 시작 pending 행과 종료 행이 같은 id 를 쓴다 — 죽은 턴도 지시와 시작 시각은 남는다.
    expect(PANEL).toContain("pending: true");
    expect(PANEL).toContain("id: turnLogId");
    // 소유권을 잃은 턴도 남긴다(예전에는 여기서 그냥 return 했다).
    expect(PANEL).toContain("orphaned: true");
  });
});
