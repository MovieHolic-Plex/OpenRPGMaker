import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
  switchDatabaseActiveTab,
} from "@/editor/panels/database";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import {
  getSelectedMonsterSpeciesId,
  setSelectedMonsterSpeciesId,
} from "@/editor/panels/databaseMonsterSpeciesView";
import { selectedRecordIdForSession, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;
const openDatabaseModalSpy = vi.fn();

vi.mock("@/editor/panels/databaseModal", () => ({
  openDatabaseModal: (...args: unknown[]) => openDatabaseModalSpy(...args),
}));

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  openDatabaseModalSpy.mockReset();
  store.replace(createBlankProject());
  resetMapEditHistory();
  setSelectedMonsterSpeciesId(undefined);
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

function restoreBrowserGlobal<Key extends keyof FakeBrowserGlobals>(key: Key, value: FakeBrowserGlobals[Key]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }
  Object.defineProperty(globalThis, key, { configurable: true, value });
}

function firstEnemy(): EnemyRecord {
  const enemy = store.getCurrent().database.enemies[0];
  if (!enemy) throw new Error("missing default enemy");
  return enemy;
}

function renderEnemyForm(enemyId?: string): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  const project = store.getCurrent();
  const enemy = project.database.enemies.find((entry) => entry.id === enemyId) ?? project.database.enemies[0];
  if (!enemy) throw new Error("missing enemy");
  const rerender = (): void => {
    form.replaceChildren();
    const current = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id) ?? enemy;
    renderEnemyRecordForm(form as unknown as HTMLElement, current, rerender);
  };
  rerender();
  return form;
}

describe("database cross-tab navigation (G006 Phase 4)", () => {
  it("selects species/enemy + switches tab without openDatabaseModal", () => {
    const speciesId = store.getCurrent().database.monsterSpecies?.[0]?.id;
    const enemyId = firstEnemy().id;
    if (!speciesId) throw new Error("missing default species");

    const panelRoot = document.createElement("div") as unknown as FakeElement;
    panelRoot.className = "database-modal-body";
    renderDatabasePanel(panelRoot as unknown as HTMLElement);

    setSelectedMonsterSpeciesId(speciesId);
    setDatabaseActiveTab("monsterSpecies");
    expect(getSelectedMonsterSpeciesId()).toBe(speciesId);
    expect(getDatabaseActiveTab()).toBe("monsterSpecies");

    setSelectedRecordId("enemies", enemyId);
    setDatabaseActiveTab("enemies");
    expect(selectedRecordIdForSession("enemies")).toBe(enemyId);
    expect(getDatabaseActiveTab()).toBe("enemies");

    // In-modal helper: set tab + sync header + refresh body without remounting modal.
    setSelectedMonsterSpeciesId(speciesId);
    switchDatabaseActiveTab("monsterSpecies", panelRoot as unknown as HTMLElement);
    expect(getDatabaseActiveTab()).toBe("monsterSpecies");
    expect(getSelectedMonsterSpeciesId()).toBe(speciesId);

    const speciesTab = findByTestId(panelRoot, "db-tab-monster-species");
    expect(speciesTab?.classList.contains("active")).toBe(true);
    const enemiesTab = findByTestId(panelRoot, "db-tab-enemies");
    expect(enemiesTab?.classList.contains("active")).toBe(false);

    expect(openDatabaseModalSpy).not.toHaveBeenCalled();
  });

  it("create-species-from-enemy is a single undo unit for species append + enemy.speciesId", () => {
    const enemy = firstEnemy();
    store.update((project) => {
      const target = project.database.enemies.find((entry) => entry.id === enemy.id);
      if (target) {
        target.speciesId = undefined;
        target.name = "크로스탭 슬라임";
        target.monsterResourceId = "enemy-seed-graphic";
        target.graphicHue = 42;
        target.transparent = true;
        target.flying = true;
        target.stats = { maxHp: 77, maxMp: 11, attack: 13, defense: 14, mind: 15, agility: 16 };
      }
    });
    resetMapEditHistory();

    const beforeCount = (store.getCurrent().database.monsterSpecies ?? []).length;
    expect(getMapEditHistoryState().canUndo).toBe(false);

    const host = renderEnemyForm(enemy.id);
    const create = findByTestId(host, "db-enemy-create-species");
    expect(create).not.toBeNull();
    expect(create).toBeInstanceOf(HTMLButtonElement);
    expect(create?.tagName).toBe("BUTTON");
    expect(create?.getAttribute("type")).toBe("button");
    expect(create?.disabled).toBe(false);
    create?.click();

    const after = store.getCurrent();
    const species = after.database.monsterSpecies ?? [];
    expect(species).toHaveLength(beforeCount + 1);
    const created = species.at(-1);
    if (!created) throw new Error("missing created species");
    expect(created.name).toBe("크로스탭 슬라임");
    expect(created.graphic.monsterResourceId).toBe("enemy-seed-graphic");
    expect(created.graphic.graphicHue).toBe(42);
    expect(created.graphic.transparent).toBe(true);
    expect(created.graphic.flying).toBe(true);
    expect(created.baseStats).toEqual({ maxHp: 77, maxMp: 11, attack: 13, defense: 14, mind: 15, agility: 16 });
    expect(created.types).toBeUndefined();
    expect(created.captureRate).toBe(0.3);
    expect(after.database.enemies.find((entry) => entry.id === enemy.id)?.speciesId).toBe(created.id);
    expect(getSelectedMonsterSpeciesId()).toBe(created.id);
    expect(getMapEditHistoryState().canUndo).toBe(true);

    const undone = undoMapEdit();
    expect(undone).toBe(true);
    const restored = store.getCurrent();
    expect(restored.database.monsterSpecies).toHaveLength(beforeCount);
    expect(restored.database.monsterSpecies?.some((entry) => entry.id === created.id)).toBe(false);
    expect(restored.database.enemies.find((entry) => entry.id === enemy.id)?.speciesId).toBeUndefined();
    // One snapshot unit — second undo must not exist for this create.
    expect(getMapEditHistoryState().canUndo).toBe(false);
    expect(openDatabaseModalSpy).not.toHaveBeenCalled();
  });
});
