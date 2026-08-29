/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { openEventConditions, openEventMovement } from "@/editor/panels/eventEditor/eventEditorOpenState";
import { EVENT_PRIORITY_OPTIONS, TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "p1",
    name: "상자",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "잡화가 들어 있다." }],
    ...overrides,
  };
}

function event(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: "ev_chest",
    x: 4,
    y: 7,
    trigger: { kind: "action" },
    commands: [],
    pages: [page()],
    ...overrides,
  };
}

function render(host: HTMLElement, ev: GameEvent = event()): void {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [ev];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
  renderEventEditorDynamic(host, mapId, ev.id);
}

describe("event editor chest-path UX", () => { let host: HTMLElement;

beforeEach(() => {
  resetEditorUiModeForTests("expert");
  clearCommandInspector();
  openEventConditions.clear();
  openEventMovement.clear();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  resetEditorUiModeForTests("standard");
  clearCommandInspector();
  host.remove();
  document.querySelector('[data-testid="event-command-picker"]')?.remove();
  document.querySelector('[data-testid="event-command-edit-dialog"]')?.remove();
  openEventConditions.clear();
  openEventMovement.clear();
});

it("defaults to the storyboard and does not offer a fake graph tab", () => {
  render(host);
  const list = host.querySelector<HTMLElement>(".cmd-list");
  const board = host.querySelector<HTMLElement>(".event-storyboard");
  expect(list?.hidden).toBe(true);
  expect(board?.hidden).toBe(false);
  expect(host.querySelector('[data-testid="event-view-toggle-graph"]')).toBeNull();
  expect(host.querySelector('[data-testid="event-graph-placeholder"]')).toBeNull();
  expect(host.querySelector('[data-testid="event-view-toggle-list"]')?.textContent).toBe("목록");
  // a87ab4fc 가 크롬을 접으면서 라벨을 «스토리» 로 줄였다(목록·스토리·미리보기 3뷰).
  expect(host.querySelector('[data-testid="event-view-toggle-storyboard"]')?.textContent).toBe("스토리");
});

it("opens the command picker from a storyboard add card without switching views", () => {
  render(host);
  host.querySelector<HTMLButtonElement>('[data-testid="event-view-toggle-storyboard"]')?.click();
  expect(host.querySelector('[data-testid="event-view-toggle-storyboard"]')?.getAttribute("aria-pressed")).toBe("true");
  host.querySelector<HTMLButtonElement>('[data-testid="event-storyboard-add"]')?.click();
  expect(host.querySelector('[data-testid="event-view-toggle-storyboard"]')?.getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector<HTMLElement>(".event-storyboard")?.hidden).toBe(false);
  expect(document.querySelector('[data-testid="event-command-picker"]')).toBeTruthy();
});

it("keeps page add on the tab strip and leaves overflow for copy/delete only", () => {
  render(host);
  expect(host.querySelector('[data-testid="evt-page-add"]')).toBeTruthy();
  expect(host.querySelector('[data-testid="event-page-add"]')).toBeNull();
  expect(host.querySelector('[data-testid="event-page-copy"]')?.textContent).toContain("페이지 복사");
  expect(host.querySelector('[data-testid="event-page-delete"]')).toBeNull();
});

it("hides the character-id field behind a connect action until a profile is linked", () => {
  render(host);
  const field = host.querySelector('[data-testid="event-character-id-field"]');
  expect(field).toBeTruthy();
  expect(host.querySelector('[data-testid="event-character-id-connect"]')?.textContent).toContain("연결 안 됨");
  expect(host.querySelector('[data-testid="event-character-id-details"]')).toBeNull();
  expect(host.querySelector('[data-testid="event-character-id-input"]')).toBeNull();

  host.replaceChildren();
  render(host, event({ characterId: "npc_chest" }));
  expect(host.querySelector('[data-testid="event-character-id-picker-open"]')?.textContent).toContain("npc_chest");
  expect(host.querySelector('[data-testid="event-character-id-input"]')).toBeTruthy();
  expect(host.querySelector('[data-testid="event-character-social-extras"]')).toBeTruthy();
  expect(host.querySelector('[data-testid="event-character-id-connect"]')).toBeNull();
});

it("keeps follower presets and the field-monster template in the closed toolbar menu", () => {
  render(host);
  const contents = host.querySelector('[data-testid="event-script-canvas"]');
  const toolbar = contents?.querySelector(".event-editor-command-toolbar");
  const aux = toolbar?.querySelector<HTMLDetailsElement>('[data-testid="event-editor-aux-tools"]');
  expect(aux).toBeTruthy();
  expect(aux?.open).toBe(false);
  expect(aux?.querySelector('[data-testid="follower-preset-bar"]')).toBeTruthy();
  expect(aux?.querySelector('[data-testid="event-command-toolbar-field-monster"]')).toBeTruthy();
});

it("uses investigation and map-layer wording for trigger and priority", () => {
  expect(TRIGGER_OPTIONS.find((option) => option.value === "action")?.label).toBe("말을 걸면");
  expect(EVENT_PRIORITY_OPTIONS.find((option) => option.value === "below")?.label).toBe("맵 아래");
  expect(EVENT_PRIORITY_OPTIONS.find((option) => option.value === "same")?.label).toBe("캐릭터와 같은 층");
  expect(EVENT_PRIORITY_OPTIONS.find((option) => option.value === "above")?.label).toBe("맵 위");
  render(host);
  const trigger = host.querySelector<HTMLSelectElement>('[data-testid="event-page-trigger-select"]');
  expect(trigger?.selectedOptions[0]?.textContent).toBe("말을 걸면");
  const priority = host.querySelector<HTMLSelectElement>('[data-testid="event-page-priority-select"]');
  expect(priority?.selectedOptions[0]?.textContent).toBe("맵 아래");
});

it("does not advertise movement speed on a stationary event", () => {
  render(host);
  expect(host.querySelector('[data-testid="event-movement-summary-chips"]')?.textContent).toBe("정지");
});

  it("opens the selected branch command instead of its parent choice", () => {
    render(host, event({
      pages: [page({
        commands: [{
          kind: "choices",
          options: [{
            text: "문을 연다",
            branch: [{ kind: "setSwitch", switchId: "switch_1", value: true }],
          }],
        }],
      })],
    }));

    host.querySelector<HTMLButtonElement>("[data-testid='event-view-toggle-storyboard']")?.click();
    const card = host.querySelector<HTMLElement>("[data-testid='event-storyboard-card-0']");
    // 스토리 카드는 목록 행과 같은 계약이다: 한 번 = 선택(편집 창 없음), 두 번 = 편집 창.
    card?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).toBeNull();
    card?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));

    const dialog = document.querySelector('[data-testid="event-command-edit-dialog"] [role="dialog"]');
    expect(dialog?.getAttribute("aria-label")).toBe("선택지 표시");
  });

  it("keeps complete command and branch text available to storyboard users", () => {
    const longBody = "오래된 기록의 첫 문장부터 마지막 문장까지 카드의 시각적 말줄임과 무관하게 보조 기술과 DOM에서 온전히 읽혀야 한다. 이 문장은 기존 120자 절단을 확실히 넘기기 위해 충분히 길게 작성한 회귀 문장이다. 잘린 데이터는 인스펙터를 열기 전 서로 비슷한 대사를 구분할 수 없게 만든다.";
    const longChoice = "기록 보관소의 잠긴 문을 조심스럽게 열고 안쪽을 조사한다";
    render(host, event({
      pages: [page({
        commands: [
          { kind: "text", body: longBody },
          { kind: "choices", options: [{ text: longChoice, branch: [] }] },
        ],
      })],
    }));

    host.querySelector<HTMLButtonElement>("[data-testid='event-view-toggle-storyboard']")?.click();

    expect(host.querySelector(".event-storyboard-card-detail")?.textContent).toContain(longBody);
    expect(host.querySelector("[data-testid='event-storyboard-card-0']")?.getAttribute("aria-label")).toContain("번째 명령");
    expect(host.querySelector(".event-storyboard-branch-label")?.textContent).toBe(longChoice.slice(0, 12));
  });

  it("moves to the complete command list from a truncated branch", () => {
    const branch = Array.from({ length: 5 }, (_, index) => ({
      kind: "text" as const,
      body: `분기 대사 ${index + 1}`,
    }));
    render(host, event({
      pages: [page({ commands: [{ kind: "choices", options: [{ text: "진행", branch }] }] })],
    }));

    host.querySelector<HTMLButtonElement>("[data-testid='event-view-toggle-storyboard']")?.click();
    host.querySelector<HTMLButtonElement>("[data-testid='event-view-toggle-list']")?.click();

    expect(host.querySelector<HTMLElement>(".cmd-list")?.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>(".event-storyboard")?.hidden).toBe(true);
  });

  it("labels an empty storyboard branch without implying hidden commands", () => {
    render(host, event({
      pages: [page({
        commands: [{ kind: "choices", options: [{ text: "아무것도 하지 않는다", branch: [] }] }],
      })],
    }));

    host.querySelector<HTMLButtonElement>("[data-testid='event-view-toggle-storyboard']")?.click();

    expect(host.querySelector(".event-storyboard-branch-label")?.textContent).toBe("아무것도 하지 않는다".slice(0, 12));
    expect(host.querySelector(".event-storyboard-branch-overflow")).toBeNull();
    expect(host.querySelector(".event-storyboard-branch-more")).toBeNull();
  });
});
