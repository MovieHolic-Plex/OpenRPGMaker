import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { classifyEnemyDifficulty, estimateEnemyDifficulty } from "@/editor/panels/databaseEnemyDifficulty";
import { createBlankProject } from "@/project/defaults";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { enemyResistSummary } from "@/editor/panels/databaseEnemyResistSummary";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { isolateTimers } from "./mergedTeardown";

describe("databaseEnemyDifficulty", () => {
  isolateTimers();
  describe("estimateEnemyDifficulty", () => {
    it("classifies win rate and remaining HP into three plain grades", () => {
      expect(classifyEnemyDifficulty(1, 0.9).grade).toBe("easy");
      expect(classifyEnemyDifficulty(0.8, 0.9).grade).toBe("normal");
      expect(classifyEnemyDifficulty(1, 0.3).grade).toBe("normal");
      expect(classifyEnemyDifficulty(0.3, 0.1).grade).toBe("hard");
    });

    it("returns null when there is no starting party to fight with", () => {
      const project = createBlankProject();
      project.system.startActorIds = [];
      project.session.partyActorIds = [];
      expect(estimateEnemyDifficulty(project, project.database.enemies[0]!)).toBeNull();
    });

    it("runs the same headless battle simulator as the troop tab, without mutating the project", () => {
      const project = createBlankProject();
      const before = JSON.stringify(project.database.troops);
      const slime = estimateEnemyDifficulty(project, project.database.enemies[0]!);
      expect(JSON.stringify(project.database.troops)).toBe(before);
      expect(slime?.partyLevel).toBe(project.database.enemies[0]!.level ?? 1);
      expect(slime?.samples).toBeGreaterThan(0);
      const weakest = { ...project.database.enemies[0]!, stats: { ...project.database.enemies[0]!.stats, maxHp: 1, attack: 1 } };
      const strongest = { ...weakest, stats: { ...weakest.stats, maxHp: 99999, attack: 999, defense: 999 } };
      expect(estimateEnemyDifficulty(project, weakest)?.grade).toBe("easy");
      expect(estimateEnemyDifficulty(project, strongest)?.grade).toBe("hard");
    });
  });
});

