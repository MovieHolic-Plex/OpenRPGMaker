// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import type { EventPage, GameEvent } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

// 우선순위와 겹침은 런타임 통행 판정식(`priority === "same" && overlapForbidden`)의 두 반쪽이다.
// 한 그룹에서 함께 보이고, 판정에 안 쓰이는 상태를 살아있는 것처럼 보이지 않게 하는 계약.
describe("eventPagePassageGroup", () => {
  isolateTimers();
  function seed(pageOverrides: Partial<EventPage> = {}): string {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    map.events = [
      {
        id: "ev_passage",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "통행",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
            ...pageOverrides,
          } as EventPage,
        ],
      },
    ];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    return mapId;
  }
  describe("겹침과 통행 그룹", () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement("div");
      document.body.append(host);
    });

    afterEach(() => {
      host.remove();
    });

    it("우선순위 select 가 겹침과 같은 memory 그룹에 있다", () => {
      renderEventEditorDynamic(host, seed(), "ev_passage");
      const priority = host.querySelector<HTMLElement>("[data-testid='event-page-priority-select']");
      expect(priority).toBeTruthy();
      expect(priority!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
      expect(priority!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
    });

    it("같은 층이면 겹침 체크가 살아 있고 안내문이 판정에 쓰인다고 말한다", () => {
      renderEventEditorDynamic(host, seed({ priority: "same" }), "ev_passage");
      const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
      expect(overlap!.disabled).toBe(false);
      expect(host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent).toContain(
        "통행 판정에 쓰입니다",
      );
    });

    it("맵 아래/맵 위면 겹침 체크를 잠그고 왜 안 막히는지 알려 준다", () => {
      for (const priority of ["below", "above"] as const) {
        host.replaceChildren();
        renderEventEditorDynamic(host, seed({ priority }), "ev_passage");
        const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
        expect(overlap!.disabled, priority).toBe(true);
        const hint = host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent ?? "";
        expect(hint, priority).toContain("통행을 막지 않습니다");
        expect(hint, priority).toContain(priority === "below" ? "맵 아래" : "맵 위");
        // 헤더 요약도 «겹침 금지» 라고 거짓말하지 않는다.
        expect(host.querySelector("[data-testid='evt-rail-meta-memory']")!.textContent, priority).toContain("통행 허용");
      }
    });

    it("층을 옮겼으면 그룹에 손댄 표시(점)가 뜬다", () => {
      renderEventEditorDynamic(host, seed({ priority: "below", overlapForbidden: true }), "ev_passage");
      expect(host.querySelector("[data-testid='evt-rail-dot-memory']")).toBeTruthy();
    });

    it("기타 그룹이 생기지 않고 레일 순서는 그대로다", () => {
      renderEventEditorDynamic(host, seed(), "ev_passage");
      expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
      const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
      expect([...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup)).toEqual([
        "look-talk",
        "when",
        "move",
        "memory",
        "npc",
      ]);
    });
  });
});

// 레일은 한 번에 한 그룹만 연다. 나머지 넷은 접혀 있으므로, 어느 그룹에 저작자가
// 손댄 내용이 있는지 열어 보지 않고도 알 수 있어야 한다. 기본값 그대로인 그룹과
// 값이 들어간 그룹을 점 하나로 가른다.
describe("eventRailAuthoredDot", () => {
  isolateTimers();
  function seed(page: Partial<EventPage> = {}, event: Partial<GameEvent> = {}): string {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [
      {
        id: "ev_dot",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        ...event,
        pages: [
          {
            id: "p1",
            name: "점",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
            ...page,
          } as EventPage,
        ],
      } as GameEvent,
    ];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    return mapId;
  }
  function hasDot(host: HTMLElement, slug: string): boolean {
    const group = host.querySelector<HTMLElement>(`[data-testid='evt-rail-group-${slug}']`);
    return Boolean(group?.querySelector(`[data-testid='evt-rail-dot-${slug}']`));
  }
  describe("레일 그룹 저작 표시 점", () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement("div");
      document.body.append(host);
    });

    afterEach(() => {
      host.remove();
    });

    it("기본값뿐인 페이지에는 점이 하나도 없다", () => {
      const mapId = seed();
      renderEventEditorDynamic(host, mapId, "ev_dot");
      for (const slug of ["look-talk", "when", "move", "memory", "npc"]) {
        expect(hasDot(host, slug), slug).toBe(false);
      }
    });

    it("조건을 넣으면 when 그룹에만 점이 붙는다", () => {
      const mapId = seed({ conditions: [{ kind: "switch", switchId: "sw_0001", value: true }] });
      renderEventEditorDynamic(host, mapId, "ev_dot");
      expect(hasDot(host, "when")).toBe(true);
      expect(hasDot(host, "move")).toBe(false);
      expect(hasDot(host, "look-talk")).toBe(false);
    });

    it("이동 유형이 정지가 아니면 move 그룹에 점이 붙는다", () => {
      const mapId = seed({ movement: { type: "random", speed: 4, frequency: 3 } });
      renderEventEditorDynamic(host, mapId, "ev_dot");
      expect(hasDot(host, "move")).toBe(true);
      expect(hasDot(host, "when")).toBe(false);
    });

    it("그래픽을 고르면 look-talk 그룹에 점이 붙는다", () => {
      const mapId = seed({ graphic: { sprite: "Actor1" } });
      renderEventEditorDynamic(host, mapId, "ev_dot");
      expect(hasDot(host, "look-talk")).toBe(true);
    });

    it("겹침 기본값(금지)에는 점이 없고, 통행 허용으로 바꾸면 붙는다", () => {
      const base = seed({ overlapForbidden: true });
      renderEventEditorDynamic(host, base, "ev_dot");
      expect(hasDot(host, "memory")).toBe(false);

      host.replaceChildren();
      const changed = seed({ overlapForbidden: false });
      renderEventEditorDynamic(host, changed, "ev_dot");
      expect(hasDot(host, "memory")).toBe(true);
    });

    it("NPC 를 연결하면 npc 그룹에 점이 붙는다", () => {
      const mapId = seed({}, { characterId: "npc_shopkeeper" });
      renderEventEditorDynamic(host, mapId, "ev_dot");
      expect(hasDot(host, "npc")).toBe(true);
    });
  });
});

