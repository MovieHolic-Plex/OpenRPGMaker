/** @vitest-environment happy-dom */
// 묶음 조건(all/any/not) 저작 계약. 런타임은 예전부터 평가했지만 편집기가 못 만들어서
// 페이지 조건은 사실상 전부 AND 였다 — OR·부정을 UI 로 만들 수 있는지 고정한다.
import { beforeEach, describe, expect, it } from "vitest";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { createBlankProject } from "@/project/defaults";
import { resolveEventPage } from "@/project/io/pageResolution";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent } from "@/project/types";
import { el } from "@/util/dom";

const MAP_ID = "map-start";
const EVENT_ID = "ev-cond-group";

function seed(conditions: readonly EventPageCondition[] = []): void {
  const project = createBlankProject();
  const page: EventPage = {
    id: "p1",
    name: "묶음",
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
  const event: GameEvent = {
    id: EVENT_ID,
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
  const map = project.maps[project.startMapId]!;
  map.events = [event];
  store.replace(project);
}

function livePage(): EventPage {
  const project = store.getCurrent();
  const page = project.maps[project.startMapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
  if (!page) throw new Error("live page missing");
  return page;
}

function liveConditions(): readonly EventPageCondition[] {
  return livePage().conditions;
}

/** 항상 살아있는 페이지로 다시 그린다 — 편집기는 렌더 시점의 page 를 캡처한다. */
function render(): HTMLElement {
  const mapId = store.getCurrent().startMapId;
  return el("div", { children: renderPageConditions(mapId, EVENT_ID, livePage()) });
}

function byTestId<T extends HTMLElement>(root: HTMLElement, testId: string): T {
  const node = root.querySelector<T>(`[data-testid='${testId}']`);
  if (!node) throw new Error(`testid 없음: ${testId}`);
  return node;
}

function selectOption(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

function addTopLevel(kind: string): void {
  const root = render();
  selectOption(byTestId<HTMLSelectElement>(root, "event-page-advanced-condition-kind"), kind);
  byTestId<HTMLButtonElement>(root, "event-page-advanced-condition-add").click();
}

const SWITCH_0 = () => store.getCurrent().switches[0]?.id ?? "";

describe("페이지 조건 묶음(all/any/not) 편집", () => {
  beforeEach(() => {
    seed();
    void MAP_ID;
  });

  it("고급 조건 추가 목록에 묶음 3종이 있다", () => {
    const kind = byTestId<HTMLSelectElement>(render(), "event-page-advanced-condition-kind");
    const values = [...kind.options].map((option) => option.value);
    expect(values).toContain("all");
    expect(values).toContain("any");
    expect(values).toContain("not");
  });

  it("묶음을 추가하면 빈 묶음이 아니라 하위 조건 하나가 함께 생긴다", () => {
    addTopLevel("any");
    const [condition] = liveConditions();
    expect(condition).toEqual({ kind: "any", conditions: [{ kind: "switch", switchId: SWITCH_0(), value: true }] });
  });

  it("하위 추가 → 하위 조건 종류 변경 → 하위 삭제가 부모를 망가뜨리지 않는다", () => {
    addTopLevel("any");
    byTestId<HTMLButtonElement>(render(), "event-page-advanced-condition-child-add-0").click();
    expect((liveConditions()[0] as { conditions: unknown[] }).conditions).toHaveLength(2);

    selectOption(byTestId<HTMLSelectElement>(render(), "event-page-advanced-condition-kind-0-1"), "gold");
    let group = liveConditions()[0] as Extract<EventPageCondition, { kind: "any" }>;
    expect(group.kind).toBe("any");
    expect(group.conditions[0]?.kind).toBe("switch");
    expect(group.conditions[1]).toEqual({ kind: "gold", op: ">=", amount: 0 });

    byTestId<HTMLButtonElement>(render(), "event-page-advanced-condition-remove-0-0").click();
    group = liveConditions()[0] as Extract<EventPageCondition, { kind: "any" }>;
    expect(group.conditions).toHaveLength(1);
    expect(group.conditions[0]?.kind).toBe("gold");
  });

  it("묶음 종류를 바꿔도 하위 조건은 살아남는다", () => {
    addTopLevel("all");
    byTestId<HTMLButtonElement>(render(), "event-page-advanced-condition-child-add-0").click();
    selectOption(byTestId<HTMLSelectElement>(render(), "event-page-advanced-condition-group-kind-0"), "any");
    const group = liveConditions()[0] as Extract<EventPageCondition, { kind: "any" }>;
    expect(group.kind).toBe("any");
    expect(group.conditions).toHaveLength(2);
  });

  it("not 은 하위가 정확히 하나 — 추가·삭제 버튼이 없고 종류 변경으로 갈아탄다", () => {
    addTopLevel("not");
    const root = render();
    expect(root.querySelector("[data-testid='event-page-advanced-condition-child-add-0']")).toBeNull();
    expect(root.querySelector("[data-testid='event-page-advanced-condition-remove-0-0']")).toBeNull();

    selectOption(byTestId<HTMLSelectElement>(root, "event-page-advanced-condition-kind-0-0"), "battleResult");
    expect(liveConditions()[0]).toEqual({ kind: "not", condition: { kind: "battleResult", result: "victory" } });
  });

  it("not → any 로 바꾸면 하위 하나를 가진 any 가 된다", () => {
    addTopLevel("not");
    selectOption(byTestId<HTMLSelectElement>(render(), "event-page-advanced-condition-group-kind-0"), "any");
    expect(liveConditions()[0]).toEqual({
      kind: "any",
      conditions: [{ kind: "switch", switchId: SWITCH_0(), value: true }],
    });
  });

  it("묶음 안에 묶음을 한 겹 넣을 수 있고, 그 아래는 묶음을 제시하지 않는다", () => {
    addTopLevel("any");
    const root = render();
    const childKind = byTestId<HTMLSelectElement>(root, "event-page-advanced-condition-child-kind-0");
    expect([...childKind.options].map((option) => option.value)).toContain("all");
    selectOption(childKind, "all");
    byTestId<HTMLButtonElement>(root, "event-page-advanced-condition-child-add-0").click();

    const nested = (liveConditions()[0] as Extract<EventPageCondition, { kind: "any" }>).conditions[1];
    expect(nested?.kind).toBe("all");

    const deepKind = byTestId<HTMLSelectElement>(render(), "event-page-advanced-condition-child-kind-0-1");
    const deepValues = [...deepKind.options].map((option) => option.value);
    expect(deepValues).not.toContain("all");
    expect(deepValues).not.toContain("any");
    expect(deepValues).not.toContain("not");
  });

  it("빈 묶음이 남으면 항상 참/거짓이라고 알려 준다", () => {
    seed([{ kind: "any", conditions: [] }]);
    expect(byTestId(render(), "event-page-advanced-condition-group-empty-0").textContent).toContain("항상 거짓");
    seed([{ kind: "all", conditions: [] }]);
    expect(byTestId(render(), "event-page-advanced-condition-group-empty-0").textContent).toContain("항상 참");
  });

  it("편집기가 만든 OR 묶음은 런타임에서 OR 로 평가된다", () => {
    addTopLevel("any");
    byTestId<HTMLButtonElement>(render(), "event-page-advanced-condition-child-add-0").click();
    // 두 하위 모두 스위치 0 을 보므로 값만 갈라 준다: 하나는 꺼짐 조건으로.
    selectOption(byTestId<HTMLSelectElement>(render(), "event-page-advanced-condition-kind-0-1"), "battleResult");

    const page = livePage();
    const event: GameEvent = { id: EVENT_ID, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] };
    const base = { switches: {} as Record<string, boolean>, variables: {} };
    expect(resolveEventPage(event, base)).toBeUndefined();
    expect(resolveEventPage(event, { ...base, switches: { [SWITCH_0()]: true } })?.id).toBe("p1");
    expect(resolveEventPage(event, { ...base, battleResult: "victory" })?.id).toBe("p1");
  });
});
