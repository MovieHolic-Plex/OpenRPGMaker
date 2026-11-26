// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach, vi } from "vitest";
import { renderCoordinateMoveCommandBody } from "@/editor/panels/eventEditor/commandBodyM2Coordinate";
import { m2CommandById, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { movementResultCode } from "@/project/eventCommands/coordinateDestination";
import { store } from "@/project/store";
import type { Command, M2CommandFields, Project, GameEvent, MapId } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { commandCategoryVisual, pickerPageIcon, renderCategoryIcon } from "@/editor/panels/eventEditor/commandCategoryIcons";
import { EDITOR_ICON_NAMES, renderEditorIcon } from "@/editor/panels/eventEditor/editorIcons";
import { editorState } from "@/editor/editorState";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetEventAiStagedForTest } from "@/editor/panels/eventEditor/aiAssist";
import { resetEventEditLineForTest } from "@/editor/panels/eventEditor/eventEditLine";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { getAudioEngine, playAudioCommand, resumeAudioState } from "@/player/audio";
import { enterBattleAudio, exitBattleAudio, playAuthoredBattleResultCue } from "@/player/battleAudio";
import { playBattleCue } from "@/player/battleJuice";
import { createInterpreter } from "@/player/interpreter";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from "@/player/saveSlots";
import { startMapBgm } from "@/player/mapBgm";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { buildContractProject } from "./commandContracts/harness";
import { isolateTimers } from "./mergedTeardown";

