import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { classifyEnemyDifficulty, estimateEnemyDifficulty } from "@/editor/panels/databaseEnemyDifficulty";
import { createBlankProject } from "@/project/defaults";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { store } from "@/project/store";
import type { EnemyRecord, Project, BattleEventPageRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { enemyResistSummary } from "@/editor/panels/databaseEnemyResistSummary";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { resolveBattleBackdrop, terrainBattleBackgroundAt } from "@/battle/battleBackdrop";
import { hitFeelFromActionResult, resolveBattlerPose } from "@/battle/battlePose";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { createBattleRuntime, isBattlerIncapacitated } from "@/battle/runtime";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID, normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { type MutableBattler, enemyBattlers } from "@/battle/battleBattlers";
import type { TroopRecord } from "@/project/types/database";
import { deserialize, serialize } from "@/project/io";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { updateEnemyRecord, updateSkillRecord } from "@/editor/databaseRecordMutators";
import { evaluateDamageFormula, FORMULA_PREVIEW_CONTEXT } from "@/battle/damageFormula";
import fixture from "./fixtures/projects/battle-v3.json";
import battleFixture from "./fixtures/projects/battle-v3.json";
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

describe("databaseEnemyFactionPanel", () => {
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
  function renderEnemyForm(): FakeElement {
    const form = document.createElement("section") as unknown as FakeElement;
    const enemy = firstEnemy();
    const rerender = (): void => {
      form.replaceChildren();
      renderEnemyRecordForm(form as unknown as HTMLElement, liveEnemy(enemy.id), rerender);
    };
    rerender();
    return form;
  }
  function firstEnemy(): EnemyRecord {
    const enemy = store.getCurrent().database.enemies[0];
    if (!enemy) throw new Error("missing default enemy");
    return enemy;
  }
  function liveEnemy(id: string): EnemyRecord {
    const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === id);
    if (!enemy) throw new Error(`missing enemy: ${id}`);
    return enemy;
  }
  function changeSelect(select: FakeElement, value: string): void {
    select.value = value;
    select.dispatchEvent(new Event("change"));
  }
  describe("enemy faction assignment panel", () => {
    it("shows the effective enemy faction for an empty sparse value", () => {
      const host = renderEnemyForm();
      const select = findByTestId(host, "db-picker-enemy-faction");
      const effective = findByTestId(host, "db-enemy-faction-effective");

      expect(select?.value).toBe("enemy");
      expect(effective?.dataset.effectiveFactionId).toBe("enemy");
      expect(effective?.textContent).toContain("미저장 · 기본 적 진영으로 전투");
      expect(findByTestId(host, "db-enemy-faction-default-clears")?.textContent).toContain("저장된 소속 진영 값을 지웁니다");
      expect(findByTestId(host, "db-enemy-faction-guide")?.textContent).toContain("[진영] 탭");
      expect(firstEnemy().factionId).toBeUndefined();
    });

    it("surfaces a dangling stored id without mutating it during render", () => {
      const project = createBlankProject();
      project.database.enemies[0]!.factionId = "deleted_guard";
      store.replace(project);
      const before = JSON.stringify(firstEnemy());

      const host = renderEnemyForm();
      const select = findByTestId(host, "db-picker-enemy-faction");
      const effective = findByTestId(host, "db-enemy-faction-effective");
      const missing = findByTestId(host, "db-enemy-faction-missing");

      expect(select?.value).toBe("deleted_guard");
      expect(select?.textContent).toContain("deleted_guard · 존재하지 않는 진영");
      expect(effective?.dataset.storedFactionId).toBe("deleted_guard");
      expect(effective?.dataset.effectiveFactionId).toBe("enemy");
      expect(effective?.textContent).toContain("존재하지 않는 진영deleted_guard저장됨 · 기본 적 진영으로 전투");
      expect(missing?.textContent).toContain("저장된 진영 ID 'deleted_guard'가 존재하지 않는 진영");
      expect(missing?.textContent).toContain("런타임에서는 기본 적 진영으로 전투");
      expect(findByTestId(host, "db-enemy-hero")?.textContent).toContain("진영 deleted_guard · 존재하지 않는 진영 · 기본 적 진영으로 전투");
      expect(JSON.stringify(firstEnemy())).toBe(before);
      expect(firstEnemy().factionId).toBe("deleted_guard");
    });

    it("repairs a dangling faction by clearing the stored value", () => {
      const project = createBlankProject();
      project.database.enemies[0]!.factionId = "deleted_guard";
      store.replace(project);
      const host = renderEnemyForm();

      findByTestId(host, "db-enemy-faction-clear-missing")?.click();

      expect(firstEnemy().factionId).toBeUndefined();
      expect(findByTestId(host, "db-enemy-faction-missing")).toBeNull();
      expect(findByTestId(host, "db-picker-enemy-faction")?.value).toBe("enemy");
    });

    it("repairs a dangling faction by assigning an existing faction", () => {
      const project = createBlankProject();
      project.factions = { defs: [{ id: "guard", name: "경비대" }], relations: [] };
      project.database.enemies[0]!.factionId = "deleted_guard";
      store.replace(project);
      const host = renderEnemyForm();
      const select = findByTestId(host, "db-picker-enemy-faction");
      if (!select) throw new Error("missing faction select");

      changeSelect(select, "guard");

      expect(firstEnemy().factionId).toBe("guard");
      expect(findByTestId(host, "db-enemy-faction-missing")).toBeNull();
      expect(findByTestId(host, "db-picker-enemy-faction")?.value).toBe("guard");
    });

    it("writes an authored faction through the enemy record mutation path", () => {
      const project = createBlankProject();
      project.factions = { defs: [{ id: "bandit", name: "산적" }], relations: [] };
      store.replace(project);
      const host = renderEnemyForm();
      const select = findByTestId(host, "db-picker-enemy-faction");
      if (!select) throw new Error("missing faction select");

      changeSelect(select, "bandit");

      expect(firstEnemy().factionId).toBe("bandit");
      expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("레코드에 저장됨");
      expect(findByTestId(host, "db-picker-enemy-faction")?.value).toBe("bandit");
    });

    it("clears an explicitly stored enemy value only after an authored round trip and explains it", () => {
      const project = createBlankProject();
      project.factions = { defs: [{ id: "bandit", name: "산적" }], relations: [] };
      project.database.enemies[0]!.factionId = "enemy";
      store.replace(project);
      const host = renderEnemyForm();
      const select = findByTestId(host, "db-picker-enemy-faction");
      if (!select) throw new Error("missing faction select");

      expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("레코드에 저장됨");
      expect(findByTestId(host, "db-enemy-faction-default-clears")?.textContent).toContain("저장된 소속 진영 값을 지웁니다");

      changeSelect(select, "bandit");
      const changed = findByTestId(host, "db-picker-enemy-faction");
      if (!changed) throw new Error("missing rerendered faction select");
      changeSelect(changed, "enemy");

      expect(firstEnemy().factionId).toBeUndefined();
      expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("미저장 · 기본 적 진영으로 전투");
    });

    it("clears the authored key when returning to the effective enemy default and explains that behavior", () => {
      const project = createBlankProject();
      project.factions = { defs: [{ id: "bandit", name: "산적" }], relations: [] };
      project.database.enemies[0]!.factionId = "bandit";
      store.replace(project);
      const host = renderEnemyForm();
      const select = findByTestId(host, "db-picker-enemy-faction");
      if (!select) throw new Error("missing faction select");

      expect(findByTestId(host, "db-enemy-faction-default-clears")?.textContent).toBe(
        "기본값을 고르면 저장된 소속 진영 값을 지웁니다.",
      );
      changeSelect(select, "enemy");

      expect(firstEnemy().factionId).toBeUndefined();
      expect(findByTestId(host, "db-enemy-faction-effective")?.dataset.effectiveFactionId).toBe("enemy");
      expect(findByTestId(host, "db-enemy-faction-effective")?.textContent).toContain("미저장 · 기본 적 진영으로 전투");
    });

    it("reads player and peer stances from the resolved runtime faction table", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [
          { id: "bandit", name: "산적", color: "#76512d" },
          { id: "guard", name: "경비대" },
        ],
        relations: [
          { a: "bandit", b: "guard", stance: -1 },
        ],
      };
      project.database.enemies[0]!.factionId = "bandit";
      store.replace(project);
      const host = renderEnemyForm();

      const player = findByTestId(host, "db-enemy-faction-stance-player");
      const guard = findByTestId(host, "db-enemy-faction-stance-guard");
      expect(player?.dataset.stance).toBe("0");
      expect(player?.textContent).toBe("플레이어 기준 0 · 중립");
      expect(guard?.dataset.stance).toBe("-1");
      expect(guard?.textContent).toBe("경비대 -1 · 적");
      expect(guard?.style["--db-enemy-faction-stance-color"]).toBe("#e0564a");
      expect(findByTestId(host, "db-enemy-faction-color")?.style["--db-enemy-faction-color"]).toBe("#76512d");
    });

    it("keeps all seven authored hostile relationships in the primary list", () => {
      const project = createBlankProject();
      project.factions = {
        defs: Array.from({ length: 7 }, (_, index) => ({
          id: `faction_${String.fromCharCode(97 + index)}`,
          name: `진영 ${String.fromCharCode(65 + index)}`,
        })),
        relations: [
          { a: "faction_a", b: "enemy", stance: -1 },
          ...Array.from({ length: 6 }, (_, index) => ({
            a: "faction_a",
            b: `faction_${String.fromCharCode(98 + index)}`,
            stance: -1 as const,
          })),
        ],
      };
      project.database.enemies[0]!.factionId = "faction_a";
      store.replace(project);
      const host = renderEnemyForm();

      const primary = findByTestId(host, "db-enemy-faction-relationships-primary");

      expect(primary?.querySelectorAll(".db-enemy-faction-stance")).toHaveLength(7);
      expect(primary?.textContent).toContain("적 -1 · 적");
      for (const id of ["b", "c", "d", "e", "f", "g"]) {
        expect(findByTestId(primary ?? host, `db-enemy-faction-stance-faction_${id}`)?.dataset.stance).toBe("-1");
      }
      expect(findByTestId(host, "db-enemy-faction-relationships-more")).toBeNull();
    });

    it("keeps neutral peers expanded when this faction attacks them by aggression", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [
          { id: "berserkers", name: "광전사", aggression: 2 },
          ...Array.from({ length: 8 }, (_, index) => ({ id: `neutral_${index + 1}`, name: `중립 ${index + 1}` })),
        ],
        relations: [],
      };
      project.database.enemies[0]!.factionId = "berserkers";
      store.replace(project);
      const host = renderEnemyForm();

      const primary = findByTestId(host, "db-enemy-faction-relationships-primary");

      expect(primary?.querySelectorAll(".db-enemy-faction-stance")).toHaveLength(9);
      expect(findByTestId(host, "db-enemy-faction-relationships-more")).toBeNull();
    });

    it("keeps a neutral peer expanded when that peer would attack this faction", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [
          { id: "villagers", name: "주민", aggression: 0 },
          ...Array.from({ length: 7 }, (_, index) => ({ id: `neutral_${index + 1}`, name: `중립 ${index + 1}`, aggression: 0 as const })),
          { id: "frenzied", name: "광폭단", aggression: 3 },
        ],
        relations: [],
      };
      project.database.enemies[0]!.factionId = "villagers";
      store.replace(project);
      const host = renderEnemyForm();

      const primary = findByTestId(host, "db-enemy-faction-relationships-primary");
      const collapsed = findByTestId(host, "db-enemy-faction-relationships-more");

      expect(findByTestId(primary ?? host, "db-enemy-faction-stance-frenzied")).not.toBeNull();
      expect(findByTestId(collapsed ?? host, "db-enemy-faction-stance-frenzied")).toBeNull();
    });

    it("bounds peer pills, prioritizes authored relationships, and collapses the neutral remainder", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [
          { id: "bandit", name: "산적" },
          ...Array.from({ length: 7 }, (_, index) => ({ id: `neutral_${index + 1}`, name: `중립 ${index + 1}` })),
          { id: "guard", name: "경비대" },
          { id: "trader", name: "상인회" },
        ],
        relations: [
          { a: "bandit", b: "guard", stance: -1 },
          { a: "bandit", b: "trader", stance: 0 },
        ],
      };
      project.database.enemies[0]!.factionId = "bandit";
      store.replace(project);
      const host = renderEnemyForm();

      const primary = findByTestId(host, "db-enemy-faction-relationships-primary");
      const more = findByTestId(host, "db-enemy-faction-relationships-more");
      const collapsedBody = more?.querySelector(".db-ws-card-body");
      const toggle = more?.querySelector("button");

      expect(primary?.querySelectorAll(".db-enemy-faction-stance")).toHaveLength(7);
      expect(primary?.textContent).toContain("경비대 -1 · 적");
      expect(primary?.textContent).toContain("상인회 0 · 중립");
      expect(more?.textContent).toContain("서로 선공하지 않는 관계 3개");
      expect(more?.textContent).toContain("중립 3개 포함");
      expect(more?.dataset.neutralCount).toBe("3");
      expect(collapsedBody?.getAttribute("hidden")).toBe("");
      expect(toggle?.getAttribute("aria-label")).toBe("서로 선공하지 않는 관계 3개 펼치기");
      expect(findByTestId(host, "db-enemy-faction-stance-neutral_7")?.textContent).toBe("중립 7 0 · 중립");

      toggle?.click();
      expect(collapsedBody?.getAttribute("hidden")).toBeNull();
      expect(toggle?.getAttribute("aria-label")).toBe("서로 선공하지 않는 관계 3개 접기");
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

