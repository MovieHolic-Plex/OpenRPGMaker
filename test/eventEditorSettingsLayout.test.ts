/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { openEventConditions, openEventMovement } from "@/editor/panels/eventEditor/eventEditorOpenState";

describe("event editor settings column layout", () => {
  let host: HTMLElement;

  beforeEach(() => {
    openEventConditions.clear();
    openEventMovement.clear();
    resetEditorUiModeForTests("expert");
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    map.events = [
      {
        id: "ev_layout",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "경비병",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          },
        ],
      },
    ];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
    openEventConditions.clear();
    openEventMovement.clear();
    resetEditorUiModeForTests("standard");
  });

  it("promotes identity and page tabs above the settings rail", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_layout");
    const column = host.querySelector(".event-editor-settings-column");
    expect(column).toBeTruthy();
    const direct = [...(column?.children ?? [])] as HTMLElement[];
    expect(direct).toHaveLength(2);
    expect(direct[0]?.dataset.testid).toBe("event-editor-column-label-settings");
    expect(direct[1]?.classList.contains("event-editor-settings-main")).toBe(true);

    // 카드는 스프라이트 + 이름/캐릭터 ID + 좌표를 한 덩어리로 묶는다.
    const card = host.querySelector<HTMLElement>(".event-editor-card");
    expect(card).toBeTruthy();
    expect(card?.parentElement).toBe(host.querySelector(".event-editor"));
    expect(card?.nextElementSibling?.classList.contains("event-editor-pagebar")).toBe(true);
    expect(card.querySelector(".event-editor-card-sprite")).toBeTruthy();
    expect(card.querySelector(".event-editor-top-strip")).toBeTruthy();
    expect(card.querySelector("[data-testid='event-position-controls']")).toBeTruthy();
    expect(card.querySelector("[data-testid='event-editor-event-id']")).toBeTruthy();
    expect(card.querySelector("[data-testid='event-editor-event-info']")).toBeTruthy();

    // 페이지 선택은 폭이 필요하다 — 좁은 설정 레일 밖, 전용 페이지 행이 유일한 집이다.
    expect(column?.querySelector(".evt-page-segments")).toBeNull();
    expect(host.querySelector(".event-editor-pagebar .evt-page-segments")).toBeTruthy();
    expect(host.querySelector(".event-page-number-tabs")).toBeNull();

    // RM2003 셸: 스케줄 패널은 마운트하지 않음. 페이지 설정만 settings-main 안.
    expect(direct[1]?.querySelector("[data-testid='event-schedule-section']")).toBeNull();
    expect(direct[1]?.querySelector(".event-page-props")).toBeTruthy();
  });

  it("orders six numbered settings groups; characterId lives in top strip", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_layout");
    const main = host.querySelector(".event-editor-settings-main");
    expect(main).toBeTruthy();

    // Character ID is optional identity chrome next to name, not left-settings chrome.
    const topStrip = host.querySelector(".event-editor-top-strip");
    const characterId = host.querySelector('[data-testid="event-character-id-field"]');
    const nameRow = host.querySelector('[data-testid="event-classic-name"]');
    expect(characterId).toBeTruthy();
    expect(nameRow?.contains(characterId)).toBe(false);
    expect(topStrip?.contains(characterId)).toBe(true);
    expect(main?.contains(characterId)).toBe(false);
    // 관계 상태와 연결 행동은 중복 disclosure 없이 카드에서 한 번에 보인다.
    expect(host.querySelector('[data-testid="event-character-id-connect"]')?.textContent).toContain("연결 안 됨");
    expect(host.querySelector('[data-testid="event-character-id-details"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-character-id-input"]')).toBeNull();
    // Empty characterId: no social extras in settings.
    expect(host.querySelector('[data-testid="event-character-social-extras"]')).toBeNull();

    const conditions = host.querySelector('[data-testid="event-classic-conditions"]');
    const graphic = host.querySelector('[data-testid="event-classic-graphic"]');
    const behavior = host.querySelector('[data-testid="event-page-trigger-priority-stack"]');
    const trigger = host.querySelector('[data-testid="event-classic-trigger"]');
    const priority = host.querySelector('[data-testid="event-classic-priority"]');
    const overlap = host.querySelector('[data-testid="event-classic-overlap"]');
    const movement = host.querySelector('[data-testid="event-classic-movement-section"]');
    expect(conditions).toBeTruthy();
    expect(graphic).toBeTruthy();
    expect(behavior).toBeTruthy();
    expect(trigger).toBeTruthy();
    expect(priority).toBeTruthy();
    expect(overlap).toBeTruthy();
    expect(movement).toBeTruthy();
    expect(host.querySelector('[data-testid="event-page-trigger-select"]')).toBeTruthy();

    // Trigger is a sibling of movement, not nested inside it.
    expect(movement?.contains(behavior)).toBe(false);
    expect(movement?.querySelector('[data-testid="event-page-trigger-select"]')).toBeNull();

    expect(main?.querySelectorAll(".event-editor-settings-accordion-group").length).toBeLessThanOrEqual(5);
    expect(main?.querySelector('[data-testid="evt-rail-group-look-talk"]')).toBeTruthy();
    expect(main?.querySelector('[data-testid="evt-rail-group-when"]')).toBeTruthy();
    expect(main?.querySelector('[data-testid="evt-rail-group-move"]')).toBeTruthy();
    expect(main?.querySelector('[data-testid="evt-rail-group-memory"]')).toBeTruthy();
    expect(graphic?.querySelector("legend")?.textContent).toContain("모습");
    expect(trigger?.querySelector("legend")?.textContent).toContain("시작 방식");
    expect(priority?.querySelector("legend")?.textContent).toContain("우선순위");
    expect(overlap?.querySelector("legend")?.textContent).toContain("겹침");

    // Disposition B: no bottom-left/right panes.
    expect(host.querySelector('[data-testid="event-page-bottom-left"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-bottom-right"]')).toBeNull();
  });
});