// test/coordinateMoveCommandBody.test.ts — OPRN-OUT-013 저작 표면.
//
// 「좌표로 이동」 폼이 (1) 대상 세 종류를 정본 문자열로 커밋하고, (2) X·Y 를 각각 숫자/변수로
// 전환하며 표준 변수 픽커를 쓰고, (3) 실패 정책·대체 목적지·결과 기록처를 저작하게 하고,
// (4) 옛 고정 좌표 명령을 열어도 값과 저장 형태가 변하지 않는지를 실제 DOM 으로 잰다.
describe("coordinateMoveCommandBody", () => {
  isolateTimers();
  const PATHFIND_ID = "m2-205-pathfind-move";
  type M2Command = Extract<Command, { kind: "m2Command" }>;
  function projectWithRecords(): Project {
    const project = createBlankProject();
    project.variables = [
      ...project.variables,
      { id: "var_x", name: "목표 X" },
      { id: "var_y", name: "목표 Y" },
      { id: "var_result", name: "이동 결과" },
    ];
    project.switches = [...project.switches, { id: "sw_arrived", name: "도착" }];
    const map = project.maps[project.startMapId]!;
    map.events = [
      { id: "ev_guard", x: 3, y: 4, trigger: { kind: "action" }, commands: [] },
    ];
    return project;
  }
  function harness(fields: M2CommandFields) {
    const initial: M2Command = { kind: "m2Command", commandId: PATHFIND_ID, fields };
    let current: M2Command = initial;
    const replaced: M2Command[] = [];
    const context = {
      path: [0],
      lockKind: true,
      getCurrentCommand: () => current,
      actions: {
        replaceCommand: (_path: readonly number[], command: Command) => {
          current = command as M2Command;
          replaced.push(current);
        },
        addCommand: () => {},
        removeCommand: () => {},
        moveCommand: () => {},
      },
    } as unknown as CommandEditContext;
    const root = renderCoordinateMoveCommandBody(context, initial);
    expect(root, "좌표 이동 전용 폼이 렌더되지 않았다").toBeTruthy();
    document.body.replaceChildren(root!);
    return { root: root!, replaced, latest: () => replaced.at(-1) };
  }
  const q = <T extends Element = HTMLElement>(root: ParentNode, testid: string): T | null =>
    root.querySelector<T>(`[data-testid="${testid}"]`);
  function setSelect(root: ParentNode, testid: string, value: string): void {
    const select = q<HTMLSelectElement>(root, testid);
    expect(select, testid).not.toBeNull();
    select!.value = value;
    select!.dispatchEvent(new Event("change"));
  }
  function setInput(root: ParentNode, testid: string, value: string): void {
    const input = q<HTMLInputElement>(root, testid);
    expect(input, testid).not.toBeNull();
    input!.value = value;
    input!.dispatchEvent(new Event("change"));
  }
  describe("좌표로 이동 — 저작 폼", () => {
    beforeEach(() => {
      store.replace(projectWithRecords());
    });

    it("카탈로그가 좌표 소스·실패 정책·대체·결과 필드를 선언한다", () => {
      const entry = m2CommandById(PATHFIND_ID)!;
      const keys = entry.fields.map((field) => field.key);
      expect(keys).toEqual(expect.arrayContaining([
        "target", "xSource", "x", "xVariableId", "ySource", "y", "yVariableId",
        "speed", "wait", "onFailure", "fallback", "resultVariableId", "resultSwitchId",
      ]));
      // 기본값은 옛 고정 좌표 동작과 같아야 한다.
      const byKey = new Map(entry.fields.map((field) => [field.key, field.defaultValue]));
      expect(byKey.get("xSource")).toBe("fixed");
      expect(byKey.get("ySource")).toBe("fixed");
      expect(byKey.get("onFailure")).toBe("continue");
      expect(byKey.get("fallback")).toBe("none");
    });

    it("옛 고정 좌표 명령을 열면 숫자 칸이 보이고 변수 칸은 숨는다", () => {
      const { root } = harness({ target: "this-event", x: 6, y: 4, speed: 4, wait: true });
      expect(q<HTMLSelectElement>(root, "coordinate-move-x-source")?.value).toBe("fixed");
      expect(q<HTMLInputElement>(root, "coordinate-move-x-input")?.value).toBe("6");
      expect(q<HTMLInputElement>(root, "coordinate-move-y-input")?.value).toBe("4");
      expect((q(root, "coordinate-move-x-variable-field") as HTMLElement).hidden).toBe(true);
      expect((q(root, "coordinate-move-x-number-field") as HTMLElement).hidden).toBe(false);
      // 대상이 「특정 이벤트」가 아니면 이벤트 검색 줄도 숨는다.
      expect((q(root, "coordinate-move-event-field") as HTMLElement).hidden).toBe(true);
    });

    it("폼을 열기만 해도 저장값이 바뀌지 않는다 — 옛 프로젝트를 여는 것이 편집이 되면 안 된다", () => {
      const { replaced } = harness({ target: "this-event", x: 6, y: 4, speed: 4, wait: true });
      expect(replaced).toEqual([]);
    });

    it.each([
      ["player", PLAYER_MOVE_TARGET],
      ["this-event", "this-event"],
    ])("대상 %s 를 정본 문자열로 커밋한다", (segment, stored) => {
      const { root, latest } = harness({ target: "this-event", x: 1, y: 1 });
      setSelect(root, "coordinate-move-target", segment);
      expect(latest()?.fields.target).toBe(stored);
    });

    it("「특정 이벤트」를 고르면 이 맵의 이벤트 목록에서 골라 id 가 커밋된다 (원시 id 입력 불필요)", () => {
      const { root, latest } = harness({ target: "this-event", x: 1, y: 1 });
      setSelect(root, "coordinate-move-target", "event");
      expect((q(root, "coordinate-move-event-field") as HTMLElement).hidden).toBe(false);
      // 이동 경로 설정과 같은 픽커다 — 목록 버튼과 옵션 testid 가 그 계약을 그대로 쓴다.
      q<HTMLButtonElement>(root, "move-route-event-picker-open")!.click();
      const option = q<HTMLButtonElement>(root, "move-route-event-option-ev_guard");
      expect(option, "이 맵의 이벤트가 목록에 없다").not.toBeNull();
      option!.click();
      expect(latest()?.fields.target).toBe("ev_guard");
    });

    it("X 를 변수로 바꾸면 표준 변수 픽커가 나타나고 숫자 칸이 숨는다", () => {
      const { root, latest } = harness({ target: "player", x: 6, y: 4 });
      setSelect(root, "coordinate-move-x-source", "variable");
      expect((q(root, "coordinate-move-x-variable-field") as HTMLElement).hidden).toBe(false);
      expect((q(root, "coordinate-move-x-number-field") as HTMLElement).hidden).toBe(true);
      expect(latest()?.fields.xSource).toBe("variable");
      // 표준 레코드 픽커의 숨은 select 를 통해 고른다 (e2e selectOption 과 같은 경로).
      const select = q(root, "coordinate-move-x-variable")!.querySelector("select")!;
      select.value = "var_x";
      select.dispatchEvent(new Event("change"));
      expect(latest()?.fields.xVariableId).toBe("var_x");
      // 고정 X 값은 지워지지 않는다 — 숫자로 되돌리면 원래 값이 살아 있어야 한다.
      expect(latest()?.fields.x).toBe(6);
    });

    it("X 는 변수, Y 는 숫자처럼 축마다 다르게 저작할 수 있다", () => {
      const { root, latest } = harness({ target: "player", x: 0, y: 0 });
      setSelect(root, "coordinate-move-x-source", "variable");
      const xSelect = q(root, "coordinate-move-x-variable")!.querySelector("select")!;
      xSelect.value = "var_x";
      xSelect.dispatchEvent(new Event("change"));
      setInput(root, "coordinate-move-y-input", "9");
      expect(latest()?.fields).toMatchObject({
        xSource: "variable", xVariableId: "var_x", ySource: "fixed", y: 9,
      });
    });

    it("실패 정책·대체 목적지·결과 기록처를 저작한다", () => {
      const { root, latest } = harness({ target: "player", x: 2, y: 2 });
      setSelect(root, "coordinate-move-failure", "stop");
      setSelect(root, "coordinate-move-fallback", "nearest");
      const variable = q(root, "coordinate-move-result-variable")!.querySelector("select")!;
      variable.value = "var_result";
      variable.dispatchEvent(new Event("change"));
      const sw = q(root, "coordinate-move-result-switch")!.querySelector("select")!;
      sw.value = "sw_arrived";
      sw.dispatchEvent(new Event("change"));
      expect(latest()?.fields).toMatchObject({
        onFailure: "stop", fallback: "nearest",
        resultVariableId: "var_result", resultSwitchId: "sw_arrived",
      });
    });

    it("속도는 1–8 로 묶이고 대기는 체크박스가 소유한다", () => {
      const { root, latest } = harness({ target: "player", x: 2, y: 2, speed: 4, wait: true });
      setInput(root, "coordinate-move-speed-input", "99");
      expect(latest()?.fields.speed).toBe(8);
      setInput(root, "coordinate-move-speed-input", "-3");
      expect(latest()?.fields.speed).toBe(1);
      expect(q(root, "coordinate-move-speed-input")?.getAttribute("max")).toBe("8");
      expect(root.textContent).toContain("속도(1–8)");
      const wait = q<HTMLInputElement>(root, "coordinate-move-wait-checkbox")!;
      wait.checked = false;
      wait.dispatchEvent(new Event("change"));
      expect(latest()?.fields.wait).toBe(false);
    });

    it("미리보기가 목적지·정책·결과 코드 표를 말한다 (색만으로 상태를 구분하지 않는다)", () => {
      const { root } = harness({
        target: "player", xSource: "variable", xVariableId: "var_x", y: 4,
        resultVariableId: "var_result", onFailure: "stop",
      });
      const preview = q(root, "coordinate-move-preview")!;
      expect(preview.textContent).toContain("주인공");
      expect(preview.textContent).toContain("목표 X");
      expect(preview.textContent).toContain("이벤트를 중단");
      expect(preview.textContent).toContain(`도착 ${movementResultCode("arrived")}`);
      expect(preview.textContent).toContain(`막힘 ${movementResultCode("blocked")}`);
    });

    it("변수를 골랐지만 정하지 않으면 미리보기가 경고한다", () => {
      const { root } = harness({ target: "player", xSource: "variable", xVariableId: "", y: 4 });
      expect(q(root, "coordinate-move-preview-warning")?.textContent).toContain("X");
    });

    it("대체를 끄면 미리보기가 (0,0) 으로 떨어지지 않는다고 명시한다", () => {
      const { root } = harness({ target: "player", x: 2, y: 2, fallback: "none" });
      expect(q(root, "coordinate-move-preview")?.textContent).toContain("(0,0)");
    });
  });
  describe("좌표로 이동 — 저작 시점 진단", () => {
    /** 이 명령 하나만 단 페이지 이벤트를 검사하고 이슈 코드만 돌린다. */
    function issuesFor(fields: M2CommandFields): readonly string[] {
      const project = projectWithRecords();
      store.replace(project);
      const mapId = project.startMapId;
      const event = {
        id: "probe", x: 1, y: 1, trigger: { kind: "action" as const }, commands: [],
        pages: [{
          id: "page-1", name: "검사", conditions: [], graphic: {},
          trigger: { kind: "action" as const }, priority: "below" as const,
          movement: { type: "fixed" as const, speed: 3, frequency: 3 },
          commands: [{ kind: "m2Command" as const, commandId: PATHFIND_ID, fields }],
        }],
      };
      project.maps[mapId]!.events = [...project.maps[mapId]!.events, event];
      return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
    }

    it("고정 좌표가 맵 범위를 벗어나면 지금 잡는다", () => {
      expect(issuesFor({ target: "player", xSource: "fixed", x: 9999, ySource: "fixed", y: 0 }))
        .toContain("map.position.out-of-bounds");
    });

    it.each([
      ["소수", 2.5],
      ["음수", -1],
    ])("고정 좌표가 %s 면 런타임과 같은 이유로 반려한다", (_label, value) => {
      expect(issuesFor({ target: "player", xSource: "fixed", x: value, ySource: "fixed", y: 0 }))
        .toContain("m2.coordinate.fixed.invalid");
    });

    it("변수를 골랐는데 정하지 않으면 저작 시점에 잡는다", () => {
      expect(issuesFor({ target: "player", xSource: "variable", xVariableId: "", ySource: "fixed", y: 0 }))
        .toContain("m2.coordinate.variable.unselected");
    });

    it("없는 변수를 가리키면 참조 오류다", () => {
      expect(issuesFor({ target: "player", xSource: "variable", xVariableId: "var_missing", ySource: "fixed", y: 0 }))
        .toContain("reference.variable.missing");
    });

    it("한 축이라도 변수면 지도 범위를 단정하지 않는다 — 런타임 전에는 알 수 없다", () => {
      const codes = issuesFor({ target: "player", xSource: "variable", xVariableId: "var_x", ySource: "fixed", y: 0 });
      expect(codes).not.toContain("map.position.out-of-bounds");
      expect(codes).not.toContain("m2.coordinate.variable.unselected");
    });

    it("옛 고정 좌표 명령(새 키 없음)은 아무 진단도 새로 만들지 않는다", () => {
      expect(issuesFor({ target: "this-event", x: 3, y: 3, speed: 4, wait: true })).toEqual([]);
    });

    it("결과 기록처를 비워 두는 것은 정상이다 (기본이 안전)", () => {
      expect(issuesFor({ target: "player", x: 2, y: 2, resultVariableId: "", resultSwitchId: "" })).toEqual([]);
    });

    it("결과 기록처가 없는 레코드를 가리키면 잡는다", () => {
      expect(issuesFor({ target: "player", x: 2, y: 2, resultVariableId: "var_gone" }))
        .toContain("reference.variable.missing");
      expect(issuesFor({ target: "player", x: 2, y: 2, resultSwitchId: "sw_gone" }))
        .toContain("reference.switch.missing");
    });
  });
});

