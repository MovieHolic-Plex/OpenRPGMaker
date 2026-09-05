import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { ClassBattleCommand } from "@/project/types";
import { installFakeDom } from "./fakeDom";

const attack: ClassBattleCommand = { id: "attack", name: "Strike", kind: "attack" };
const item: ClassBattleCommand = { id: "item", name: "Pack", kind: "item" };
const magic: ClassBattleCommand = { id: "magic", name: "Fire", kind: "skill", skillId: "skill_fire" };
const footer: ClassBattleCommand = { id: "cmd_change", name: "Switch", kind: "switch" };

describe("battle command controls after external selected-class deletion", () => {
  let restore: () => void;
  let host: HTMLElement;
  let studio: typeof import("@/editor/panels/databaseBattleCommandStudio");
  let store: typeof import("@/project/store")["store"];
  let history: typeof import("@/editor/mapEditHistory");
  let rerender: ReturnType<typeof vi.fn>;

  function control(id: string): HTMLElement {
    const node = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }

  beforeEach(async () => {
    restore = installFakeDom();
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
    ({ store } = await import("@/project/store"));
    history = await import("@/editor/mapEditHistory");
    studio = await import("@/editor/panels/databaseBattleCommandStudio");
    const project = createBlankProject();
    const base = project.database.classes[0];
    if (!base) throw new Error("Missing starter class");
    project.database.classes = ["survivor_a", "selected", "survivor_b"].map((id) => ({
      ...base, id, name: id,
      battleCommands: [{ ...attack, name: `${id} override`, skillId: `${id}_skill` }, { ...item }, { ...footer }],
    }));
    project.database.battleCommands = [{ ...magic }];
    store.replace(project);
    history.resetMapEditHistory();
    host = document.createElement("div");
    document.body.append(host);
    // Deliberately retain DOM on external updates, as the modal does during input focus.
    rerender = vi.fn(() => {
      const palette = document.createElement("div");
      for (const command of store.getCurrent().database.battleCommands ?? []) {
        const card = document.createElement("article");
        studio.attachCatalogPlacement(card, command, rerender);
        palette.append(card);
      }
      host.replaceChildren(studio.battleCommandPlacement(palette, rerender));
    });
    rerender();
    const select = control("db-command-class-select") as HTMLSelectElement;
    select.value = "selected";
    select.dispatchEvent(new Event("change"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    restore();
  });

  it.each([
    ["add", "db-command-place-magic"],
    ["move", "db-command-down-attack"],
    ["remove", "db-command-remove-attack"],
  ])("rejects retained %s without touching surviving classes or history, then refreshes", (_action, testid) => {
    const select = control("db-command-class-select") as HTMLSelectElement;
    const button = control(testid) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    store.update((project) => {
      project.database.classes = project.database.classes.filter((row) => row.id !== "selected");
    }, { scope: "database", collection: "classes", label: "External class deletion", origin: "system" });
    expect(control(testid)).toBe(button);
    expect(control("db-command-class-select")).toBe(select);
    expect(select.value).toBe("selected");
    const before = structuredClone(store.getCurrent().database.classes);
    const marker = history.getMapEditHistoryMarker();
    const labels = history.pendingHistoryLabels();
    const updates = vi.spyOn(store, "update");
    const snapshots = vi.spyOn(history, "recordProjectSnapshot");
    rerender.mockClear();

    button.dispatchEvent(new Event("click"));

    expect(store.getCurrent().database.classes).toEqual(before);
    expect(updates).not.toHaveBeenCalled();
    expect(snapshots).not.toHaveBeenCalled();
    expect(history.getMapEditHistoryMarker()).toBe(marker);
    expect(history.pendingHistoryLabels()).toEqual(labels);
    expect(rerender).toHaveBeenCalledOnce();
    expect(control("db-command-class-select")).not.toBe(select);
    expect((control("db-command-class-select") as HTMLSelectElement).value).toBe("survivor_a");
    expect((control("db-command-place-magic") as HTMLButtonElement).disabled).toBe(false);
  });
});
