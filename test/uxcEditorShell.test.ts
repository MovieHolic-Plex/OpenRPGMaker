import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEventListTooltipModel,
  buildEventMarkerTooltipModel,
  eventDisplayName,
  eventLayerSwitchNotice,
  eventMarkerTooltip,
  renderEventListTooltipElement,
  renderEventMarkerTooltipElement,
  shouldOfferEventLayerSwitch,
} from "@/editor/eventMarkerUx";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import {
  isMapEditLockTakeoverImmediate,
  mapEditLockLastActivityText,
  type MapEditLockStatus,
} from "@/editor/mapEditLocks";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { normalizeAiDockButtonChrome, persistenceModeBannerText } from "@/editor/panels/editor";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => void storage.delete(key),
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
    },
  });
}

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

function fakeElement(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}

function keydown(key: string): KeyboardEvent {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  return event as KeyboardEvent;
}

function namedEvent(name: string): GameEvent {
  return {
    commands: [],
    id: "ev_npc",
    pages: [{
      commands: [],
      conditions: [],
      graphic: {},
      id: "page_1",
      movement: { frequency: 3, speed: 3, type: "fixed" },
      name,
      priority: "same",
      trigger: { kind: "action" },
    }],
    trigger: { kind: "action" },
    x: 4,
    y: 5,
  };
}

beforeEach(() => {
  _resetEventDraftVaultForTest();
  restoreDom = installFakeDom();
  installStorage();
  store.replaceProject(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selectedEventId: null, selectedEventPageId: null });
});

