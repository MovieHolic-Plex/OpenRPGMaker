// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandInspector, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerPanel";
import { editorState } from "@/editor/editorState";
import { eventEditorViewLevel, setEventEditorViewLevel } from "@/editor/panels/eventEditor/beginnerChrome";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { buildSceneCards, conditionQuestion, SCENE_COMMENT_COMMAND_ID } from "@/editor/panels/eventEditor/sceneCards";
import { resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { resetViewLevelHintForTest, VIEW_LEVEL_HINT_QUIET_MS, viewLevelHintFor } from "@/editor/panels/eventEditor/viewLevelHint";
import { editStepSummary, eventCommandChanges, linkedMapEvents, noteViewLevelSignal, pruneUndoneSteps, resetEventEditLineForTest, type EditStep } from "@/editor/panels/eventEditor/eventEditLine";
import { registerAiAssistantBridge, unregisterAiAssistantBridge, type AiBridgeSendOptions } from "@/editor/aiAssistantBridge";
import { isolateTimers } from "./mergedTeardown";

describe("eventPreviewState", () => {
  isolateTimers();
  const FACE_A = "easyrpg-faceset-people1-03";
  const FACE_B = "easyrpg-faceset-actor1-00";
  function faceCommand(resourceId: string): Extract<Command, { kind: "changeFace" }> {
    return { kind: "changeFace", resourceId, position: "left", flipHorizontally: false };
  }
  function page(id: string, commands: Command[]): EventPage {
    return {
      id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" },
      priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    };
  }
  function render(authored: EventPage, advances = 0): HTMLElement {
    const panel = renderEventPagePreview({
      mapId: store.getCurrent().startMapId, eventId: "ev_preview_state", page: authored,
    });
    document.body.append(panel);
    for (let i = 0; i < advances; i += 1) {
      const next = panel.querySelector<HTMLButtonElement>('[data-testid="event-script-live-next"]');
      if (!next) throw new Error("Preview Next control is missing");
      next.click();
    }
    return panel;
  }
  function faceId(panel: HTMLElement): string | null {
    return panel.querySelector('[data-testid="event-command-face-crop-shell"]')?.getAttribute("data-resource-id") ?? null;
  }
  describe("event preview uses the current command state", () => {
    beforeEach(() => {
      const project = createBlankProject();
      project.variables = [{ id: "var_0001", name: "Score" }];
      store.replace(project);
    });
    afterEach(() => {
      clearCommandInspector();
      setCommandInspectorHost(undefined);
      document.body.replaceChildren();
    });

    it("refreshes a remembered dialogue step when its preceding face is edited", () => {
      const first = render(page("edited-face", [
        faceCommand(FACE_A), { kind: "text", body: "대사" },
      ]), 1);
      expect(faceId(first)).toBe(FACE_A);
      first.remove();

      const refreshed = render(page("edited-face", [
        faceCommand(FACE_B), { kind: "text", body: "대사" },
      ]));

      expect(refreshed.querySelector(".event-script-live-position")?.textContent).toBe("2/2");
      expect(faceId(refreshed)).toBe(FACE_B);
    });

    it("honors a face-clear command instead of finding an older portrait", () => {
      const panel = render(page("cleared-face", [
        faceCommand(FACE_A),
        faceCommand(""),
        { kind: "text", body: "얼굴 없는 대사" },
      ]), 2);

      expect(faceId(panel)).toBeNull();
      expect(panel.querySelector(".ecp-message-window")?.classList.contains("with-face")).toBe(false);
    });

    it("carries the authored face side and flip into the dialogue stage", () => {
      const panel = render(page("face-layout", [
        { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
        { kind: "text", body: "오른쪽 얼굴" },
      ]), 1);

      const face = panel.querySelector('[data-testid="event-command-face-crop-shell"]');
      expect(face?.getAttribute("data-position")).toBe("right");
      expect(face?.classList.contains("flipped")).toBe(true);
      expect(panel.querySelector(".ecp-message-window")?.classList.contains("face-right")).toBe(true);
    });

    it("does not borrow a face from a skipped conditional branch", () => {
      const panel = render(page("skipped-face", [
        faceCommand(FACE_A),
        {
          kind: "fork", condition: { kind: "switch", switchId: "sw_preview", value: true },
          then: [faceCommand(FACE_B)], else: [],
        },
        { kind: "text", body: "실행되는 대사" },
      ]), 3);

      expect(faceId(panel)).toBe(FACE_A);
    });

    it.each([4, 5])("keeps choice-local faces out of sibling/outer dialogue at step %i", (step) => {
      const panel = render(page(`choice-face-${step}`, [
        faceCommand(FACE_A),
        {
          kind: "choices", prompt: "선택", options: [
            { text: "첫 분기", branch: [
              faceCommand(FACE_B), { kind: "text", body: "첫 분기 대사" },
            ] },
            { text: "다음 분기", branch: [{ kind: "text", body: "다음 분기 대사" }] },
          ],
        },
        { kind: "text", body: "분기 밖 대사" },
      ]), step);

      expect(faceId(panel)).toBe(FACE_A);
    });

    it("interpolates the variable value at the current simulated step", () => {
      const panel = render(page("variable-dialogue", [
        { kind: "setVariable", variableId: "var_0001", op: "=", value: 37 },
        { kind: "text", body: "점수: \\V[1]" },
      ]), 1);

      expect(panel.querySelector(".ecp-message-body")?.textContent).toBe("점수: 37");
    });

    it("passes authored face side and flip from the list into the text inspector", () => {
      const list = document.createElement("div");
      const inspector = document.createElement("div");
      document.body.append(list, inspector);
      setCommandInspectorHost(inspector);
      renderCommandList(list, [
        { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
        { kind: "text", body: "인스펙터 대사" },
      ], [], {
        addCommand() {}, insertCommand() {}, replaceCommand() {},
        deleteCommand() {}, moveCommand() {}, moveCommandTo() {},
      });
      const row = list.querySelector<HTMLElement>('[data-testid="event-command-text"] .cmd-head');
      if (!row) throw new Error("Text command row is missing");

      row.click();

      const face = inspector.querySelector('[data-testid="event-command-face-crop-shell"]');
      expect(face?.getAttribute("data-position")).toBe("right");
      expect(face?.classList.contains("flipped")).toBe(true);
    });
  });
});

// 스위치가 수십 개로 늘어나면 "쓰는 곳 n곳"만으로는 지금 편집 중인 맵과 관계있는
// 레코드를 못 고른다. 이 맵에서 이미 쓰는 것들을 위로 올려 준다.
describe("eventRecordPickerMapScope", () => {
  isolateTimers();
  function panel(): HTMLElement {
    const node = document.querySelector<HTMLElement>('[data-testid="event-record-picker"]');
    if (!node) throw new Error("픽커가 열리지 않았다");
    return node;
  }
  /** 화면에 보이는 순서대로 행 이름을 읽는다. */
  const visibleNames = (): string[] =>
    Array.from(panel().querySelectorAll<HTMLElement>(".event-record-picker-row-name")).map(
      (node) => node.textContent ?? "",
    );
  describe("레코드 픽커 — 이 맵에서 쓰는 중", () => {
    beforeEach(() => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.switches[0]!.name = "다른 맵 스위치";
      project.switches[1]!.name = "이 맵 스위치";
      // 이 맵의 이벤트가 두 번째 스위치를 참조하게 만든다.
      project.maps[mapId]!.events = [
        {
          id: "ev_use",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "p1",
              name: "쓰는 이벤트",
              conditions: [{ kind: "switch", switchId: project.switches[1]!.id, value: true }],
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
    });

    afterEach(() => {
      document.querySelectorAll('[data-testid="event-record-picker"]').forEach((n) => n.remove());
    });

    it("이 맵에서 쓰는 레코드를 맨 위 구획으로 올린다", () => {
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      const section = panel().querySelector<HTMLElement>(
        '[data-testid="event-record-picker-section-map"]',
      );
      expect(section, "이 맵 구획이 있어야 한다").not.toBeNull();
      expect(section!.textContent).toContain("이 맵에서 쓰는 중");

      // 이 맵이 참조하는 스위치가 목록 첫 행이어야 한다.
      expect(visibleNames()[0]).toBe("이 맵 스위치");
    });

    it("이 맵이 아무것도 안 쓰면 구획을 만들지 않는다", () => {
      const project = store.getCurrent();
      project.maps[project.startMapId]!.events = [];
      store.replace(project);

      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });
      expect(
        panel().querySelector('[data-testid="event-record-picker-section-map"]'),
      ).toBeNull();
    });

    it("구획을 나눠도 행 testid 는 레코드 번호를 그대로 따른다", () => {
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      // e2e 3개 스펙이 -row-1 을 첫 번째 *레코드*로 집는다. 표시 순서가 바뀌어도
      // testid 는 레코드 인덱스를 따라야 한다.
      const first = panel().querySelector<HTMLElement>('[data-testid="event-record-picker-row-1"]');
      expect(first).not.toBeNull();
      expect(first!.textContent).toContain("다른 맵 스위치");
    });
  });
});

// 레코드 픽커 창의 두 계약을 고정한다.
//
// 1) 참조 수 집계는 창이 열려 있는 동안 한 번만 한다. 렌더마다 새로 만들면 검색 키
//    한 번에 프로젝트 맵 전체가 다시 직렬화된다.
// 2) 행을 클릭해 재렌더가 일어나도 포커스가 선택된 행에 남는다. 재렌더는 방금 누른
//    버튼을 파괴하므로, 옮겨 주지 않으면 body 로 떨어져 ↑↓·Enter 와 스크린리더
//    위치를 함께 잃는다.
describe("eventRecordPickerPanelBehavior", () => {
  isolateTimers();
  function picker(): HTMLElement {
    const node = document.querySelector<HTMLElement>('[data-testid="event-record-picker"]');
    if (!node) throw new Error("픽커가 열리지 않았다");
    return node;
  }
  const rows = (): HTMLElement[] =>
    Array.from(picker().querySelectorAll<HTMLElement>(".event-record-picker-row"));
  describe("레코드 픽커 창 동작", () => {
    beforeEach(() => {
      const project = createBlankProject();
      project.switches[0]!.name = "마을 축제 시작";
      project.switches[1]!.name = "마을 축제 끝남";
      store.replace(project);
    });

    afterEach(() => {
      document.querySelectorAll('[data-testid="event-record-picker"]').forEach((n) => n.remove());
      vi.restoreAllMocks();
    });

    it("검색을 여러 번 해도 프로젝트를 다시 직렬화하지 않는다", () => {
      const spy = vi.spyOn(JSON, "stringify");
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      const afterOpen = spy.mock.calls.length;
      expect(afterOpen).toBeGreaterThan(0);

      const search = picker().querySelector<HTMLInputElement>(
        '[data-testid="event-record-picker-search"]',
      )!;
      for (const query of ["축", "축제", "축제 시"]) {
        search.value = query;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }

      // 검색 세 번이 집계 원본을 다시 만들지 않아야 한다.
      expect(spy.mock.calls.length).toBe(afterOpen);
    });

    it("행을 클릭한 뒤에도 포커스가 선택된 행에 남는다", () => {
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      const second = rows()[1];
      expect(second).toBeTruthy();
      second!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      const selected = picker().querySelector<HTMLElement>(".event-record-picker-row.selected");
      expect(selected).toBeTruthy();
      expect(document.activeElement).toBe(selected);
      expect(document.activeElement).not.toBe(document.body);
    });

    it("행에 포커스가 있어도 ↑↓ 로 선택을 옮길 수 있다", () => {
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });

      const first = rows()[0]!;
      first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const before = picker()
        .querySelector<HTMLElement>(".event-record-picker-row.selected")
        ?.dataset.testid;

      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );

      const after = picker()
        .querySelector<HTMLElement>(".event-record-picker-row.selected")
        ?.dataset.testid;
      expect(after).toBeTruthy();
      expect(after).not.toBe(before);
    });

    it("빈 검색 문구는 아이템·스위치 받침에 맞는 조사를 쓴다", () => {
      openRecordPickerPanel({ kind: "item", currentId: "", onSelect: () => undefined });
      const search = picker().querySelector<HTMLInputElement>(
        '[data-testid="event-record-picker-search"]',
      )!;
      search.value = "없는물건";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      expect(picker().querySelector('[data-testid="event-record-picker-no-result"]')?.textContent)
        .toBe('"없는물건" 과 일치하는 아이템이 없습니다.');

      document.querySelectorAll('[data-testid="event-record-picker"]').forEach((node) => node.remove());
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect: () => undefined });
      const switchSearch = picker().querySelector<HTMLInputElement>(
        '[data-testid="event-record-picker-search"]',
      )!;
      switchSearch.value = "가나";
      switchSearch.dispatchEvent(new Event("input", { bubbles: true }));
      expect(picker().querySelector('[data-testid="event-record-picker-no-result"]')?.textContent)
        .toBe('"가나" 와 일치하는 스위치가 없습니다.');
    });

    it("아이템이 없으면 빈 목록도 받침 있는 조사를 쓴다", () => {
      const project = createBlankProject();
      project.database.items = [];
      store.replace(project);
      openRecordPickerPanel({ kind: "item", currentId: "", onSelect: () => undefined });
      expect(picker().textContent).toContain("아이템이 아직 없습니다.");
      expect(picker().textContent).not.toContain("아이템가");
    });

    it("Enter 는 선택을 확정하고 창을 닫는다", () => {
      const onSelect = vi.fn();
      openRecordPickerPanel({ kind: "switch", currentId: "", onSelect });

      rows()[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-testid="event-record-picker"]')).toBeNull();
    });
  });
});

