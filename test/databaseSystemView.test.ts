import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { createBlankProject, createSampleAdventureProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderSystem(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderSystemTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

function setSelectValue(host: FakeElement, testid: string, value: string): void {
  const select = findByTestId(host, testid);
  if (!select) throw new Error(`missing select ${testid}`);
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

function setCheckbox(host: FakeElement, testid: string, checked: boolean): void {
  const input = findByTestId(host, testid) as { checked?: boolean } | null;
  if (!input) throw new Error(`missing checkbox ${testid}`);
  input.checked = checked;
  (input as FakeElement).dispatchEvent(new Event("change"));
}

describe("database system view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("preserves multi-member start party when editing one slot", () => {
    store.replace(createSampleAdventureProject());
    const before = [...store.getCurrent().system.startActorIds];
    expect(before.length).toBeGreaterThan(1);

    const host = renderSystem();
    const actors = store.getCurrent().database.actors;
    const replacement = actors.find((actor) => actor.id !== before[0])?.id;
    if (!replacement) throw new Error("need a second actor");

    setSelectValue(host, "db-picker-system-start-actor", replacement);

    const after = store.getCurrent().system.startActorIds;
    expect(after[0]).toBe(replacement);
    expect(after.slice(1)).toEqual(before.slice(1));
    expect(store.getCurrent().session.partyActorIds).toEqual(after);
  });

  it("rebuilds type chart matrix when the type list changes", () => {
    store.update((draft) => {
      delete draft.system.typeChart;
    });
    const host = renderSystem();
    expect(findByTestId(host, "db-type-chart-matrix")).toBeNull();

    const types = findByTestId(host, "db-field-system-type-chart-types");
    if (!types) throw new Error("missing type chart input");
    types.value = "fire, water";
    types.dispatchEvent(new Event("change"));

    expect(store.getCurrent().system.typeChart?.types).toEqual(["fire", "water"]);
    expect(findByTestId(host, "db-type-chart-matrix")).not.toBeNull();
    expect(findByTestId(host, "db-type-chart-fire-water")).not.toBeNull();
  });

  it("writes battle flow, gift system, and time system gates", () => {
    const host = renderSystem();

    setSelectValue(host, "db-field-system-battle-flow", "strict");
    setCheckbox(host, "db-field-system-gift-system", true);
    setCheckbox(host, "db-field-system-time-enabled", true);

    const system = store.getCurrent().system;
    expect(system.battleFlow).toBe("strict");
    expect(system.giftSystem).toBe(true);
    expect(system.timeSystem?.enabled).toBe(true);
    expect(findByTestId(host, "db-field-system-time-day-start")).not.toBeNull();
  });

  it("edits title screen fields into system.titleScreen", () => {
    const host = renderSystem();
    const title = findByTestId(host, "db-field-title-screen-title");
    if (!title) throw new Error("missing title field");
    title.value = "테스트 타이틀";
    title.dispatchEvent(new Event("input"));

    expect(store.getCurrent().system.titleScreen?.title).toBe("테스트 타이틀");
  });
});
