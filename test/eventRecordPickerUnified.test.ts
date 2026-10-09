/** @vitest-environment happy-dom */
// 계약: 스위치·변수·아이템·주인공은 "DB 레코드 하나 고르기"라는 같은 일이므로
// 같은 컨트롤(트리거 버튼 + 숨은 select)로 편집한다.
//
// 이전에는 스위치/변수만 모달 픽커였고 아이템/주인공은 네이티브 <select> 였다.
// 네이티브 select 는 좁은 조건 칸에서 폭이 눌려 선택값이 읽히지 않았다(실측 91px,
// "0001: 회복약" 이 들어가지 않음). 숨은 select 는 남긴다 — Playwright
// selectOption 과 기존 change 파이프라인 호환 때문이며, 스위치/변수가 이미 쓰는 방식이다.
//
// 조건 칸은 이후 칩 팔레트로 바뀌어 **켜진 조건의 행만** 렌더한다. 그래서 픽커를 보려면
// 네 종류 조건을 실제로 심어야 한다 — 빈 conditions 로는 행 자체가 없어 픽커도 없다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";

function seed(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  map.events = [
    {
      id: "ev_pick",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "픽커",
          conditions: [
            { kind: "switch", switchId: "sw_1", value: true },
            { kind: "variable", variableId: "var_1", op: ">=", value: 0 },
            { kind: "item", itemId: "item_potion", present: true },
            { kind: "actor", actorId: "actor_hero", present: true },
          ],
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
  return mapId;
}

describe("레코드 선택 컨트롤 통일", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
  });

  for (const kind of ["item", "actor"] as const) {
    it(`${kind} 조건은 네이티브 select 가 아니라 픽커 트리거를 노출한다`, () => {
      const mapId = seed();
      renderEventEditorDynamic(host, mapId, "ev_pick");

      const trigger = host.querySelector<HTMLElement>(
        `[data-testid='event-page-${kind}-condition-picker-open']`,
      );
      expect(trigger, `${kind} 픽커 트리거가 있어야 한다`).not.toBeNull();
      expect(trigger?.tagName).toBe("BUTTON");
    });

    it(`${kind} 의 숨은 select 는 e2e 호환을 위해 남는다`, () => {
      const mapId = seed();
      renderEventEditorDynamic(host, mapId, "ev_pick");

      const select = host.querySelector<HTMLSelectElement>(
        `[data-testid='event-page-${kind}-condition-input']`,
      );
      expect(select, `${kind} 숨은 select 가 남아야 한다`).not.toBeNull();
      expect(select?.tagName).toBe("SELECT");
      expect(select?.getAttribute("aria-hidden")).toBe("true");
    });
  }

  it("네 종류 모두 같은 트리거 클래스를 쓴다", () => {
    const mapId = seed();
    renderEventEditorDynamic(host, mapId, "ev_pick");

    const ids = [
      "event-page-switch-condition-picker-open",
      "event-page-variable-picker-open",
      "event-page-item-condition-picker-open",
      "event-page-actor-condition-picker-open",
    ];
    for (const id of ids) {
      const node = host.querySelector<HTMLElement>(`[data-testid='${id}']`);
      expect(node, `${id} 가 있어야 한다`).not.toBeNull();
      expect(node?.classList.contains("event-record-picker-trigger"), id).toBe(true);
    }
  });
});
