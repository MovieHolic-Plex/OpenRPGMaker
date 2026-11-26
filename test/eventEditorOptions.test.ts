import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandInspector, resetCommandInspectorView, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { editorState } from "@/editor/editorState";
import { renderEventEditorContent } from "@/editor/panels/eventEditor/content";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { PAGE_COMMAND_BUTTONS, TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";
import { isolateTimers } from "./mergedTeardown";

/**
 * 계약: **명령 행 한 번 클릭 = 선택(세 번째 칼럼 인스펙터 채움), 두 번 클릭 = 편집 모달.**
 *
 * 회귀 배경: content.ts 는 "선택한 명령" 인스펙터 칼럼을 만들고
 * setCommandInspectorHost() 로 등록하지만, commandList.ts 의 행 클릭이 곧바로
 * 편집 모달을 열어버려서 인스펙터가 열릴 경로가 없었다. showCommandInspector() 는
 * 재렌더 복원 분기(`sameInspectorPath(path, selectedCommandPath())`) 안에서만
 * 불렸고, 그 조건은 showCommandInspector() 자신이 세우는 값이라 영원히 거짓이었다.
 */
describe("eventEditorInspectorSelection", () => {
  isolateTimers();
  const noopActions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };
  const COMMANDS: Command[] = [
    { kind: "text", body: "약초를 고르고 계신가요?" },
    { kind: "text", body: "오늘 약초는 다 팔렸어요." },
  ];
  const EDIT_DIALOG = '[data-testid="event-command-edit-dialog"]';
  describe("이벤트 편집기 — 명령 선택과 인스펙터", () => {
    let restoreDom: (() => void) | undefined;
    let inspectorHost: FakeElement;
    let listRoot: FakeElement;

    function renderList(): void {
      renderCommandList(listRoot as unknown as HTMLElement, COMMANDS, [], noopActions);
    }

    function headAt(index: number): FakeElement {
      const head = listRoot.querySelectorAll(".cmd-head")[index];
      if (!head) throw new Error(`expected .cmd-head at ${index}`);
      return head;
    }

    function selectedPaths(): string[] {
      // fakeDom 셀렉터는 복합 클래스(.cmd-item.selected)를 모른다 — 클래스 목록으로 직접 고른다.
      return listRoot
        .querySelectorAll(".cmd-item")
        .filter((item) => item.className.split(/\s+/u).includes("selected"))
        .map((item) => item.dataset.cmdPath ?? "");
    }

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      // content.ts 와 같은 순서: 인스펙터 칼럼 등록 → 화면 비우기 → 리스트 렌더.
      inspectorHost = new FakeElement("div");
      inspectorHost.dataset.testid = "event-editor-inspector";
      document.body.append(inspectorHost as unknown as HTMLElement);
      setCommandInspectorHost(inspectorHost as unknown as HTMLElement);
      resetCommandInspectorView();
      listRoot = new FakeElement("div");
      document.body.append(listRoot as unknown as HTMLElement);
      renderList();
    });

    afterEach(() => {
      clearCommandInspector();
      setCommandInspectorHost(undefined);
      restoreDom?.();
    });

    it("한 번 클릭하면 인스펙터가 채워지고 편집 모달은 열리지 않는다", () => {
      expect(inspectorHost.hidden).toBe(true);

      headAt(0).dispatchEvent(new Event("click"));

      expect(inspectorHost.hidden).toBe(false);
      expect(inspectorHost.childNodes.length).toBeGreaterThan(0);
      expect(findByTestId(inspectorHost, "event-inspector-body")).toBeTruthy();
      expect(inspectorHost.dataset.commandPath).toBe("[0]");
      expect(document.querySelector(EDIT_DIALOG)).toBeNull();
      // 툴바 이동/복사가 쓰는 선택 표시도 같이 선다.
      expect(selectedPaths()).toEqual(["[0]"]);
    });

    it("두 번 클릭하면 편집 모달이 열린다", () => {
      headAt(0).dispatchEvent(new Event("dblclick"));

      expect(document.querySelector(EDIT_DIALOG)).not.toBeNull();
    });

    it("다른 행을 클릭하면 인스펙터가 그 행으로 옮겨간다", () => {
      headAt(0).dispatchEvent(new Event("click"));
      headAt(1).dispatchEvent(new Event("click"));

      expect(inspectorHost.dataset.commandPath).toBe("[1]");
      expect(document.querySelector(EDIT_DIALOG)).toBeNull();
      expect(selectedPaths()).toEqual(["[1]"]);
    });

    it("재렌더 후에도 선택한 행의 인스펙터가 복원된다", () => {
      headAt(0).dispatchEvent(new Event("click"));

      resetCommandInspectorView();
      renderList();

      expect(inspectorHost.hidden).toBe(false);
      expect(findByTestId(inspectorHost, "event-inspector-body")).toBeTruthy();
      expect(inspectorHost.dataset.commandPath).toBe("[0]");
    });

    it("닫기 버튼은 인스펙터를 다시 비운다", () => {
      headAt(0).dispatchEvent(new Event("click"));
      findByTestId(inspectorHost, "event-inspector-close")?.click();

      expect(inspectorHost.hidden).toBe(true);
      expect(inspectorHost.childNodes.length).toBe(0);
    });
  });
});