describe("editorIcons", () => {
  isolateTimers();
  describe("editorIcons", () => {
    it("아이콘은 22×22 스트로크 SVG 이고 기본은 장식(aria-hidden)이다", () => {
      const icon = renderEditorIcon("close");
      expect(icon.tagName.toLowerCase()).toBe("svg");
      expect(icon.getAttribute("viewBox")).toBe("0 0 22 22");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.classList.contains("ee-icon")).toBe(true);
      expect(icon.classList.contains("ee-icon-close")).toBe(true);
      expect(icon.querySelector("path, rect, circle")).not.toBeNull();
    });

    it("라벨을 주면 아이콘 혼자 뜻을 전한다(role=img)", () => {
      const icon = renderEditorIcon("trash", { label: "삭제" });
      expect(icon.getAttribute("role")).toBe("img");
      expect(icon.getAttribute("aria-label")).toBe("삭제");
      expect(icon.hasAttribute("aria-hidden")).toBe(false);
    });

    it("모든 이름이 비어 있지 않은 스펙을 가진다", () => {
      expect(EDITOR_ICON_NAMES.length).toBeGreaterThan(30);
      for (const name of EDITOR_ICON_NAMES) {
        expect(renderEditorIcon(name).querySelector("path, rect, circle"), name).not.toBeNull();
      }
    });

    it("명령 분류마다 아이콘 이름이 붙고 글리프 문자 대신 SVG 로 그려진다", () => {
      expect(commandCategoryVisual({ kind: "text", body: "" }).icon).toBe("chat");
      expect(commandCategoryVisual({ kind: "choices", options: [] }).icon).toBe("choice");
      expect(commandCategoryVisual({ kind: "fork", condition: { kind: "switch", switchId: "s", value: true }, then: [] }).icon).toBe("branch");
      expect(commandCategoryVisual({ kind: "transfer", mapId: "m", x: 0, y: 0 }).icon).toBe("route");
      expect(commandCategoryVisual({ kind: "shop", itemIds: [] }).icon).toBe("coin");
      const node = renderCategoryIcon(commandCategoryVisual({ kind: "text", body: "" }));
      expect(node.tagName.toLowerCase()).toBe("svg");
      expect(node.classList.contains("ee-icon-chat")).toBe(true);
      expect([pickerPageIcon(1), pickerPageIcon(2), pickerPageIcon(3), pickerPageIcon(4)]).toEqual(["chat", "party", "spark", "gear"]);
    });
  });
});

