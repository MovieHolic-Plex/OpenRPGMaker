import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderFactionsTab } from "@/editor/panels/databaseFactionView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
import { Window } from "happy-dom";
import { restoreFocusAfterRerender } from "@/editor/panels/databaseWorkspace";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { deserialize, serialize } from "@/project/io";
import { toolActionRulesOf } from "@/project/toolActions";
import { computeRowWindow, createVirtualList, DEFAULT_ROW_HEIGHT, VIRTUALIZATION_THRESHOLD } from "@/editor/panels/databaseListVirtualizer";
import { el } from "@/util/dom";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { isolateTimers } from "./mergedTeardown";

describe("databaseFactionView", () => {
  isolateTimers();
  let cleanupDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    cleanupDom = installFakeDom();
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { setTimeout: (callback: TimerHandler): number => { if (typeof callback === "function") callback(); return 0; }, clearTimeout },
    });
    store.replace(createBlankProject());
  });
  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  function renderView(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderFactionsTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  describe("database faction authoring view", () => {
    it("uses the canonical workspace builders and renders accessible reserved-faction matrix cells", () => {
      const host = renderView();
      expect(host.querySelectorAll(".db-record-workspace")).toHaveLength(1);
      expect(host.querySelectorAll(".db-list-pane")).toHaveLength(1);
      expect(findByTestId(host, "db-faction-search")?.getAttribute("type")).toBe("search");

      const relation = findByTestId(host, "db-faction-relation-enemy");
      // 관계는 말로 보이고(숫자 -1 은 전문가 모드 전용 칸), 결과는 한 줄로 합쳐 보인다.
      expect(relation?.textContent).toContain("적대");
      expect(relation?.textContent).toContain("서로 먼저 공격");
      expect(findByTestId(host, "db-faction-pick-enemy--1")?.getAttribute("aria-pressed")).toBe("true");

      const cell = findByTestId(host, "db-faction-stance-player-enemy");
      expect(cell?.tagName).toBe("BUTTON");
      expect(cell?.textContent).toContain("-1");
      expect(cell?.textContent).toContain("적대");
      expect(cell?.textContent).toContain("기본");
      expect(cell?.getAttribute("aria-label")).toContain("기본");
    });

    it("creates factions and disables deletion for reserved ids", () => {
      const host = renderView();
      expect(findByTestId(host, "db-faction-delete")?.getAttribute("disabled")).toBe("true");

      findByTestId(host, "db-faction-create")?.click();
      expect(store.getCurrent().factions?.defs).toEqual([{ id: "faction_1", name: "새 진영" }]);
      expect(findByTestId(host, "db-faction-delete")?.getAttribute("disabled")).toBeNull();
      expect(findByTestId(host, "db-faction-stance-faction_1-player")?.textContent).toContain("중립");
    });

    it("changes a relation from the per-faction list and marks only the non-default value", () => {
      const project = createBlankProject();
      project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
      store.replace(project);
      const host = renderView();

      const pick = findByTestId(host, "db-faction-pick-guard-1");
      expect(pick?.getAttribute("aria-pressed")).toBe("false");
      expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("기본");
      pick?.click();

      expect(store.getCurrent().factions?.relations).toEqual([{ a: "player", b: "guard", stance: 1 }]);
      expect(findByTestId(host, "db-faction-pick-guard-1")?.getAttribute("aria-pressed")).toBe("true");
      expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("바꿈");

      findByTestId(host, "db-faction-pick-guard-0")?.click();
      expect(store.getCurrent().factions?.relations).toEqual([]);
      expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("기본");
    });

    it("cycles a matrix cell and marks only the non-default value as authored", () => {
      const project = createBlankProject();
      project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
      store.replace(project);
      const host = renderView();

      const cell = findByTestId(host, "db-faction-stance-player-guard");
      expect(cell?.dataset.authored).toBe("false");
      cell?.click();

      expect(store.getCurrent().factions?.relations).toEqual([{ a: "player", b: "guard", stance: 1 }]);
      expect(findByTestId(host, "db-faction-stance-player-guard")?.dataset.authored).toBe("true");
    });
    it("previews kill reputation without changing authored data", () => {
      store.update((project) => { project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [{ a: "guard", b: "enemy", stance: -1 }], playerKillReputation: { weight: 0.25 } }; });
      const before = JSON.stringify(store.getCurrent());
      const host = renderView();
      const count = findByTestId(host, "db-faction-preview-count")!;
      count.value = "4"; count.dispatchEvent(new Event("input"));
      expect(findByTestId(host, "db-faction-reputation-preview-result")?.textContent).toContain("경비병: 0 → 1");
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      findByTestId(host, "db-faction-row-enemy")!.click();
      expect(findByTestId(host, `db-faction-use-enemy-${store.getCurrent().database.enemies[0]!.id}`)).toBeTruthy();
    });

    it("keeps project-wide rules and the matrix out of the per-faction view until switched", () => {
      const host = renderView();
      const paneOf = (testid: string): FakeElement | null | undefined => {
        let node = findByTestId(host, testid) as FakeElement | null | undefined;
        while (node && node.dataset?.factionView === undefined) node = node.parentElement as FakeElement | null | undefined;
        return node;
      };
      expect(paneOf("db-faction-relations")?.getAttribute("hidden")).toBeNull();
      expect(paneOf("db-faction-reputation")?.getAttribute("hidden")).not.toBeNull();
      expect(paneOf("db-faction-matrix-card")?.getAttribute("hidden")).not.toBeNull();
      // 예전 숫자 요약 띠 대신 제목줄에 소속·쓰는 곳 요약이 있다.
      expect(findByTestId(host, "db-faction-usage-toggle")?.textContent).toContain("소속 몬스터");

      findByTestId(host, "db-faction-view-rules")?.click();
      expect(paneOf("db-faction-reputation")?.getAttribute("hidden")).toBeNull();
      expect(paneOf("db-faction-relations")?.getAttribute("hidden")).not.toBeNull();
      findByTestId(host, "db-faction-view-faction")?.click();
      expect(paneOf("db-faction-relations")?.getAttribute("hidden")).toBeNull();
    });

    it("labels aggression options once, without repeating the label in the description", () => {
      const host = renderView();
      const options = findByTestId(host, "db-faction-aggression")?.querySelectorAll("option") ?? [];
      const texts = Array.from(options, (option) => (option as FakeElement).textContent ?? "");
      expect(texts).toHaveLength(4);
      for (const text of texts) expect(text).not.toContain("—");
    });
  });
});