// 이벤트 편집기 보기 셋(쉬움·보통·고급)과 장면 카드 모델(목업 v2).
describe("eventSceneCards", () => {
  isolateTimers();
  const comment = (text: string): Command => ({ kind: "m2Command", commandId: SCENE_COMMENT_COMMAND_ID, fields: { comment: text, color: "green" } });
  const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body });
  const narrate = (body: string): Command => ({ kind: "text", body, context: "narration" });
  describe("장면 카드 모델", () => {
    it("대사 줄은 얼굴 바꾸기와 함께 한 대화 카드로 묶고, 상점은 따로 카드다", () => {
      const cards = buildSceneCards([
        { kind: "changeFace", faceId: "f" } as Command,
        say("오든", "회복약이랑 약초는 여기서 사고판다."),
        { kind: "shop", itemIds: ["a"], allowSell: true, title: "오든 약재상" },
      ]);
      expect(cards.map((card) => card.kind)).toEqual(["talk", "shop"]);
      expect(cards[0]!.title).toBe("오든이 말한다");
      expect(cards[0]!.paths).toEqual([[0], [1]]);
      expect(cards[1]!.shop?.title).toBe("오든 약재상");
    });

    it("주석 명령은 카드 경계이자 이름이고, 다음 주석까지 모두 담는다", () => {
      const cards = buildSceneCards([
        comment("막을 연다"),
        { kind: "playAudio", resourceId: "se", loop: false, channel: "se" } as Command,
        narrate("쇠 장화 소리"),
        comment("마주 선다"),
        say("발렌", "넘겨라."),
        say("이리스", "싫어요."),
      ]);
      expect(cards.map((card) => [card.kind, card.title, card.commandCount])).toEqual([
        ["stage", "막을 연다", 3],
        ["talk", "마주 선다", 3],
      ]);
    });

    it("전투 뒤 전투 결과 갈림은 전투 카드 하나와 이기면·지면 갈래다", () => {
      const cards = buildSceneCards([
        { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true } as Command,
        { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: [narrate("이겼다")], else: [narrate("졌다")] } as Command,
      ]);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.kind).toBe("battle");
      expect(cards[0]!.branches.map((branch) => branch.label)).toEqual(["이기면", "지면"]);
      expect(cards[0]!.branches[0]!.containerPath).toEqual([1, FORK_THEN_BRANCH_INDEX]);
    });

    it("조건 문장을 물음으로 바꾼다", () => {
      expect(conditionQuestion("「해 손잡이 당김」이 켜져 있으면")).toBe("「해 손잡이 당김」이 켜져 있나?");
      expect(conditionQuestion("전투 승리일 때")).toBe("전투 승리일 때?");
    });
  });
  describe("보기 셋", () => {
    const EVENT_ID = "ev_scene_levels";
    const page: EventPage = {
      id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [say("오든", "어서 오게."), { kind: "shop", itemIds: [], allowSell: true }],
    };

    beforeEach(() => {
      localStorage.clear();
      resetEventViewSession();
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const event: GameEvent = { id: EVENT_ID, name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] };
      project.maps[mapId]!.events.push(event);
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    });
    afterEach(() => {
      localStorage.clear();
      clearCommandInspector();
      document.body.replaceChildren();
    });

    const render = (): HTMLElement => {
      const host = document.createElement("div");
      document.body.append(host);
      renderEventEditorDynamic(host, editorState.get().currentMapId!, EVENT_ID);
      return host;
    };

    it("시험 환경의 기본은 고급(명령 목록)이고, 고른 보기는 기억한다", () => {
      expect(eventEditorViewLevel()).toBe("advanced");
      setEventEditorViewLevel("easy");
      expect(eventEditorViewLevel()).toBe("easy");
      expect(localStorage.getItem("oprn.event-editor.view")).toBe("easy");
    });

    it("쉬움은 명령 목록 대신 장면 카드를 그리고, 줄 수·카드 추가를 숨긴다", () => {
      setEventEditorViewLevel("easy");
      const host = render();
      const cards = host.querySelector<HTMLElement>('[data-testid="event-scene-cards"]');
      expect(cards?.dataset.level).toBe("easy");
      expect(cards?.querySelectorAll(".event-scene-card")).toHaveLength(2);
      expect(host.querySelector('[data-testid="event-scene-card-count"]')).toBeNull();
      expect(host.querySelector('[data-testid="event-scene-add"]')).toBeNull();
      expect(host.querySelector(".cmd-item")).toBeNull();
      expect(host.querySelector('[data-testid="event-editor-advanced-toggle"]')).toBeNull();
    });

    it("쉬움은 모습·시작 방식을 페이지 줄 앞 칩으로 옮기고, 고급은 설정 칸에 그대로 둔다", () => {
      setEventEditorViewLevel("easy");
      const easy = render();
      const strip = easy.querySelector('[data-testid="event-editor-pagebar"] > [data-testid="event-scene-who-when"]');
      expect(strip?.querySelector('[data-testid="event-classic-graphic"]')).not.toBeNull();
      expect(strip?.querySelector('[data-testid="event-classic-trigger"]')).not.toBeNull();
      expect(easy.querySelector('.event-editor-settings-column [data-testid="event-classic-trigger"]')).toBeNull();
      expect(easy.querySelector('[data-testid="event-scene-page-label"]')?.textContent).toBe("때");
      document.body.replaceChildren();
      setEventEditorViewLevel("advanced");
      const advanced = render();
      expect(advanced.querySelector('[data-testid="event-scene-who-when"]')).toBeNull();
      expect(advanced.querySelector('.event-editor-settings-column [data-testid="event-classic-trigger"]')).not.toBeNull();
    });

    it("보통은 카드에 줄 수와 카드 추가를 더한다", () => {
      setEventEditorViewLevel("normal");
      const host = render();
      expect(host.querySelectorAll('[data-testid="event-scene-card-count"]')).toHaveLength(2);
      expect(host.querySelector('[data-testid="event-scene-add"]')).not.toBeNull();
    });
  });
  describe("막히는 신호의 보기 제안", () => {
    beforeEach(() => {
      localStorage.clear();
      resetViewLevelHintForTest();
      resetEventEditLineForTest();
    });

    it("쉬움에서 두 번 되돌림은 보통을 한 번만 제안하고, 14일 뒤 다시 제안한다", () => {
      setEventEditorViewLevel("easy");
      const now = 1_000_000;
      expect(viewLevelHintFor("undo-twice", now)).toContain("보기 › 보통");
      expect(viewLevelHintFor("undo-twice", now + 1000)).toBeNull();
      expect(viewLevelHintFor("undo-twice", now + VIEW_LEVEL_HINT_QUIET_MS + 1)).toContain("보통");
    });

    it("숨은 명령·줄 복사·Delete 는 고급을 제안하고, 이미 그 보기 이상이면 말하지 않는다", () => {
      setEventEditorViewLevel("normal");
      expect(viewLevelHintFor("undo-twice")).toBeNull();
      expect(viewLevelHintFor("hidden-command")).toContain("보기 › 고급");
      expect(viewLevelHintFor("line-delete")).toBeNull();
      setEventEditorViewLevel("advanced");
      resetViewLevelHintForTest();
      expect(viewLevelHintFor("line-copy")).toBeNull();
    });

    it("보기를 스스로 바꾸지 않고, 열린 편집기의 요약줄 자리에 한 줄로 띄운다", () => {
      setEventEditorViewLevel("easy");
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const page: EventPage = {
        id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [say("오든", "어서 오게.")],
      };
      project.maps[mapId]!.events.push({ id: "ev_hint", name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] });
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      const host = document.createElement("div");
      document.body.append(host);
      renderEventEditorDynamic(host, mapId, "ev_hint");
      const card = host.querySelector<HTMLElement>(".event-scene-card")!;
      card.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
      const summary = host.querySelector<HTMLElement>('[data-testid="event-edit-line-summary"]')!;
      expect(summary.dataset.kind).toBe("hint");
      expect(summary.textContent).toContain("고급");
      expect(eventEditorViewLevel()).toBe("easy");
      expect(noteViewLevelSignal("line-copy")).toBe(false);
      document.body.replaceChildren();
      clearCommandInspector();
    });
  });
  describe("한 줄 고치기 조수 호출", () => {
    afterEach(() => {
      unregisterAiAssistantBridge();
      resetEventEditLineForTest();
      document.body.replaceChildren();
      clearCommandInspector();
    });

    it("Enter 는 지금 페이지 범위(eventCommandScope)로 보내고, 이어진 이벤트가 없으면 한 번만 부른다", async () => {
      setEventEditorViewLevel("easy");
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const page: EventPage = {
        id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [say("오든", "어서 오게.")],
      };
      project.maps[mapId]!.events.push({ id: "ev_line", name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] });
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      const calls: { text: string; options?: AiBridgeSendOptions }[] = [];
      registerAiAssistantBridge({
        send: async (text, options) => {
          calls.push({ text, options });
          const before = store.getCurrent();
          const after = structuredClone(before);
          (after.maps[mapId]!.events.find((event) => event.id === "ev_line")!.pages![0]!.commands[0] as { body: string }).body = "어서 와.";
          return { ok: true, pendingProposal: { callCount: 1, summary: "", before, after }, status: { ready: true, turnBusy: false } as never, audit: [], harness: null };
        },
        getStatus: () => ({ ready: true, turnBusy: false }) as never,
        getAudit: () => [],
        getHarness: () => null,
        abort: () => {},
      });
      const host = document.createElement("div");
      document.body.append(host);
      renderEventEditorDynamic(host, mapId, "ev_line");
      const input = host.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]')!;
      input.value = "반말로";
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await vi.waitFor(() => expect(store.getCurrent().maps[mapId]!.events.find((event) => event.id === "ev_line")!.pages![0]!.commands[0]).toMatchObject({ body: "어서 와." }));
      expect(calls).toHaveLength(1);
      expect(calls[0]!.text).toBe("반말로");
      expect(calls[0]!.options).toMatchObject({ deferApply: true, eventCommandScope: { mapId, eventId: "ev_line", pageId: "p1", mode: "edit" } });
    });

    it("페이지 범위가 실패로 끝나도 이어진 이벤트가 있으면 전체 길로 한 번 더 보낸다(퍼즐 손잡이)", async () => {
      // 2026-11-25 fast-apply: 「퍼즐 정답을 2번으로」 의 범위 턴이 ok:false 로 끝나 전체 길을 타지 않고 바로 실패했다.
      setEventEditorViewLevel("easy");
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const leverPage = (id: string, body: string): EventPage => ({
        id, name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [narrate(body), { kind: "setSwitch", switchId: "sw_sun", value: true } as Command],
      });
      project.maps[mapId]!.events.push(
        { id: "ev_sun", name: "해 손잡이", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [leverPage("sun_p1", "해 문양")] },
        { id: "ev_moon", name: "달 손잡이", x: 2, y: 1, trigger: { kind: "action" }, commands: [], pages: [leverPage("moon_p1", "달 문양")] },
      );
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "moon_p1" });
      const calls: { text: string; options?: AiBridgeSendOptions }[] = [];
      registerAiAssistantBridge({
        send: async (text, options) => {
          calls.push({ text, options });
          if (options?.eventCommandScope) return { ok: false, error: "명령 4개가 사라져 적용하지 않았습니다", status: { ready: true, turnBusy: false } as never, audit: [], harness: null };
          const before = store.getCurrent();
          const after = structuredClone(before);
          (after.maps[mapId]!.events.find((event) => event.id === "ev_moon")!.pages![0]!.commands[0] as { body: string }).body = "달 문양, 먼저";
          return { ok: true, pendingProposal: { callCount: 1, summary: "", before, after }, status: { ready: true, turnBusy: false } as never, audit: [], harness: null };
        },
        getStatus: () => ({ ready: true, turnBusy: false }) as never,
        getAudit: () => [],
        getHarness: () => null,
        abort: () => {},
      });
      const host = document.createElement("div");
      document.body.append(host);
      renderEventEditorDynamic(host, mapId, "ev_moon");
      const input = host.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]')!;
      input.value = "퍼즐 정답을 2번으로";
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await vi.waitFor(() => expect(calls).toHaveLength(2));
      expect(calls[0]!.options?.eventCommandScope).toBeDefined();
      expect(calls[1]!.options?.eventCommandScope).toBeUndefined();
      await vi.waitFor(() => expect(store.getCurrent().maps[mapId]!.events.find((event) => event.id === "ev_moon")!.pages![0]!.commands[0]).toMatchObject({ body: "달 문양, 먼저" }));
    });
  });
  describe("한 줄 고치기 범위(이어진 이벤트)", () => {
    const lever = (id: string, name: string, switchId: string, body: string): GameEvent => ({
      id, name, x: 1, y: 1, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: `${id}_p1`, name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [narrate(body), { kind: "setSwitch", switchId, value: true } as Command],
      }],
    });
    const puzzle = () => {
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      project.maps[mapId]!.events.push(
        lever("ev_sun", "해 손잡이", "sw_sun", "해 문양"),
        lever("ev_moon", "달 손잡이", "sw_sun", "달 문양"),
        lever("ev_far", "석판", "sw_other", "석판 글"),
      );
      return { project, mapId };
    };
    const setBody = (event: GameEvent, body: string) => { (event.pages![0]!.commands[0] as { body: string }).body = body; };

    it("같은 스위치를 쓰는 같은 맵 이벤트를 이어진 것으로 찾는다", () => {
      const { project, mapId } = puzzle();
      expect(linkedMapEvents(project, mapId, "ev_moon").map((event) => event.id)).toEqual(["ev_sun"]);
    });

    it("맵 여러 이벤트가 명령에서 쓰는 이야기 깃발은 연결로 보지 않는다(마을 허브)", () => {
      const { project, mapId } = puzzle();
      for (let index = 0; index < 4; index += 1) project.maps[mapId]!.events.push(lever(`ev_villager_${index}`, "주민", "sw_sun", "안녕"));
      expect(linkedMapEvents(project, mapId, "ev_moon")).toEqual([]);
    });

    it("같은 맵 다른 이벤트의 명령 변경은 받고 연 이벤트를 먼저 둔다", () => {
      const { project: before, mapId } = puzzle();
      const after = structuredClone(before);
      const events = after.maps[mapId]!.events;
      setBody(events.find((event) => event.id === "ev_sun")!, "해 문양, 나중에");
      setBody(events.find((event) => event.id === "ev_moon")!, "달 문양, 먼저");
      const checked = eventCommandChanges(before, after, mapId, "ev_moon");
      expect(checked.ok).toBe(true);
      if (!checked.ok) return;
      expect(checked.changes.map((change) => change.eventId)).toEqual(["ev_moon", "ev_sun"]);
      const moonPages = before.maps[mapId]!.events.find((event) => event.id === "ev_moon")!.pages!;
      const line = editStepSummary(checked.changes, moonPages, undefined, "ev_moon", (id) => id === "ev_sun" ? "해 손잡이" : id);
      expect(line).toContain("이벤트 2개");
      expect(line).toContain("해 손잡이");
    });

    it("다른 이벤트의 조건·다른 맵·이벤트 더하기는 통째로 거절한다", () => {
      const { project: before, mapId } = puzzle();
      const cond = structuredClone(before);
      cond.maps[mapId]!.events.find((event) => event.id === "ev_sun")!.pages![0]!.name = "바뀐 이름";
      expect(eventCommandChanges(before, cond, mapId, "ev_moon").ok).toBe(false);
      const added = structuredClone(before);
      added.maps[mapId]!.events.push(lever("ev_new", "새 손잡이", "sw_sun", "새"));
      expect(eventCommandChanges(before, added, mapId, "ev_moon").ok).toBe(false);
      const otherMap = structuredClone(before);
      const otherMapId = Object.keys(otherMap.maps).find((id) => id !== mapId);
      if (otherMapId) {
        otherMap.maps[otherMapId]!.name = "바뀐 맵";
        expect(eventCommandChanges(before, otherMap, mapId, "ev_moon").ok).toBe(false);
      }
    });

    it("연 이벤트만 Ctrl+Z 로 되돌리면 같은 단계의 다른 이벤트도 되돌려 한 단계로 지킨다", () => {
      const { project, mapId } = puzzle();
      const events = project.maps[mapId]!.events;
      const sun = events.find((event) => event.id === "ev_sun")!;
      const moon = events.find((event) => event.id === "ev_moon")!;
      const sunBefore = structuredClone(sun.pages![0]!.commands);
      const moonBefore = structuredClone(moon.pages![0]!.commands);
      setBody(sun, "해 문양, 나중에");
      const sunAfter = structuredClone(sun.pages![0]!.commands);
      const moonAfter = moonBefore.map((command, index) => index === 0 ? narrate("달 문양, 먼저") : command);
      store.replace(project); // 달은 이미 Ctrl+Z 로 되돌아갔고(before), 해는 아직 after 다.
      const state: { steps: EditStep[] } = { steps: [{ summary: "정답 바꿈", changes: [
        { eventId: "ev_moon", pageId: "ev_moon_p1", before: moonBefore, after: moonAfter },
        { eventId: "ev_sun", pageId: "ev_sun_p1", before: sunBefore, after: sunAfter },
      ] }] };
      const undone: string[] = [];
      pruneUndoneSteps(state, mapId, (eventId, pageId) => undone.push(`${eventId}:${pageId}`));
      expect(state.steps).toHaveLength(0);
      expect(undone).toEqual(["ev_sun:ev_sun_p1"]);
    });
  });
});