// 「AI 로 이벤트 고치기」의 실제 모달 통합 계약.
//
// 조수 창(도크)은 없고 맨 아래 한 줄 입력칸이 입구다(목업 v2). 진짜 편집기 모달을 열어, 전역 선택 페이지가 다른 이벤트를
// 가리킬 때(A 를 최소화한 채 B 를 고른 뒤 A 로 돌아옴)도 입력칸이 초점을 받는지 고정한다.
describe("eventAiAuthoringIntegration", () => {
  isolateTimers();
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
});

describe("eventAudioHandoffs", () => {
  isolateTimers();
  const FIELD = "cc0-bgm-rtp-fld-002";
  const BATTLE = "cc0-bgm-rtp-btl-002";
  const SE = "easyrpg-sound-decision1";
  const OTHER_SE = "easyrpg-sound-cancel1";
  const originalProject = store.getCurrent();
  function m2(title: string, fields: M2CommandFields = {}): Command {
    const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
    if (!entry) throw new Error(`Missing command: ${title}`);
    return { kind: "m2Command", commandId: entry.id, fields };
  }
  function setup(commands: Command[] = []) {
    const project = buildContractProject(commands);
    store.replaceProject(project);
    const session = startSession(project, 3);
    const dialogue = {
      showText: vi.fn(async () => undefined), showChoices: vi.fn(async () => 0),
      showNumberInput: vi.fn(async () => 0), hide: vi.fn(), close: vi.fn(),
    };
    // Only non-audio scene surfaces are stubbed; interpreter, scheduler, resolver and engine are real.
    const scene = {
      session, running: false, inputEnabled: true, lastActionTargetKey: "", tileY: 0,
      map: project.maps[project.startMapId],
      game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : undefined } },
      setInputEnabled: vi.fn(), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
      showRuntimeOverlay: vi.fn(), clearRuntimeOverlay: vi.fn(),
    } as unknown as PlaySceneContext;
    return { project, session, scene };
  }
  function audioElements(): HTMLAudioElement[] {
    return [...document.querySelectorAll<HTMLAudioElement>("audio[data-oprn-audio]")];
  }
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const engine = getAudioEngine();
    engine.stopAll();
    engine.unlock();
    engine.setFadeInMs(600);
    engine.setVolume("bgm", 0.7);
    engine.setVolume("se", 0.8);
  });
  afterEach(() => {
    getAudioEngine().stopAll();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    localStorage.clear();
    store.replaceProject(originalProject);
  });
  describe("U14 actual audio handoffs", () => {
    it.each(["blocking", "parallel"] as const)("delivers ambient gain and explicit zero fade through %s execution", async (path) => {
      const { scene, session } = setup();
      const command = m2("Sound Layer", { channel: "ambient", resourceId: FIELD, volume: 25, fadeMs: 0 });
      if (path === "blocking") await runCommands(scene, [command]);
      else applyNonBlockingStep(scene, createInterpreter([command], session).start());
      const audio = audioElements();
      expect(audio).toHaveLength(1);
      expect(audio[0]?.loop).toBe(true);
      expect(audio[0]?.volume).toBeCloseTo(0.7 * 0.25);
      expect(getAudioEngine().getFadeInMs()).toBe(0);
      expect(session.audio.ambient?.resourceId).toBe(FIELD);
      expect(session.audio.bgm).toBeUndefined();
    });

    it("keeps per-track gain when the group volume changes and the same track is requested again", async () => {
      const { scene } = setup();
      await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 25, fadeMs: 0 })]);
      getAudioEngine().setVolume("bgm", 0.4);
      expect(audioElements()[0]?.volume).toBeCloseTo(0.1);
      await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 50, fadeMs: 0 })]);
      expect(audioElements()).toHaveLength(1);
      expect(audioElements()[0]?.volume).toBeCloseTo(0.2);
    });

    it.each(["command", "map"] as const)("resets omitted gain on the same track through %s and keeps save/resume consistent", async (path) => {
      const { scene, session, project } = setup();
      await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 25, fadeMs: 0 })]);
      const element = audioElements()[0];
      expect(element?.volume).toBeCloseTo(0.175);

      if (path === "command") await runCommands(scene, [{ kind: "playAudio", resourceId: FIELD, loop: true }]);
      else {
        project.system.defaultBgmResourceId = FIELD;
        startMapBgm(project, session, project.startMapId);
      }

      expect(audioElements()).toEqual([element]);
      expect(element?.volume).toBeCloseTo(0.7);
      expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: true });
      saveToSlot(localStorage, 1, createSaveSnapshot(project, session));
      const saved = readSaveSlot(localStorage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
      const restored = applySaveSnapshot(project, saved.snapshot);
      getAudioEngine().stopAll();
      resumeAudioState(restored.audio, project, { fadeInMs: 0 });
      expect(audioElements()[0]?.volume).toBeCloseTo(0.7);
    });

    it.each([
      { volume: 0.25, sameTrack: false }, { volume: 0, sameTrack: false },
      { volume: 0.25, sameTrack: true }, { volume: 0, sameTrack: true },
    ])("restores field gain $volume after battle (same track: $sameTrack)", async ({ volume, sameTrack }) => {
      const { scene, session, project } = setup();
      project.system.battleBgmResourceId = sameTrack ? FIELD : BATTLE;
      await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: volume * 100, fadeMs: 0 })]);
      const before = { ...session.audio.bgm };
      const saved = enterBattleAudio(project, session);
      expect(audioElements().at(-1)?.volume).toBeCloseTo(sameTrack ? volume * 0.7 : 0.7);

      exitBattleAudio(project, session, saved);

      expect(session.audio.bgm).toEqual(before);
      expect(audioElements().at(-1)?.volume).toBeCloseTo(volume * 0.7);
    });

    it("preserves an explicit field loop flag through a battle handoff", () => {
      const { session, project } = setup();
      session.audio.bgm = { resourceId: FIELD, loop: false, volume: 25 };
      const saved = enterBattleAudio(project, session);
      const play = vi.spyOn(getAudioEngine(), "play");
      exitBattleAudio(project, session, saved);
      expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: false, volume: 25 });
      expect(play.mock.calls.at(-1)?.[0]).toBe("bgm");
      expect(play.mock.calls.at(-1)?.[3]).toBe(false);
    });

    it.each(["me", "se"] as const)("plays %s once with its own gain without changing BGM", async (channel) => {
      const { scene, project } = setup();
      playAudioCommand({ resourceId: FIELD, loop: true }, project, { fadeInMs: 0 });
      const field = audioElements()[0];
      await runCommands(scene, [m2("Sound Layer", { channel, resourceId: SE, volume: 50, fadeMs: 0 })]);
      expect(audioElements()[0]).toBe(field);
      expect(field?.volume).toBeCloseTo(0.7);
      expect(audioElements()[1]?.loop).toBe(false);
      expect(audioElements()[1]?.volume).toBeCloseTo((channel === "me" ? 0.7 : 0.8) * 0.5);
      getAudioEngine().setVolume(channel === "me" ? "bgm" : "se", 0.6);
      expect(audioElements()[1]?.volume).toBeCloseTo(0.3);
    });

    it("replays memorized BGM through the engine, not only the session record", async () => {
      const { scene } = setup();
      const play = vi.spyOn(getAudioEngine(), "play");
      await runCommands(scene, [
        { kind: "playAudio", resourceId: FIELD, loop: true }, m2("Memorize Current BGM"),
        { kind: "playAudio", resourceId: BATTLE, loop: true }, m2("Play Memorized BGM"),
      ]);
      expect(play.mock.calls.map(([channel, resource]) => [channel, resource])).toEqual([
        ["bgm", FIELD], ["bgm", BATTLE], ["bgm", FIELD],
      ]);
    });

    it("inserts the Fadeout BGM alias with its channel and preserves it through project export/import", () => {
      let selected: Command | undefined;
      openEventCommandPicker({ title: "Commands", context: "map", onSelect: (command) => { selected = command; } });
      const button = [...document.querySelectorAll<HTMLButtonElement>(".event-command-picker-command")]
        .find((candidate) => candidate.textContent?.includes("BGM 페이드아웃"));
      expect(button).toBeDefined();
      button?.click();
      expect(selected).toEqual({ kind: "stopAudio", channel: "bgm" });
      if (!selected) throw new Error("Picker did not insert a command");
      const project = buildContractProject([selected, { kind: "stopAudio" }]);
      const restored = deserialize(serialize(project));
      expect(restored.maps[restored.startMapId]?.events[0]?.commands).toEqual([selected, { kind: "stopAudio" }]);
    });

    it.each(["blocking", "parallel", "legacy"] as const)("stops only BGM through the %s path", async (path) => {
      const { scene, session } = setup();
      await runCommands(scene, [
        m2("Sound Layer", { channel: "bgm", resourceId: FIELD, fadeMs: 0 }),
        m2("Sound Layer", { channel: "ambient", resourceId: BATTLE, fadeMs: 0 }),
        m2("Sound Layer", { channel: "se", resourceId: SE }),
      ]);
      const stop = vi.spyOn(getAudioEngine(), "stopChannel");
      const stopAll = vi.spyOn(getAudioEngine(), "stopAll");
      if (path === "parallel") applyNonBlockingStep(scene, { kind: "stopAudio", channel: "bgm" });
      else await runCommands(scene, [path === "legacy" ? m2("Fadeout BGM") : { kind: "stopAudio", channel: "bgm" }]);
      expect(stop).toHaveBeenCalledWith("bgm");
      expect(stopAll).not.toHaveBeenCalled();
      expect(session.audio.bgm).toBeUndefined();
      expect(session.audio.ambient?.resourceId).toBe(BATTLE);
      expect(session.audio.se?.resourceId).toBe(SE);
    });

    it("persists system replacements through save-slot parsing and consumes them on map/battle entry", async () => {
      const { project, session, scene } = setup();
      await runCommands(scene, [m2("Change System BGM", { slot: "field", resourceId: FIELD }), m2("Change System BGM", { slot: "battle", resourceId: BATTLE })]);
      expect(saveToSlot(localStorage, 1, createSaveSnapshot(project, session)).ok).toBe(true);
      const saved = readSaveSlot(localStorage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
      const restored = applySaveSnapshot(project, saved.snapshot);
      const play = vi.spyOn(getAudioEngine(), "play");
      startMapBgm(project, restored, project.startMapId);
      enterBattleAudio(project, restored);
      expect(play.mock.calls.map(([, resource]) => resource)).toEqual([FIELD, BATTLE]);
      expect(startSession(project, 3).m2Runtime).toBeUndefined();
    });

    it("restores authored battle music across both command formats without clearing the field slot", async () => {
      const { project, session, scene } = setup();
      project.system.battleBgmResourceId = FIELD;
      await runCommands(scene, [
        m2("Change System BGM", { slot: "field", resourceId: BATTLE }),
        m2("Change System BGM", { slot: "battle", value: BATTLE }),
        m2("Change System BGM", { cue: "battle", operation: "set", resourceId: BATTLE, volume: 42 }),
      ]);
      enterBattleAudio(project, session);
      expect(session.audio.bgm).toMatchObject({ resourceId: BATTLE, volume: 42 });

      await runCommands(scene, [m2("Change System BGM", { cue: "battle", operation: "reset" })]);
      enterBattleAudio(project, session);
      expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: true });
      startMapBgm(project, session, project.startMapId);
      expect(session.audio.bgm?.resourceId).toBe(BATTLE);

      await runCommands(scene, [
        m2("Change System BGM", { cue: "battle", operation: "set", resourceId: BATTLE, volume: 42 }),
        m2("Change System BGM", { slot: "battle", resourceId: "" }),
      ]);
      enterBattleAudio(project, session);
      expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: true });
    });

    it.each(["defeat", "escape"] as const)("plays the active %s sound and restores the authored sound in either format", async cue => {
      const { project, session, scene } = setup();
      project.system.seCues = { [cue]: SE };
      const play = vi.spyOn(getAudioEngine(), "play");
      const playResult = () => playBattleCue(cue, { project, session });
      const playedResources = () => play.mock.calls.filter(([channel]) => channel === "se").map(([, resource]) => resource);

      await runCommands(scene, [m2("Change System SE", { slot: cue, resourceId: OTHER_SE })]);
      playResult();
      expect(playedResources()).toEqual([OTHER_SE]);

      await runCommands(scene, [m2("Change System SE", { cue, operation: "set", resourceId: "", volume: 100 })]);
      playResult();
      expect(playedResources()).toEqual([OTHER_SE]);

      await runCommands(scene, [m2("Change System SE", { cue, operation: "reset" })]);
      playResult();
      expect(playedResources()).toEqual([OTHER_SE, SE]);

      await runCommands(scene, [
        m2("Change System SE", { cue, operation: "set", resourceId: OTHER_SE, volume: 42 }),
        m2("Change System SE", { slot: cue, resourceId: "" }),
      ]);
      playResult();
      expect(playedResources()).toEqual([OTHER_SE, SE, SE]);
    });

    it("keeps battle result overrides session-owned even with overlapping battle lifetimes", async () => {
      const first = setup();
      const second = setup();
      await runCommands(first.scene, [m2("Change System SE", { slot: "defeat", resourceId: SE })]);
      await runCommands(second.scene, [m2("Change System SE", { slot: "defeat", resourceId: OTHER_SE })]);
      const saved = enterBattleAudio(first.project, first.session);
      enterBattleAudio(second.project, second.session);
      exitBattleAudio(first.project, first.session, saved);
      const play = vi.spyOn(getAudioEngine(), "play");
      playAuthoredBattleResultCue(first.project, "defeat", first.session);
      playAuthoredBattleResultCue(second.project, "defeat", second.session);
      expect(play.mock.calls.map(([channel, resource]) => [channel, resource])).toEqual([["se", SE], ["se", OTHER_SE]]);
    });

    it("restores a layer's gain through save parsing and engine resume", async () => {
      const { project, session, scene } = setup();
      await runCommands(scene, [m2("Sound Layer", { channel: "ambient", resourceId: FIELD, volume: 30, fadeMs: 0 })]);
      saveToSlot(localStorage, 1, createSaveSnapshot(project, session));
      const saved = readSaveSlot(localStorage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
      const restored = applySaveSnapshot(project, saved.snapshot);
      getAudioEngine().stopAll();
      resumeAudioState(restored.audio, project, { fadeInMs: 0 });
      expect(audioElements()[0]?.volume).toBeCloseTo(0.21);
    });
  });
});
