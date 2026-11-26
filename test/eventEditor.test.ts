// @vitest-environment happy-dom

import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command, CharacterFootprint, EventPage } from "@/project/types";
import { captureFormSurface } from "./eventEditorFormSurface";
import { captureInteractionSurface } from "./eventEditorInteractionSurface";
import { probeCommandControls } from "./eventEditorCommitProbe";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { inspectorTitle } from "@/editor/panels/eventEditor/inspectorChoicesTitle";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { attachWindowDrag } from "@/editor/panels/eventEditor/modalDrag";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { derivedScaleForBody, footprintSummary } from "@/editor/panels/eventEditor/pageFootprint";
import { footprintPreviewLayout } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { openEventConditions, openEventMovement, activeEventRailGroup } from "@/editor/panels/eventEditor/eventEditorOpenState";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { isolateTimers } from "./mergedTeardown";

// 명령 하나가 렌더를 터뜨려도 이벤트 전체가 흰 화면이 되면 안 된다.
// 깨진 카드만 자리 표시자로 그리고 형제는 정상 표시한다.
describe("eventEditorBrokenCommandIsolation", () => {
  isolateTimers();
  const noop = (): void => {};
  const actions: CommandListActions = {
    addCommand: noop,
    insertCommand: noop,
    replaceCommand: noop,
    deleteCommand: noop,
    moveCommand: noop,
    moveCommandTo: noop,
  };
  const GOOD: Command = { kind: "text", speaker: "장로", body: "허허, 잘 왔네." };
  // 요약기가 options.length 에서 터지는 깨진 선택지 — 가드로 못 막는未知 모양의 대리인.
  const BROKEN = { kind: "choices", prompt: "???" } as unknown as Command;
  describe("깨진 명령 격리", () => {
    it("스토리보드: 깨진 카드 옆에 정상 카드가 그려진다", () => {
      const host = renderStoryboard([GOOD, BROKEN, GOOD]);
      document.body.append(host);
      try {
        expect(host.querySelectorAll(".event-storyboard-card").length).toBe(3);
        const broken = host.querySelector('[data-testid="event-storyboard-broken-1"]');
        expect(broken).not.toBeNull();
        expect(broken?.textContent ?? "").toContain("표시할 수 없는 명령");
        const cards = Array.from(host.querySelectorAll(".event-storyboard-card"));
        expect(cards[0]?.textContent ?? "").toContain("허허");
        expect(cards[2]?.textContent ?? "").toContain("허허");
      } finally {
        host.remove();
      }
    });

    it("목록: 깨진 행 옆에 정상 행이 그려진다", () => {
      const host = document.createElement("div");
      document.body.append(host);
      try {
        renderCommandList(host, [GOOD, BROKEN, GOOD], [], actions);
        expect(host.querySelectorAll(".cmd-item").length).toBe(3);
        const broken = host.querySelector('[data-testid="event-command-broken-1"]');
        expect(broken).not.toBeNull();
        expect(broken?.textContent ?? "").toContain("표시할 수 없는 명령");
        expect(host.querySelectorAll('[data-testid="event-command-text"]').length).toBe(2);
      } finally {
        host.remove();
      }
    });

    it("분기 안 깨진 명령도 형제를 가리지 않는다", () => {
      const fork: Command = {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_1", value: true },
        then: [GOOD, BROKEN],
        else: [],
      };
      const host = renderStoryboard([fork]);
      document.body.append(host);
      try {
        const cards = host.querySelectorAll(".event-storyboard-card, .event-storyboard-branch-command");
        expect(cards.length).toBeGreaterThanOrEqual(3);
        expect(host.querySelector('[data-testid^="event-storyboard-broken-"]')).not.toBeNull();
      } finally {
        host.remove();
      }
    });
  });
});