// 레일 그룹 소속은 위치가 아니라 명시 claim 으로 결정된다는 계약을 고정한다.
describe("eventRailGroupComposition", () => {
  isolateTimers();
  function seed(pageOverrides: Partial<EventPage> = {}): string {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    map.events = [
      {
        id: "ev_rail",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "레일",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
            ...pageOverrides,
          } as EventPage,
        ],
      },
    ];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    return mapId;
  }
  describe("이벤트 편집기 좌측 레일 그룹 소속", () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement("div");
      document.body.append(host);
    });

    afterEach(() => {
      host.remove();
    });

    it("겹침 체크박스는 memory 그룹이 소유한다", () => {
      const mapId = seed();
      renderEventEditorDynamic(host, mapId, "ev_rail");
      const overlap = host.querySelector<HTMLElement>("[data-testid='event-classic-overlap']");
      expect(overlap).toBeTruthy();
      expect(overlap!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
      expect(overlap!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
    });

    it("memory 그룹 body 에 편집 가능한 컨트롤이 있다", () => {
      const mapId = seed();
      renderEventEditorDynamic(host, mapId, "ev_rail");
      const body = host.querySelector<HTMLElement>(
        "[data-testid='evt-rail-group-memory'] .event-editor-settings-accordion-body",
      );
      expect(body).toBeTruthy();
      expect(body!.querySelectorAll("input, select, textarea").length).toBeGreaterThan(0);
    });

    it("미분류 자식이 없어 기타 그룹이 만들어지지 않는다", () => {
      const mapId = seed();
      renderEventEditorDynamic(host, mapId, "ev_rail");
      expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
      const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
      const slugs = [...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup);
      expect(slugs).toEqual(["look-talk", "when", "move", "memory", "npc"]);
    });

    it("overlapForbidden 미지정 시 헤더 요약과 체크박스 상태가 일치한다", () => {
      const mapId = seed({ overlapForbidden: undefined });
      renderEventEditorDynamic(host, mapId, "ev_rail");
      const meta = host.querySelector<HTMLElement>("[data-testid='evt-rail-meta-memory']");
      const checkbox = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
      expect(checkbox!.checked).toBe(true);
      expect(meta!.textContent).toBe("겹침 금지");
    });

    it("움직임 그룹 요약은 원시 enum 이 아니라 한글 라벨을 보여준다", () => {
      const mapId = seed({ movement: { type: "random", speed: 5, frequency: 6 } });
      renderEventEditorDynamic(host, mapId, "ev_rail");
      const meta = host.querySelector<HTMLElement>("[data-testid='evt-rail-meta-move']");
      expect(meta!.textContent).toContain("무작위");
      expect(meta!.textContent).not.toContain("random");
    });

    it("이동 속도 select 는 런타임 범위 1~8 을 전부 제시한다", () => {
      const mapId = seed({ movement: { type: "random", speed: 8, frequency: 6 } });
      renderEventEditorDynamic(host, mapId, "ev_rail");
      const select = host.querySelector<HTMLSelectElement>("[data-testid='event-page-movement-speed-select']");
      expect([...select!.options].map((option) => option.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
      expect(select!.value).toBe("8");
    });
  });
});

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
describe("eventRecordPickerUnified", () => {
  isolateTimers();
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
});