describe("databaseEnemyResistSummary", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function firstEnemy(): EnemyRecord {
    const enemy = store.getCurrent().database.enemies[0];
    if (!enemy) throw new Error("missing default enemy");
    return enemy;
  }
  function renderEnemyForm(): FakeElement {
    const form = document.createElement("section") as unknown as FakeElement;
    const rerender = (): void => {
      form.replaceChildren();
      const live = store.getCurrent().database.enemies.find((entry) => entry.id === firstEnemy().id)!;
      renderEnemyRecordForm(form as unknown as HTMLElement, live, rerender);
    };
    rerender();
    return form;
  }
  function allByDataset(root: FakeElement, key: string): FakeElement[] {
    const found: FakeElement[] = [];
    const walk = (node: FakeElement): void => {
      if (node.dataset[key] !== undefined) found.push(node);
      for (const child of node.children as unknown as FakeElement[]) walk(child);
    };
    walk(root);
    return found;
  }
  describe("enemy 약점·저항 summary", () => {
    it("lists only grades that differ from the default, in the table's own vocabulary", () => {
      const project = store.getCurrent();
      const [weakElement, resistElement] = project.database.elements ?? [];
      if (!weakElement || !resistElement) throw new Error("blank project needs two elements");
      const enemy: EnemyRecord = {
        ...firstEnemy(),
        elementRates: { [weakElement.id]: "A", [resistElement.id]: "D", ghost_element: "A" },
        stateRates: { state_death: "E", state_poison: "C", state_sleep: "A" },
      };
      const summary = enemyResistSummary(project, enemy);
      const texts = summary.highlights.map((entry) => entry.text);
      const weak = (weakElement.damageMultipliers?.A ?? 100) / 100;
      const resist = (resistElement.damageMultipliers?.D ?? 100) / 100;
      expect(texts).toContain(`${weakElement.name} ×${weak} 약점`);
      expect(texts).toContain(`${resistElement.name} ×${resist}`);
      expect(texts).toContain("전투불능 무효");
      // C → 60%: 기본(100%)과 다르므로 보인다. A(100%)는 기본과 같아 숨는다.
      expect(summary.highlights.some((entry) => entry.id === "state_poison" && entry.text.endsWith("60%만 걸림"))).toBe(project.database.states.some((state) => state.id === "state_poison"));
      expect(summary.highlights.some((entry) => entry.id === "state_sleep")).toBe(false);
      expect(summary.highlights.find((entry) => entry.kind === "dangling")?.text).toBe("목록에 없는 속성 1개");
      expect(summary.total).toBe(summary.stateCount + summary.elementCount);
    });

    it("keeps every rate row inside a collapsed full table and refreshes chips when a grade changes", () => {
      const host = renderEnemyForm();
      const card = findByTestId(host, "db-enemy-card-resist");
      const table = findByTestId(host, "db-enemy-resist-table") as unknown as { open?: boolean } | null;
      expect(card).not.toBeNull();
      expect(table?.open).toBe(false);
      // 기존 표 카드·행 testid 는 그대로 표 안에 있다.
      const tableNode = findByTestId(host, "db-enemy-resist-table")!;
      expect(findByTestId(tableNode, "db-enemy-card-state")).not.toBeNull();
      expect(findByTestId(tableNode, "db-enemy-card-element")).not.toBeNull();
      expect(findByTestId(tableNode, "db-picker-enemy-state-rate-state_death")).not.toBeNull();
      expect(findByTestId(host, "db-enemy-resist-chips")?.hidden).toBe(true);
      expect(findByTestId(host, "db-enemy-resist-note")?.textContent).toContain("모두 기본값");

      const element = store.getCurrent().database.elements?.[0];
      if (!element) throw new Error("missing element");
      const select = findByTestId(tableNode, `db-picker-enemy-element-rate-${element.id}`)!;
      select.value = "E";
      select.dispatchEvent(new Event("change", { bubbles: true }));

      expect(firstEnemy().elementRates[element.id]).toBe("E");
      const chip = findByTestId(host, `db-enemy-resist-chip-element-${element.id}`);
      expect(chip?.textContent).toContain(element.name);
      expect(findByTestId(host, "db-enemy-resist-chips")?.hidden).toBe(false);
      expect(findByTestId(host, "db-enemy-resist-note")?.textContent).toMatch(/^나머지 \d+개는 기본값입니다\.$/u);

      chip?.dispatchEvent(new Event("click", { bubbles: true }));
      expect((findByTestId(host, "db-enemy-resist-table") as unknown as { open?: boolean }).open).toBe(true);
    });

    it("shows every enemy card, including the ones beginner mode used to hide", () => {
      const host = renderEnemyForm();
      for (const id of [
        "db-enemy-card-critical", "db-enemy-card-options", "db-enemy-card-action-combat", "db-enemy-card-species",
        "db-enemy-card-resist", "db-enemy-card-stats", "db-enemy-card-rewards", "db-enemy-graphic-set",
      ]) {
        expect(findByTestId(host, id), id).not.toBeNull();
      }
      expect(allByDataset(host, "dbUx")).toEqual([]);
      // 치명타 힌트는 「N번에 1번 (x%)」 말투다.
      const critical = store.getCurrent().database.enemies[0]!.criticalHit;
      const hint = findByTestId(host, "db-enemy-card-critical")?.textContent ?? "";
      expect(hint).toContain(critical.enabled ? `${critical.oneIn}번에 1번` : "치명타 사용 안 함");
      expect(hint).not.toContain("1/");
    });
  });
});

describe("databaseEnemySpeciesPanel", () => {
  isolateTimers();
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
});