describe("eventEditorFormSurfaceLifecycle", () => {
  isolateTimers();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.stubGlobal("Image", class {
      addEventListener(): void {}
      set src(_value: string) {}
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("stops the animation interval after harvesting a detached command form", () => {
    const scheduled = vi.spyOn(window, "setInterval");
    const cleared = vi.spyOn(window, "clearInterval");
    const before = vi.getTimerCount();

    const surface = captureFormSurface("showAnimation");

    expect(surface.error).toBeUndefined();
    expect(surface.controls["show-animation-play"]).toBe("button{}");
    expect(scheduled).toHaveBeenCalledTimes(1);
    const timer = scheduled.mock.results[0];
    if (timer?.type !== "return") throw new Error("Animation timer was not scheduled");
    expect(cleared).toHaveBeenCalledWith(timer.value);
    expect(vi.getTimerCount()).toBe(before);
  });
  it("releases intervals started by interaction-driven preview changes", () => {
    const before = vi.getTimerCount();
    const surface = captureInteractionSurface(MINIMAL_COMMANDS.showAnimation, "showAnimation");
    expect(surface.error).toBeUndefined();
    expect(surface.reactions).toHaveProperty("show-animation-animationId-select");
    expect(vi.getTimerCount()).toBe(before);
  });
  it("keeps commit probes static even when a browser window already exists", () => {
    const before = vi.getTimerCount();
    const schedule = window.setInterval;
    const run = probeCommandControls(MINIMAL_COMMANDS.showAnimation);
    expect(run.error).toBeUndefined();
    expect(run.results.some(result => result.key === "show-animation-animationId-select")).toBe(true);
    expect(window.setInterval).toBe(schedule);
    expect(vi.getTimerCount()).toBe(before);
  });
});

describe("eventEditorInspectorTitle", () => {
  isolateTimers();
  const choicesCmd: Command = {
    kind: "choices",
    prompt: "두 길목을 정리해 줄래?",
    options: [
      { text: "맡는다", branch: [] },
      { text: "나중에", branch: [] },
    ],
    cancelBehavior: "choice2",
  };
  describe("inspectorTitle", () => {
    it("uses the trimmed prompt as the compact choices title (no options, no cancel)", () => {
      const title = inspectorTitle(choicesCmd);
      expect(title).toBe("두 길목을 정리해 줄래?");
      expect(title).not.toContain("1.맡는다");
      expect(title).not.toContain("나중에");
      expect(title).not.toContain("취소");
    });

    it("falls back to `선택지 N개` when the prompt is empty or whitespace", () => {
      const empty: Command = { ...choicesCmd, prompt: "" };
      const blank: Command = { ...choicesCmd, prompt: "   \n  " };
      const missing: Command = { kind: "choices", options: choicesCmd.options };
      expect(inspectorTitle(empty)).toBe("선택지 2개");
      expect(inspectorTitle(blank)).toBe("선택지 2개");
      expect(inspectorTitle(missing)).toBe("선택지 2개");
    });

    it("collapses multiline prompts to one line", () => {
      const multiline: Command = { ...choicesCmd, prompt: "첫째 줄\n\n  둘째   줄" };
      const title = inspectorTitle(multiline);
      expect(title).toBe("첫째 줄 둘째 줄");
      expect(title).not.toContain("\n");
    });

    it("ellipsizes prompts longer than 80 chars", () => {
      const long: Command = { ...choicesCmd, prompt: "가".repeat(100) };
      const title = inspectorTitle(long);
      expect(title.length).toBeLessThanOrEqual(80);
      expect(title.endsWith("…")).toBe(true);
      expect(title).not.toContain("맡는다");
    });

    it("keeps commandSummary output for non-choices kinds", () => {
      const waitCmd: Command = { kind: "wait", ms: 1500 };
      expect(inspectorTitle(waitCmd)).toBe(commandSummary(waitCmd));
      expect(inspectorTitle(waitCmd)).toContain("대기");
    });

    it("leaves the list-row commandSummary contract untouched", () => {
      const summary = commandSummary(choicesCmd);
      expect(summary).toContain("선택지 표시");
      expect(summary).toContain("맡는다");
      expect(summary).toContain("나중에");
    });
  });
});

// test/eventEditorModalDragSvgTarget.test.ts
//
// 이벤트 편집기 헤더 드래그는 헤더 안 단추 위에서 시작하면 안 된다 — 시작하면 setPointerCapture +
// preventDefault 가 뒤따르는 click 을 삼킨다. 단추 아이콘이 SVG 로 바뀐 뒤(글리프 → SVG 세트)
// 포인터 대상이 `<path>` 가 되면서 `instanceof HTMLElement` 가림막이 비켜났고, 닫기(×)·전체 보기
// 단추가 실제 마우스로는 눌리지 않았다(2026-09-03 실측, e2e event-ai-command-dock «닫기» 단계).
describe("eventEditorModalDragSvgTarget", () => {
  isolateTimers();
  function mount(): { handle: HTMLElement; windowEl: HTMLElement; path: Element; button: HTMLButtonElement } {
    const windowEl = document.createElement("section");
    const handle = document.createElement("header");
    const button = document.createElement("button");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.append(path);
    button.append(svg);
    handle.append(button);
    windowEl.append(handle);
    document.body.append(windowEl);
    handle.setPointerCapture = () => undefined;
    handle.hasPointerCapture = () => false;
    handle.releasePointerCapture = () => undefined;
    attachWindowDrag(handle, windowEl);
    return { handle, windowEl, path, button };
  }
  function pointerDown(target: Element): PointerEvent {
    const event = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 10 });
    target.dispatchEvent(event);
    return event;
  }
  describe("attachWindowDrag — 단추 위 포인터", () => {
    it("SVG 아이콘(path)을 누르면 드래그를 시작하지 않아 click 이 살아남는다", () => {
      const { windowEl, path } = mount();
      const event = pointerDown(path);
      expect(event.defaultPrevented).toBe(false);
      expect(windowEl.classList.contains("dragging")).toBe(false);
    });

    it("단추 자체를 누를 때도 같다(기존 동작)", () => {
      const { windowEl, button } = mount();
      const event = pointerDown(button);
      expect(event.defaultPrevented).toBe(false);
      expect(windowEl.classList.contains("dragging")).toBe(false);
    });

    it("헤더 빈 곳을 누르면 드래그가 시작된다", () => {
      const { handle, windowEl } = mount();
      const event = pointerDown(handle);
      expect(event.defaultPrevented).toBe(true);
      expect(windowEl.classList.contains("dragging")).toBe(true);
    });
  });
});