describe("eventEditorMemoryOpeningTemplate", () => {
  isolateTimers();
  let restoreDom: () => void = () => undefined;
  function emptyPage(): EventPage {
    return {
      id: "page-1",
      name: "회상",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function gameEvent(page: EventPage): GameEvent {
    return { id: "event-1", x: 3, y: 3, trigger: page.trigger, commands: [], pages: [page] };
  }
  function renderEmptyEventEditor(): string {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [gameEvent(emptyPage())];
    store.replaceProject(project);
    editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
    const host = new FakeElement("div") as unknown as HTMLElement;
    document.body.append(host);
    renderEventEditorContent(host, mapId, "event-1");
    return mapId;
  }
  function activePage(mapId: string): EventPage {
    const pages = store.getCurrent().maps[mapId].events[0]?.pages ?? [];
    const page = pages.find((entry) => entry.id === "page-1");
    if (!page) throw new Error("page-1 사라짐");
    return page;
  }
  beforeEach(() => {
    vi.stubEnv("VITE_LEGACY_DB_URL", "http://dbserver:8100");
    vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "event-editor-memory-opening");
    _resetEventDraftVaultForTest();
    restoreDom = installFakeDom();
    store.replaceProject(createBlankProject());
  });
  afterEach(() => {
    _resetEventDraftVaultForTest();
    vi.unstubAllEnvs();
    restoreDom();
  });
  describe("empty-event 회상 오프닝 template", () => {
    it("Given an empty event page, When the 회상 오프닝 CTA is clicked, Then the page holds the memory_opening cutscene", () => {
      const mapId = renderEmptyEventEditor();
      const button = document.querySelector<HTMLElement>('[data-testid="event-template-memory-opening"]');
      expect(button).not.toBeNull();

      button?.click();

      const commands = activePage(mapId).commands;
      expect(commands.length).toBeGreaterThan(3);
      expect(commands.some((command) => command.kind === "text")).toBe(true);
      expect(commands.some((command) => command.kind === "wait" && command.ms >= 100)).toBe(true);
      expect(commands.some((command) => command.kind === "showPicture")).toBe(true);
      expect(commands.some((command) => command.kind === "playAudio")).toBe(true);
      // 프리셋이 만든 별도 「컷신」 페이지는 남기지 않는다 — 보고 있던 빈 페이지가 채워진다.
      expect(store.getCurrent().maps[mapId].events[0]?.pages?.length).toBe(1);
    });

    it("Given an empty event page, When the CTA is clicked, Then no command edit dialog blocks the author", () => {
      renderEmptyEventEditor();
      const button = document.querySelector<HTMLElement>('[data-testid="event-template-memory-opening"]');
      expect(button).not.toBeNull();
      button?.click();
      expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).toBeNull();
    });
  });
});

describe("eventEditorOptions", () => {
  isolateTimers();
  describe("event editor trigger options", () => {
    it("shows parallel as an implemented trigger option", () => {
      const parallelOption = TRIGGER_OPTIONS.find((option) => option.value === "parallel");

      expect(parallelOption).toMatchObject({ value: "parallel", label: "뒤에서 계속 실행" });
      expect(parallelOption?.description).toContain("반복");
    });

    it("shows RM2003 player and event touch triggers separately without the legacy touch alias", () => {
      expect(TRIGGER_OPTIONS.map((option) => option.value)).toEqual([
        "action",
        "playerTouch",
        "eventTouch",
        "auto",
        "parallel",
        "locationTransition",
      ]);
      for (const option of TRIGGER_OPTIONS) {
        expect(option.description, option.label).toBeTruthy();
        expect(option.description).not.toBe(option.label);
      }
    });
  });
  describe("event editor command shortcuts", () => {
    it("exposes ending as a direct authoring command", () => {
      expect(PAGE_COMMAND_BUTTONS).toContainEqual({
        kind: "ending",
        testId: "command-add-ending",
        label: "엔딩",
      });
    });
  });
});
