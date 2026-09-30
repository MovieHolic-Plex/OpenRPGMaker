import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldGenTab, resetWorldGenTabViewState } from "@/editor/panels/databaseWorldGenView";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { BUILTIN_WORLD_GEN_KEYWORD_RULES } from "@/project/worldGenRules";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: () => void;
let form: FakeElement;
function byId(id: string): FakeElement {
  const node = findByTestId(form, id);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
function paint(): void {
  form.replaceChildren();
  renderWorldGenTab(form as unknown as HTMLElement, paint);
}
function input(id: string, value: string): void {
  const control = byId(id);
  control.value = value;
  control.dispatchEvent(new Event("input"));
}
beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  delete project.tilesets[COMBINED_TOWN_TILESET_ID]; // Unit fixture exercises the no-tileset preview fallback.
  store.replace(project);
  resetMapEditHistory();
  resetWorldGenTabViewState();
  form = document.createElement("section") as unknown as FakeElement;
  paint();
});
afterEach(() => {
  resetMapEditHistory();
  restoreDom();
});

describe("world generation authoring history", () => {
  it("coalesces repeated numeric input but keeps different water fields independently undoable", () => {
    byId("db-worldgen-section-water").click();
    input("db-worldgen-river-min-stepper", "5");
    input("db-worldgen-river-min-stepper", "7");
    input("db-worldgen-river-max-stepper", "12");
    expect(getMapEditHistoryEntries()).toHaveLength(2);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().system.worldGen?.water).toEqual({ riverBandMin: 7 });
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().system.worldGen).toBeUndefined();
  });

  it("records each keyword toggle as a separate undo step", () => {
    byId("db-worldgen-section-keywords").click();
    const rule = BUILTIN_WORLD_GEN_KEYWORD_RULES[0]!;
    const toggle = byId(`db-worldgen-keyword-toggle-${rule.id}`);
    expect(toggle.parentElement?.parentElement?.textContent).toContain(`${rule.label} 규칙 쓰기`);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(store.getCurrent().system.worldGen?.keywords?.[0]?.enabled).toBe(false);
    const secondToggle = byId(`db-worldgen-keyword-toggle-${rule.id}`);
    secondToggle.checked = true;
    secondToggle.dispatchEvent(new Event("change"));
    expect(getMapEditHistoryEntries()).toHaveLength(2);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().system.worldGen?.keywords?.[0]?.enabled).toBe(false);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().system.worldGen).toBeUndefined();
  });

  it("resets transient section and preview text without altering authored rules", () => {
    byId("db-worldgen-section-water").click();
    input("db-worldgen-river-min-stepper", "7");
    input("db-worldgen-preview-query", "호수 마을");
    resetWorldGenTabViewState();
    paint();
    expect(byId("db-worldgen-preview-query").value).toBe("강촌마을");
    expect(findByTestId(form, "db-worldgen-river-min-stepper")).toBeNull();
    expect(store.getCurrent().system.worldGen?.water?.riverBandMin).toBe(7);
    expect(form.textContent).toContain("기본 타일셋이 없어");
  });
});