describe("databaseFocusRestoration", () => {
  isolateTimers();
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    const window = new Window();
    vi.stubGlobal("document", window.document);
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  function button(id: string): HTMLButtonElement {
    const node = document.createElement("button");
    node.dataset.testid = id;
    document.body.append(node);
    return node;
  }
  function frame(): void {
    const callback = frames.shift();
    if (!callback) throw new Error("missing scheduled frame");
    callback(0);
  }
  it("does not steal focus after the author moves to a CSS input", () => {
    const target = button("placed");
    const input = document.createElement("textarea");
    document.body.append(input);
    restoreFocusAfterRerender("placed", 2);
    frame();
    expect(document.activeElement).toBe(target);
    input.focus();
    frame();
    expect(document.activeElement).toBe(input);
  });
  it("allows the latest requested restoration to supersede older queued frames", () => {
    button("old");
    const latest = button("latest");
    restoreFocusAfterRerender("old", 2);
    frame();
    restoreFocusAfterRerender("latest", 2);
    frame();
    frame();
    expect(document.activeElement).toBe(latest);
    frame();
    expect(document.activeElement).toBe(latest);
    while (frames.length) frame();
    expect(document.activeElement).toBe(latest);
  });
  it("still restores focus after a second DOM replacement", () => {
    const first = button("same");
    restoreFocusAfterRerender("same", 2);
    frame();
    expect(document.activeElement).toBe(first);
    first.remove();
    const replacement = button("same");
    frame();
    expect(document.activeElement).toBe(replacement);
  });
});

describe("databaseImageFailurePlaceholder", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("Database image failure placeholders", () => {
    it("renders an unresolved shared thumbnail as a labeled non-zero placeholder", () => {
      const project = createBlankProject();
      const item = {
        ...project.database.items[0],
        name: "없는 회복약",
        iconResourceId: "missing-database-image-resource",
        imageResourceId: undefined,
      };
      const thumbnail = recordListThumbnail("items", item, project);

      expect(thumbnail).toBeInstanceOf(FakeElement);
      if (!(thumbnail instanceof FakeElement)) throw new Error("expected Database thumbnail element");

      expect(thumbnail.classList.contains("db-image-load-failed")).toBe(true);
      expect(thumbnail.classList.contains("db-image-placeholder")).toBe(true);
      expect(thumbnail.getAttribute("aria-label")).toContain("없는 회복약");
      expect(Number.parseFloat(thumbnail.style.minWidth)).toBeGreaterThan(0);
      expect(Number.parseFloat(thumbnail.style.minHeight)).toBeGreaterThan(0);
    });
  });
});

