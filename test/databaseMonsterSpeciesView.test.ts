import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { captureDifficulty } from "@/editor/panels/databaseCapturePreview";
import { setMonsterSpeciesSection } from "@/editor/panels/databaseMonsterSpeciesSections";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { setEditorUiMode } from "@/editor/editorUiMode";
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
      // setEditorUiMode() announces the mode on window; the stub has no listeners to notify.
      dispatchEvent: () => true,
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
    setMonsterSpeciesSection("basic");
    setEditorUiMode("expert", null);
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


  // Break caught: all nine cards were stacked at once (1372px) so beginners could not tell where to start.
  it("splits the detail into five section tabs that keep every field mounted", () => {
    const host = renderUtility(renderMonsterSpeciesTab);
    const tabs = ["basic", "capture", "growth", "evolution", "links"].map((id) => findByTestId(host, `db-monster-species-section-tab-${id}`)!);
    expect(tabs.map((tab) => tab.getAttribute("role"))).toEqual(["tab", "tab", "tab", "tab", "tab"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false", "false"]);
    expect(findByTestId(host, "db-monster-species-section-tab-links")?.dataset.dbUx).toBe("advanced");
    // Hidden panels still own their fields — tests and saved paths reach them without a tab click.
    for (const testid of ["db-monster-species-name", "db-monster-species-capture-rate", "db-monster-species-hp", "db-monster-species-evo-add", "db-monster-species-linked-enemies"]) {
      expect(findByTestId(host, testid), testid).toBeTruthy();
    }
    expect(findByTestId(host, "db-monster-species-section-basic")?.hidden).toBe(false);
    expect(findByTestId(host, "db-monster-species-section-growth")?.hidden).toBe(true);

    tabs[2]!.click();
    expect(findByTestId(host, "db-monster-species-section-growth")?.hidden).toBe(false);
    expect(findByTestId(host, "db-monster-species-section-basic")?.hidden).toBe(true);
    // The chosen section survives a rerender (edits that rebuild the tab must not jump back to 기본).
    const rerendered = renderUtility(renderMonsterSpeciesTab);
    expect(findByTestId(rerendered, "db-monster-species-section-tab-growth")?.getAttribute("aria-selected")).toBe("true");
    expect(findByTestId(rerendered, "db-monster-species-section-growth")?.hidden).toBe(false);

    const growthTab = findByTestId(rerendered, "db-monster-species-section-tab-growth")!;
    growthTab.dispatchEvent(Object.assign(new Event("keydown"), { key: "ArrowRight" }));
    expect(findByTestId(rerendered, "db-monster-species-section-tab-evolution")?.getAttribute("aria-selected")).toBe("true");
  });

  it("falls back to 기본 when the remembered section is hidden in beginner mode", () => {
    setMonsterSpeciesSection("links");
    setEditorUiMode("beginner", null);
    const host = renderUtility(renderMonsterSpeciesTab);
    expect(findByTestId(host, "db-monster-species-section-tab-basic")?.getAttribute("aria-selected")).toBe("true");
    expect(findByTestId(host, "db-monster-species-section-links")?.hidden).toBe(true);
  });

  // Break caught: 「기본 포획 계수 0.45」 said nothing about how hard the monster is to catch.
  it("names capture difficulty and lets a difficulty step set the representative rate", () => {
    expect(captureDifficulty(1).label).toBe("매우 쉬움");
    expect(captureDifficulty(0.7).label).toBe("쉬움");
    expect(captureDifficulty(0.3).label).toBe("보통");
    expect(captureDifficulty(0.45).label).toBe("보통");
    expect(captureDifficulty(0.15).label).toBe("어려움");
    expect(captureDifficulty(0.02).label).toBe("전설");

    const host = renderUtility(renderMonsterSpeciesTab);
    findByTestId(host, "db-monster-species-add")!.click();
    const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
    expect(findByTestId(host, "db-monster-species-capture-difficulty")?.textContent).toBe("보통");
    expect(findByTestId(host, "db-monster-species-capture-rate")?.closest("[data-db-ux]")?.dataset.dbUx).toBe("expert");
    findByTestId(host, "db-monster-species-capture-step-hard")!.click();
    expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.captureRate).toBe(0.15);
    expect(findByTestId(host, "db-monster-species-capture-difficulty")?.textContent).toBe("어려움");
    expect(findByTestId(host, "db-monster-species-capture-step-hard")?.getAttribute("aria-pressed")).toBe("true");
    expect(findByTestId(host, "db-monster-species-section-tab-capture")?.textContent).toContain("어려움");
    expect(findByTestId(host, "db-monster-species-summary")?.textContent).toContain("잡기 어려움");
    expect(findByTestId(host, "db-monster-species-check-capture")?.dataset.done).toBe("true");
  });

  it("shows Korean type labels while storing raw type ids", () => {
    store.update((project) => {
      project.system.typeChart = {
        types: ["fire", "water", "shadow"],
        multipliers: { fire: {}, water: {}, shadow: {} },
      } as never;
    });
    const host = renderUtility(renderMonsterSpeciesTab);
    findByTestId(host, "db-monster-species-add")!.click();
    const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
    const fire = findByTestId(host, "db-monster-species-type-fire")!;
    expect(fire.closest("label")?.textContent).toContain("불");
    expect(findByTestId(host, "db-monster-species-type-shadow")!.closest("label")?.textContent).toContain("shadow");
    fire.checked = true;
    fire.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.types).toEqual(["fire"]);
    expect(findByTestId(host, "db-monster-species-hero-types")?.textContent).toBe("불");
  });

  it("keeps the project-wide readiness collapsed into a counted pill", () => {
    const host = renderUtility(renderMonsterSpeciesTab);
    const details = findByTestId(host, "db-monster-pipeline-details")!;
    expect(details.tagName).toBe("DETAILS");
    expect((details as unknown as { open?: boolean }).open).toBe(false);
    expect(findByTestId(host, "db-monster-pipeline-toggle")?.textContent).toMatch(/프로젝트 준비\s*\d\/4/u);
    expect(details.contains(findByTestId(host, "db-monster-pipeline"))).toBe(true);
  });

  it("marks the fill-order checklist from real data and jumps to the item's section", () => {
    const host = renderUtility(renderMonsterSpeciesTab);
    findByTestId(host, "db-monster-species-add")!.click();
    expect(findByTestId(host, "db-monster-species-checklist")?.dataset.dbUx).toBe("guide");
    expect(findByTestId(host, "db-monster-species-check-identity")?.dataset.done).toBe("false");
    expect(findByTestId(host, "db-monster-species-check-graphic")?.dataset.done).toBe("false");
    expect(findByTestId(host, "db-monster-species-check-capture")?.dataset.done).toBe("false");
    findByTestId(host, "db-monster-species-check-evolution")!.click();
    expect(findByTestId(host, "db-monster-species-section-evolution")?.hidden).toBe(false);
  });
});
