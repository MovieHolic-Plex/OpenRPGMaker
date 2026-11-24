/** @vitest-environment happy-dom */
// 「AI 로 이벤트 고치기」의 실제 모달 통합 계약.
//
// 조수 창(도크)은 없고 맨 아래 한 줄 입력칸이 입구다(목업 v2). 진짜 편집기 모달을 열어, 전역 선택 페이지가 다른 이벤트를
// 가리킬 때(A 를 최소화한 채 B 를 고른 뒤 A 로 돌아옴)도 입력칸이 초점을 받는지 고정한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetEventAiStagedForTest } from "@/editor/panels/eventEditor/aiAssist";
import { resetEventEditLineForTest } from "@/editor/panels/eventEditor/eventEditLine";
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

function lineInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]');
}

describe("AI 이벤트 고치기 — 실제 모달 통합(한 줄 입력칸)", () => {
  let mapId: MapId;

  beforeEach(() => {
    _resetEventDraftVaultForTest();
    resetEventAiStagedForTest();
    resetEventEditLineForTest();
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
    resetEventEditLineForTest();
  });

  it("조수 입구로 새로 열면 한 줄 입력칸이 초점을 받는다", async () => {
    openEventEditorModal(mapId, EVENT_A, { aiDock: true });
    await Promise.resolve();
    expect(document.activeElement).toBe(lineInput());
    expect(document.querySelector('[data-testid="ai-event-assist"]')).toBeNull();
  });

  it("최소화된 편집기를 다른 이벤트 페이지가 선택된 채로 다시 열어도 입력칸이 초점을 받는다", async () => {
    openEventEditorModal(mapId, EVENT_A);
    document.querySelector<HTMLButtonElement>('[data-testid="event-editor-window-minimize"]')?.click();
    expect(document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.hidden).toBe(true);
    editorState.set({ selectedEventId: EVENT_B, selectedEventPageId: "page_b" });

    openEventEditorModal(mapId, EVENT_A, { aiDock: true });
    await Promise.resolve();
    expect(document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.hidden).toBe(false);
    expect(document.activeElement).toBe(lineInput());
  });

  it("이미 열려 있는 편집기를 다시 요청하면 입력칸이 초점을 받는다", async () => {
    openEventEditorModal(mapId, EVENT_A);
    (document.activeElement as HTMLElement | null)?.blur();
    openEventEditorModal(mapId, EVENT_A, { aiDock: true });
    await Promise.resolve();
    expect(document.activeElement).toBe(lineInput());
  });
});