afterEach(() => {
  document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
  document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
  _resetEventDraftVaultForTest();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

describe("UXC D13 이벤트 마커 편집 동선", () => {
  it("비이벤트 레이어 더블클릭에서만 이벤트 레이어 전환을 제안한다", () => {
    expect(shouldOfferEventLayerSwitch({ activeLayer: "lower", clickCount: 2, hasEvent: true })).toBe(true);
    expect(shouldOfferEventLayerSwitch({ activeLayer: "upper", clickCount: 3, hasEvent: true })).toBe(true);
    expect(shouldOfferEventLayerSwitch({ activeLayer: "event", clickCount: 2, hasEvent: true })).toBe(false);
    expect(shouldOfferEventLayerSwitch({ activeLayer: "lower", clickCount: 1, hasEvent: true })).toBe(false);
    expect(shouldOfferEventLayerSwitch({ activeLayer: "lower", clickCount: 2, hasEvent: false })).toBe(false);
  });

  it("이벤트 이름과 명령 요약을 툴팁에 담는다", () => {
    const event = namedEvent("장터 상인");
    event.pages = event.pages.map((page) => ({
      ...page,
      commands: [
        { kind: "text", body: "어서 오세요." },
        { kind: "shop", itemIds: ["item_potion"], buyOnly: false },
        { kind: "wait", ms: 500 },
        { kind: "text", body: "또 오세요." },
        { kind: "text", body: "추가 대사" },
      ],
    }));

    expect(eventDisplayName(event)).toBe("장터 상인");
    const tip = eventMarkerTooltip(event);
    expect(tip).toContain("장터 상인");
    expect(tip).toContain("(4,5)");
    expect(tip).toContain("확인 키로 조사");
    expect(tip).toContain("문장 표시");
    expect(tip).toContain("어서 오세요.");
    expect(tip).toContain("+1개 명령 더");

    const model = buildEventMarkerTooltipModel(event);
    expect(model.commands.length).toBe(4);
    expect(model.moreCommandCount).toBe(1);

    const el = renderEventMarkerTooltipElement(model);
    expect(el.dataset.testid).toBe("event-marker-tooltip");
    expect(el.textContent).toContain("장터 상인");
    expect(el.textContent).toContain("확인 키로 조사");
    expect(el.textContent).toContain("어서 오세요.");

    expect(eventLayerSwitchNotice(event)).toContain("장터 상인");
    expect(eventLayerSwitchNotice(event)).toContain("이벤트 레이어로 전환");
  });
  it("맵 이벤트 목록 호버는 페이지·조건·명령을 더 자세히 담는다", () => {
    const event = namedEvent("장터 상인");
    event.characterId = "npc_market";
    event.pages = [
      {
        ...event.pages[0]!,
        name: "영업중",
        conditions: [{ kind: "switch", switchId: "sw_open", value: true }],
        commands: [
          { kind: "text", body: "어서 오세요." },
          { kind: "shop", itemIds: ["item_potion"] },
        ],
      },
      {
        ...event.pages[0]!,
        id: "page_2",
        name: "폐점",
        conditions: [],
        commands: [{ kind: "text", body: "오늘은 쉽니다." }],
      },
    ];

    const model = buildEventListTooltipModel(event);
    expect(model.title).toBe("폐점");
    expect(model.characterId).toBe("npc_market");
    expect(model.pages).toHaveLength(2);
    expect(model.pages[0]?.conditions.some((line) => line.includes("스위치"))).toBe(true);
    expect(model.pages[0]?.commands.some((line) => line.includes("어서 오세요."))).toBe(true);
    expect(model.pages[1]?.commands.some((line) => line.includes("오늘은 쉽니다."))).toBe(true);

    const el = renderEventListTooltipElement(model);
    expect(el.dataset.testid).toBe("event-list-tooltip");
    expect(el.className).toContain("event-list-tooltip");
    expect(el.textContent).toContain("캐릭터 ID: npc_market");
    expect(el.textContent).toContain("페이지 1 — 영업중");
    expect(el.textContent).toContain("페이지 2 — 폐점");
  });
});

describe("UXC D14/D19/D27/D29 에디터 셸 크롬", () => {
  it("임시 저장 배너에서 내부 URL 파라미터명을 노출하지 않는다", () => {
    const text = persistenceModeBannerText("dev-showcase", true);

    expect(text).toContain("임시 세션");
    expect(text).not.toContain("blankProject");
    expect(text).not.toContain("freshProject");
  });

  it("캔버스 툴바에서 줌 그룹과 맵 저장 액션을 분리한다", () => {
    // 맵 저장/펼침 버튼은 dense 크롬(표준/전문가)에서만 렌더된다 — 기본(초보) 크롬은 줌 전용.
    resetEditorUiModeForTests("expert");
    try {
      const toolbar = document.createElement("div");

      renderCanvasToolbar(toolbar);

      const zoomGroup = findByTestId(fakeElement(toolbar), "editor-zoom-group");
      const saveGroup = findByTestId(fakeElement(toolbar), "editor-map-save-group");
      const expand = findByTestId(fakeElement(toolbar), "editor-canvas-toolbar-expand");
      // P2-11: 줌 그룹은 스테퍼(−/+)와 배율 버튼(1x/2x/4x)만 노출 — "확대"는 title/aria로 이동.
      expect(zoomGroup?.textContent).toContain("2x");
      expect(zoomGroup?.textContent).not.toContain("맵 저장");
      expect(saveGroup?.textContent).toContain("맵 저장");
      expand?.click();
      expect(fakeElement(toolbar).classList.contains("is-expanded")).toBe(true);
    } finally {
      resetEditorUiModeForTests();
    }
  });

  it("AI 패널 언독 버튼 툴팁을 패널 분리로 보정한다", () => {
    const panel = document.createElement("aside");
    panel.className = "ai-chat-panel is-docked";
    const button = document.createElement("button");
    button.dataset.testid = "ai-dock-toggle";
    panel.append(button);

    normalizeAiDockButtonChrome(panel);
    expect(button.getAttribute("title")).toBe("패널 분리");

    panel.classList.remove("is-docked");
    button.click();
    expect(button.getAttribute("title")).toBe("오른쪽 사이드바에 고정");
  });
});

describe("UXC D20 편집 잠금 UX", () => {
  it("잠금 마지막 활동 시각을 분 단위 문구로 표시한다", () => {
    const status: MapEditLockStatus = {
      expiresAt: "2026-07-07T10:05:00.000Z",
      kind: "locked",
      mapId: "map_1",
      mapName: "마을",
      ownerLabel: "브라우저 bbf2",
      updatedAt: "2026-07-07T10:00:00.000Z",
    };

    expect(mapEditLockLastActivityText(status, Date.parse("2026-07-07T10:03:20.000Z"))).toBe("3분 전 활동");
  });

  it("최근 활동 잠금은 확인이 필요하고 오래된 활동은 즉시 인수할 수 있다", () => {
    const recent: MapEditLockStatus = {
      expiresAt: "2026-07-07T10:02:00.000Z",
      kind: "locked",
      mapId: "map_1",
      mapName: "마을",
      ownerLabel: "다른 세션",
      updatedAt: "2026-07-07T10:00:45.000Z",
    };
    const old: MapEditLockStatus = { ...recent, updatedAt: "2026-07-07T10:00:00.000Z" };
    const now = Date.parse("2026-07-07T10:01:40.000Z");

    expect(isMapEditLockTakeoverImmediate(recent, now)).toBe(false);
    expect(isMapEditLockTakeoverImmediate(old, now)).toBe(true);
  });
});

describe("UXC D30 새 이벤트 모달 상태", () => {
  it("새 이벤트 모달 제목과 취소 안내에 자동 저장/복구 상태를 표시한다", () => {
    const mapId = store.getCurrent().startMapId;

    openNewEventEditorModal(mapId, 2, 2);

    const header = findByTestId(fakeBody(), "event-editor-header-save-state");
    const draftStatus = findByTestId(fakeBody(), "event-editor-draft-status");
    const remoteStatus = findByTestId(fakeBody(), "event-editor-remote-status");
    expect(header?.dataset.localState).toBe("new-pristine");
    expect(draftStatus?.dataset.state).toBe("new-pristine");
    expect(header?.dataset.remoteState).toBe(remoteStatus?.dataset.state);
    expect(header?.textContent).toBe(`${draftStatus?.textContent} · ${remoteStatus?.textContent}`);
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(0);

    findByTestId(fakeBody(), "event-editor-apply")?.click();
    expect(draftStatus?.dataset.state).toBe("applied");
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(1);
    findByTestId(fakeBody(), "event-editor-cancel")?.click();
    expect(store.getCurrent().maps[mapId].events).toHaveLength(1);
  });

  it("새 이벤트 모달 취소는 이벤트를 남기지 않는다", () => {
    const mapId = store.getCurrent().startMapId;
    const before = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.length;
    openNewEventEditorModal(mapId, 3, 3);

    findByTestId(fakeBody(), "event-editor-cancel")?.click();

    expect(store.getCurrent().maps[mapId].events).toHaveLength(before);
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(before);
  });

  it("새 이벤트 모달 ESC도 이벤트를 남기지 않는다", () => {
    const mapId = store.getCurrent().startMapId;
    const before = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.length;
    openNewEventEditorModal(mapId, 4, 4);

    findByTestId(fakeBody(), "event-editor-modal")?.dispatchEvent(keydown("Escape"));

    expect(store.getCurrent().maps[mapId].events).toHaveLength(before);
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(before);
  });
});
