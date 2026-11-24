import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { readEventSurfaceCss } from "./helpers/eventSurfaceCss";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandInspector, resetCommandInspectorView, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";
import type { CommandListActions, CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { editorState } from "@/editor/editorState";
import { renderEventEditorContent } from "@/editor/panels/eventEditor/content";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { PAGE_COMMAND_BUTTONS, TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";
import { isolateTimers } from "./mergedTeardown";

describe("eventEditorHierarchyShell", () => {
  isolateTimers();
  // PIN-RED: event-editor hierarchy chrome contract (after.html).
  //
  // These assertions describe the target "hierarchy" shell rendered by content.ts +
  // event-editor.(hierarchy|balanced).css, and fail against the current balanced
  // baseline. Implementation flips this file to green. The required shell testids
  // (event-editor-modal, event-page-tab-*, event-storyboard) are kept.

  // 2026-09-11 Task 13: balanced.css 는 구성 요소 버킷(shell/pages/footer …)으로 흩어졌다 → 이벤트 표면 전체를 읽는다.
  const css = readEventSurfaceCss();
  const contentSource = readFileSync(
    new URL("../src/editor/panels/eventEditor/content.ts", import.meta.url),
    "utf8",
  );
  const modalSource = readFileSync(
    new URL("../src/editor/panels/eventEditor/modal.ts", import.meta.url),
    "utf8",
  );
  const pagePropsSource = readFileSync(
    new URL("../src/editor/panels/eventEditor/pageProps.ts", import.meta.url),
    "utf8",
  );
  const storyboardSource = readFileSync(
    new URL("../src/editor/panels/eventEditor/storyboardView.ts", import.meta.url),
    "utf8",
  );
  describe("event editor hierarchy chrome contract", () => {
    it("collapses the identity band into the titlebar (no 89px identity row)", () => {
      expect(css).not.toContain("--balanced-identity-height: 89px");
    });

    it("shrinks the titlebar to 48px", () => {
      expect(css).toMatch(/--(?:hierarchy|balanced)-header-height:\s*48px/);
    });

    it("shrinks the page tab strip to 40px", () => {
      expect(css).toMatch(/--(?:hierarchy|balanced)-pages-height:\s*40px/);
    });

    it("shrinks the footer to 40px", () => {
      expect(css).toMatch(/--(?:hierarchy|balanced)-footer-height:\s*40px/);
    });

    it("drops the numbered left-rail '1. 언제 나타날까요?' affordance", () => {
      expect(pagePropsSource).not.toContain("1. 언제 나타날까요?");
    });

    it("shows the event name in the titlebar via the event-editor-name testid", () => {
      expect(modalSource).toContain("event-editor-name");
    });

    it("keeps the required shell testids", () => {
      const combined = modalSource + pagePropsSource + storyboardSource;
      expect(combined).toContain("event-editor-modal");
      expect(combined).toContain("evt-page-segment");
      expect(combined).toContain("event-storyboard");
    });
  });
});

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

describe("eventEditorM2CommandBody", () => {
  isolateTimers();
  const MOVE_PICTURE_COMMAND = {
    kind: "m2Command",
    commandId: "m2-052-move-picture",
    fields: {
      pictureId: "pic_cloud",
      resourceId: "easyrpg-picture-cloud",
      x: 12,
      y: 34,
    },
  } satisfies Command;
  function contextWithReplaceSpy(replaceCommand: CommandEditContext["actions"]["replaceCommand"]): CommandEditContext {
    return {
      path: [2],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand,
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
    };
  }
  describe("event editor M2 command body", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      const firstActor = project.database.actors[0];
      const firstClass = project.database.classes[0];
      const firstAnimation = project.database.battleAnimations[0];
      if (firstActor) firstActor.name = "테스트 주인공";
      if (firstClass) firstClass.name = "테스트 직업";
      if (firstAnimation) firstAnimation.name = "테스트 애니메이션";
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders Move Picture as the canonical rich picture-slot movement form", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));

      expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
      expect(findByTestId(body, "move-picture-m2-command-body")).not.toBeNull();
      expect(findByTestId(body, "move-picture-m2-intent")?.textContent).toContain("그림 이동");
      expect(findByTestId(body, "move-picture-m2-preview")).not.toBeNull();
      expect(findByTestId(body, "move-picture-m2-resource-select")).toBeNull();
    });

    it("keeps Move Picture numeric fields editable through the normal command replace path", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const context = contextWithReplaceSpy(replaceCommand);

      const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));
      const pictureId = findByTestId(body, "move-picture-m2-id-input");
      const x = findByTestId(body, "move-picture-m2-x-input");
      const y = findByTestId(body, "move-picture-m2-y-input");
      expect(pictureId?.value).toBe("pic_cloud");
      expect(x?.value).toBe("12");
      expect(y?.value).toBe("34");
      if (!x) throw new Error("missing Move Picture X input");

      x.value = "48";
      x.dispatchEvent(new Event("change"));

      expect(replaceCommand).toHaveBeenCalledWith(
        [2],
        expect.objectContaining({
          kind: "m2Command",
          commandId: "m2-052-move-picture",
          fields: expect.objectContaining({ pictureId: "pic_cloud", x: 48, y: 34 }),
        })
      );
    });

    it("renders database-backed generic command ids as Korean record selectors instead of raw text inputs", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const context = contextWithReplaceSpy(replaceCommand);

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-091-change-actor-class",
            fields: { target: "actor_hero", operation: "set", value: "class_hero" },
          }) ?? document.createElement("div")
      );

      expect(Boolean(findByTestId(body, "m2-command-target-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
      const actor = findByTestId(body, "change-actor-class-actor-select");
      const actorClass = findByTestId(body, "change-actor-class-class-select");
      expect(findByTestId(body, "change-actor-class-command-body")).not.toBeNull();
      expect(actor?.tagName).toBe("SELECT");
      expect(actor?.textContent).toContain("테스트 주인공");
      expect(actorClass?.tagName).toBe("SELECT");
      expect(actorClass?.textContent).toContain("테스트 직업");
    });

    it("renders generic animation ids as battle animation record selectors", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-054-show-animation",
            fields: { target: "this-event", animationId: "anim_sword" },
          }) ?? document.createElement("div")
      );

      expect(Boolean(findByTestId(body, "m2-command-animationId-input"))).toBe(false);
      const animation = findByTestId(body, "show-animation-m2-animation-select");
      expect(findByTestId(body, "show-animation-m2-command-body")).not.toBeNull();
      expect(animation?.tagName).toBe("SELECT");
      expect(animation?.textContent).toContain("테스트 애니메이션");
    });

    it("renders system graphic values as resource selectors with a preview", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-029-change-system-graphic",
            fields: { target: "window", operation: "set", value: "windowskin-warm" },
          }) ?? document.createElement("div")
      );

      expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
      const picker = findByTestId(body, "m2-command-value-resource-picker");
      const preview = findByTestId(body, "m2-command-value-resource-preview");
      expect(picker?.tagName).toBe("SELECT");
      expect(picker?.attrs["aria-label"]).toBe("메뉴 모습 선택");
      expect(picker?.textContent).toContain("windowskin-warm");
      expect(preview?.dataset.resourceId).toBe("windowskin-warm");
    });

    it("renders map/event location commands with friendly event, map, and coordinate controls", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-040-set-event-location",
            fields: { target: "event_starter_mina", mapId: "map_starter_village", x: 3, y: 4 },
          }) ?? document.createElement("div")
      );

      expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
      expect(findByTestId(body, "set-event-location-command-body")).not.toBeNull();
      expect(findByTestId(body, "set-event-location-event-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "set-event-location-map-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "set-event-location-x-input")?.value).toBe("3");
      expect(findByTestId(body, "set-event-location-y-input")?.value).toBe("4");
    });

    it("renders modern commands as guided controls instead of raw note fields", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const context = contextWithReplaceSpy(replaceCommand);

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-201-camera-control",
            fields: { mode: "panTo", target: "player", x: 10, y: 12, zoom: 1.25, durationMs: 450 },
          }) ?? document.createElement("div")
      );

      expect(body.textContent).toContain("값을 고르고 확인을 누르면 적용됩니다.");
      expect(findByTestId(body, "m2-command-mode-option-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "m2-command-target-option-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "m2-command-x-input")?.value).toBe("10");
      expect(findByTestId(body, "m2-command-y-input")?.value).toBe("12");
      expect(findByTestId(body, "m2-command-zoom-input")?.value).toBe("1.25");
      expect(findByTestId(body, "m2-command-durationMs-input")?.value).toBe("450");
      expect(findByTestId(body, "m2-command-note-input")).toBeNull();
    });

    it("routes Advanced Dialogue into the native text form (merged)", async () => {
      // Advanced Dialogue is now existingKind:text — generic m2 body is not used.
      const { m2CommandById } = await import("@/project/eventCommands/m2Catalog");
      const entry = m2CommandById("m2-209-advanced-dialogue");
      expect(entry?.existingKind).toBe("text");
      expect(entry?.bodyStrategy).toBe("existing");
    });

    it("renders Call Event as a common-event record selector, not map coordinates", () => {
      const project = store.getCurrent();
      project.commonEvents.push({ id: "ce_test", name: "테스트 공통 이벤트", commands: [], trigger: "none" });
      store.replace(project);
      const context = contextWithReplaceSpy(vi.fn());
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-087-call-event",
          fields: {},
        }) ?? document.createElement("div")
      );

      // m2-087은 existingKind:callCommonEvent 별칭이라 제네릭 껍데기만 낸다.
      // 실제 저작은 네이티브 폼이 맡으므로, 별칭 껍데기가 맵 좌표 입력을 내놓지 않으면 된다.
      expect(Boolean(findByTestId(body, "m2-command-target-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-mapId-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-x-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-y-input"))).toBe(false);
    });

    it("renders Play Movie resource ids as movie picks, not image picks", () => {
      const context = contextWithReplaceSpy(vi.fn());
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-066-play-movie",
          fields: {},
        }) ?? document.createElement("div")
      );

      const picker = findByTestId(body, "m2-command-resourceId-picker");
      expect(picker?.attrs["aria-label"]).toBe("영상 선택");
      expect(body.textContent).not.toContain("합본 마을");
      expect(body.textContent).not.toContain("tex_easyrpg_chipset_combined_town");
      expect(body.textContent).toContain("동영상을 고르세요");
      expect(body.textContent).not.toContain("그림을 고르세요");
    });

    it("explains Wait for All Movement intent for authors", () => {
      const context = contextWithReplaceSpy(vi.fn());
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-058-wait-for-all-movement",
          fields: {},
        }) ?? document.createElement("div")
      );

      expect(findByTestId(body, "m2-command-body-m2-058-wait-for-all-movement")).not.toBeNull();
      expect(findByTestId(body, "m2-command-note-input")).toBeNull();
      expect(body.textContent).toContain("이 명령은 추가 설정 없이 실행됩니다");
      const hints = (body.textContent?.match(/추가 설정 없음/g) ?? []).length;
      expect(hints).toBeLessThanOrEqual(1);
    });
    it("announces retired catalog rows inside the dialog", () => {
      const context = contextWithReplaceSpy(vi.fn());
      // m2-055는 전용 애니메이션 폼 경로 — 배너가 전용 폼에도 붙는지 본다.
      const body = renderWithFakeDom(() =>
        renderCommandBody(context, {
          kind: "m2Command",
          commandId: "m2-055-show-animation",
          fields: {},
        })
      );

      expect(findByTestId(body, "show-animation-m2-command-body")).not.toBeNull();
      const notice = findByTestId(body, "m2-command-deprecated-notice");
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain("m2-054-show-animation");
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
