// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandInspector, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerPanel";
import { editorState } from "@/editor/editorState";
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
