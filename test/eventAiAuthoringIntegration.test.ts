/** @vitest-environment happy-dom */
// 「AI 로 이벤트 고치기」의 실제 모달 통합 계약.
//
// 단위 테스트(`eventAiAuthoringMenu.test.ts`)는 도크를 직접 그려서 본다. 여기서는 **진짜
// 편집기 모달**을 열어, 적대적 리뷰가 재현한 결함을 고정한다: 도크 키를 전역
// `editorState.selectedEventPageId` 로 재구성하면, 다른 이벤트의 페이지가 선택돼 있을 때
// (A 를 최소화한 채 B 를 복사한 뒤 A 로 돌아오는 흐름) 엉뚱한 키를 만져 도크가 펼쳐지지 않는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetEventAiStagedForTest } from "@/editor/panels/eventEditor/aiAssist";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { GameEvent, MapId } from "@/project/types";

const EVENT_A = "ev_ai_int_a";
const EVENT_B = "ev_ai_int_b";

function event(id: string, x: number, pageId: string): GameEvent {
  return {
    id,
    x,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: pageId,
      name: "페이지",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "안녕" }],
    }],
  };
}

function dockOf(): HTMLDetailsElement | null {
  return document.querySelector<HTMLDetailsElement>('[data-testid="ai-event-assist"]');
}

describe("AI 이벤트 저작 — 실제 모달 통합", () => {
  let mapId: MapId;

  beforeEach(() => {
    _resetEventDraftVaultForTest();
    // 도크의 열림/초안 상태는 모듈 수명이라 테스트 사이에 새어 나간다 — 여기서 비운다.
    // (제품에서 이 지속은 의도된 것이다: 손으로 펼친 도크는 편집기를 닫았다 열어도 펼쳐진 채다.)
    resetEventAiStagedForTest();
    const project = createBlankProject();
    mapId = project.startMapId;
    project.maps[mapId]!.events = [event(EVENT_A, 2, "page_a"), event(EVENT_B, 6, "page_b")];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventId: EVENT_A, selectedEventPageId: "page_a" });
  });

  afterEach(() => {
    document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
    document.body.replaceChildren();
    _resetEventDraftVaultForTest();
    resetEventAiStagedForTest();
  });

  it("새로 열면 도크가 펼쳐지고 입력창이 초점을 받는다", () => {
    openEventEditorModal(mapId, EVENT_A, { aiDock: true });
    expect(dockOf()?.open).toBe(true);
    // 요청 열기의 초점은 마이크로태스크에서 옮겨진다.
    return Promise.resolve().then(() => {
      expect(document.activeElement).toBe(document.querySelector('[data-testid="ai-event-input"]'));
    });
  });

  it("aiDock 없이 열면 도크는 닫힌 채로 남는다 — 기본 동작 보존", () => {
    openEventEditorModal(mapId, EVENT_A);
    expect(dockOf()?.open).toBe(false);
  });

  it("최소화된 편집기를 다른 이벤트 페이지가 선택된 채로 다시 열어도 도크가 펼쳐진다", () => {
    openEventEditorModal(mapId, EVENT_A, { aiDock: true });
    // 사용자가 도크를 접고 창을 최소화한다.
    const dock = dockOf();
    if (dock) dock.open = false;
    document.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-minimize"]')?.click();
    expect(document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.hidden).toBe(true);

    // 그 사이 다른 이벤트(B)의 페이지가 선택돼 있다 — 전역 선택으로 키를 재구성하면 여기서 깨진다.
    editorState.set({ selectedEventId: EVENT_B, selectedEventPageId: "page_b" });

    openEventEditorModal(mapId, EVENT_A, { aiDock: true });

    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    expect(modal?.hidden).toBe(false);
    expect(dockOf()?.open).toBe(true);
  });

  it("이미 열려 있는 편집기를 다시 요청하면 도크가 펼쳐진다", () => {
    openEventEditorModal(mapId, EVENT_A);
    expect(dockOf()?.open).toBe(false);

    openEventEditorModal(mapId, EVENT_A, { aiDock: true });
    expect(dockOf()?.open).toBe(true);
  });
});