describe("databaseLifeCraftingView", () => {
  isolateTimers();
  function renderTab(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderLifeCraftingTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  function setValue(host: FakeElement, testid: string, value: string): void {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing ${testid}`);
    control.value = value;
    control.dispatchEvent(new Event("change"));
  }
  function setChecked(host: FakeElement, testid: string, checked: boolean): void {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing ${testid}`);
    control.checked = checked;
    control.dispatchEvent(new Event("change"));
  }
  describe("database life skill and crafting view", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    afterEach(() => cleanupDom?.());

    it("materializes real defaults only on first custom-table creation, as one undoable edit", () => {
      const defaults = structuredClone(toolActionRulesOf(store.getCurrent()));
      const host = renderTab();
      findByTestId(host, "db-life-section-tool-actions")?.click();
      expect(store.getCurrent().system.toolActions).toBeUndefined();
      findByTestId(host, "db-life-add")?.click();
      expect(store.getCurrent().system.toolActions).toHaveLength(5);
      expect(store.getCurrent().system.toolActions?.slice(1)).toEqual(defaults);
      expect(store.getCurrent().system.toolActions?.[0]?.itemId).toBeUndefined();
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().system.toolActions).toBeUndefined();
      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent().system.toolActions?.slice(1)).toEqual(defaults);
    });

    it("appends to existing tables without merging and preserves false through editing and load", () => {
      store.update((project) => { project.system.toolActions = [{ id: "existing", action: "till", farmTool: "hoe" }]; });
      const host = renderTab();
      findByTestId(host, "db-life-section-tool-actions")?.click();
      findByTestId(host, "db-life-row-existing")?.click();
      expect(findByTestId(host, "db-life-tool-requires-farmable")?.checked).toBe(true);
      setChecked(host, "db-life-tool-requires-farmable", false);
      expect(store.getCurrent().system.toolActions?.[0]?.requiresFarmable).toBe(false);
      expect(deserialize(serialize(store.getCurrent())).system.toolActions?.[0]?.requiresFarmable).toBe(false);
      findByTestId(host, "db-life-add")?.click();
      expect(store.getCurrent().system.toolActions).toHaveLength(2);
      expect(store.getCurrent().system.toolActions?.[0]?.id).toBe("existing");
    });

    // Break caught: life skill records have no list/detail editor or reward controls.
    it("authors a life skill and level reward, then undo restores the prior record", () => {
      const host = renderTab();
      findByTestId(host, "db-life-section-skills")?.click();
      findByTestId(host, "db-life-add")?.click();
      setValue(host, "db-life-skill-name", "농사");
      setValue(host, "db-life-skill-type", "farming");
      setValue(host, "db-life-skill-max-level", "10");
      findByTestId(host, "db-life-skill-reward-add")?.click();
      setValue(host, "db-life-skill-reward-level-0", "5");
      setValue(host, "db-life-skill-reward-switch-0", store.getCurrent().switches[0]?.id ?? "");

      expect(store.getCurrent().database.lifeSkills?.[0]).toMatchObject({
        name: "농사",
        skillType: "farming",
        maxLevel: 10,
        levelUpRewards: [{ level: 5 }],
      });
      expect(undoMapEdit()).toBe(true);
    });

    // Break caught: recipe ingredients and output only appear as a count in System.
    it("authors a recipe with ingredient and output item references", () => {
      const host = renderTab();
      findByTestId(host, "db-life-section-recipes")?.click();
      findByTestId(host, "db-life-add")?.click();
      const itemId = store.getCurrent().database.items[0]?.id ?? "";
      setValue(host, "db-life-recipe-name", "간식 만들기");
      setValue(host, "db-life-recipe-output-item", itemId);
      setValue(host, "db-life-recipe-output-count", "2");
      findByTestId(host, "db-life-recipe-ingredient-add")?.click();
      setValue(host, "db-life-recipe-ingredient-item-0", itemId);
      setValue(host, "db-life-recipe-ingredient-count-0", "3");

      expect(store.getCurrent().system.craftRecipes?.[0]).toMatchObject({
        name: "간식 만들기",
        outputItemId: itemId,
        outputCount: 2,
        ingredients: [{ itemId, count: 3 }],
      });
    });

    // Break caught: upgrades, prices, and tool actions have no structured record editor.
    it("authors upgrade, sell-price, and tool-action records through their detail forms", () => {
      const host = renderTab();
      const itemId = store.getCurrent().database.items[0]?.id ?? "";

      findByTestId(host, "db-life-section-upgrades")?.click();
      findByTestId(host, "db-life-add")?.click();
      setValue(host, "db-life-upgrade-from-item", itemId);
      setValue(host, "db-life-upgrade-to-item", itemId);
      setValue(host, "db-life-upgrade-gold-cost", "250");

      findByTestId(host, "db-life-section-sell-prices")?.click();
      findByTestId(host, "db-life-add")?.click();
      setValue(host, "db-life-sell-item", itemId);
      setValue(host, "db-life-sell-price", "80");

      findByTestId(host, "db-life-section-tool-actions")?.click();
      findByTestId(host, "db-life-add")?.click();
      setValue(host, "db-life-tool-item", itemId);
      setValue(host, "db-life-tool-farm-tool", "hoe");
      setValue(host, "db-life-tool-action", "till");

      expect(store.getCurrent().system.itemUpgrades?.[0]).toMatchObject({ fromItemId: itemId, toItemId: itemId, goldCost: 250 });
      expect(store.getCurrent().system.sellPrices?.[0]).toEqual({ itemId, price: 80 });
      expect(store.getCurrent().system.toolActions?.[0]).toMatchObject({ itemId, farmTool: "hoe", action: "till" });

      const restored = deserialize(serialize(store.getCurrent()));
      expect(restored.system.itemUpgrades?.[0]).toMatchObject({ fromItemId: itemId, toItemId: itemId, goldCost: 250 });
      expect(restored.system.sellPrices?.[0]).toEqual({ itemId, price: 80 });
      expect(restored.system.toolActions?.[0]).toMatchObject({ itemId, farmTool: "hoe", action: "till" });
    });

    // Break caught: editing an id or adding another sell row can create ambiguous duplicate keys.
    it("rejects duplicate record ids and chooses an unused sell-price item", () => {
      const host = renderTab();
      for (const section of ["skills", "recipes", "upgrades", "tool-actions"] as const) {
        findByTestId(host, `db-life-section-${section}`)?.click();
        findByTestId(host, "db-life-add")?.click();
        findByTestId(host, "db-life-add")?.click();
        const records = section === "skills"
          ? store.getCurrent().database.lifeSkills ?? []
          : section === "recipes"
            ? store.getCurrent().system.craftRecipes ?? []
            : section === "upgrades"
              ? store.getCurrent().system.itemUpgrades ?? []
              : store.getCurrent().system.toolActions ?? [];
        const firstId = records[0]?.id;
        const secondId = records.at(-1)?.id;
        if (!firstId || !secondId) throw new Error(`missing ${section} ids`);
        const prefix = section === "skills" ? "skill" : section === "recipes" ? "recipe" : section === "upgrades" ? "upgrade" : "tool";
        setValue(host, `db-life-${prefix}-id`, firstId);
        const after = section === "skills"
          ? store.getCurrent().database.lifeSkills ?? []
          : section === "recipes"
            ? store.getCurrent().system.craftRecipes ?? []
            : section === "upgrades"
              ? store.getCurrent().system.itemUpgrades ?? []
              : store.getCurrent().system.toolActions ?? [];
        expect(after.at(-1)?.id).toBe(secondId);
      }

      findByTestId(host, "db-life-section-sell-prices")?.click();
      findByTestId(host, "db-life-add")?.click();
      findByTestId(host, "db-life-add")?.click();
      const prices = store.getCurrent().system.sellPrices ?? [];
      expect(prices).toHaveLength(2);
      expect(prices[0]?.itemId).not.toBe(prices[1]?.itemId);
    });

    // Break caught: deleting records leaves craftRecipe/applyItemUpgrade/changeLifeSkillExp commands dangling.
    it("blocks deletion while event commands reference the selected life records", () => {
      const project = createBlankProject();
      const itemId = project.database.items[0]?.id ?? "";
      project.database.lifeSkills = [{ id: "life_ref", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] }];
      project.system.craftRecipes = [{ id: "recipe_ref", ingredients: [], outputItemId: itemId }];
      project.system.itemUpgrades = [{ id: "upgrade_ref", fromItemId: itemId, toItemId: itemId }];
      project.maps[project.startMapId]?.events.push({
        id: "life_commands",
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [
          { kind: "changeLifeSkillExp", skillId: "life_ref", op: "+=", amount: 1 },
          { kind: "craftRecipe", recipeId: "recipe_ref" },
          { kind: "applyItemUpgrade", upgradeId: "upgrade_ref" },
        ],
      });
      store.replace(project);
      const host = renderTab();

      for (const section of ["skills", "recipes", "upgrades"] as const) {
        findByTestId(host, `db-life-section-${section}`)?.click();
        findByTestId(host, "db-life-delete")?.click();
      }

      expect(store.getCurrent().database.lifeSkills).toHaveLength(1);
      expect(store.getCurrent().system.craftRecipes).toHaveLength(1);
      expect(store.getCurrent().system.itemUpgrades).toHaveLength(1);
    });

    // Break caught: the runtime understands locked recipes and upgraded tool reach,
    // but the structured editor drops those fields because it has no controls for them.
    it("authors recipe unlock requirements and tool capability fields", () => {
      const host = renderTab();

      findByTestId(host, "db-life-section-recipes")?.click();
      findByTestId(host, "db-life-add")?.click();
      setChecked(host, "db-life-recipe-requires-unlock", true);

      findByTestId(host, "db-life-section-upgrades")?.click();
      findByTestId(host, "db-life-add")?.click();
      setChecked(host, "db-life-upgrade-capability-enabled", true);
      setValue(host, "db-life-upgrade-area-width", "3");
      setValue(host, "db-life-upgrade-area-height", "2");
      setValue(host, "db-life-upgrade-energy-multiplier", "0.75");

      expect(store.getCurrent().system.craftRecipes?.[0]?.requiresUnlock).toBe(true);
      expect(store.getCurrent().system.itemUpgrades?.[0]?.capability).toEqual({
        areaWidth: 3,
        areaHeight: 2,
        energyMultiplier: 0.75,
      });
      const restored = deserialize(serialize(store.getCurrent()));
      expect(restored.system.craftRecipes?.[0]?.requiresUnlock).toBe(true);
      expect(restored.system.itemUpgrades?.[0]?.capability?.areaWidth).toBe(3);
    });

    it("clamps authored tool capability axes to the runtime-safe 9x9 limit", () => {
      const host = renderTab();
      findByTestId(host, "db-life-section-upgrades")?.click();
      findByTestId(host, "db-life-add")?.click();
      setChecked(host, "db-life-upgrade-capability-enabled", true);

      setValue(host, "db-life-upgrade-area-width", "99");
      setValue(host, "db-life-upgrade-area-height", "999999");

      expect(store.getCurrent().system.itemUpgrades?.[0]?.capability).toMatchObject({ areaWidth: 9, areaHeight: 9 });
    });

    // Break caught: energy and shipping are schema-only packages and shipping's
    // enabled toggle must not erase history/item policy while it is off.
    it("creates energy and shipping settings and preserves disabled shipping values", () => {
      const host = renderTab();

      findByTestId(host, "db-life-section-energy")?.click();
      expect(findByTestId(host, "db-life-package-create")).not.toBeNull();
      findByTestId(host, "db-life-package-create")?.click();
      setValue(host, "db-life-energy-max", "180");
      setValue(host, "db-life-energy-initial", "120");
      setValue(host, "db-life-energy-restore", "90");

      findByTestId(host, "db-life-section-shipping")?.click();
      findByTestId(host, "db-life-package-create")?.click();
      setValue(host, "db-life-shipping-history-limit", "14");
      const itemId = store.getCurrent().database.items[0]?.id;
      if (!itemId) throw new Error("missing default item");
      setChecked(host, "db-life-shipping-all-items", false);
      setChecked(host, `db-life-shipping-item-${itemId}`, true);
      setChecked(host, "db-life-shipping-enabled", false);

      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.getCurrent().system.energy).toEqual({ max: 180, initial: 120, restorePerDay: 90 });
      expect(store.getCurrent().system.shipping).toEqual({
        enabled: false,
        historyLimit: 14,
        allowedItemIds: [itemId],
      });
      expect(findByTestId(host, "db-life-shipping-history-limit")?.value).toBe("14");
    });

    // Break caught (2026-09-09 native editor QA v13): unchecking a single item
    // materializes allowedItemIds (undefined -> array) but the per-item handler did
    // not rerender, so "판매 가능한 모든 아이템" stayed checked while one item was
    // excluded. That control writes `checked ? undefined : []` from its NEW checked
    // state, so one click on the stale-checked box wiped the whole shipping list.
    it("clears the all-items checkbox once a single item is excluded, so one click cannot wipe the list", () => {
      const host = renderTab();
      findByTestId(host, "db-life-section-shipping")?.click();
      findByTestId(host, "db-life-package-create")?.click();

      const allItemIds = store.getCurrent().database.items.map((item) => item.id);
      const excluded = allItemIds[0];
      if (!excluded || allItemIds.length < 2) throw new Error("need at least two default items");

      // Starts as "all allowed": undefined, and the header renders checked.
      expect(store.getCurrent().system.shipping?.allowedItemIds).toBeUndefined();
      expect(findByTestId(host, "db-life-shipping-all-items")?.checked).toBe(true);

      setChecked(host, `db-life-shipping-item-${excluded}`, false);

      // The project now holds every id except the excluded one...
      expect(store.getCurrent().system.shipping?.allowedItemIds).toEqual(
        allItemIds.filter((id) => id !== excluded),
      );
      // ...and the header must no longer claim every item is shippable.
      expect(findByTestId(host, "db-life-shipping-all-items")?.checked).toBe(false);

      // Therefore the next click on it means "select all", not "clear everything".
      setChecked(host, "db-life-shipping-all-items", true);
      expect(store.getCurrent().system.shipping?.allowedItemIds).toBeUndefined();
    });

    // Break caught: world unlock, bundle, and maker records have no discoverable
    // add/detail/duplicate/delete workflow even though they are persisted by ProjectIO.
    it("authors world unlock, bundle rewards, and maker processing without raw JSON", () => {
      const project = createBlankProject();
      project.switches.push({ id: "sw_unlock", name: "해금" });
      store.replace(project);
      const host = renderTab();
      const itemId = store.getCurrent().database.items[0]?.id;
      if (!itemId) throw new Error("missing default item");

      findByTestId(host, "db-life-section-world-unlocks")?.click();
      findByTestId(host, "db-life-empty-add")?.click();
      setValue(host, "db-life-world-unlock-id", "unlock_bridge");
      setValue(host, "db-life-world-unlock-name", "다리 수리");
      setValue(host, "db-life-world-unlock-switch", "sw_unlock");
      findByTestId(host, "db-life-duplicate")?.click();
      expect(store.getCurrent().system.worldUnlocks).toHaveLength(2);
      expect(store.getCurrent().system.worldUnlocks?.[1]?.id).not.toBe("unlock_bridge");

      findByTestId(host, "db-life-section-recipes")?.click();
      findByTestId(host, "db-life-add")?.click();
      const recipeId = store.getCurrent().system.craftRecipes?.[0]?.id;
      if (!recipeId) throw new Error("missing recipe");

      findByTestId(host, "db-life-section-bundles")?.click();
      findByTestId(host, "db-life-empty-add")?.click();
      setValue(host, "db-life-bundle-name", "봄 채집 꾸러미");
      findByTestId(host, "db-life-bundle-requirement-add")?.click();
      setValue(host, "db-life-bundle-requirement-item-0", itemId);
      setValue(host, "db-life-bundle-requirement-count-0", "5");
      setValue(host, "db-life-bundle-reward-gold", "500");
      findByTestId(host, "db-life-bundle-reward-item-add")?.click();
      setValue(host, "db-life-bundle-reward-item-item-0", itemId);
      setValue(host, "db-life-bundle-reward-item-count-0", "2");
      setValue(host, "db-life-bundle-reward-switch", "sw_unlock");
      setChecked(host, "db-life-bundle-unlock-unlock_bridge", true);
      setChecked(host, `db-life-bundle-recipe-${recipeId}`, true);

      findByTestId(host, "db-life-section-makers")?.click();
      findByTestId(host, "db-life-empty-add")?.click();
      setValue(host, "db-life-maker-name", "치즈 프레스");
      setValue(host, "db-life-maker-duration", "120");
      findByTestId(host, "db-life-maker-input-add")?.click();
      setValue(host, "db-life-maker-input-item-0", itemId);
      setValue(host, "db-life-maker-input-count-0", "1");
      findByTestId(host, "db-life-maker-output-add")?.click();
      setValue(host, "db-life-maker-output-item-0", itemId);
      setValue(host, "db-life-maker-output-count-0", "1");

      expect(store.getCurrent().system.bundles?.[0]).toMatchObject({
        name: "봄 채집 꾸러미",
        requirements: [{ itemId, count: 5 }],
        reward: {
          gold: 500,
          itemRewards: [{ itemId, count: 2 }],
          switchId: "sw_unlock",
          worldUnlockIds: ["unlock_bridge"],
          recipeIds: [recipeId],
        },
      });
      expect(store.getCurrent().system.makers?.[0]).toMatchObject({
        name: "치즈 프레스",
        durationMinutes: 120,
        inputs: [{ itemId, count: 1 }],
        outputs: [{ itemId, count: 1 }],
      });
      expect(deserialize(serialize(store.getCurrent())).system.bundles?.[0]?.reward?.recipeIds).toEqual([recipeId]);
    });

    // Break caught: duplicate ids and deleting a reward target can make package
    // references ambiguous or dangling; undo must also cover collection actions.
    it("rejects duplicate package ids, guards reward targets, and records undo", () => {
      const project = createBlankProject();
      const itemId = project.database.items[0]?.id ?? "";
      project.system.worldUnlocks = [{ id: "unlock_mine", name: "광산" }];
      project.system.craftRecipes = [{ id: "recipe_gate", ingredients: [], outputItemId: itemId }];
      project.system.bundles = [{
        id: "bundle_gate",
        requirements: [{ itemId, count: 1 }],
        reward: { worldUnlockIds: ["unlock_mine"], recipeIds: ["recipe_gate"] },
      }];
      store.replace(project);
      const host = renderTab();

      findByTestId(host, "db-life-section-world-unlocks")?.click();
      findByTestId(host, "db-life-add")?.click();
      const secondId = store.getCurrent().system.worldUnlocks?.[1]?.id;
      if (!secondId) throw new Error("missing second unlock");
      setValue(host, "db-life-world-unlock-id", "unlock_mine");
      expect(store.getCurrent().system.worldUnlocks?.[1]?.id).toBe(secondId);

      findByTestId(host, "db-life-delete")?.click();
      expect(store.getCurrent().system.worldUnlocks).toHaveLength(1);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().system.worldUnlocks).toHaveLength(2);

      findByTestId(host, "db-life-section-world-unlocks")?.click();
      findByTestId(host, "db-life-row-unlock_mine")?.click();
      findByTestId(host, "db-life-delete")?.click();
      expect(store.getCurrent().system.worldUnlocks?.some((entry) => entry.id === "unlock_mine")).toBe(true);

      findByTestId(host, "db-life-section-recipes")?.click();
      findByTestId(host, "db-life-row-recipe_gate")?.click();
      findByTestId(host, "db-life-delete")?.click();
      expect(store.getCurrent().system.craftRecipes).toHaveLength(1);
    });

    it("blocks renaming referenced skill, recipe, upgrade, and world-unlock ids", () => {
      // Break caught: delete guards protect references, but editing the same ID
      // field immediately leaves event and bundle references dangling.
      const project = createBlankProject();
      const itemId = project.database.items[0]?.id ?? "";
      project.database.lifeSkills = [{ id: "life_ref", name: "농사", skillType: "farming", maxLevel: 5, levelUpRewards: [] }];
      project.system.craftRecipes = [{ id: "recipe_ref", ingredients: [], outputItemId: itemId }];
      project.system.itemUpgrades = [{ id: "upgrade_ref", fromItemId: itemId, toItemId: itemId }];
      project.system.worldUnlocks = [{ id: "unlock_ref", name: "다리" }];
      project.system.bundles = [{
        id: "bundle_ref",
        requirements: [{ itemId, count: 1 }],
        reward: { recipeIds: ["recipe_ref"], worldUnlockIds: ["unlock_ref"] },
      }];
      project.maps[project.startMapId]?.events.push({
        id: "rename_refs",
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [
          { kind: "changeLifeSkillExp", skillId: "life_ref", op: "+=", amount: 1 },
          { kind: "craftRecipe", recipeId: "recipe_ref" },
          { kind: "applyItemUpgrade", upgradeId: "upgrade_ref" },
        ],
      });
      store.replace(project);
      const host = renderTab();

      for (const [section, row, field, original] of [
        ["skills", "life_ref", "skill", "life_ref"],
        ["recipes", "recipe_ref", "recipe", "recipe_ref"],
        ["upgrades", "upgrade_ref", "upgrade", "upgrade_ref"],
        ["world-unlocks", "unlock_ref", "world-unlock", "unlock_ref"],
      ] as const) {
        findByTestId(host, `db-life-section-${section}`)?.click();
        findByTestId(host, `db-life-row-${row}`)?.click();
        setValue(host, `db-life-${field}-id`, `${original}_renamed`);
      }

      expect(store.getCurrent().database.lifeSkills?.[0]?.id).toBe("life_ref");
      expect(store.getCurrent().system.craftRecipes?.[0]?.id).toBe("recipe_ref");
      expect(store.getCurrent().system.itemUpgrades?.[0]?.id).toBe("upgrade_ref");
      expect(store.getCurrent().system.worldUnlocks?.[0]?.id).toBe("unlock_ref");
    });

    it("keeps section switching in a tab strip and does not dump every section into the empty detail", () => {
      const host = renderTab();
      findByTestId(host, "db-life-section-skills")?.click();
      const header = findByTestId(host, "db-life-crafting-header");
      expect(header).not.toBeNull();
      expect(header?.querySelector("h2")).toBeNull();
      expect(findByTestId(host, "db-life-section-makers")).not.toBeNull();
      expect(findByTestId(host, "db-life-empty-add")).not.toBeNull();
      expect(findByTestId(host, "db-life-board-makers")).toBeNull();
      expect(findByTestId(host, "db-life-stats")).toBeNull();
      expect(findByTestId(host, "db-life-list-pane-skills")).not.toBeNull();

      findByTestId(host, "db-life-section-energy")?.click();
      expect(findByTestId(host, "db-life-list-pane-energy")).not.toBeNull();
      expect(findByTestId(host, "db-life-package-create")).not.toBeNull();
      expect(findByTestId(host, "db-life-board-skills")).toBeNull();
    });
  });
});

