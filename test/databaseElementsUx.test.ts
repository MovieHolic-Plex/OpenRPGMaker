// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderElementsTab } from "@/editor/panels/databaseElementsClassic";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory, getMapEditHistoryState, undoMapEdit } from "@/editor/mapEditHistory";
import { elementArtwork, elementDefenseContext, elementOutcome } from "@/editor/panels/databaseElementPresentation";

const get = (id: string) => {
  const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
};
const input = (id: string, value: string) => {
  const node = get(id) as HTMLInputElement;
  node.focus(); node.value = value; node.dispatchEvent(new Event("input", { bubbles: true }));
  return node;
};
function mount() { document.body.replaceChildren(); renderElementsTab(document.body); }
beforeEach(() => {
  store.replace(createBlankProject()); resetMapEditHistory(); mount();
  get("db-elements-row-5").click();
  input("db-elements-reference-damage", "100");
});

describe("elements worksheet", () => {
  it("renders distinct artwork without changing authored data", () => {
    const before = JSON.stringify(store.getCurrent());
    mount();
    const images = [...get("db-elements-list").querySelectorAll("img")];
    expect(images).toHaveLength(17);
    expect(new Set(images.map((image) => image.getAttribute("src"))).size).toBe(17);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });
  it("updates identity in place and keeps the caret", () => {
    const node = input("db-field-element-name-selected", "긴 이름 얼음");
    node.setSelectionRange(2, 2);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.activeElement).toBe(node);
    expect(node.selectionStart).toBe(2);
    expect(get("db-elements-hero").querySelector("h3")?.textContent).toBe(node.value);
    expect(get("db-elements-row-5").querySelector(".db-list-name")?.textContent).toBe(node.value);
  });
  it("keeps filter focus and selected detail through no results and clear", async () => {
    vi.useFakeTimers();
    try {
      const detail = get("db-field-element-name-selected");
      const search = input("db-elements-search", "not-a-real-element");
      await vi.runOnlyPendingTimersAsync();
      expect(document.activeElement).toBe(search);
      expect(get("db-field-element-name-selected")).toBe(detail);
      expect(get("db-elements-list").querySelectorAll(".db-ws-row")).toHaveLength(0);
      get("db-elements-search-clear").click();
      expect(get("db-elements-list").querySelectorAll(".db-ws-row")).toHaveLength(17);
      expect(get("db-field-element-name-selected")).toBe(detail);
    } finally { vi.useRealTimers(); }
  });
  it("derives signed results and one shared scale, including edited E", () => {
    input("db-field-element-damage-E", "150");
    expect(get("db-elements-damage-result-E").dataset.value).toBe("150");
    expect(get("db-elements-damage-result-E").dataset.outcome).toBe("damage");
    input("db-field-element-damage-A", "300");
    expect(get("db-elements-damage-bar-A").dataset.scale).toBe("300");
    expect(get("db-elements-damage-bar-E").dataset.scale).toBe("300");
    input("db-field-element-damage-E", "-50");
    expect(get("db-elements-example-result").dataset.value).toBe("-50");
    expect(get("db-elements-example-result").dataset.outcome).toBe("heal");
    input("db-field-element-damage-E", "0");
    expect(get("db-elements-example-result").dataset.outcome).toBe("none");
  });
  it("keeps reference and grade selection out of store writes", () => {
    const update = vi.spyOn(store, "update");
    input("db-elements-reference-damage", "250");
    const grade = get("db-elements-preview-grade") as HTMLSelectElement;
    grade.value = "B"; grade.dispatchEvent(new Event("change"));
    expect(get("db-elements-example-result").dataset.value).toBe("375");
    expect(update).not.toHaveBeenCalled();
    update.mockRestore();
  });
  it("uses linked skill art only when resolvable, and marks actual image failures", () => {
    const project = createBlankProject();
    const element = { ...project.database.elements![5], id: "custom-ice" };
    const noArt = elementArtwork(element, project, 32, false);
    expect(noArt.dataset.artSource).toBe("none");
    const animation = project.database.battleAnimations.find((entry) => entry.resourceId)!;
    project.database.skills[0] = { ...project.database.skills[0], elementId: element.id, animationId: "missing-animation" };
    project.database.skills[1] = { ...project.database.skills[1], elementId: element.id, animationId: animation.id };
    const before = JSON.stringify(project);
    const linked = elementArtwork(element, project, 32, false);
    expect(linked.dataset.artSource).toBe("skill");
    expect(linked.classList.contains("db-list-thumb-animation")).toBe(true);
    linked.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(linked.classList.contains("db-image-load-failed")).toBe(true);
    expect(JSON.stringify(project)).toBe(before);
  });
  it.each(["constructor", "__proto__"])("does not assign built-in artwork to custom id %s", (id) => {
    const project = createBlankProject();
    const element = { ...project.database.elements![5], id };
    expect(elementArtwork(element, project, 32).dataset.artSource).toBe("none");
  });
  it("follows the engine defense predicate without inventing absent grades", () => {
    const project = createBlankProject();
    expect(elementDefenseContext(project, "ice")).toBe("rm2k3");
    project.system.battleModel = "gen1";
    expect(elementDefenseContext(project, "ice")).toBe("mental");
    expect(elementDefenseContext(project, "sword")).toBe("physical");
    expect(elementDefenseContext(project, undefined)).toBe("physical");
    expect(elementOutcome(1, -1)).toMatchObject({ outcome: "heal" });
  });
  it("counts equipment first attack, defense and explicit grade references", () => {
    const project = createBlankProject();
    project.database.skills = [];
    project.database.actors.forEach((entry) => { entry.elementRates = {}; });
    project.database.enemies.forEach((entry) => { entry.elementRates = {}; });
    project.database.classes.forEach((entry) => { entry.elementRates = {}; });
    project.database.classes[0].elementRates = { ice: "B" };
    project.database.equipment = [
      { ...project.database.equipment[0], attackElementIds: ["ice"], elementalDefenseIds: ["ice"] },
      { ...project.database.equipment[0], attackElementIds: ["sword", "ice"], elementalDefenseIds: [] },
    ];
    store.replace(project); mount();
    const stats = get("db-elements-usage-stats").dataset;
    expect({ ...stats }).toMatchObject({ skills: "0", actors: "0", enemies: "0", classes: "1", attack: "1", defense: "1" });
  });
  it("clamps percentage edits, resets in place and retains undo history", () => {
    const reset = get("db-elements-damage-reset");
    const changed = input("db-field-element-damage-E", "1000000");
    changed.dispatchEvent(new Event("change"));
    expect(changed.value).toBe("99999");
    expect(store.getCurrent().database.elements![5].damageMultipliers.E).toBe(99999);
    input("db-field-element-damage-E", "-10000").dispatchEvent(new Event("change"));
    expect(changed.value).toBe("-9999");
    reset.click();
    expect(get("db-elements-damage-reset")).toBe(reset);
    expect(changed.value).toBe("0");
    expect(getMapEditHistoryState().canUndo).toBe(true);
    undoMapEdit();
    expect(store.getCurrent().database.elements![5].damageMultipliers.E).toBe(-9999);
  });
  it("disables adding at 99 and renders an honest empty collection", () => {
    const project = createBlankProject();
    const template = project.database.elements![0];
    project.database.elements = Array.from({ length: 99 }, (_, n) => ({ ...template, id: `custom-${n}` }));
    store.replace(project); mount();
    expect((get("db-elements-add") as HTMLButtonElement).disabled).toBe(true);
    project.database.elements = []; store.replace(project); mount();
    expect(document.querySelector('[data-testid="db-elements-reference-damage"]')).toBeNull();
    expect((get("db-elements-add") as HTMLButtonElement).disabled).toBe(false);
  });
});
