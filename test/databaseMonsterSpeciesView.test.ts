import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let previousWindow: typeof globalThis.window | undefined;

function stubWindowTimers(): void {
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout,
    },
  });
}

function restoreWindow(): void {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
}

function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    render(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("database monster species view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    stubWindowTimers();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
    restoreWindow();
  });

  // fix(db): statFields/hue/resourcePicker 콜백이 렌더 시점 record를 클로저로 캡처한 채
  // baseStats를 스프레드해, rerender 없이 연속 편집하면 직전 편집이 스테일 스냅샷 위에
  // 덮여 사라졌다(HP→MP→공격 순서 입력 시 마지막 필드만 저장 — qa-enemies-report.md).
  it("preserves every stat field when edited sequentially without an intervening rerender", () => {
    const host = renderUtility(renderMonsterSpeciesTab);
    findByTestId(host, "db-monster-species-add")?.click();
    const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
    if (!id) throw new Error("missing species id");

    const setNumber = (testid: string, value: string): void => {
      const input = findByTestId(host, testid);
      if (!input) throw new Error(`missing field ${testid}`);
      input.value = value;
      input.dispatchEvent(new Event("input"));
    };

    setNumber("db-monster-species-hp", "64");
    setNumber("db-monster-species-mp", "30");
    setNumber("db-monster-species-atk", "21");
    setNumber("db-monster-species-def", "22");
    setNumber("db-monster-species-mind", "23");
    setNumber("db-monster-species-agi", "24");
    setNumber("db-monster-species-hue", "120");

    const record = store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id);
    expect(record?.baseStats).toEqual({ maxHp: 64, maxMp: 30, attack: 21, defense: 22, mind: 23, agility: 24 });
    expect(record?.graphic.graphicHue).toBe(120);
  });

  it("duplicates with a 사본 suffix and blocks delete while an enemy references the species", () => {
    const host = renderUtility(renderMonsterSpeciesTab);
    const before = (store.getCurrent().database.monsterSpecies ?? []).length;
    findByTestId(host, "db-monster-species-add")?.click();
    const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
    if (!id) throw new Error("missing species id");

    findByTestId(host, "db-monster-species-duplicate")?.click();
    const species = store.getCurrent().database.monsterSpecies ?? [];
    expect(species).toHaveLength(before + 2);
    const duplicatedId = species.at(-1)?.id;
    expect(species.at(-1)?.name).toBe("새 species 사본");
    if (!duplicatedId) throw new Error("missing duplicated species id");

    // duplicate is auto-selected — reference it (not the original) so the delete
    // button below targets the referenced record and the guard actually engages.
    const enemyId = store.getCurrent().database.enemies[0]?.id;
    if (!enemyId) throw new Error("missing default enemy");
    store.update((project) => {
      const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
      if (enemy) enemy.speciesId = duplicatedId;
    });

    const deleteButton = findByTestId(host, "db-monster-species-delete");
    if (!deleteButton) throw new Error("missing delete button");
    deleteButton.click();
    expect(deleteButton.textContent).toBe("삭제"); // blocked — never arms
    expect(store.getCurrent().database.monsterSpecies).toHaveLength(before + 2);
  });

  it("requires a second click before deleting an unreferenced species, and undo restores it", () => {
    const host = renderUtility(renderMonsterSpeciesTab);
    findByTestId(host, "db-monster-species-add")?.click();
    const before = (store.getCurrent().database.monsterSpecies ?? []).length;

    const deleteButton = findByTestId(host, "db-monster-species-delete");
    if (!deleteButton) throw new Error("missing delete button");
    deleteButton.click();
    expect(deleteButton.textContent).toBe("정말 삭제?");
    expect(store.getCurrent().database.monsterSpecies).toHaveLength(before);

    deleteButton.click();
    expect(store.getCurrent().database.monsterSpecies).toHaveLength(before - 1);

    expect(getMapEditHistoryState().canUndo).toBe(true);
    const undone = undoMapEdit();
    expect(undone).toBe(true);
    expect(store.getCurrent().database.monsterSpecies).toHaveLength(before);
  });

  it("uses type-chart chips: two stick, third does not, and outlier types warn", () => {
    store.update((project) => {
      project.system.typeChart = {
        types: ["fire", "water", "grass"],
        multipliers: {
          fire: { fire: 1, water: 0.5, grass: 2 },
          water: { fire: 2, water: 1, grass: 0.5 },
          grass: { fire: 0.5, water: 2, grass: 1 },
        },
      };
    });

    const host = renderUtility(renderMonsterSpeciesTab);
    findByTestId(host, "db-monster-species-add")?.click();
    const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
    if (!id) throw new Error("missing species id");

    const toggleType = (type: string, checked: boolean): FakeElement => {
      const chip = findByTestId(host, `db-monster-species-type-${type}`);
      if (!chip) throw new Error(`missing type chip ${type}`);
      chip.checked = checked;
      chip.dispatchEvent(new Event("change"));
      return chip;
    };

    toggleType("fire", true);
    toggleType("water", true);
    expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
      "fire",
      "water",
    ]);

    const grass = toggleType("grass", true);
    expect(grass.checked).toBe(false);
    expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
      "fire",
      "water",
    ]);
    expect(store.getCurrent().system.typeChart?.types).toEqual(["fire", "water", "grass"]);

    // Outlier warn: store a type outside the chart without clearing chart types.
    store.update((project) => {
      const record = project.database.monsterSpecies?.find((entry) => entry.id === id);
      if (!record) throw new Error("missing species");
      record.types = ["fire", "ghost"];
    });
    const refreshed = renderUtility(renderMonsterSpeciesTab);
    const warn = findByTestId(refreshed, "db-monster-species-type-warn");
    expect(warn?.textContent).toContain("타입 상성표에 없는 타입");
    expect(warn?.textContent).toContain("ghost");
    expect(findByTestId(refreshed, "db-monster-species-type-fire")?.checked).toBe(true);
    expect(findByTestId(refreshed, "db-monster-species-type-water")?.checked).toBe(false);
    const orphan = findByTestId(refreshed, "db-monster-species-type-ghost")!;
    orphan.checked = false;
    orphan.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.monsterSpecies?.find((row) => row.id === id)?.types).toEqual(["fire"]);
  });

  it("falls back to free-text types when the type chart is empty", () => {
    store.update((project) => {
      delete project.system.typeChart;
    });

    const host = renderUtility(renderMonsterSpeciesTab);
    findByTestId(host, "db-monster-species-add")?.click();
    const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
    if (!id) throw new Error("missing species id");

    expect(findByTestId(host, "db-monster-species-types-hint")).not.toBeNull();
    expect(findByTestId(host, "db-monster-species-type-fire")).toBeNull();

    const input = findByTestId(host, "db-monster-species-types");
    if (!input) throw new Error("missing free-text types field");
    input.value = "불, 물, 바람";
    input.dispatchEvent(new Event("input"));

    expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
      "불",
      "물",
    ]);
    expect(store.getCurrent().system.typeChart).toBeUndefined();
  });

  // Break caught: species fields do not show whether enemies, field spawns, and drops form a playable pipeline.
  it("shows the monster pipeline summary and direct navigation actions", () => {
    const host = renderUtility(renderMonsterSpeciesTab);
    expect(findByTestId(host, "db-monster-pipeline")).toBeTruthy();
    expect(findByTestId(host, "db-monster-pipeline-links")?.dataset.state).toBe("ready");
    expect(findByTestId(host, "db-monster-pipeline-spawns")?.dataset.state).toBe("needs-setup");
    // 기본 DB 는 이제 모든 적에 드롭 아이템을 생산한다(해골 궁수 = item_bone).
    // 이 칩이 다른 상태도 보고한다는 적은 위의 spawns(needs-setup) 가 직얰한다.
    expect(findByTestId(host, "db-monster-pipeline-drops")?.dataset.state).toBe("ready");
    expect(findByTestId(host, "db-monster-pipeline-links-action")).toBeTruthy();
    expect(findByTestId(host, "db-monster-pipeline-spawns-action")).toBeTruthy();
    expect(findByTestId(host, "db-monster-pipeline-drops-action")).toBeTruthy();
  });
  it("keeps skill row identity through sorting, blur, a later skill edit and deletion", () => {
    const initial = renderUtility(renderMonsterSpeciesTab);
    findByTestId(initial, "db-monster-species-add")!.click();
    const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
    const [a, b, c] = store.getCurrent().database.skills;
    store.update((project) => {
      project.database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel = [
        { level: 1, skillId: a!.id }, { level: 10, skillId: b!.id },
      ];
    });
    const host = renderUtility(renderMonsterSpeciesTab);
    const first = findByTestId(host, "db-monster-species-skill-level-0")!;
    first.value = "20";
    first.dispatchEvent(new Event("input"));
    first.dispatchEvent(new Event("change"));
    const saved = () => store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel;
    expect(saved()).toEqual([{ level: 10, skillId: b!.id }, { level: 20, skillId: a!.id }]);
    const skill = findByTestId(host, "db-monster-species-skill-0")!;
    skill.value = c!.id;
    skill.dispatchEvent(new Event("change"));
    expect(saved()).toEqual([{ level: 10, skillId: b!.id }, { level: 20, skillId: c!.id }]);
    findByTestId(host, "db-monster-species-skill-delete-0")!.click();
    expect(saved()).toEqual([{ level: 10, skillId: b!.id }]);
  });

  it("does not overwrite externally changed skill rows", () => {
    const initial = renderUtility(renderMonsterSpeciesTab);
    findByTestId(initial, "db-monster-species-add")!.click();
    findByTestId(initial, "db-monster-species-skill-add")!.click();
    const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
    const input = findByTestId(initial, "db-monster-species-skill-level-0")!;
    store.update((project) => { project.database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel[0]!.level = 30; });
    input.value = "20";
    input.dispatchEvent(new Event("input"));
    expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel[0]!.level).toBe(30);
  });

});