describe("databaseListVirtualizer", () => {
  isolateTimers();
  describe("computeRowWindow", () => {
    it("renders everything when the total is at or below the threshold", () => {
      expect(computeRowWindow({ total: 40, scrollTop: 999, viewportHeight: 300, threshold: 80 })).toEqual({
        start: 0,
        end: 40,
      });
    });

    it("renders everything when the viewport height is unknown (0)", () => {
      expect(computeRowWindow({ total: 500, scrollTop: 4000, viewportHeight: 0 })).toEqual({ start: 0, end: 500 });
    });

    it("windows a large list around the scroll position with overscan", () => {
      const window = computeRowWindow({
        total: 1000,
        scrollTop: 100 * DEFAULT_ROW_HEIGHT,
        viewportHeight: 10 * DEFAULT_ROW_HEIGHT,
        overscan: 5,
        threshold: 80,
      });
      // firstVisible = 100, visibleCount = 10, overscan = 5 -> [95, 115)
      expect(window).toEqual({ start: 95, end: 115 });
      expect(window.end - window.start).toBeLessThan(1000);
    });

    it("clamps the window to the list bounds", () => {
      const window = computeRowWindow({
        total: 200,
        scrollTop: 500 * DEFAULT_ROW_HEIGHT,
        viewportHeight: 8 * DEFAULT_ROW_HEIGHT,
        overscan: 4,
        threshold: 80,
      });
      expect(window.start).toBeGreaterThanOrEqual(0);
      expect(window.end).toBe(200);
      expect(window.start).toBeLessThanOrEqual(200);
    });

    it("returns an empty window for an empty list", () => {
      expect(computeRowWindow({ total: 0, scrollTop: 0, viewportHeight: 300 })).toEqual({ start: 0, end: 0 });
    });

    it("exposes a sensible default threshold", () => {
      expect(VIRTUALIZATION_THRESHOLD).toBeGreaterThan(0);
    });

    it("windows by full rows when columns > 1 (grid math)", () => {
      // 133 items ÷ 4 columns = 34 rows. viewport 400px / rowHeight 120px = 4 visible rows.
      const window = computeRowWindow({
        total: 133,
        scrollTop: 0,
        viewportHeight: 400,
        rowHeight: 120,
        columns: 4,
        overscan: 0,
        threshold: 80,
      });
      // endRow = min(34, 0 + 4 + 0) = 4 → items [0, 16). start 는 항상 columns 의 배수다.
      expect(window).toEqual({ start: 0, end: 16 });
      expect(window.start % 4).toBe(0);
      expect(window.end - window.start).toBeLessThan(133);
    });

    it("keeps the window row-aligned at depth (start is a multiple of columns)", () => {
      const window = computeRowWindow({
        total: 200,
        scrollTop: 10 * 120,
        viewportHeight: 400,
        rowHeight: 120,
        columns: 3,
        overscan: 2,
        threshold: 80,
      });
      expect(window.start % 3).toBe(0);
      expect(window.start).toBeGreaterThanOrEqual(0);
      expect(window.end).toBeLessThanOrEqual(200);
      expect(window.start).toBeLessThan(window.end);
    });

    it("clamps the last row to the item count when the total is not divisible", () => {
      // 10 items ÷ 3 columns = 4 rows (last row holds 1 item).
      const window = computeRowWindow({
        total: 10,
        scrollTop: 0,
        viewportHeight: 400,
        rowHeight: 120,
        columns: 3,
        overscan: 0,
        threshold: 80,
      });
      // total(10) <= threshold(80) → 전부 렌더. end 가 항목 수로 클램프된다.
      expect(window).toEqual({ start: 0, end: 10 });
    });

    it("applies the threshold to the item count, not the row count", () => {
      // 100 items ÷ 4 columns = 25 rows — 행 수는 임계값(80) 이하여도 항목 수가 넘으면 윈도잉.
      const window = computeRowWindow({
        total: 100,
        scrollTop: 0,
        viewportHeight: 400,
        rowHeight: 120,
        columns: 4,
        overscan: 0,
        threshold: 80,
      });
      expect(window.end - window.start).toBeLessThan(100);
    });

    it("guards columns > total and degenerate columns values without crashing", () => {
      // columns(1000) > total(500): rows=1 → 전체가 한 행으로 렌더된다 (0 나눗셈 없음).
      const wide = computeRowWindow({
        total: 500,
        scrollTop: 0,
        viewportHeight: 400,
        rowHeight: 120,
        columns: 1000,
        overscan: 0,
        threshold: 0,
      });
      expect(wide).toEqual({ start: 0, end: 500 });

      // columns 0 / 음수 / NaN 은 기본 1 로 폴백 — columns 미지정과 동일한 결과.
      const baseline = computeRowWindow({ total: 500, scrollTop: 0, viewportHeight: 400, rowHeight: 120, overscan: 0, threshold: 0 });
      for (const broken of [0, -3, Number.NaN]) {
        expect(computeRowWindow({ total: 500, scrollTop: 0, viewportHeight: 400, rowHeight: 120, columns: broken, overscan: 0, threshold: 0 })).toEqual(baseline);
      }
    });

    it("columns=1 produces identical math to the default (single column)", () => {
      const withDefault = computeRowWindow({ total: 1000, scrollTop: 100 * DEFAULT_ROW_HEIGHT, viewportHeight: 10 * DEFAULT_ROW_HEIGHT, overscan: 5, threshold: 80 });
      const withOne = computeRowWindow({ total: 1000, scrollTop: 100 * DEFAULT_ROW_HEIGHT, viewportHeight: 10 * DEFAULT_ROW_HEIGHT, columns: 1, overscan: 5, threshold: 80 });
      expect(withOne).toEqual(withDefault);
    });
  });
  describe("createVirtualList", () => {
    it("renders all rows when geometry is unavailable (fake DOM) and re-renders windowed slices", () => {
      const restore = installFakeDom();
      try {
        const items = Array.from({ length: 300 }, (_, index) => index);
        const list = createVirtualList<number>({
          items,
          rowHeight: DEFAULT_ROW_HEIGHT,
          renderRow: (value) => el("button", { dataset: { row: String(value) }, text: String(value) }),
        });
        const container = list.element;
        if (!(container instanceof FakeElement)) throw new Error("expected fake element");
        const rowsHost = container.querySelector(".db-virtual-rows");
        // 높이를 측정할 수 없으면 전부 렌더된다.
        expect(rowsHost?.childNodes.length).toBe(300);

        // 뷰포트/스크롤을 부여하면 보이는 슬라이스만 렌더한다.
        (container as unknown as { clientHeight: number }).clientHeight = 10 * DEFAULT_ROW_HEIGHT;
        (container as unknown as { scrollTop: number }).scrollTop = 100 * DEFAULT_ROW_HEIGHT;
        list.render();
        const windowedCount = container.querySelector(".db-virtual-rows")?.childNodes.length ?? 0;
        expect(windowedCount).toBeGreaterThan(0);
        expect(windowedCount).toBeLessThan(300);
      } finally {
        restore();
      }
    });

    it("renders grid rows with columns: spacers cover full rows and the CSS var is set", () => {
      const restore = installFakeDom();
      try {
        const items = Array.from({ length: 133 }, (_, index) => index);
        const list = createVirtualList<number>({
          items,
          rowHeight: 120,
          columns: 4,
          renderRow: (value) => el("button", { dataset: { card: String(value) }, text: String(value) }),
        });
        const container = list.element;
        if (!(container instanceof FakeElement)) throw new Error("expected fake element");

        // 뷰포트/스크롤을 부여하면 행 단위로 윈도잉된다 (rows=34, visible 4행 + overscan).
        (container as unknown as { clientHeight: number }).clientHeight = 400;
        (container as unknown as { scrollTop: number }).scrollTop = 0;
        list.render();
        const rowsHost = container.querySelector(".db-virtual-rows");
        const renderedCount = rowsHost?.childNodes.length ?? 0;
        expect(renderedCount).toBeGreaterThan(0);
        expect(renderedCount).toBeLessThan(133);
        expect(renderedCount % 4).toBe(0);

        // 스페이서는 '행' 단위 — 상단 0행, 하단 (34 - endRow)행.
        const topSpacer = container.querySelector(".db-virtual-spacer-top");
        const bottomSpacer = container.querySelector(".db-virtual-spacer-bottom");
        expect(topSpacer?.style.height).toBe("0px");
        const endRow = Math.ceil(renderedCount / 4);
        expect(bottomSpacer?.style.height).toBe(`${(34 - endRow) * 120}px`);

        // CSS 그리드용 커스텀 프로퍼티가 컨테이너에 심긴다.
        expect(container.style.getPropertyValue("--db-gallery-columns")).toBe("4");
      } finally {
        restore();
      }
    });

    it("supports a columns resolver function called with the container (width-responsive)", () => {
      const restore = installFakeDom();
      try {
        const items = Array.from({ length: 133 }, (_, index) => index);
        const resolver = vi.fn(() => 3);
        const list = createVirtualList<number>({
          items,
          columns: resolver,
          renderRow: (value) => el("button", { dataset: { card: String(value) }, text: String(value) }),
        });
        expect(resolver.mock.calls.length).toBeGreaterThan(0);
        expect(resolver.mock.calls[0]?.[0]).toBe(list.element);
        expect(list.element.style.getPropertyValue("--db-gallery-columns")).toBe("3");
      } finally {
        restore();
      }
    });
  });
});

