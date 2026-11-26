// @vitest-environment happy-dom

import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command, CharacterFootprint, EventPage, Condition, GameEvent, Trigger } from "@/project/types";
import { captureFormSurface } from "./eventEditorFormSurface";
import { captureInteractionSurface } from "./eventEditorInteractionSurface";
import { probeCommandControls } from "./eventEditorCommitProbe";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { inspectorTitle } from "@/editor/panels/eventEditor/inspectorChoicesTitle";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { attachWindowDrag } from "@/editor/panels/eventEditor/modalDrag";
import { renderEventEditorDynamic, undoActiveEventCommands } from "@/editor/panels/eventEditor/content";
import { derivedScaleForBody, footprintSummary } from "@/editor/panels/eventEditor/pageFootprint";
import { footprintPreviewLayout } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { openEventConditions, openEventMovement, activeEventRailGroup } from "@/editor/panels/eventEditor/eventEditorOpenState";
import { resetModalStackForTest, modalStackDepthForTest } from "@/editor/ui/modalStack";
import { isolateTimers } from "./mergedTeardown";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { beginExistingEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { undoFeedbackText } from "@/editor/eventDiffLabel";
import { requestEditorEventDeletion, deleteEditorEvent } from "@/editor/eventDeletion";
import { addEventPage, deleteEventPage, replaceEventPageCommands, updateEventPage } from "@/editor/eventPages";
import { runUndoWithFeedback, historyHotkeyOwnedByPanel, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { clearCommandToolbarHistories, createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { _resetEventPageDeletionHistoryForTest, canRedoEventPageDeletion, canUndoEventPageDeletion, undoEventPageDeletion } from "@/editor/panels/eventEditor/pageDeleteHistory";
import { _resetEventDraftVaultForTest, applyEventDraftVault, applySessionEvents, eventDraftVaultStorageKey, loadEventDraftVaultFromLocalStorage, persistEventDraftVaultNow, syncEventDraftVaultFromProject } from "@/project/eventDraftVault";
import { toast } from "@/util/toast";
import type { EventDraftIssue, EventDraftValidation } from "@/editor/eventDraftValidator";
import { refreshEventValidationBell, renderEventValidationBell } from "@/editor/panels/eventEditor/validationBell";
import { selectEditorMap } from "@/editor/mapSelection";
import { showConfirm } from "@/editor/ui/modal";
import { attachColumnResize } from "@/editor/panels/eventEditor/layoutResize";
import { attachWindowFullscreen } from "@/editor/panels/eventEditor/modalFullscreen";
import { attachWindowResize } from "@/editor/panels/eventEditor/modalResize";

describe("eventEditor", () => {
  isolateTimers();
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
});

describe("eventEditorQaFixes", () => {
  isolateTimers();
  describe("eventEditorQaFixes", () => {
    isolateTimers();
    function page(id: string, name: string, trigger: Trigger, commands: Command[], conditions: Condition[] = []): EventPage {
      return {
        id,
        name,
        conditions,
        graphic: {},
        trigger,
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      };
    }
    function seedEvent(pages: EventPage[], name = "사건"): { mapId: string; eventId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const event = createDefaultGameEvent(1, 1);
      event.name = name;
      event.trigger = { kind: "auto" };
      event.commands = [];
      event.pages = pages;
      project.maps[mapId]!.events = [event];
      store.replace(project);
      return { mapId, eventId: event.id };
    }
    describe("event editor QA fixes", () => {
      beforeEach(() => {
        _resetEventDraftVaultForTest();
        _resetEventPageDeletionHistoryForTest();
        clearCommandToolbarHistories("");
        resetMapEditHistory();
        document.querySelector("[data-testid='toast-stack']")?.remove();
        localStorage.clear();
        sessionStorage.clear();
      });

      afterEach(() => {
        document.querySelector("[data-testid='event-editor-modal']")?.remove();
        document.querySelector("[data-testid='toast-stack']")?.remove();
        resetModalStackForTest();
        window.history.replaceState(null, "", "/");
        _resetEventDraftVaultForTest();
        _resetEventPageDeletionHistoryForTest();
        clearCommandToolbarHistories("");
        resetMapEditHistory();
        document.querySelector("[data-testid='app-confirm-modal']")?.remove();
      });

      it("undoes a page delete with its trigger, conditions, and commands", () => {
        const gone = page(
          "gone",
          "지울 페이지",
          { kind: "action" },
          [{ kind: "text", body: "keep me" }],
          [{ kind: "switch", switchId: "sw_0001", value: true }],
        );
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, []),
          gone,
        ]);
        beginExistingEventDraft(mapId, eventId);
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        expect(canUndoEventPageDeletion(mapId, eventId)).toBe(true);
        expect(store.getCurrent().maps[mapId]!.events[0]!.pages?.some((entry) => entry.id === "gone")).toBe(false);

        expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
        const restored = store.getCurrent().maps[mapId]!.events[0]!.pages?.find((entry) => entry.id === "gone");
        expect(restored?.trigger).toEqual({ kind: "action" });
        expect(restored?.conditions).toEqual([{ kind: "switch", switchId: "sw_0001", value: true }]);
        expect(restored?.commands).toEqual([{ kind: "text", body: "keep me" }]);
      });

      it("map undo after apply restores a deleted pre-existing page", () => {
        const before = page(
          "gone",
          "지울 페이지",
          { kind: "touch" },
          [{ kind: "text", body: "before the session" }],
          [{ kind: "switch", switchId: "sw_0001", value: true }],
        );
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, []),
          before,
        ]);
        beginExistingEventDraft(mapId, eventId);
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        saveEventDraft(mapId, eventId);

        expect(undoMapEdit()).toBe(true);
        const gone = findPage(mapId, eventId, "gone");
        expect(gone?.trigger).toEqual(before.trigger);
        expect(gone?.conditions).toEqual(before.conditions);
        expect(gone?.commands).toEqual(before.commands);
      });

      it("map undo after apply restores the pre-session page, not the in-session edit", () => {
        // 자동 실행·명령 0개는 캡처가 틀린 게 아니다. 이벤트 뿌리의 trigger/commands 를
        // createDefaultEventPage 가 첫 페이지로 복사하고, 세션에서 고친 명령은 작업 본문에만 있다.
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, []),
          page("gone", "지울 페이지", { kind: "auto" }, []),
        ]);
        beginExistingEventDraft(mapId, eventId);
        updateEventPage(mapId, eventId, "gone", {
          trigger: { kind: "action" },
          conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
          commands: [{ kind: "text", body: "written in this session" }],
        });
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
        const inSession = findPage(mapId, eventId, "gone");
        expect(inSession?.trigger).toEqual({ kind: "action" });
        expect(inSession?.commands).toEqual([{ kind: "text", body: "written in this session" }]);
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        saveEventDraft(mapId, eventId);

        expect(undoMapEdit()).toBe(true);
        const gone = findPage(mapId, eventId, "gone");
        expect(gone?.trigger).toEqual({ kind: "auto" });
        expect(gone?.conditions).toEqual([]);
        expect(gone?.commands).toEqual([]);
      });

      it("map undo after apply does not restore a page created in this session", () => {
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
        ]);
        beginExistingEventDraft(mapId, eventId);
        const created = addEventPage(mapId, eventId);
        updateEventPage(mapId, eventId, created, {
          trigger: { kind: "touch" },
          conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
          commands: [{ kind: "text", body: "created in this session" }],
        });
        expect(deleteEventPage(mapId, eventId, created)).toBe(true);
        expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
        const inSession = findPage(mapId, eventId, created);
        expect(inSession?.trigger).toEqual({ kind: "touch" });
        expect(inSession?.commands).toEqual([{ kind: "text", body: "created in this session" }]);
        expect(deleteEventPage(mapId, eventId, created)).toBe(true);
        saveEventDraft(mapId, eventId);

        expect(undoMapEdit()).toBe(true);
        const event = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === eventId);
        expect(event?.pages?.map((entry) => entry.id)).toEqual(["keep"]);
        expect(event?.pages?.[0]?.commands).toEqual([{ kind: "text", body: "stay" }]);
      });

      it("enables the editor undo button after a page delete and restores the page", async () => {
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
          page("gone", "지울 페이지", { kind: "touch" }, [{ kind: "text", body: "keep me" }]),
        ]);
        openEventEditorModal(mapId, eventId);
        const button = () => document.querySelector<HTMLButtonElement>("[data-testid='event-command-toolbar-undo']");
        await viWaitForButton(button);
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        await viWaitForButton(() => {
          const undo = button();
          return undo && !undo.disabled ? undo : null;
        });
        button()?.click();
        const restored = store.getCurrent().maps[mapId]!.events[0]!.pages?.find((entry) => entry.id === "gone");
        expect(restored?.trigger).toEqual({ kind: "touch" });
        expect(restored?.commands).toEqual([{ kind: "text", body: "keep me" }]);
      });

      it("scopes a blank session away from the shared local vault and keeps a pasted event", () => {
        window.history.replaceState(null, "", "/?blankProject=1");
        sessionStorage.setItem("oprn:event-draft-session", "tab-a");
        const stale: GameEvent = {
          id: "stale-draft",
          x: 4,
          y: 4,
          name: "옛 초안",
          trigger: { kind: "auto" },
          commands: [],
          pages: [],
          draft: { kind: "new" },
        };
        localStorage.setItem("oprn:event-draft-vault:local", JSON.stringify({
          version: 1,
          entries: [{ mapId: "map_blank_start", event: stale, updatedAt: 1 }],
        }));
        const project = createBlankProject();
        const pasted = createDefaultGameEvent(2, 2);
        pasted.id = "pasted";
        pasted.name = "붙여넣은 이벤트";
        delete pasted.draft;
        project.maps[project.startMapId]!.events = [pasted];
        syncEventDraftVaultFromProject(project);
        persistEventDraftVaultNow();

        expect(eventDraftVaultStorageKey()).toBe("oprn:event-draft-vault:session:tab-a");
        expect(localStorage.getItem("oprn:event-draft-vault:local")).toContain("stale-draft");
        const saved = JSON.parse(localStorage.getItem("oprn:event-draft-vault:session:tab-a") ?? "{}") as {
          sessionEvents?: Array<{ events?: Array<{ id?: string }> }>;
        };
        expect(saved.sessionEvents?.[0]?.events?.map((event) => event.id)).toEqual(["pasted"]);

        _resetEventDraftVaultForTest();
        expect(loadEventDraftVaultFromLocalStorage()).toBe(0);
        const restored = applySessionEvents(applyEventDraftVault(createBlankProject()));
        expect(restored.maps[restored.startMapId]!.events.map((event) => event.id)).toEqual(["pasted"]);
        expect(restored.maps[restored.startMapId]!.events.some((event) => event.id === "stale-draft")).toBe(false);

        sessionStorage.setItem("oprn:event-draft-session", "tab-b");
        _resetEventDraftVaultForTest();
        expect(loadEventDraftVaultFromLocalStorage()).toBe(0);
        const other = applySessionEvents(applyEventDraftVault(createBlankProject()));
        expect(other.maps[other.startMapId]!.events).toEqual([]);
      });

      it("dedupes the same visible toast", () => {
        const message = "조건 없는 새 페이지를 기존 승자보다 낮은 우선순위로 추가했어요.";
        toast(message, { kind: "info", dedupe: true });
        toast(message, { kind: "info", dedupe: true });
        expect(document.querySelectorAll(".toast.show")).toHaveLength(1);
        toast("다른 알림", { kind: "info", dedupe: true });
        expect(document.querySelectorAll(".toast.show")).toHaveLength(2);
      });

      it("does not say 변경 없음 when undo changes the event name and page count", () => {
        const { mapId, eventId } = seedEvent([
          page("a", "하나", { kind: "action" }, []),
          page("b", "둘", { kind: "action" }, []),
        ], "옛 이름");
        recordProjectSnapshot("이벤트 편집 — 변경 없음");
        store.updateEvent(mapId, eventId, (event) => {
          event.name = "새 이름";
          event.pages = event.pages?.slice(0, 1);
        }, { scope: "map", mapId, eventId, label: "이름과 페이지" });

        expect(runUndoWithFeedback()).toBe(true);
        const message = document.querySelector(".toast-message")?.textContent ?? "";
        expect(message).not.toContain("변경 없음");
        expect(message).toContain("이벤트 이름, 페이지 수");
        const event = store.getCurrent().maps[mapId]!.events[0]!;
        expect(event.name).toBe("옛 이름");
        expect(event.pages).toHaveLength(2);
      });

      it("builds undo feedback from the restored name and page count", () => {
        const before = createBlankProject();
        const after = structuredClone(before);
        const event = createDefaultGameEvent(0, 0);
        event.name = "옛";
        event.pages = [page("a", "하나", { kind: "action" }, []), page("b", "둘", { kind: "action" }, [])];
        before.maps[before.startMapId]!.events = [event];
        const renamed = structuredClone(event);
        renamed.name = "새";
        renamed.pages = renamed.pages?.slice(0, 1);
        after.maps[after.startMapId]!.events = [renamed];
        expect(undoFeedbackText("이벤트 편집 — 변경 없음", before, after)).toBe("되돌렸습니다 — 이벤트 이름, 페이지 수");
        expect(undoFeedbackText("타일 칠하기", before, after)).toBe("되돌렸습니다 — 타일 칠하기");
      });

      it("undoes a page deletion that sits between two command edits, then redoes in that order", () => {
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
          page("gone", "지울 페이지", { kind: "touch" }, [{ kind: "text", body: "old" }]),
        ]);
        beginExistingEventDraft(mapId, eventId);
        editorState.set({ selectedEventPageId: "keep" });
        const history = createCommandToolbarHistory({
          key: `${mapId}:${eventId}:keep`,
          editScope: { mapId, eventId },
          immutableSnapshots: true,
          readCommands: () => findPage(mapId, eventId, "keep")?.commands ?? [],
          replaceCommands: (commands) => replaceEventPageCommands(mapId, eventId, "keep", commands),
        });
        history.replaceAll([{ kind: "text", body: "first" }]);
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        history.replaceAll([{ kind: "text", body: "second" }]);

        undoActiveEventCommands(mapId, eventId);
        expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "first" }]);
        expect(findPage(mapId, eventId, "gone")).toBeUndefined();

        undoActiveEventCommands(mapId, eventId);
        expect(findPage(mapId, eventId, "gone")?.commands).toEqual([{ kind: "text", body: "old" }]);
        expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "first" }]);

        undoActiveEventCommands(mapId, eventId, true);
        expect(findPage(mapId, eventId, "gone")).toBeUndefined();
        expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "first" }]);
        undoActiveEventCommands(mapId, eventId, true);
        expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "second" }]);
      });

      it("drops page-deletion redo after a command edit and command redo after a page deletion", () => {
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, [{ kind: "text", body: "stay" }]),
          page("gone", "지울 페이지", { kind: "touch" }, [{ kind: "text", body: "old" }]),
        ]);
        beginExistingEventDraft(mapId, eventId);
        editorState.set({ selectedEventPageId: "keep" });
        const history = createCommandToolbarHistory({
          key: `${mapId}:${eventId}:keep`,
          editScope: { mapId, eventId },
          immutableSnapshots: true,
          readCommands: () => findPage(mapId, eventId, "keep")?.commands ?? [],
          replaceCommands: (commands) => replaceEventPageCommands(mapId, eventId, "keep", commands),
        });
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        expect(undoEventPageDeletion(mapId, eventId)).toBe(true);
        history.replaceAll([{ kind: "text", body: "new" }]);
        expect(canRedoEventPageDeletion(mapId, eventId)).toBe(false);
        undoActiveEventCommands(mapId, eventId, true);
        expect(findPage(mapId, eventId, "gone")?.commands).toEqual([{ kind: "text", body: "old" }]);
        expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "new" }]);

        history.undo();
        expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "stay" }]);
        expect(history.canRedo()).toBe(true);
        expect(deleteEventPage(mapId, eventId, "gone")).toBe(true);
        expect(history.canRedo()).toBe(false);
        undoActiveEventCommands(mapId, eventId, true);
        expect(findPage(mapId, eventId, "keep")?.commands).toEqual([{ kind: "text", body: "stay" }]);
        expect(findPage(mapId, eventId, "gone")).toBeUndefined();
      });

      it("does not delete the replacement project's event when confirmation outlives the switch", async () => {
        const { mapId, eventId } = seedEvent([
          page("keep", "남는 페이지", { kind: "action" }, []),
          page("gone", "지울 페이지", { kind: "action" }, []),
        ]);
        const pending = requestEditorEventDeletion(mapId, eventId);
        const replacement = createBlankProject();
        const survivor = createDefaultGameEvent(3, 3);
        survivor.id = eventId;
        survivor.name = "다른 문서";
        replacement.maps[replacement.startMapId]!.events = [survivor];
        store.replaceProject(replacement);

        document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']")?.click();
        await expect(pending).resolves.toBe(false);
        const events = store.getCurrent().maps[replacement.startMapId]!.events;
        expect(events.map((event) => event.id)).toEqual([eventId]);
        expect(events[0]?.name).toBe("다른 문서");
      });

      it("leaves a map's events in place when the recovered session snapshot is not a list of events", () => {
        window.history.replaceState(null, "", "/?blankProject=1");
        sessionStorage.setItem("oprn:event-draft-session", "tab-a");
        const project = createBlankProject();
        const keep = createDefaultGameEvent(1, 1);
        keep.id = "keep";
        keep.name = "살아 있는 이벤트";
        project.maps[project.startMapId]!.events = [keep];
        localStorage.setItem(eventDraftVaultStorageKey(), JSON.stringify({
          version: 1,
          entries: [],
          sessionEvents: [{ mapId: project.startMapId, events: [null] }],
        }));
        expect(loadEventDraftVaultFromLocalStorage()).toBe(0);
        const restored = applySessionEvents(project);
        expect(restored.maps[project.startMapId]!.events.map((event) => event.id)).toEqual(["keep"]);
      });

      it("keeps the previous session snapshot while event arrays are unchanged", () => {
        window.history.replaceState(null, "", "/?blankProject=1");
        sessionStorage.setItem("oprn:event-draft-session", "tab-a");
        const project = createBlankProject();
        const event = createDefaultGameEvent(1, 1);
        event.id = "pasted";
        event.commands = [{ kind: "text", body: "old" }];
        project.maps[project.startMapId]!.events = [event];
        syncEventDraftVaultFromProject(project);
        persistEventDraftVaultNow();

        event.commands = [{ kind: "text", body: "mutated in place" }];
        syncEventDraftVaultFromProject(project);
        persistEventDraftVaultNow();
        const stale = JSON.parse(localStorage.getItem(eventDraftVaultStorageKey()) ?? "{}") as {
          sessionEvents?: Array<{ events?: Array<{ commands?: Array<{ body?: string }> }> }>;
        };
        expect(stale.sessionEvents?.[0]?.events?.[0]?.commands?.[0]?.body).toBe("old");

        project.maps[project.startMapId]!.events = [structuredClone(event)];
        project.maps[project.startMapId]!.events[0]!.commands = [{ kind: "text", body: "replaced" }];
        syncEventDraftVaultFromProject(project);
        persistEventDraftVaultNow();
        const next = JSON.parse(localStorage.getItem(eventDraftVaultStorageKey()) ?? "{}") as {
          sessionEvents?: Array<{ events?: Array<{ commands?: Array<{ body?: string }> }> }>;
        };
        expect(next.sessionEvents?.[0]?.events?.[0]?.commands?.[0]?.body).toBe("replaced");
      });
    });
    function findPage(mapId: string, eventId: string, pageId: string): EventPage | undefined {
      return store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.pages?.find((entry) => entry.id === pageId);
    }
    function viWaitForButton<T>(read: () => T | null | undefined): Promise<T> {
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = (): void => {
          const value = read();
          if (value) {
            resolve(value);
            return;
          }
          if (Date.now() - started > 4000) {
            const crash = document.querySelector("[data-testid='event-editor-render-error']")?.textContent?.trim();
            reject(new Error(crash ? `timed out waiting for the undo button: ${crash}` : "timed out waiting for the undo button"));
            return;
          }
          setTimeout(tick, 20);
        };
        tick();
      });
    }
  });
  describe("eventEditorValidationBell", () => {
    isolateTimers();
    function validationOf(issues: readonly EventDraftIssue[]): EventDraftValidation {
      const errorCount = issues.filter((issue) => issue.severity === "error").length;
      const warningCount = issues.filter((issue) => issue.severity === "warning").length;
      const infoCount = issues.filter((issue) => issue.severity === "info").length;
      return { issues, errorCount, warningCount, infoCount, canCommit: errorCount === 0 };
    }
    function issue(overrides: Partial<EventDraftIssue> = {}): EventDraftIssue {
      return {
        severity: "warning",
        code: "shop.items.empty",
        message: "상점에 팔 물건이 없습니다.",
        pageId: "p1",
        ...overrides,
      };
    }
    describe("event editor validation bell", () => {
      let header: HTMLElement;

      beforeEach(() => {
        document.body.replaceChildren();
        header = document.createElement("header");
        header.className = "event-editor-modal-header";
        header.append(renderEventValidationBell());
        document.body.append(header);
      });

      function bell(): HTMLDetailsElement {
        const node = header.querySelector<HTMLDetailsElement>('[data-testid="event-draft-validation"]');
        if (!node) throw new Error("expected validation bell");
        return node;
      }

      it("stays hidden while the draft has no issues", () => {
        refreshEventValidationBell(header, validationOf([]));

        expect(bell().hidden).toBe(true);
        expect(bell().dataset.count).toBe("0");
        expect(bell().dataset.severity).toBe("none");
        expect(header.querySelector('[data-testid^="event-draft-validation-issue-"]')).toBeNull();
      });

      it("shows the issue count and takes the worst severity", () => {
        refreshEventValidationBell(header, validationOf([
          issue(),
          issue({ severity: "info", code: "page.empty" }),
        ]));

        expect(bell().hidden).toBe(false);
        expect(bell().dataset.severity).toBe("warning");
        expect(bell().dataset.count).toBe("2");
        expect(header.querySelector('[data-testid="event-draft-validation-count"]')?.textContent).toBe("2");
        expect(header.querySelectorAll('[data-testid^="event-draft-validation-issue-"]')).toHaveLength(2);

        refreshEventValidationBell(header, validationOf([
          issue({ severity: "error", code: "event.position.out-of-bounds" }),
          issue(),
        ]));

        expect(bell().dataset.severity).toBe("error");
        expect(header.querySelector('[data-testid="event-draft-validation-tally"]')?.textContent)
          .toBe("오류 1 · 경고 1");
      });

      it("caps the badge at 99+ while keeping the exact count machine-readable", () => {
        refreshEventValidationBell(header, validationOf(
          Array.from({ length: 120 }, (_, index) => issue({ code: `dup.${index}` })),
        ));

        expect(header.querySelector('[data-testid="event-draft-validation-count"]')?.textContent).toBe("99+");
        expect(bell().dataset.count).toBe("120");
      });

      it("navigates to the clicked issue page and closes the popover", () => {
        editorState.set({ selectedEventPageId: "p9" });
        refreshEventValidationBell(header, validationOf([issue({ pageId: "p3" })]));
        bell().open = true;

        header.querySelector<HTMLButtonElement>('[data-testid="event-draft-validation-issue-0"]')?.click();

        expect(editorState.get().selectedEventPageId).toBe("p3");
        expect(bell().open).toBe(false);
      });

      it("closes the popover when the next pointerdown lands outside it", () => {
        refreshEventValidationBell(header, validationOf([issue()]));
        bell().open = true;
        bell().dispatchEvent(new Event("toggle"));

        header.querySelector('[data-testid="event-draft-validation-issue-0"]')
          ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        expect(bell().open).toBe(true);

        document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        expect(bell().open).toBe(false);
      });
    });
  });
  describe("eventEditorWindowControls", () => {
    isolateTimers();
    let mapId: string;
    const destinationMapId = "window-map-b";
    function node(id: string): HTMLElement {
      const result = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!result) throw new Error(`Missing ${id}`);
      return result;
    }
    beforeEach(() => {
      const project = createBlankProject();
      mapId = project.startMapId;
      project.maps[mapId].events = [{ id: "window-event", x: 1, y: 1,
        trigger: { kind: "action" }, commands: [], pages: [{
          id: "window-page", name: "Window event", conditions: [], graphic: {},
          trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
        }] }];
      project.maps[mapId].events.push({ ...structuredClone(project.maps[mapId].events[0]), id: "other-event" });
      const secondMap = structuredClone(project.maps[mapId]);
      const pages = project.maps[mapId].events[0].pages;
      const destinationPage = secondMap.events[0].pages?.[0];
      if (!pages || !destinationPage) throw new Error("Expected two-map fixture pages");
      secondMap.id = destinationMapId;
      secondMap.events = [{ ...structuredClone(secondMap.events[0]), id: "destination-event",
        pages: [{ ...structuredClone(destinationPage), id: "destination-page" }] }];
      project.maps[destinationMapId] = secondMap;
      pages.push({ ...structuredClone(pages[0]), id: "window-page-2", name: "Second page" });
      store.replaceProject(project);
      editorState.set({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page" });
      openEventEditorModal(mapId, "window-event");
    });
    afterEach(() => {
      document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
      document.body.replaceChildren();
      resetModalStackForTest();
      vi.restoreAllMocks();
    });
    function draft() { return store.getCurrent().maps[mapId].events.find(event => event.id === "window-event"); }
    function key(target: EventTarget, key: string, altKey = false): KeyboardEvent {
      const event = new KeyboardEvent("keydown", { key, altKey, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    }
    function changedUntil(check: () => boolean): Promise<void> {
      return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          if (!check()) return;
          observer.disconnect();
          clearTimeout(deadline);
          resolve();
        });
        const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Expected DOM transition")); }, 5000);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      });
    }
    describe("event editor window controls", () => {
      for (const target of ["existing", "new"] as const) {
        for (const dirty of [false, true]) {
          it(`keeps the destination map when opening a ${target} event after ${dirty ? "approved dirty" : "unchanged"} cross-map switching`, async () => {
            if (dirty) updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
            const previous = node("event-editor-modal");
            node("event-editor-window-minimize").click();
            expect(selectEditorMap(destinationMapId)).toBe(true);
            expect(editorState.get().currentMapId).toBe(destinationMapId);
            if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
            else openNewEventEditorModal(destinationMapId, 3, 4);
            if (dirty) {
              const switched = changedUntil(() => node("event-editor-modal") !== previous);
              node("app-modal-confirm").click();
              await switched;
            }
            const modal = node("event-editor-modal");
            expect(modal).not.toBe(previous);
            expect(modal.dataset.mapId).toBe(destinationMapId);
            expect(editorState.get().currentMapId).toBe(destinationMapId);
            const opened = store.getCurrent().maps[destinationMapId].events.find(event => event.id === modal.dataset.eventId);
            expect(opened?.draft?.kind).toBe(target === "existing" ? "edit" : "new");
            expect(editorState.get().selectedEventId).toBe(opened?.id);
            expect(editorState.get().selectedEventPageId).toBe(opened?.pages?.[0].id);
            if (target === "existing") expect(opened?.id).toBe("destination-event");
            else expect(opened).toMatchObject({ x: 3, y: 4 });
            expect(draft()?.draft).toBeUndefined();
            expect(draft()?.pages?.[0].name).toBe("Window event");
            expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
            expect(modalStackDepthForTest()).toBe(1);
          });
        }

        it(`retains the original map and page when cancelling a dirty cross-map switch to a ${target} event`, async () => {
          editorState.set({ selectedEventPageId: "window-page-2" });
          updateEventPage(mapId, "window-event", "window-page-2", { name: "Dirty second page" });
          const original = structuredClone(draft());
          const destination = structuredClone(store.getCurrent().maps[destinationMapId]);
          const modal = node("event-editor-modal");
          node("event-editor-window-minimize").click();
          selectEditorMap(destinationMapId);
          if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
          else expect(openNewEventEditorModal(destinationMapId, 3, 4)).toBe("");
          expect(modal.hidden).toBe(false);
          expect(modalStackDepthForTest()).toBe(2);
          const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
          node("app-modal-cancel").click();
          await cancelled;
          expect(node("event-editor-modal")).toBe(modal);
          expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
          expect(draft()).toEqual(original);
          expect(store.getCurrent().maps[destinationMapId]).toEqual(destination);
          expect(modalStackDepthForTest()).toBe(1);
        });
      }

      for (const restore of ["chip", "same-event"] as const) {
        it(`restores the original map and nondefault page via ${restore} after selecting another map`, () => {
          editorState.set({ selectedEventPageId: "window-page-2" });
          const modal = node("event-editor-modal");
          node("event-editor-window-minimize").click();
          selectEditorMap(destinationMapId);
          if (restore === "chip") node("event-editor-window-restore").click();
          else openEventEditorModal(mapId, "window-event");
          expect(node("event-editor-modal")).toBe(modal);
          expect(modal.hidden).toBe(false);
          expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
        });
      }

      it("minimizes without discarding pending input and restores the same editor", () => {
        const modal = node("event-editor-modal");
        const input = node("event-editor-name");
        if (!(input instanceof HTMLInputElement)) throw new Error("Expected input");
        input.focus();
        input.value = "Pending draft";
        input.setSelectionRange(3, 7);
        node("event-editor-window-minimize").click();
        expect(modal.hidden).toBe(true);
        expect(modalStackDepthForTest()).toBe(0);
        expect(document.body.classList.contains("event-editor-modal-open")).toBe(false);
        const restore = node("event-editor-window-restore");
        expect(document.activeElement).toBe(restore);
        expect(historyHotkeyOwnedByPanel()).toBe(false);
        expect(shouldIgnoreEditorShortcut(key(restore, "ArrowRight"))).toBe(false);
        const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
        restore.dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(false);
        restore.click();
        expect(node("event-editor-modal")).toBe(modal);
        expect(modal.hidden).toBe(false);
        expect(node("event-editor-name")).toBe(input);
        expect(input.value).toBe("Pending draft");
        expect(input.selectionStart).toBe(3);
        expect(input.selectionEnd).toBe(7);
        expect(document.activeElement).toBe(input);
        expect(modalStackDepthForTest()).toBe(1);
      });
      it("keeps full-view state and saved normal geometry across minimize and map reopen", () => {
        const modal = node("event-editor-modal");
        const windowEl = modal.querySelector<HTMLElement>(".event-editor-modal-window");
        if (!windowEl) throw new Error("Expected window");
        Object.assign(windowEl.style, { width: "900px", height: "650px", transform: "translate(12px, 8px)" });
        node("event-editor-window-fullscreen").click();
        expect(node("event-editor-window-fullscreen").style.display).not.toBe("none");
        node("event-editor-window-minimize").click();
        editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
        openEventEditorModal(mapId, "window-event");
        expect(node("event-editor-modal")).toBe(modal);
        expect(modal.hidden).toBe(false);
        expect(modal.classList.contains("is-fullscreen")).toBe(true);
        expect(editorState.get().selectedEventPageId).toBe("window-page");
        key(document, "Escape");
        expect(windowEl.style.width).toBe("900px");
        expect(windowEl.style.height).toBe("650px");
        expect(windowEl.style.transform).toBe("translate(12px, 8px)");
        expect(modalStackDepthForTest()).toBe(1);
        key(document, "Escape");
        expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
      });

      it("does not rebuild pending dynamic fields on background map and selection changes", () => {
        const field = node("event-command-search");
        if (!(field instanceof HTMLInputElement)) throw new Error("Expected search input");
        field.focus();
        field.value = "pending search";
        node("event-editor-window-minimize").click();
        store.updateMap(mapId, map => { map.name = "Background edit"; });
        editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
        node("event-editor-window-restore").click();
        expect(node("event-command-search")).toBe(field);
        expect(field.value).toBe("pending search");
        expect(document.activeElement).toBe(field);
      });

      it("restores a minimized new draft without resetting or discarding it", () => {
        node("event-editor-cancel").click();
        const eventId = openNewEventEditorModal(mapId, 2, 2);
        const modal = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        openEventEditorModal(mapId, eventId);
        expect(node("event-editor-modal")).toBe(modal);
        expect(modal.hidden).toBe(false);
        expect(store.getCurrent().maps[mapId].events.find(event => event.id === eventId)?.draft?.kind).toBe("new");
      });

      it("guards switching dirty minimized drafts, then discards only on approval", async () => {
        updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
        const modal = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        openEventEditorModal(mapId, "other-event");
        expect(modal.hidden).toBe(false);
        expect(modalStackDepthForTest()).toBe(2);
        const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
        node("app-modal-cancel").click();
        await cancelled;
        expect(draft()?.pages?.[0].name).toBe("Dirty");
        expect(modalStackDepthForTest()).toBe(1);
        openEventEditorModal(mapId, "other-event");
        const switched = changedUntil(() => document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.dataset.eventId === "other-event");
        node("app-modal-confirm").click();
        await switched;
        expect(draft()?.draft).toBeUndefined();
        expect(draft()?.pages?.[0].name).toBe("Window event");
        expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
        expect(modalStackDepthForTest()).toBe(1);
      });

      it("keeps Apply and save semantics after restore", () => {
        updateEventPage(mapId, "window-event", "window-page", { name: "Applied" });
        node("event-editor-window-minimize").click();
        node("event-editor-window-restore").click();
        node("event-editor-apply").click();
        expect(draft()?.pages?.[0].name).toBe("Applied");
        expect(draft()?.draft?.kind).toBe("edit");
        updateEventPage(mapId, "window-event", "window-page", { name: "Saved" });
        node("event-editor-save").click();
        expect(draft()?.pages?.[0].name).toBe("Saved");
        expect(draft()?.draft).toBeUndefined();
        expect(modalStackDepthForTest()).toBe(0);
      });

      it("closes a dormant draft on deletion rather than resurrecting it from the vault", () => {
        node("event-editor-window-minimize").click();
        expect(deleteEditorEvent(mapId, "window-event", { silent: true })).toBe(true);
        expect(draft()).toBeUndefined();
        expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
        expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
        expect(modalStackDepthForTest()).toBe(0);
      });

      it("ends ownership on same-ID project replacement without touching the incoming draft", () => {
        node("event-editor-window-minimize").click();
        const replacement = structuredClone(store.getCurrent());
        const incoming = replacement.maps[mapId].events[0];
        if (!incoming.pages?.[0]) throw new Error("Expected page");
        incoming.pages[0].name = "Incoming";
        store.replaceProject(replacement);
        expect(draft()?.pages?.[0].name).toBe("Incoming");
        expect(draft()?.draft).toBeDefined();
        expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
        expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
        expect(modalStackDepthForTest()).toBe(0);
      });

      it("tears down its pending close guard on project replacement", async () => {
        updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
        node("event-editor-modal-close").click();
        const replacement = structuredClone(store.getCurrent());
        store.replaceProject(replacement);
        expect(document.querySelector('[data-testid="app-confirm-modal"]')).toBeNull();
        expect(modalStackDepthForTest()).toBe(0);
        await Promise.resolve();
        expect(draft()?.pages?.[0].name).toBe("Dirty");
        expect(modalStackDepthForTest()).toBe(0);
      });

      it("does not steal focus or Escape from another modal while minimized", async () => {
        node("event-editor-window-minimize").click();
        const result = showConfirm({ message: "Other operation" });
        openEventEditorModal(mapId, "window-event");
        expect(node("event-editor-modal").hidden).toBe(true);
        expect(document.activeElement).toBe(node("app-modal-cancel"));
        key(document, "Escape");
        expect(await result).toBe(false);
        expect(node("event-editor-modal").hidden).toBe(true);
        node("event-editor-window-restore").click();
        expect(modalStackDepthForTest()).toBe(1);
      });

      it("disposes draft subscriptions and restore UI on external DOM teardown", async () => {
        node("event-editor-cancel").click();
        const subscribe = store.subscribe.bind(store);
        const disposers: Array<() => void> = [];
        vi.spyOn(store, "subscribe").mockImplementation(listener => {
          const dispose = vi.fn(subscribe(listener));
          disposers.push(dispose);
          return dispose;
        });
        openEventEditorModal(mapId, "window-event");
        const modal = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        const disposed = changedUntil(() => !document.querySelector('[data-testid="event-editor-window-restore"]'));
        modal.remove();
        await disposed;
        expect(draft()?.draft).toBeUndefined();
        expect(modalStackDepthForTest()).toBe(0);
        store.updateMap(mapId, map => { map.name = "After teardown"; });
        expect(disposers.length).toBeGreaterThan(0);
        for (const dispose of disposers) expect(dispose).toHaveBeenCalledOnce();
        expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
      });

      it("maximizes on immediate titlebar double-click but not on nested button SVGs", () => {
        const modal = node("event-editor-modal");
        node("event-editor-titlebar").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        expect(modal.classList.contains("is-fullscreen")).toBe(true);
        const path = node("event-editor-window-fullscreen").querySelector("path");
        if (!path) throw new Error("Expected SVG path");
        path.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        expect(modal.classList.contains("is-fullscreen")).toBe(true);
        key(modal, "Enter", true);
        expect(modal.classList.contains("is-fullscreen")).toBe(false);
      });

    });
  });
  describe("eventEditorWindowing", () => {
    isolateTimers();
    describe("event editor windowing", () => {
      afterEach(() => {
        document.body.classList.remove("event-editor-column-resizing");
        document.body.replaceChildren();
      });

      it("toggles full view and restores the previous window geometry", () => {
        const backdrop = document.createElement("div");
        const windowEl = document.createElement("section");
        const header = document.createElement("header");
        const button = document.createElement("button");
        header.append(button);
        windowEl.append(header);
        backdrop.append(windowEl);
        document.body.append(backdrop);
        windowEl.style.width = "960px";
        windowEl.style.height = "700px";
        windowEl.style.transform = "translate(24px, 12px)";

        const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
        expect(button.getAttribute("aria-label")).toBe("전체 보기");
        expect(button.getAttribute("aria-pressed")).toBe("false");

        button.click();
        expect(controller.isFullscreen()).toBe(true);
        expect(backdrop.classList.contains("is-fullscreen")).toBe(true);
        expect(windowEl.classList.contains("is-fullscreen")).toBe(true);
        expect(windowEl.style.transform).toBe("");
        expect(button.getAttribute("aria-label")).toBe("창 보기로 복원");

        backdrop.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        expect(controller.isFullscreen()).toBe(false);
        expect(windowEl.style.width).toBe("960px");
        expect(windowEl.style.height).toBe("700px");
        expect(windowEl.style.transform).toBe("translate(24px, 12px)");
        controller.dispose();
      });

      it("supports title-bar double click and Alt+Enter", () => {
        const backdrop = document.createElement("div");
        const windowEl = document.createElement("section");
        const header = document.createElement("header");
        const button = document.createElement("button");
        const title = document.createElement("span");
        header.append(title, button);
        windowEl.append(header);
        backdrop.append(windowEl);
        document.body.append(backdrop);

        const controller = attachWindowFullscreen(button, header, backdrop, windowEl);
        title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        expect(controller.isFullscreen()).toBe(true);

        backdrop.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));
        expect(controller.isFullscreen()).toBe(false);
        controller.dispose();
      });

      it("resizes the settings rail by keyboard and resets it on double click", () => {
        const workbench = document.createElement("div");
        const settings = document.createElement("div");
        const handle = document.createElement("div");
        settings.className = "event-editor-settings-column";
        workbench.append(settings, handle);
        document.body.append(workbench);

        Object.defineProperty(workbench, "getBoundingClientRect", {
          value: () => ({ left: 100, width: 1200, right: 1300, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
        });
        Object.defineProperty(settings, "getBoundingClientRect", {
          value: () => ({ left: 100, width: 312, right: 412, top: 0, bottom: 700, height: 700, x: 100, y: 0, toJSON: () => ({}) }),
        });

        attachColumnResize(handle, workbench);
        handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
        expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("336px");
        expect(handle.getAttribute("aria-valuenow")).toBe("336");
        expect(handle.getAttribute("aria-valuetext")).toBe("설정 패널 336픽셀");

        handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
        expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("288px");

        handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        expect(workbench.style.getPropertyValue("--event-editor-settings-track")).toBe("");
        expect(handle.getAttribute("aria-valuenow")).toBe("312");
      });


      it("lets a viewport-fitted modal become smaller instead of growing to the desktop minimum", () => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
        const windowEl = document.createElement("section");
        const handle = document.createElement("div");
        document.body.append(windowEl, handle);
        Object.defineProperty(windowEl, "getBoundingClientRect", {
          value: () => ({ left: 40, width: 720, right: 760, top: 32, bottom: 832, height: 800, x: 40, y: 32, toJSON: () => ({}) }),
        });

        attachWindowResize(handle, windowEl);
        handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));

        expect(windowEl.style.width).toBe("704px");
      });
    });
  });
});