describe("databaseEnemyTroopRecordModel", () => {
  isolateTimers();
  describe("battlePoseHitFeelBackdropEvents", () => {
    isolateTimers();
    describe("battle poses", () => {
      it("maps idle, attack, hit, defend, and dead from action result", () => {
        const idle = resolveBattlerPose({
          battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: false },
        });
        expect(idle).toBe("idle");

        const attack = resolveBattlerPose({
          battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: false },
          lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 5, critical: false },
        });
        expect(attack).toBe("attack");

        const hit = resolveBattlerPose({
          battler: { id: "e1", recordId: "enemy_slime", defeated: false, defending: false },
          lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 5, critical: false },
        });
        expect(hit).toBe("hit");

        const defend = resolveBattlerPose({
          battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: true },
        });
        expect(defend).toBe("defend");

        const dead = resolveBattlerPose({
          battler: { id: "e1", recordId: "enemy_slime", defeated: true, defending: false },
          lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 99, critical: true },
        });
        expect(dead).toBe("dead");
      });

      it("surfaces attack/hit poses on a real runtime snapshot after an attack", () => {
        const project = createBlankProject();
        const troopId = project.database.troops[0]?.id;
        if (!troopId) throw new Error("missing default troop");
        for (const enemy of project.database.enemies) {
          enemy.stats.maxHp = 9999;
          enemy.stats.defense = 1;
          enemy.stats.agility = 1;
        }
        // Gauge mode: after actor acts, phase is charging and lastActionResult is still the actor's blow
        // (enemy has not ticked yet).
        const rt = createBattleRuntime({ project, troopId, canEscape: true, canLose: true, battleFlow: "gauge" });
        for (let i = 0; i < 20_000; i += 1) {
          rt.tick(50);
          if (rt.snapshot().phase === "actorCommand") break;
        }
        let snap = rt.snapshot();
        expect(snap.phase).toBe("actorCommand");
        const eid = snap.enemies[0]?.id;
        const aid = snap.activeActorId;
        if (!eid || !aid) throw new Error("missing combatants");
        rt.performActorCommand({ kind: "attack", targetEnemyId: eid });
        snap = rt.snapshot();
        const actor = snap.actors.find((entry) => entry.recordId === aid);
        const enemy = snap.enemies.find((entry) => entry.id === eid);
        expect(snap.lastActionResult?.userRecordId).toBe(aid);
        expect(actor?.pose).toBe("attack");
        expect(enemy?.defeated).toBe(false);
        if (snap.lastActionResult?.hit) {
          expect(enemy?.pose).toBe("hit");
          expect(snap.hitFeel?.targetId).toBe(eid);
        }
      });
    });
    describe("hit-feel helper", () => {
      it("builds hit-feel only for damaging hits", () => {
        expect(hitFeelFromActionResult(undefined)).toBeUndefined();
        expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: false, amount: 0, critical: false })).toBeUndefined();
        expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: true, amount: 0, critical: false })).toBeUndefined();
        expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: true, amount: 12, critical: true })).toEqual({
          targetId: "e",
          amount: 12,
          critical: true,
          healing: false,
        });
      });
    });
    describe("battle backdrop resolution", () => {
      it("uses troop preview when set, otherwise terrain at location, else forest", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        if (!map) throw new Error("missing start map");
        const tileset = project.tilesets[map.tilesetId];
        if (!tileset) throw new Error("missing tileset");

        // Author terrain tag 1 on the start tile → grassland dawn backdrop.
        const x = project.startPos.x;
        const y = project.startPos.y;
        const tile = map.lowerTiles[y * map.width + x] ?? 0;
        if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
        while (tileset.terrain.length <= tile) tileset.terrain.push(0);
        tileset.terrain[tile] = 1;
        tileset.tileMeta = { ...(tileset.tileMeta ?? {}), [tile]: { ...(tileset.tileMeta?.[tile] ?? {}), terrainTag: 1 } };
        project.database.terrains = [
          {
            id: "terrain_grassland",
            name: "초원",
            damage: 0,
            encounterRatePercent: 100,
            battleBackgroundResourceId: "easyrpg-backdrop-dawn1",
            characterDisplay: "normal",
            vehiclePassage: { boat: false, ship: false, airshipLand: true },
          },
        ];

        const troop = project.database.troops[0];
        if (!troop) throw new Error("missing troop");
        delete troop.previewBackgroundResourceId;

        expect(terrainBattleBackgroundAt(project, { mapId, x, y })).toBe("easyrpg-backdrop-dawn1");
        const fromTerrain = resolveBattleBackdrop({
          project,
          troopId: troop.id,
          location: { mapId, x, y },
        });
        // EasyRPG 하늘 배경은 도트 풀밭 겹 배경 id 로 풀린다(2026-10-03).
        expect(fromTerrain).toBe("battle-scenery-plains");

        troop.previewBackgroundResourceId = "generated-battle-reference-forest";
        // 적 그룹의 숲 값은 도구가 찍는 기본값인 경우가 많아, 지형·맵이 더 구체적으로 말하면 물러난다(battleBackdrop.ts, jrpg-real-1 J08).
        expect(resolveBattleBackdrop({ project, troopId: troop.id, location: { mapId, x: project.startPos.x, y: project.startPos.y } })).toBe(
          "battle-scenery-plains"
        );
        // 다른 단서가 없으면 그 숲 값이 그대로 쓰인다.
        expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("battle-scenery-forest");

        troop.previewBackgroundResourceId = undefined;
        // Off-map / no tag → forest fallback
        expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
      });

      it("uses the monster skin fallback without overriding authored battle backgrounds", () => {
        const project = createBlankProject();
        project.system.battleUiStyle = "pokemon";
        const troop = project.database.troops[0]!;
        delete troop.previewBackgroundResourceId;
        expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("battle-skin-pokemon-backdrop");
        // 옛 숲 그림·도트 겹 배경은 포켓몬에서 줄무늬 바닥 표지로, Scarloxy 그림은 그대로 둔다.
        troop.previewBackgroundResourceId = "generated-battle-reference-forest";
        expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("battle-skin-pokemon-backdrop");
        troop.previewBackgroundResourceId = "scarloxy-backdrop-sand";
        expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("scarloxy-backdrop-sand");
        project.system.battleUiStyle = "retro2003";
        delete troop.previewBackgroundResourceId;
        expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
      });

      it("rewrites night-sky troop previews to forest via runtime create", () => {
        const project = createBlankProject();
        const troop = project.database.troops[0];
        if (!troop) throw new Error("missing troop");
        troop.previewBackgroundResourceId = "easyrpg-backdrop-night-sky1";
        // normalizeTroop on blank already rewrote; force raw id and resolve helper
        expect(
          resolveBattleBackdrop({
            project: {
              ...project,
              database: {
                ...project.database,
                troops: [{ ...troop, previewBackgroundResourceId: "easyrpg-backdrop-night-sky1" }],
              },
            },
            troopId: troop.id,
          })
        ).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
      });
    });
    describe("battle event command expansion", () => {
      function stubBattler(recordId: string): MutableBattler {
        return {
          id: recordId,
          recordId,
          name: recordId,
          maxHp: 50,
          maxMp: 10,
          attackPower: 10,
          defense: 5,
          mind: 5,
          agility: 10,
          chargeRate: 0.1,
          skillIds: [],
          hidden: false,
          hp: 50,
          mp: 10,
          gauge: 0,
          stateIds: [],
          stateTurns: {},
          defending: false,
        };
      }

      it("executes changeGold, changeExp, learnSkill, and changeParty for real", () => {
        const project = createBlankProject();
        const actorId = project.system.startActorIds[0] ?? "actor_hero";
        const troop: TroopRecord = {
          id: "troop_event_test",
          name: "event test",
          enemyIds: [],
          members: [],
          autoAlign: true,
          battleEventPages: [
            {
              id: "page1",
              name: "on start",
              conditions: [{ kind: "onRound", round: 0 }],
              span: "battle",
              runOnce: true,
              commands: [
                { kind: "changeGold", op: "+=", amount: 25 },
                { kind: "changeExp", actorId, op: "+=", amount: 40 },
                { kind: "learnSkill", actorId, skillId: project.database.skills[0]?.id ?? "skill_attack" },
                { kind: "changeParty", actorId: "actor_extra", action: "add" },
                { kind: "transfer", mapId: "nope", x: 0, y: 0 },
              ],
            },
          ],
        };
        const state = {
          switches: {} as Record<string, boolean>,
          variables: {} as Record<string, number>,
          inventory: {} as Record<string, number>,
          gold: 10,
          partyActorIds: [actorId],
          actorSkillIds: { [actorId]: [] as string[] },
          actorExperience: { [actorId]: 0 },
          actorLevels: { [actorId]: 1 },
        };
        const actors = [stubBattler(actorId)];
        const runtime = createBattleEventRuntime({
          project,
          troopRecord: troop,
          actors,
          enemies: [],
          stateIds: [],
          state,
        });
        runtime.applyTroopEvents({ turn: 0 });
        const snap = runtime.snapshot();
        expect(snap.gold).toBe(35);
        expect(snap.actorExperience?.[actorId]).toBe(40);
        expect(snap.actorSkillIds?.[actorId]).toContain(project.database.skills[0]?.id ?? "skill_attack");
        expect(snap.partyActorIds).toContain("actor_extra");
        const logs = runtime.logs();
        expect(logs.some((entry) => entry.kind === "unsupported" && entry.detail === "transfer")).toBe(true);
        expect(logs.some((entry) => entry.kind === "message" && entry.detail?.startsWith("gold→"))).toBe(true);
      });
    });
  });
  describe("feature16CombatSchema", () => {
    isolateTimers();
    describe('feature16 combat authoring persistence', () => {
      it('roundtrips authored rules through the editor mutator and project wire load/save', () => {
        const project = deserialize(JSON.stringify(fixture));
        project.switches.push({ id: 'bonus', name: '추가 보상' });
        project.database.states.push({ ...project.database.states[0], id: 'poison', name: '독' });
        const id = project.database.skills[0].id;
        const patch = { damageFormula: 'power + a.atk * 2 - b.def', criticalRate: 0, criticalMultiplier: 2.5, cooldownTurns: 2, hitSequence: [1, 0.5, 2], hitRate: 74 };
        updateSkillRecord(project.database, id, patch);
        project.database.enemies[0] = normalizeEnemyRecord({ ...project.database.enemies[0], actions: [
          { ...project.database.enemies[0].actions[0], skillId: id, condition: { kind: 'mp', minPercent: 10, maxPercent: 80 } },
        ], rewards: { ...project.database.enemies[0].rewards, drops: [
          { itemId: project.database.items[0].id, ratePercent: 45, quantity: 2, condition: { kind: 'switch', switchId: 'bonus', value: true } },
          { itemId: project.database.items[0].id, ratePercent: 100, quantity: 1, condition: { kind: 'status', stateId: 'poison', present: false } },
        ] } });
        const loaded = deserialize(serialize(project));
        expect(loaded.database.skills.find(skill => skill.id === id)).toMatchObject(patch);
        expect(loaded.database.enemies[0].actions[0].condition).toEqual({ kind: 'mp', minPercent: 10, maxPercent: 80 });
        expect(loaded.database.enemies[0].rewards.drops).toEqual(project.database.enemies[0].rewards.drops);
        expect(deserialize(serialize(loaded)).database.skills.find(skill => skill.id === id)).toMatchObject(patch);
      });
      it('keeps omitted defaults and clamps malformed optional numbers', () => {
        const legacy = normalizeSkillRecord({ id: 'legacy', name: 'Legacy' });
        expect(legacy.damageFormula).toBeUndefined();
        expect(legacy.criticalRate).toBeUndefined();
        expect(legacy.hitSequence).toBeUndefined();
        expect(legacy.cooldownTurns).toBeUndefined();
        expect(normalizeSkillRecord({ ...legacy, criticalRate: 300, cooldownTurns: -5, hitSequence: [NaN, -2, 50] })).toMatchObject({ criticalRate: 100, cooldownTurns: 0, hitSequence: [1, 0, 10] });
        expect(normalizeEnemyRecord({ id: 'e', name: 'E' }).rewards.drops).toBeUndefined();
        expect(normalizeEnemyRecord({ id: 'e', name: 'E', rewards: { exp: 0, gold: 0, dropRatePercent: 100, drops: [] } }).rewards.drops).toEqual([]);
      });
    });
    describe('database form combat fields', () => {
      it('keeps the skill and enemy fields the database forms write', () => {
        const project = deserialize(JSON.stringify(fixture));
        const id = project.database.skills[0].id;
        const name = project.database.skills[0].name;
        updateSkillRecord(project.database, id, {
          gaugeShift: -20,
          chargeTurns: 2,
          summonResourceId: 'party-pixel-animal-0',
          learnable: true,
          inputSequence: { keys: ['up', 'confirm'], timeLimitMs: 2500, successMultiplier: 2, failMultiplier: 0.25 },
          battleGimmick: { pattern: 'dash', durationTurns: 3 },
        });
        const saved = project.database.skills.find((skill) => skill.id === id);
        expect(saved?.name).toBe(name);
        expect(saved).toMatchObject({
          gaugeShift: -20,
          chargeTurns: 2,
          summonResourceId: 'party-pixel-animal-0',
          learnable: true,
          inputSequence: { keys: ['up', 'confirm'], timeLimitMs: 2500, successMultiplier: 2, failMultiplier: 0.25 },
          battleGimmick: { pattern: 'dash', durationTurns: 3 },
        });
        updateSkillRecord(project.database, id, {
          gaugeShift: undefined,
          chargeTurns: undefined,
          summonResourceId: undefined,
          learnable: undefined,
          inputSequence: undefined,
          battleGimmick: undefined,
        });
        const cleared = project.database.skills.find((skill) => skill.id === id);
        expect(cleared?.gaugeShift).toBeUndefined();
        expect(cleared?.chargeTurns).toBeUndefined();
        expect(cleared?.summonResourceId).toBeUndefined();
        expect(cleared?.learnable).toBeUndefined();
        expect(cleared?.inputSequence).toBeUndefined();
        expect(cleared?.battleGimmick).toBeUndefined();

        const enemy = project.database.enemies[0];
        const itemId = project.database.items[0].id;
        updateEnemyRecord(project.database, enemy.id, { stealItems: [{ itemId, rate: 40 }] });
        expect(project.database.enemies[0].stealItems).toEqual([{ itemId, rate: 40 }]);
        updateEnemyRecord(project.database, enemy.id, { stealItems: undefined });
        expect(project.database.enemies[0].stealItems).toBeUndefined();
        expect(project.database.enemies[0].name).toBe(enemy.name);
      });
    });
    describe('feature16 bounded damage formula language', () => {
      it('supports precedence, unary signs, parentheses and deterministic values', () => {
        expect(evaluateDamageFormula('power + (a.atk * 2 - b.def) / 2', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 20 });
        expect(evaluateDamageFormula('-10 + 2 * 3', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 0 });
      });
      it.each(['globalThis.alert(1)', 'a.constructor', '1;2', 'a.atk=99', '1/0', '1e99', '2 ** 999', '('.repeat(40) + '1' + ')'.repeat(40), '1'.repeat(513)])('rejects unsafe or invalid input %s', expression => {
        expect(evaluateDamageFormula(expression, FORMULA_PREVIEW_CONTEXT).ok).toBe(false);
      });
    });
  });
  describe("mgL2BflowDefeat", () => {
    isolateTimers();
    function battleProject(): Project {
      return deserialize(JSON.stringify(battleFixture));
    }
    function addPetrify(project: Project): void {
      project.database.states.push(normalizeStateRecord({
        id: "state_stone",
        name: "석화",
        runtimeEffects: { incapacitates: true, removeOnBattleEnd: false },
      }));
    }
    describe("mg-l2-bflow #20 전원 행동 불능 패배", () => {
      it("아군 전원이 incapacitates 상태면 HP 가 남아도 패배한다", () => {
        const project = battleProject();
        addPetrify(project);
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", party: { stateIds: { actor_hero: ["state_stone"] } }, rng: () => 0.5 });
        const snapshot = runtime.snapshot();
        expect(snapshot.actors[0]!.hp).toBeGreaterThan(0);
        expect(snapshot.result).toBe("defeat");
      });

      it("incapacitates 가 아닌 상태(표시만 있는 상태)로는 패배하지 않는다", () => {
        const project = battleProject();
        project.database.states.push(normalizeStateRecord({ id: "state_mark", name: "표식", runtimeEffects: { removeOnBattleEnd: false } }));
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", party: { stateIds: { actor_hero: ["state_mark"] } }, rng: () => 0.5 });
        expect(runtime.snapshot().result).toBeUndefined();
        expect(isBattlerIncapacitated(project, { stateIds: ["state_mark"] })).toBe(false);
        expect(isBattlerIncapacitated((addPetrify(project), project), { stateIds: ["state_stone"] })).toBe(true);
      });

      it("incapacitates 는 저장·불러오기를 지난다", () => {
        const project = battleProject();
        addPetrify(project);
        const reloaded = deserialize(serialize(project));
        expect(reloaded.database.states.find((state) => state.id === "state_stone")?.runtimeEffects?.incapacitates).toBe(true);
      });
    });
    describe("mg-l2-bflow #36 적 최후의 일격(onDeath)", () => {
      function lastStandProject(chance = 100): Project {
        const project = battleProject();
        const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
        slime.stats = { ...slime.stats, maxHp: 1, defense: 0 };
        slime.reactions = [{ trigger: "onDeath", skillId: "skill_claw", chance }];
        const claw = project.database.skills.find((skill) => skill.id === "skill_claw")!;
        claw.mpCost = { flat: 0, percentMax: 0 };
        return project;
      }

      it("쓰러지는 적이 한 번 스킬을 쓰고, 그 뒤 승리한다", () => {
        const runtime = createBattleRuntime({ project: lastStandProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
        const heroHp = runtime.snapshot().actors[0]!.hp;
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();
        const counters = snapshot.timeline.filter((entry) => entry.kind === "counter");
        expect(counters).toHaveLength(1);
        expect(counters[0]!.skillName).toBe("할퀴기");
        expect(snapshot.actors[0]!.hp).toBeLessThan(heroHp);
        expect(snapshot.enemies[0]!.hp).toBe(0);
        expect(snapshot.result).toBe("victory");
      });

      it("최후의 일격으로 아군을 전멸시키면 승리가 아니라 패배다", () => {
        const project = lastStandProject();
        const claw = project.database.skills.find((skill) => skill.id === "skill_claw")!;
        claw.power = 99999;
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().result).toBe("defeat");
      });

      it("onDeath 가 없는 적은 쓰러질 때 아무것도 하지 않는다(기존 반격 계약 그대로)", () => {
        const project = lastStandProject();
        project.database.enemies.find((record) => record.id === "enemy_slime")!.reactions = [{ trigger: "physical", skillId: "skill_claw", chance: 100 }];
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().timeline.some((entry) => entry.kind === "counter")).toBe(false);
        expect(runtime.snapshot().result).toBe("victory");
      });

      it("onDeath 반응은 정규화와 저장을 지난다", () => {
        const normalized = normalizeEnemyRecord({ id: "enemy_x", name: "X", reactions: [{ trigger: "onDeath", skillId: "skill_claw", chance: 40 }] } as Parameters<typeof normalizeEnemyRecord>[0]);
        expect(normalized.reactions).toEqual([{ trigger: "onDeath", skillId: "skill_claw", chance: 40 }]);
        const reloaded = deserialize(serialize(lastStandProject(40)));
        expect(reloaded.database.enemies.find((record) => record.id === "enemy_slime")?.reactions?.[0]).toMatchObject({ trigger: "onDeath", chance: 40 });
      });
    });
  });
  describe("monsterBattleAuthoringContract", () => {
    isolateTimers();
    const page = (patch: Partial<BattleEventPageRecord> = {}): BattleEventPageRecord => ({
      id: "page", span: "turn", conditions: [], commands: [{ kind: "changeGold", op: "+=", amount: 1 }], ...patch,
    });
    function setup(pages: BattleEventPageRecord[]) {
      const project = deserialize(JSON.stringify(battleFixture));
      const troop = project.database.troops[0]!;
      troop.battleEventPages = pages;
      const enemies = enemyBattlers(project, troop);
      const state = { gold: 0, switches: {}, variables: {}, inventory: {} };
      const runtime = createBattleEventRuntime({ project, troopRecord: troop, actors: [], enemies, stateIds: project.database.states.map((s) => s.id), state });
      return { project, troop, enemies, state, runtime };
    }
    describe("monster battle authoring contracts", () => {
      it("empty authored pages have no implicit state or reward effects", () => {
        const { enemies, state, runtime } = setup([page({ commands: [], span: "battle" })]);
        const before = structuredClone(enemies);
        runtime.applyTroopEvents({ turn: 1 });
        expect(enemies).toEqual(before);
        expect(state.gold).toBe(0);
      });

      it.each([
        ["turn", undefined, 2], ["moment", undefined, 3], ["battle", undefined, 1],
        ["battle", false, 3], ["moment", true, 1], ["turn", true, 1],
      ] as const)("%s span with runOnce=%s fires %s times", (span, runOnce, expected) => {
        const { runtime, state } = setup([page({ span, runOnce })]);
        runtime.applyTroopEvents({ turn: 1 });
        runtime.applyTroopEvents({ turn: 1 });
        runtime.applyTroopEvents({ turn: 2 });
        expect(state.gold).toBe(expected);
      });

      it("round conditions still deduplicate even with moment span", () => {
        const { runtime, state } = setup([page({ span: "moment", conditions: [{ kind: "everyRound", start: 1, interval: 1 }] })]);
        runtime.applyTroopEvents({ turn: 1 });
        runtime.applyTroopEvents({ turn: 1 });
        runtime.applyTroopEvents({ turn: 2 });
        expect(state.gold).toBe(2);
      });

      it("repairs duplicate page IDs deterministically without stealing another existing ID", () => {
        const { project, troop } = setup([page({ id: "p" }), page({ id: "p" }), page({ id: "p_2" }), page({ id: "p" })]);
        const normalized = normalizeTroopRecord(troop);
        expect(normalized.battleEventPages.map((p) => p.id)).toEqual(["p", "p_3", "p_2", "p_4"]);
        expect(normalizeTroopRecord(normalized)).toEqual(normalized);
        const loaded = deserialize(serialize(project));
        expect(loaded.database.troops[0]!.battleEventPages).toEqual(normalized.battleEventPages);
        expect(deserialize(serialize(loaded)).database.troops[0]!.battleEventPages).toEqual(normalized.battleEventPages);
      });

      it("saves, loads and evaluates the second slot independently of a duplicate enemy", () => {
        const { project, troop } = setup([page({ conditions: [{ kind: "enemyHp", enemyId: "enemy-2", minPercent: 0, maxPercent: 50 }] })]);
        const enemyId = troop.enemyIds[0]!;
        troop.members = [{ enemyId, x: 80, y: 100 }, { enemyId, x: 160, y: 100 }];
        troop.enemyIds = [enemyId, enemyId];
        const loaded = deserialize(serialize(project));
        const loadedTroop = loaded.database.troops[0]!;
        const enemies = enemyBattlers(loaded, loadedTroop);
        const state = { gold: 0, switches: {}, variables: {}, inventory: {} };
        const runtime = createBattleEventRuntime({ project: loaded, troopRecord: loadedTroop, actors: [], enemies, stateIds: [], state });
        enemies[0]!.hp = 1;
        runtime.applyTroopEvents({ turn: 1 });
        expect(state.gold).toBe(0);
        enemies[1]!.hp = 1;
        runtime.applyTroopEvents({ turn: 1 });
        expect(state.gold).toBe(1);
      });
    });
  });
});
