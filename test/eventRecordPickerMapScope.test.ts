/** @vitest-environment happy-dom */
// 스위치가 수십 개로 늘어나면 "쓰는 곳 n곳"만으로는 지금 편집 중인 맵과 관계있는
// 레코드를 못 고른다. 이 맵에서 이미 쓰는 것들을 위로 올려 준다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";

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
