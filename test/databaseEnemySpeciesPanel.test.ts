import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { createBlankProject } from "@/project/defaults";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
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
  store.replace(createBlankProject());
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

function firstEnemy(): EnemyRecord {
  const enemy = store.getCurrent().database.enemies[0];
  if (!enemy) throw new Error("missing default enemy");
  return enemy;
}

describe("enemy species panel (G002 Phase 2d)", () => {
  it("warns when speciesId is empty and monster collection is enabled", () => {
    store.update((project) => {
      project.system.monsterCollection = true;
      const enemy = project.database.enemies[0];
      if (enemy) enemy.speciesId = undefined;
    });
    expect((store.getCurrent().database.monsterSpecies ?? []).length).toBeGreaterThan(0);

    const host = renderEnemyForm();
    const warn = findByTestId(host, "db-enemy-species-unset-warn");
    expect(warn).not.toBeNull();
    expect(warn?.textContent).toBe("포획 종족 미설정");
    expect(findByTestId(host, "db-enemy-species-missing-error")).toBeNull();
    expect(findByTestId(host, "db-enemy-species-graphic-mismatch")).toBeNull();
    expect(findByTestId(host, "db-enemy-species-copy-graphic")).toBeNull();
  });

  it("shows an error chip when speciesId points at a missing species", () => {
    store.update((project) => {
      const enemy = project.database.enemies[0];
      if (enemy) enemy.speciesId = "species_does_not_exist";
    });

    const host = renderEnemyForm();
    const error = findByTestId(host, "db-enemy-species-missing-error");
    expect(error).not.toBeNull();
    expect(error?.textContent).toBe("존재하지 않는 종족");
    expect(findByTestId(host, "db-enemy-species-unset-warn")).toBeNull();
    expect(findByTestId(host, "db-enemy-species-copy-graphic")).toBeNull();
  });

  it("shows graphic mismatch info + copy button, and copy writes species graphic onto the enemy", () => {
    const enemy = firstEnemy();
    const speciesId = enemy.speciesId ?? store.getCurrent().database.monsterSpecies?.[0]?.id;
    if (!speciesId) throw new Error("missing species id");

    store.update((project) => {
      project.database.monsterSpecies ??= [];
      const species = project.database.monsterSpecies.find((entry) => entry.id === speciesId);
      if (species) {
        species.graphic = {
          ...species.graphic,
          monsterResourceId: "species-graphic-resource-x",
          graphicHue: 90,
          transparent: true,
          flying: true,
        };
      } else {
        project.database.monsterSpecies.push(
          normalizeMonsterSpeciesRecord({
            id: speciesId,
            name: "테스트 종족",
            graphic: {
              monsterResourceId: "species-graphic-resource-x",
              graphicHue: 90,
              transparent: true,
              flying: true,
            },
          })
        );
      }
      const target = project.database.enemies.find((entry) => entry.id === enemy.id);
      if (target) {
        target.speciesId = speciesId;
        target.monsterResourceId = "enemy-only-resource";
        target.graphicHue = 0;
        target.transparent = false;
        target.flying = false;
      }
    });

    const host = renderEnemyForm(enemy.id);
    const info = findByTestId(host, "db-enemy-species-graphic-mismatch");
    expect(info).not.toBeNull();
    expect(info?.dataset.speciesStatus).toBe("info");

    const copy = findByTestId(host, "db-enemy-species-copy-graphic");
    expect(copy).not.toBeNull();
    expect(copy).toBeInstanceOf(HTMLButtonElement);
    expect(copy?.tagName).toBe("BUTTON");
    expect(copy?.getAttribute("type")).toBe("button");
    expect(copy?.disabled).toBe(false);
    copy?.click();

    const updated = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id);
    expect(updated?.monsterResourceId).toBe("species-graphic-resource-x");
    expect(updated?.graphicHue).toBe(90);
    expect(updated?.transparent).toBe(true);
    expect(updated?.flying).toBe(true);

    // After copy + rerender, mismatch controls should disappear.
    expect(findByTestId(host, "db-enemy-species-graphic-mismatch")).toBeNull();
    expect(findByTestId(host, "db-enemy-species-copy-graphic")).toBeNull();
  });

  it("hides the unset warning when species catalog is empty", () => {
    store.update((project) => {
      project.database.monsterSpecies = [];
      const enemy = project.database.enemies[0];
      if (enemy) enemy.speciesId = undefined;
    });

    const host = renderEnemyForm();
    expect(findByTestId(host, "db-enemy-species-unset-warn")).toBeNull();
  });
  it("distinguishes implicit state effectiveness from explicit C and supports clearing", () => {
    const enemyId = firstEnemy().id;
    const stateId = store.getCurrent().database.states[0]!.id;
    store.update((project) => { project.database.enemies[0]!.stateRates = {}; });
    const host = renderEnemyForm(enemyId);
    const control = findByTestId(host, `db-picker-enemy-state-rate-${stateId}`)!;
    expect(control.value).toBe("");
    expect(control.textContent).toContain("미지정 · 적용 100%");
    expect(control.textContent).toContain("C · 적용 60%");
    expect(firstEnemy().stateRates[stateId]).toBeUndefined();
    control.value = "C"; control.dispatchEvent(new Event("change"));
    expect(firstEnemy().stateRates[stateId]).toBe("C");
    control.value = ""; control.dispatchEvent(new Event("change"));
    expect(firstEnemy().stateRates[stateId]).toBeUndefined();
  });

  it("does not warn about uncapturable enemies in a combat-only project", () => {
    store.update((project) => { project.system.monsterCollection = false; project.database.enemies[0]!.speciesId = undefined; });
    expect(findByTestId(renderEnemyForm(), "db-enemy-species-unset-warn")).toBeNull();
  });

});
