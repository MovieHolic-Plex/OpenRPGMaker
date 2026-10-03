/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "postcss";
import { createBattleRuntime } from "@/battle/runtime";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { runTool } from "@/editor/tools/toolRunner";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { battleField, syncBattleField } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { store } from "@/project/store";
import type { EnemyRecord, Project } from "@/project/types";

function enemy(project: Project, id = "enemy_stone_golem"): EnemyRecord {
  const record = project.database.enemies.find((entry) => entry.id === id);
  if (!record) throw new Error(`Missing enemy fixture ${id}`);
  return record;
}

function input(form: HTMLElement, suffix: "slider" | "stepper"): HTMLInputElement {
  const control = form.querySelector<HTMLInputElement>(`[data-testid="db-field-enemy-battle-scale-${suffix}"]`);
  if (!control) throw new Error(`Missing battle scale ${suffix}`);
  return control;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("enemy battle size at the authoring and project IO seams", () => {
  it.each([175, 0, 999])("authors %s percent through upsert_enemy and project IO", (value) => {
    // Given: the real tool runner and an existing enemy with unrelated fields.
    const context = { project: createBlankProject() };
    const before = structuredClone(enemy(context.project));
    // When: the tool edits only the authored battle size.
    const result = runTool(context, "upsert_enemy", {
      enemy: { id: before.id, battleScalePercent: value },
    }, { dryRun: false });
    // Then: schema acceptance, mutation and persistence agree.
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(enemy(deserialize(serialize(context.project)))).toEqual({
      ...before, battleScalePercent: Math.min(300, Math.max(10, value)),
    });
  });

  it("keeps an edited enemy size through save, load and a second save", () => {
    // Given: the actual editor store, not a mock mutation adapter.
    store.replace(createBlankProject());
    // When: a record patch goes through the normal mutation and IO boundaries.
    updateDatabaseRecord("enemies", "enemy_stone_golem", { battleScalePercent: 175 });
    const loaded = deserialize(serialize(store.getCurrent()));
    const reloaded = deserialize(serialize(loaded));
    // Then: normalization must not drop the authored percentage.
    expect(enemy(reloaded).battleScalePercent).toBe(175);
    expect(enemy(reloaded, "enemy_cave_bat").battleScalePercent).toBeUndefined();
  });

  it.each([
    [undefined, undefined], [100, undefined], [10, 10], [300, 300],
    [0, 10], [-50, 10], [9999, 300], [125.6, 126],
    [null, undefined], ["175", undefined], ["bad", undefined],
  ])("normalizes wire value %s to %s without breaking old projects", (raw, expected) => {
    // Given: persisted or externally authored project data.
    const project = createBlankProject();
    Object.assign(enemy(project), { battleScalePercent: raw });
    // When: it crosses the real project load boundary.
    const loaded = deserialize(serialize(project));
    // Then: omission/default stay sparse and malformed values use the default.
    expect(enemy(loaded).battleScalePercent).toBe(expected);
    if (expected === undefined) expect(enemy(loaded)).not.toHaveProperty("battleScalePercent");
  });

  it.each([NaN, Infinity, -Infinity])("defaults non-finite direct edits (%s) safely", (value) => {
    store.replace(createBlankProject());
    updateDatabaseRecord("enemies", "enemy_stone_golem", { battleScalePercent: value });
    expect(enemy(store.getCurrent())).not.toHaveProperty("battleScalePercent");
  });

  it.each([175, 10, 300, 999, -20, 125.6])("edits %s using the real form, preserving focus and other enemy data", (value) => {
    // Given: a mounted real enemy inspector with existing actions/stats/art.
    store.replace(createBlankProject());
    const before = structuredClone(enemy(store.getCurrent()));
    const form = document.createElement("section");
    document.body.append(form);
    renderEnemyRecordForm(form, before);
    const number = input(form, "stepper");
    expect(number.value).toBe("100");
    expect([number.min, number.max, number.step]).toEqual(["10", "300", "1"]);
    expect(number.labels?.length).toBeGreaterThan(0);
    number.focus();
    // When: native input bubbles through the current store-backed form.
    number.value = String(value);
    number.dispatchEvent(new Event("input", { bubbles: true }));
    // Then: input, slider and saved value agree without replacing the input.
    const expected = Math.round(Math.min(300, Math.max(10, value)));
    expect(number.value).toBe(String(expected));
    expect(input(form, "slider").value).toBe(String(expected));
    expect(document.activeElement).toBe(number);
    expect(enemy(store.getCurrent())).toEqual({ ...before, battleScalePercent: expected });
    expect(enemy(deserialize(serialize(store.getCurrent()))).battleScalePercent).toBe(expected);
  });

  it("restores 100 percent through the slider and reopens with that default", () => {
    store.replace(createBlankProject());
    updateDatabaseRecord("enemies", "enemy_stone_golem", { battleScalePercent: 175 });
    const form = document.createElement("section");
    renderEnemyRecordForm(form, enemy(store.getCurrent()));
    const slider = input(form, "slider");
    slider.value = "100";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    const loaded = deserialize(serialize(store.getCurrent()));
    store.replace(loaded);
    const reopened = document.createElement("section");
    renderEnemyRecordForm(reopened, enemy(loaded));
    expect(input(reopened, "stepper").value).toBe("100");
    expect(enemy(loaded)).not.toHaveProperty("battleScalePercent");
  });
});

describe("enemy size in the supported battle presentations", () => {
  it.each(["retro2003", "pokemon"] as const)("applies independent sizes in %s and retains them through hit/idle sync", (skin) => {
    // Given: two differently sized records in an existing multi-enemy troop.
    const project = createBlankProject();
    project.system.battleUiStyle = skin;
    project.system.battleModel = skin === "pokemon" ? "gen1" : "rm2k3";
    enemy(project).battleScalePercent = 175;
    enemy(project, "enemy_cave_bat").battleScalePercent = 50;
    // Gen1 exposes only the first live opponent, so put the golem first.
    const troop = project.database.troops.find((entry) => entry.id === "troop_golem_guard");
    if (!troop?.members) throw new Error("Missing troop members fixture");
    troop.members.sort((a, b) => Number(b.enemyId === "enemy_stone_golem") - Number(a.enemyId === "enemy_stone_golem"));
    store.replace(deserialize(serialize(project)));
    const runtime = createBattleRuntime({ project: store.getCurrent(), troopId: "troop_golem_guard", canEscape: true, canLose: false, rng: () => 0 });
    const snapshot = runtime.snapshot();
    // When: the real renderer creates and synchronizes its battler nodes.
    const field = battleField(snapshot);
    const golem = field.querySelector<HTMLElement>('[data-record-id="enemy_stone_golem"]');
    const image = golem?.querySelector<HTMLImageElement>(".battle-enemy-image");
    expect(golem?.style.getPropertyValue("--battle-enemy-scale")).toBe("1.75");
    const bats = field.querySelectorAll<HTMLElement>('[data-record-id="enemy_cave_bat"]');
    expect(bats.length).toBe(skin === "pokemon" ? 0 : 2);
    for (const bat of bats) {
      expect(bat.style.getPropertyValue("--battle-enemy-scale")).toBe("0.5");
    }
    syncBattleField(field, snapshot, undefined, { hitTargetId: "enemy_stone_golem" });
    expect(golem?.classList.contains("battle-pose-hit")).toBe(true);
    syncBattleField(field, snapshot, undefined, { calm: true });
    // Then: sizing has not taken over transform, scale or the animation channel.
    expect(golem?.querySelector(".battle-enemy-image")).toBe(image);
    expect(golem?.style.getPropertyValue("--battle-enemy-scale")).toBe("1.75");
    expect(image?.style.transform).toBe("");
    expect(image?.style.getPropertyValue("scale")).toBe("");
    expect(image?.style.animation).toBe("");
    expect(golem?.style.transform).toBe("");
  });

  it.each(["retro2003", "pokemon"] as const)("uses unchanged 100 percent dimensions for a legacy %s enemy", (skin) => {
    const project = createBlankProject();
    project.system.battleUiStyle = skin;
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: "troop_golem_guard", canEscape: true, canLose: false, rng: () => 0 });
    const field = battleField(runtime.snapshot());
    expect(field.querySelector<HTMLElement>(".battle-enemy")?.style.getPropertyValue("--battle-enemy-scale")).toBe("1");
  });

  it.each([
    ["_rm2000.css", "retro2003", 2, 160, 180],
    ["_rm2000.css", "retro2003", 1, 200, 240],
    ["_battlers.css", "pokemon", 1, 148, 148],
  ] as const)("consumes the multiplier in the shipped %s size rule (%s, %s enemies)", (file, skin, count, width, height) => {
    // Given: parsed shipped CSS. happy-dom cannot evaluate calc multiplication
    // or :where specificity; real-browser geometry/cascade QA is lead-owned.
    const sheet = parse(readFileSync(`src/styles/runtime/battle-skins/${file}`, "utf8"));
    const selector = skin === "pokemon"
      ? '.battle-scene[data-battle-skin="pokemon"] .battle-enemy .battle-enemy-image'
      : count === 1
        ? '.battle-scene[data-battle-ui-style="classic"][data-battle-skin-family="glass"] .battle-enemy-group:not(:has(> .battle-enemy:nth-child(2))) .battle-enemy-image'
        : '.battle-scene[data-battle-ui-style="classic"][data-battle-skin-family="glass"] .battle-enemy .battle-enemy-image';
    const dimensions: Record<string, string> = {};
    const shared = '.battle-scene[data-battle-ui-style="classic"][data-battle-skin-family="glass"] .battle-enemy .battle-enemy-image';
    // When: shared dimensions and the selected skin's base-size overrides apply.
    sheet.walkRules((rule) => {
      if (rule.selector !== selector && !(skin !== "pokemon" && rule.selector === shared)) return;
      rule.walkDecls(/^(width|height|--battle-enemy-base-width|--battle-enemy-base-height)$/, (declaration) => { dimensions[declaration.prop] = declaration.value; });
    });
    // Then: both dimensions consume the same runtime multiplier with legacy fallback.
    expect(dimensions).toEqual({
      "--battle-enemy-base-width": `${width}px`,
      "--battle-enemy-base-height": `${height}px`,
      width: "calc(var(--battle-enemy-base-width) * var(--battle-enemy-scale, 1) * var(--battle-enemy-fit, 1))",
      height: "calc(var(--battle-enemy-base-height) * var(--battle-enemy-scale, 1) * var(--battle-enemy-fit, 1))",
    });
  });
});