describe("eventEditorOpenState", () => {
  isolateTimers();
  // 편집창의 "크기와 통행" 필드셋 — 2차 스펙 §5.
  //
  // 저작 경로가 없다는 것이 2차의 출발점이었다. 이 스위트는 그 경로가 실제로 값을 쓰는지,
  // 그리고 UI 가 `passRows <= height` 불변식을 스스로 지키는지 본다.
  describe("eventEditorFootprintField", () => {
    isolateTimers();
    const MAP_EVENT_ID = "ev_footprint";
    function setupProject(overrides: Partial<EventPage> = {}): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      map.events = [
        {
          id: MAP_EVENT_ID,
          x: 5,
          y: 7,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "p1",
              name: "골렘",
              conditions: [],
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              overlapForbidden: true,
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
              ...overrides,
            },
          ],
        },
      ];
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      return mapId;
    }
    function currentPage(): EventPage {
      const mapId = store.getCurrent().startMapId;
      const page = store.getCurrent().maps[mapId]?.events
        .find((event) => event.id === MAP_EVENT_ID)
        ?.pages?.[0];
      if (!page) throw new Error("page missing");
      return page;
    }
    describe("이벤트 편집창 — 크기와 통행 필드셋", () => {
      let host: HTMLElement;

      beforeEach(() => {
        openEventConditions.clear();
        openEventMovement.clear();
        host = document.createElement("div");
        document.body.append(host);
      });

      afterEach(() => {
        host.remove();
        openEventConditions.clear();
        openEventMovement.clear();
      });

      function render(): void {
        renderEventEditorDynamic(host, store.getCurrent().startMapId, MAP_EVENT_ID);
      }

      function input(testid: string): HTMLInputElement {
        const found = host.querySelector<HTMLInputElement>(`[data-testid='${testid}']`);
        if (!found) throw new Error(`missing input: ${testid}`);
        return found;
      }

      function change(testid: string, value: string): void {
        const control = input(testid);
        control.value = value;
        control.dispatchEvent(new Event("change"));
      }

      it("필드셋과 세 입력이 페이지 값을 그대로 보여준다", () => {
        setupProject({ footprint: { width: 3, height: 3 }, passRows: 1, graphic: { scale: 3 } });
        render();
        expect(host.querySelector("[data-testid='event-classic-footprint']")).toBeTruthy();
        expect(input("event-page-body-width").value).toBe("3");
        expect(input("event-page-body-height").value).toBe("3");
        expect(input("event-page-pass-rows").value).toBe("1");
        // 통행 행 상한은 몸 높이다 — 3 을 넘는 값을 스피너가 애초에 못 만든다.
        expect(input("event-page-pass-rows").max).toBe("3");
      });

      it("발자국 없는 기존 페이지는 1x1 · 통행 1행으로 보인다(항등 기본값)", () => {
        setupProject();
        render();
        expect(input("event-page-body-width").value).toBe("1");
        expect(input("event-page-body-height").value).toBe("1");
        expect(input("event-page-pass-rows").value).toBe("1");
        expect(input("event-page-body-scale").value).toBe("1");
        expect(input("event-page-body-scale-manual").checked).toBe(false);
        // 아직 아무것도 안 만졌으니 페이지에 필드가 생겨서도 안 된다.
        expect(currentPage().footprint).toBeUndefined();
        expect(currentPage().passRows).toBeUndefined();
      });

      it("몸 크기를 바꾸면 발자국·통행 행·배율을 한 패치로 쓴다", () => {
        setupProject();
        render();
        change("event-page-body-height", "3");
        change("event-page-body-width", "3");
        const page = currentPage();
        expect(page.footprint).toEqual({ width: 3, height: 3 });
        expect(page.passRows).toBe(1);
        // 배율은 파생값이다 — 3x3 몸은 3배 그림.
        expect(page.graphic.scale).toBe(3);
      });

      it("몸 높이를 줄이면 통행 행이 같이 줄어 불변식이 깨지지 않는다", () => {
        setupProject({ footprint: { width: 1, height: 4 }, passRows: 4, graphic: { scale: 4 } });
        render();
        change("event-page-body-height", "2");
        expect(currentPage().passRows).toBe(2);
        expect(currentPage().footprint).toEqual({ width: 1, height: 2 });
        // 클램프 결과가 화면에도 되비쳐야 한다 — 4 가 남아 있으면 작성자가 저장값을 오해한다.
        expect(input("event-page-pass-rows").value).toBe("2");
        expect(input("event-page-pass-rows").max).toBe("2");
      });

      it("통행 행이 몸 높이를 넘게 입력되면 몸 높이로 잘린다", () => {
        setupProject({ footprint: { width: 3, height: 2 }, passRows: 1, graphic: { scale: 3 } });
        render();
        change("event-page-pass-rows", "7");
        expect(currentPage().passRows).toBe(2);
      });

      it("축 입력은 1..8 로 잘린다", () => {
        setupProject();
        render();
        change("event-page-body-width", "99");
        expect(currentPage().footprint).toEqual({ width: 8, height: 1 });
        change("event-page-body-width", "0");
        expect(currentPage().footprint?.width).toBe(1);
      });

      it("배율 직접 지정을 켜면 입력값이 그대로 저장되고 파생을 멈춘다", () => {
        setupProject();
        render();
        const manual = input("event-page-body-scale-manual");
        expect(input("event-page-body-scale").disabled).toBe(true);
        manual.checked = true;
        manual.dispatchEvent(new Event("change"));
        expect(input("event-page-body-scale").disabled).toBe(false);
        change("event-page-body-scale", "1.5");
        change("event-page-body-height", "3");
        // 몸은 3칸이지만 그림은 1.5배 — 1차가 약속한 "그림과 발자국의 독립" 탈출구.
        expect(currentPage().footprint).toEqual({ width: 1, height: 3 });
        expect(currentPage().graphic.scale).toBe(1.5);
      });

      it("저장된 배율이 파생값과 다르면 직접 지정으로 열고 온다", () => {
        setupProject({ footprint: { width: 2, height: 2 }, passRows: 2, graphic: { scale: 5 } });
        render();
        expect(input("event-page-body-scale-manual").checked).toBe(true);
        expect(input("event-page-body-scale").disabled).toBe(false);
        expect(input("event-page-body-scale").value).toBe("5");
      });

      it("미리보기 격자가 통행 행만 칠하고 앵커 칸을 표시한다", () => {
        setupProject({ footprint: { width: 3, height: 3 }, passRows: 1, graphic: { scale: 3 } });
        render();
        const grid = host.querySelector("[data-testid='event-page-footprint-preview-grid']");
        const cells = [...(grid?.children ?? [])] as HTMLElement[];
        expect(cells).toHaveLength(9);
        expect(cells.filter((cell) => cell.dataset.pass === "true")).toHaveLength(3);
        // 하단 행만 칠한다 — 상단 6칸은 뒤로 지나갈 수 있다.
        expect(cells.slice(6).every((cell) => cell.dataset.pass === "true")).toBe(true);
        expect(cells.slice(0, 6).every((cell) => cell.dataset.pass === undefined)).toBe(true);
        expect(cells.findIndex((cell) => cell.dataset.anchor === "true")).toBe(7);
      });

      it("미리보기가 값 변경을 따라간다", () => {
        setupProject();
        render();
        expect(host.querySelectorAll("[data-testid='event-page-footprint-preview-grid'] > *")).toHaveLength(1);
        change("event-page-body-height", "3");
        change("event-page-body-width", "2");
        const cells = [...host.querySelectorAll("[data-testid='event-page-footprint-preview-grid'] > *")] as HTMLElement[];
        expect(cells).toHaveLength(6);
        expect(cells.filter((cell) => cell.dataset.pass === "true")).toHaveLength(2);
        // 짝수 폭 앵커는 중앙 **왼쪽** — 하단 행의 첫 칸이다.
        expect(cells.findIndex((cell) => cell.dataset.anchor === "true")).toBe(4);
      });

      it("요약 문구가 통행 행 수를 말한다", () => {
        setupProject({ footprint: { width: 3, height: 3 }, passRows: 1, graphic: { scale: 3 } });
        render();
        const summary = host.querySelector("[data-testid='event-page-footprint-summary']");
        expect(summary?.textContent).toContain("하단 1행");
        expect(summary?.textContent).toContain("3칸");
      });
    });
    describe("derivedScaleForBody — 1x1 은 항등이어야 한다", () => {
      it("타일 수를 그대로 배율로 쓴다", () => {
        // 캐릭터셋 칸(24x32)을 타일(16)로 나누면 1x1 이 0.67 로 쪼그라든다. 기존 페이지의
        // 모습이 바뀌면 안 되므로 타일 수를 그대로 쓴다.
        expect(derivedScaleForBody({ width: 1, height: 1 })).toBe(1);
        expect(derivedScaleForBody({ width: 2, height: 2 })).toBe(2);
        expect(derivedScaleForBody({ width: 3, height: 3 })).toBe(3);
      });

      it("축 중 큰 쪽을 쓴다 — 1x3 기둥에 2칸짜리 그림이 붙으면 안 된다", () => {
        expect(derivedScaleForBody({ width: 1, height: 3 })).toBe(3);
        expect(derivedScaleForBody({ width: 3, height: 1 })).toBe(3);
      });
    });
    describe("footprintSummary — 무엇이 막히는지 말로 확인", () => {
      const body: CharacterFootprint = { width: 3, height: 3 };

      it("1칸은 특수 문구", () => {
        expect(footprintSummary({ width: 1, height: 1 }, 1)).toContain("1칸");
      });

      it("통행 행이 몸 높이와 같으면 전부 막는다고 말한다", () => {
        expect(footprintSummary(body, 3)).toContain("9칸 전부");
      });

      it("일부만 막으면 지나갈 수 있는 행 수를 말한다", () => {
        const text = footprintSummary(body, 1);
        expect(text).toContain("하단 1행(3칸)");
        expect(text).toContain("위 2행");
        expect(text).toContain("조사는 몸 전체");
      });
    });
    describe("footprintPreviewLayout — 몸 사각과 그림의 기하", () => {
      it("1x1 배율 1 은 기존 미리보기와 같은 크기(48x64)로 확대된다", () => {
        const layout = footprintPreviewLayout({ footprint: { width: 1, height: 1 }, scale: 1 });
        expect(layout.canvas).toEqual({ width: 24, height: 32 });
        expect(layout.zoom).toBe(2);
        // 캐릭터셋 칸이 타일보다 크므로 1x1 도 이미 몸 사각을 넘어 그려진다(RM2K3 관례).
        expect(layout.body).toEqual({ x: 4, y: 16, width: 16, height: 16 });
        expect(layout.sprite).toEqual({ x: 0, y: 0, width: 24, height: 32 });
      });

      it("3x3 배율 3 은 몸 사각 위로 그림이 자란다", () => {
        const layout = footprintPreviewLayout({ footprint: { width: 3, height: 3 }, scale: 3 });
        expect(layout.canvas).toEqual({ width: 72, height: 96 });
        expect(layout.body).toEqual({ x: 12, y: 48, width: 48, height: 48 });
        expect(layout.sprite).toEqual({ x: 0, y: 0, width: 72, height: 96 });
        expect(layout.anchorColumn).toBe(1);
      });

      it("짝수 폭 앵커는 중앙 왼쪽이고 그림 중앙이 그 칸 중앙에 온다", () => {
        const layout = footprintPreviewLayout({ footprint: { width: 2, height: 2 }, scale: 2 });
        expect(layout.anchorColumn).toBe(0);
        const anchorCenter = layout.body.x + layout.anchorColumn * 16 + 8;
        expect(layout.sprite.x + layout.sprite.width / 2).toBe(anchorCenter);
      });

      it("몸이 그림보다 넓으면 그림이 안쪽으로 들어간다", () => {
        const layout = footprintPreviewLayout({ footprint: { width: 8, height: 1 }, scale: 1 });
        expect(layout.body.x).toBe(0);
        expect(layout.sprite.x).toBe(44);
        expect(layout.canvas.width).toBe(128);
      });

      it("배율이 없으면 1 로 본다", () => {
        expect(footprintPreviewLayout({ footprint: { width: 1, height: 1 } }).sprite.width).toBe(24);
      });
    });
  });
  describe("eventEditorSettingsLayout", () => {
    isolateTimers();
    describe("event editor settings column layout", () => {
      let host: HTMLElement;

      beforeEach(() => {
        openEventConditions.clear();
        openEventMovement.clear();
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
      });

      it("promotes identity and page tabs above the settings rail", () => {
        renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_layout");
        const column = host.querySelector(".event-editor-settings-column");
        expect(column).toBeTruthy();
        const direct = [...(column?.children ?? [])] as HTMLElement[];
        expect(direct).toHaveLength(2);
        expect(direct[0]?.dataset.testid).toBe("event-editor-column-label-settings");
        expect(direct[1]?.classList.contains("event-editor-settings-main")).toBe(true);

        // 숨은 identity 카드는 제거됐다: `display: none` 인 채 DOM 에만 남아 있던 죽은 UI 였고,
        // 이름·ID·좌표·NPC 는 모달 헤더와 설정 레일이 이미 보여준다.
        expect(host.querySelector(".event-editor-card")).toBeNull();
        expect(host.querySelector("[data-testid='event-editor-event-info']")).toBeNull();
        expect(host.querySelector("[data-testid='event-position-controls']")).toBeNull();
        expect(host.querySelector(".event-editor")?.firstElementChild?.classList.contains("event-editor-pagebar")).toBe(true);

        // 페이지 선택은 폭이 필요하다 — 좁은 설정 레일 밖, 전용 페이지 행이 유일한 집이다.
        expect(column?.querySelector(".evt-page-segments")).toBeNull();
        expect(host.querySelector(".event-editor-pagebar .evt-page-segments")).toBeTruthy();
        expect(host.querySelector(".event-page-number-tabs")).toBeNull();

        // RM2003 셸: 스케줄 패널은 마운트하지 않음. 페이지 설정만 settings-main 안.
        expect(direct[1]?.querySelector("[data-testid='event-schedule-section']")).toBeNull();
        expect(direct[1]?.querySelector(".event-page-props")).toBeTruthy();
      });

      it("orders six numbered settings groups; characterId lives in the NPC rail group", () => {
        renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_layout");
        const main = host.querySelector(".event-editor-settings-main");
        expect(main).toBeTruthy();

        // 숨은 identity 카드의 top strip 은 제거됐고, NPC 연결은 그 주제가 속한
        // 「NPC와 일정」 레일 그룹에서 처음으로 실제로 보인다.
        expect(host.querySelector(".event-editor-top-strip")).toBeNull();
        const characterId = host.querySelector('[data-testid="event-character-id-field"]');
        // 헤더 상자는 이벤트 이름(2026-09-18). 페이지 이름 컨트롤(event-classic-name)은 설정 본문 맨 위에 있다.
        expect(host.querySelector('[data-testid="event-classic-name"] [data-testid="event-page-name-input"]')).not.toBeNull();
        expect(characterId).toBeTruthy();
        expect(main?.contains(characterId)).toBe(true);
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
  });
  // 설정 레일 정돈(2026-09-27 적대적 시각 QA 후속)의 동작 계약.
  //  - 「시작 방식」은 「모습과 대화」가 소유한다 — 새 이벤트마다 「기타 · 분류 없음 1개」가 생기던 회귀.
  //  - 「언제 보이나요」 창은 편집기가 레일을 다시 그려도 **새 본문**을 보여 준다(낡은 사본 금지).
  //  - 「완료」로 닫으면 원래 열려 있던 그룹으로 돌아간다.
  describe("eventSettingsRailTidy", () => {
    isolateTimers();
    function seed(): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId]!.events = [{
        id: "ev_rail",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        pages: [{
          id: "p1",
          name: "레일",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        } as EventPage],
      }];
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      return mapId;
    }
    describe("이벤트 설정 레일 정돈", () => {
      let host: HTMLElement;
      let mapId: string;
      let unsubscribe: () => void = () => {};

      // 편집기 모달처럼 store 가 바뀔 때마다 편집면을 통째로 다시 그린다.
      const render = () => {
        host.replaceChildren();
        renderEventEditorDynamic(host, mapId, "ev_rail");
      };
      const flush = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));
      const header = (slug: string) =>
        host.querySelector<HTMLButtonElement>(`[data-rail-group="${slug}"] > .event-editor-settings-accordion-header`)!;
      const modal = () => document.querySelector<HTMLElement>("[data-testid='event-condition-modal']");

      beforeEach(() => {
        resetModalStackForTest();
        activeEventRailGroup.clear();
        host = document.createElement("div");
        document.body.append(host);
        mapId = seed();
        render();
        unsubscribe = store.subscribe(render);
      });

      afterEach(() => {
        unsubscribe();
        host.remove();
        modal()?.remove();
      });

      it("시작 방식은 「모습과 대화」 안에 있고 「기타」 그룹은 없다", () => {
        const trigger = host.querySelector("[data-testid='event-page-trigger-select']");
        expect(trigger?.closest("[data-rail-group]")?.getAttribute("data-rail-group")).toBe("look-talk");
        expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
      });

      it("「움직임과 속도」 안에 눌러도 안 열리는 두 번째 접이식이 없다", () => {
        const move = host.querySelector("[data-rail-group='move']")!;
        expect(move.querySelector(".event-collapsible-summary")).toBeNull();
        expect(host.querySelector("[data-testid='evt-rail-meta-move'] [data-testid='event-movement-summary-chips']")?.textContent).toBe("정지");
      });

      it("조건 창은 칩을 누른 뒤 다시 그려진 레일의 본문을 보여 준다", async () => {
        header("when").click();
        const dialog = modal();
        expect(dialog).toBeTruthy();
        expect(header("when").getAttribute("aria-haspopup")).toBe("dialog");

        dialog!.querySelector<HTMLButtonElement>("[data-testid='event-condition-chip-season']")!.click();
        await flush();

        // store 갱신 → 레일 재렌더 → 창이 새 본문으로 갈아 끼움. 칩이 켜진 채여야 한다.
        const live = modal()!;
        expect(live.querySelector("[data-testid='event-condition-chip-season']")?.getAttribute("aria-pressed")).toBe("true");
        expect(live.querySelectorAll(".event-condition-row")).toHaveLength(1);
        expect(header("when").querySelector("[data-testid='evt-rail-meta-when']")?.textContent).toBe("조건 1개");
      });

      it("「완료」로 닫으면 원래 열려 있던 그룹으로 돌아가고 다시 열 수 있다", async () => {
        header("move").click();
        header("when").click();
        modal()!.querySelector<HTMLButtonElement>("[data-testid='event-condition-modal-done']")!.click();
        expect(modal()).toBeNull();
        expect(host.querySelector(".event-editor-settings-accordion-group.is-open")?.getAttribute("data-rail-group")).toBe("move");

        header("when").click();
        expect(modal()?.querySelector("[data-testid='event-condition-palette']")).toBeTruthy();
      });

      it("「조건 저장」처럼 닫기와 같은 일을 하는 가짜 저장 버튼이 없다", () => {
        header("when").click();
        const labels = [...modal()!.querySelectorAll("footer button")].map((button) => button.textContent);
        expect(labels).toEqual(["완료"]);
      });
    });
  });
});