describe("databaseModalFooter", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  afterEach(() => {
    document.querySelector("[data-testid='database-modal']")?.remove();
    restoreDom?.();
    restoreDom = undefined;
  });
  function footerButtons(): HTMLElement[] {
    // 레코드 목록 바닥의 "최대 개수" 버튼도 같은 클래스를 재사용하므로, 모달 footer 노드 자체에서
    // 검색해 (fakeDom 셀렉터 엔진은 콤비네이터를 지원하지 않으므로) 스코프를 좁힌다.
    const footer = document.querySelector<HTMLElement>(".database-modal-footer");
    if (!footer) throw new Error("Expected database modal footer");
    return Array.from(footer.querySelectorAll<HTMLElement>(".database-footer-button"));
  }
  describe("database modal footer — honest auto-save UI", () => {
    it("states that edits auto-save and does not mention the nonexistent OK button", () => {
      openDatabaseModal("actors");

      const status = document.querySelector<HTMLElement>("[data-testid='db-footer-status']");
      expect(status?.textContent).toContain("자동 저장");
      expect(status?.textContent).not.toContain("OK");
    });

    // 도움말·되돌리기(Ctrl+Z)는 머리줄 ⋯ 안으로 옮겼다(impl-database PR-D) — 발 줄에는 저장 결정만 남는다.
    it("keeps dismissal in the header, rare actions behind the header ⋯, and only saving in the footer", () => {
      openDatabaseModal("actors");

      const labels = footerButtons().map((button) => button.textContent);
      expect(labels).toEqual(["지금 저장"]);
      const menu = document.querySelector<HTMLElement>("[data-testid='database-modal-more-menu']");
      expect(menu?.hidden).toBe(true);
      document.querySelector<HTMLElement>("[data-testid='database-modal-more']")?.click();
      expect(menu?.hidden).toBe(false);
      expect(["database-dock-toggle", "database-modal-maximize", "database-footer-help", "database-footer-undo"]
        .every((testid) => menu?.querySelector(`[data-testid='${testid}']`))).toBe(true);
      // 메뉴 밖(본문)을 누르면 닫힌다 — 열린 채로 남아 오른쪽 칸을 가리던 결함.
      document.querySelector<HTMLElement>(".database-modal-body")?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(menu?.hidden).toBe(true);
      expect(document.querySelector("[data-testid='database-footer-cancel']")).toBeNull();

      const applyButton = document.querySelector<HTMLElement>(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.apply}']`);
      expect(applyButton?.textContent).toBe("지금 저장");
    });

    // 「지금 저장」은 자동 저장과 같은 일이라 평소에는 숨고, 저장이 실패하면 다시 보인다(btn-trim-r2).
    it("hides 「지금 저장」 and the empty footer while auto-save works", () => {
      openDatabaseModal("actors");
      const applyButton = document.querySelector<HTMLElement>(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.apply}']`);
      const footer = document.querySelector<HTMLElement>(".database-modal-footer");
      expect(applyButton?.hidden).toBe(true);
      expect(footer?.hidden).toBe(true);
    });

    it("closes and keeps store edits from the header X", () => {
      openDatabaseModal("actors");
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

      document.querySelector<HTMLElement>("[data-testid='database-modal-close']")?.click();

      expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
      expect(store.getCurrent().database.actors.find((actor) => actor.id === actorId)?.name).toBe("Dirty Actor");
    });

    // 1255da55cc: 레코드 편집은 자동 저장이 이어받으므로 Escape 도 X·「닫기」처럼 바로 닫고 편집을 남긴다.
    // 닫기를 붙잡는 것은 스토어 밖의 설정집 카드 초안뿐이다.
    it("Escape closes like 닫기 and keeps store edits without a restore prompt", () => {
      openDatabaseModal("actors");
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

      document.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));

      expect(document.querySelector("[data-testid='database-dirty-prompt']")).toBeNull();
      expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
      expect(store.getCurrent().database.actors.find((actor) => actor.id === actorId)?.name).toBe("Dirty Actor");
    });
  });
});
