// @vitest-environment happy-dom

import { afterEach, expect, it, beforeEach, describe, vi } from "vitest";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { resetMapEditHistory, getMapEditHistoryState, undoMapEdit } from "@/editor/mapEditHistory";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { applyGrowthPreset } from "@/project/growth/presets";
import { investSkillNode, treeSpentPoints } from "@/project/growth/runtime";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { promoteActor } from "@/project/sessionClass";
import { store } from "@/project/store";
import type { ClassPromotionRequirement, EnemyRecord, EnemyActionPattern } from "@/project/types";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { getSelectedMonsterSpeciesId, setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import * as modal from "@/editor/ui/modal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { monsterSpeciesForEnemy, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { isolateTimers } from "./mergedTeardown";

describe("databaseClassPromotionRequirements", () => {
  isolateTimers();
  afterEach(() => { resetMapEditHistory(); document.body.replaceChildren(); });
  function mount(legacy = false, empty = false) {
    const project = createBlankProject();
    const bundle = applyGrowthPreset(project, 'bundle-vanguard');
    const klass = project.database.classes.find(c => c.id === bundle.addedClassIds[0])!;
    const actor = project.database.actors[0]!;
    actor.classId = klass.id;
    if (legacy) Object.assign(klass.promotions![0]!.requires, {
      switchId: project.switches[0]!.id, itemId: project.database.items[0]!.id,
      variableId: project.variables[0]!.id, atLeast: 2,
    });
    if (empty) klass.promotions = [];
    store.replace(project); resetMapEditHistory();
    const form = document.createElement('section'); document.body.append(form);
    renderClassRecordForm(form, klass);
    const change = (id: string, value: string, event = 'change') => {
      const control = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-testid="${id}"]`)!;
      control.value = value;
      control.dispatchEvent(new Event(event, { bubbles: true }));
    };
    const reload = () => {
      const loaded = deserialize(serialize(store.getCurrent()));
      return { loaded, promotions: loaded.database.classes.find(c => c.id === klass.id)!.promotions! };
    };
    return { project, bundle, klass, actor, form, change, reload };
  }
  it.each(['input', 'change'])('preserves all connected gates through a native level %s and reload; untrained promotion stays blocked', event => {
    const { klass, actor, change, reload } = mount();
    const original = structuredClone(klass.promotions!);
    expect(original[0]!.requires).toMatchObject({
      level: 5, requiredSkillIds: [expect.any(String)],
      requiredNodes: [{ treeId: expect.any(String), nodeId: expect.any(String), rank: 2 }],
      requiredTreePoints: [{ treeId: expect.any(String), points: 3 }],
    });
    change('db-field-class-promotion-level', '6', event);
    const { loaded, promotions } = reload();
    const session = startSession(loaded);
    session.actorLevels[actor.id] = 6;
    const tree = loaded.growth!.skillTrees.find(t => t.classIds.includes(klass.id))!;
    expect(treeSpentPoints(loaded, session, actor.id, tree.id)).toBe(0);
    const untrained = structuredClone(session);
    expect.soft(promoteActor(session, loaded, actor.id, promotions[0]!.toClassId)).toEqual({
      ok: false, actorId: actor.id, reason: 'requirements-not-met',
    });
    expect.soft(session).toEqual(untrained);
    expect(promotions).toEqual([{ ...original[0], requires: { ...original[0]!.requires, level: 6 } }, original[1]]);
    for (const node of tree.nodes) for (let rank = 0; rank < node.maxRank; rank++) {
      expect(investSkillNode(loaded, session, actor.id, tree.id, node.id)).toBeUndefined();
    }
    expect(promoteActor(session, loaded, actor.id, promotions[0]!.toClassId).ok).toBe(true);
  });
  it.each(['threshold before variable', 'clear and reselect variable'])('preserves the visible paired draft through %s, reload, and runtime threshold checks', ordering => {
    const { klass, actor, form, change, reload } = mount();
    const original = structuredClone(klass.promotions!);
    const variable = form.querySelector<HTMLSelectElement>('[data-testid="db-picker-class-promotion-variable"]')!;
    const threshold = form.querySelector<HTMLInputElement>('[data-testid="db-field-class-promotion-at-least"]')!;
    const edit = (control: HTMLInputElement | HTMLSelectElement, value: string) => {
      control.focus();
      change(control.dataset.testid!, value, 'input');
      control.dispatchEvent(new Event('change', { bubbles: true }));
    };
    expect(variable.value).toBe('');
    if (ordering === 'clear and reselect variable') edit(variable, 'var_0001');
    edit(threshold, '7');
    if (ordering === 'clear and reselect variable') {
      expect(reload().promotions[0]!.requires.atLeast).toBe(7);
      edit(variable, '');
    }
    expect(reload().promotions[0]!.requires.atLeast).toBeUndefined();
    expect(threshold.value).toBe('7');
    // An unrelated current-store edit must survive the paired-control commit.
    const current = store.getCurrent().database.classes.find(c => c.id === klass.id)!.promotions!;
    updateDatabaseRecord('classes', klass.id, {
      promotions: [{ ...current[0]!, requires: { ...current[0]!.requires, level: 6 } }, current[1]!],
    });
    edit(variable, 'var_0001');
    expect(form.querySelector('[data-testid="db-field-class-promotion-at-least"]')).toBe(threshold);
    expect(threshold.value).toBe('7');
    const { loaded, promotions } = reload();
    expect.soft(promotions).toEqual([
      { ...original[0], requires: { ...original[0]!.requires, level: 6, variableId: 'var_0001', atLeast: 7 } }, original[1],
    ]);
    const session = startSession(loaded);
    session.actorLevels[actor.id] = 6;
    const tree = loaded.growth!.skillTrees.find(t => t.classIds.includes(klass.id))!;
    for (const node of tree.nodes) for (let rank = 0; rank < node.maxRank; rank++) {
      expect(investSkillNode(loaded, session, actor.id, tree.id, node.id)).toBeUndefined();
    }
    for (const value of [1, 6]) {
      const attempt = structuredClone(session);
      attempt.variables.var_0001 = value;
      const before = structuredClone(attempt);
      expect.soft(promoteActor(attempt, loaded, actor.id, promotions[0]!.toClassId)).toEqual({
        ok: false, actorId: actor.id, reason: 'requirements-not-met',
      });
      expect.soft(attempt).toEqual(before);
    }
    session.variables.var_0001 = 7;
    expect(promoteActor(session, loaded, actor.id, promotions[0]!.toClassId)).toEqual({
      ok: true, actorId: actor.id, classId: promotions[0]!.toClassId,
    });
  });
  it.each([
    ['level', 'db-field-class-promotion-level'],
    ['switchId', 'db-picker-class-promotion-switch'],
    ['itemId', 'db-picker-class-promotion-item'],
    ['variableId', 'db-picker-class-promotion-variable'],
    ['atLeast', 'db-field-class-promotion-at-least'],
  ] as const)('edits and clears only legacy %s while retaining complete requirements and sibling promotions', (key, id) => {
    const { project, klass, change, reload } = mount(true);
    const original = structuredClone(klass.promotions!);
    const values = { level: 6, switchId: project.switches[1]!.id, itemId: project.database.items[1]!.id,
      variableId: project.variables[1]!.id, atLeast: 7 };
    change(id, String(values[key]));
    expect(reload().promotions).toEqual([
      { ...original[0], requires: { ...original[0]!.requires, [key]: values[key] } }, original[1],
    ]);
    change(id, '', 'input');
    const cleared: ClassPromotionRequirement = { ...original[0]!.requires, [key]: undefined };
    if (key === 'variableId') cleared.atLeast = undefined;
    expect(reload().promotions).toEqual([{ ...original[0], requires: cleared }, original[1]]);
  });
  it('changes and clears the native destination without dropping gates or changing the sibling edge', () => {
    const { bundle, klass, change, reload } = mount(true);
    const original = structuredClone(klass.promotions!);
    change('db-picker-class-promotion-to', bundle.addedClassIds[3]!);
    expect(reload().promotions).toEqual([{ ...original[0], toClassId: bundle.addedClassIds[3] }, original[1]]);
    change('db-picker-class-promotion-to', '', 'input');
    expect(reload().promotions).toEqual([original[1]]);
  });
  it('retains draft legacy controls when creating the first promotion in the empty row', () => {
    const { project, bundle, change, reload } = mount(false, true);
    change('db-field-class-promotion-level', '6', 'input');
    change('db-picker-class-promotion-variable', project.variables[0]!.id);
    change('db-field-class-promotion-at-least', '7', 'input');
    change('db-picker-class-promotion-to', bundle.addedClassIds[1]!);
    expect(reload().promotions).toEqual([{
      toClassId: bundle.addedClassIds[1],
      requires: { level: 6, variableId: project.variables[0]!.id, atLeast: 7 },
    }]);
  });
  it('reads the current promotion on every edit, preserving changes from another authoring surface', () => {
    const { project, bundle, klass, change, reload } = mount();
    const original = structuredClone(klass.promotions!);
    const requires: ClassPromotionRequirement = {
      level: 9, switchId: project.switches[1]!.id, itemId: project.database.items[1]!.id,
      variableId: project.variables[1]!.id, atLeast: 7,
      requiredSkillIds: [bundle.addedSkillIds[1]!],
      requiredNodes: original[0]!.requires.requiredNodes!.map(r => ({ ...r, rank: 1 })),
      requiredTreePoints: original[0]!.requires.requiredTreePoints!.map(r => ({ ...r, points: 2 })),
    };
    updateDatabaseRecord('classes', klass.id, {
      promotions: [{ toClassId: bundle.addedClassIds[3]!, requires }, original[1]!],
    });
    change('db-field-class-promotion-level', '6', 'input');
    expect(reload().promotions).toEqual([
      { toClassId: bundle.addedClassIds[3], requires: { ...requires, level: 6 } }, original[1],
    ]);
    const latest = { ...requires, level: 8, requiredSkillIds: [bundle.addedSkillIds[2]!] };
    updateDatabaseRecord('classes', klass.id, {
      promotions: [{ toClassId: bundle.addedClassIds[3]!, requires: latest }, original[1]!],
    });
    change('db-picker-class-promotion-to', original[0]!.toClassId);
    expect(reload().promotions).toEqual([{ toClassId: original[0]!.toClassId, requires: latest }, original[1]]);
  });
});

describe("databaseEnemyRelationship", () => {
  isolateTimers();
  let form: HTMLElement;
  const enemyId = "relationship-enemy";
  const speciesId = "relationship-species";
  function enemy(): EnemyRecord {
    const current = store.getCurrent().database.enemies.find((entry) => entry.id === enemyId);
    if (!current) throw new Error("Missing test enemy");
    return current;
  }
  function control<T extends HTMLElement = HTMLElement>(id: string): T {
    const node = document.querySelector<T>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }
  function render(): void {
    form.replaceChildren();
    renderEnemyRecordForm(form, enemy(), render);
  }
  function seed(link: "explicit" | "legacy" | "missing" | "absent"): void {
    store.update((project) => {
      const target = project.database.enemies[0];
      if (!target) throw new Error("Missing test enemy");
      target.speciesId = link === "explicit" ? speciesId : link === "missing" ? "missing-species" : undefined;
      project.database.monsterSpecies = [normalizeMonsterSpeciesRecord({
        id: link === "legacy" || link === "missing" ? enemyId : speciesId,
        name: "Linked species fixture",
        graphic: { monsterResourceId: target.monsterResourceId, graphicHue: 0, transparent: false, flying: false },
      })];
    });
    resetMapEditHistory();
  }
  // Observe the real modal settlement, not a timer or a mocked decision.
  function pendingConfirmation(): Promise<boolean> {
    const result = vi.mocked(modal.showConfirm).mock.results.at(-1);
    if (!result || result.type !== "return") throw new Error("Replacement confirmation was not opened");
    return result.value;
  }
  beforeEach(() => {
    resetModalStackForTest();
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    const project = createBlankProject();
    const original = project.database.enemies[0];
    if (!original) throw new Error("Missing default enemy");
    project.database.enemies = [{ ...original, id: enemyId, monsterResourceId: "shared-resource", graphicHue: 0, transparent: false, flying: false }];
    project.system.monsterCollection = true;
    store.replace(project);
    seed("explicit");
    setSelectedMonsterSpeciesId(undefined);
    form = document.createElement("section");
    document.body.append(form);
    vi.spyOn(modal, "showConfirm");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
    resetModalStackForTest();
    resetMapEditHistory();
  });
  describe("enemy effective species relationship", () => {
    it.each(["explicit", "legacy", "missing", "absent"] as const)("renders %s without writing and opens only a resolved species", (link) => {
      seed(link);
      const before = JSON.stringify(store.getCurrent());
      const update = vi.spyOn(store, "update");
      render();
      const picker = control<HTMLSelectElement>("db-picker-enemy-species");
      expect(picker.value).toBe(enemy().speciesId ?? "");
      expect(picker.selectedOptions).toHaveLength(1);
      const resolved = monsterSpeciesForEnemy(store.getCurrent(), enemy());
      if (resolved) {
        expect(picker.selectedOptions[0]?.textContent).toContain(resolved.name);
        expect(control("db-enemy-hero").textContent).toContain(resolved.name);
        expect(document.querySelector('[data-testid="db-enemy-species-unset-warn"]')).toBeNull();
        control("db-enemy-open-species").click();
        expect(getSelectedMonsterSpeciesId()).toBe(resolved.id);
        expect(control("db-enemy-capture-preview")).toBeTruthy();
      } else {
        expect(document.querySelector('[data-testid="db-enemy-open-species"]')).toBeNull();
        expect(document.querySelector('[data-testid="db-enemy-capture-preview"]')).toBeNull();
        if (link === "missing") {
          expect(picker.selectedOptions[0]?.disabled).toBe(true);
          expect(picker.selectedOptions[0]?.textContent).toContain("missing-species");
          expect(control("db-enemy-species-missing-error")).toBeTruthy();
        } else expect(control("db-enemy-species-unset-warn")).toBeTruthy();
      }
      expect(update).not.toHaveBeenCalled();
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    });
    it("clearing an explicit link reveals same-ID compatibility without storing it", () => {
      seed("legacy");
      store.update((project) => {
        project.database.monsterSpecies?.push(normalizeMonsterSpeciesRecord({ id: speciesId, name: "Explicit fixture" }));
        const target = project.database.enemies[0];
        if (target) target.speciesId = speciesId;
      });
      render();
      const picker = control<HTMLSelectElement>("db-picker-enemy-species");
      picker.value = "";
      picker.dispatchEvent(new Event("change"));
      expect(enemy().speciesId).toBeUndefined();
      control("db-enemy-open-species").click();
      expect(getSelectedMonsterSpeciesId()).toBe(enemyId);
      expect(control<HTMLSelectElement>("db-picker-enemy-species").selectedOptions[0]?.textContent).toContain("Linked species fixture");
    });
    it("open resolves the current link rather than a stale rendered ID", () => {
      render();
      store.update((project) => {
        project.database.monsterSpecies?.push(normalizeMonsterSpeciesRecord({ id: "new-link", name: "New fixture" }));
        const target = project.database.enemies[0];
        if (target) target.speciesId = "new-link";
      });
      control("db-enemy-open-species").click();
      expect(getSelectedMonsterSpeciesId()).toBe("new-link");
    });
  });
  describe("species replacement decision", () => {
    it.each(["explicit", "legacy"] as const)("cancel leaves the %s database byte-equivalent and adds no undo", async (link) => {
      seed(link);
      render();
      const before = JSON.stringify(store.getCurrent());
      const update = vi.spyOn(store, "update");
      const opener = control("db-enemy-create-species");
      opener.focus();
      opener.click();
      const pending = pendingConfirmation();
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      control("app-modal-cancel").click();
      await pending;
      expect(update).not.toHaveBeenCalled();
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
      expect(document.activeElement).toBe(opener);
    });
    it.each(["explicit", "legacy"] as const)("accept replaces %s once, keeps the old species, and undoes both atomically", async (link) => {
      seed(link);
      render();
      const before = structuredClone(store.getCurrent().database);
      const updates: string[] = [];
      const unsubscribe = store.subscribe((project) => { updates.push(JSON.stringify(project.database)); });
      try {
        control("db-enemy-create-species").click();
        const pending = pendingConfirmation();
        const accept = control("app-modal-confirm");
        accept.click();
        accept.click();
        await pending;
        expect(updates).toHaveLength(1);
        const after = store.getCurrent().database;
        expect(after.monsterSpecies).toHaveLength((before.monsterSpecies?.length ?? 0) + 1);
        expect(after.monsterSpecies?.slice(0, -1)).toEqual(before.monsterSpecies);
        const created = after.monsterSpecies?.at(-1);
        expect(created?.id).toBe(enemy().speciesId);
        expect(created?.baseStats).toEqual(enemy().stats);
        expect(created?.name).toBe(enemy().name);
        expect(created?.graphic).toMatchObject({ monsterResourceId: enemy().monsterResourceId, graphicHue: enemy().graphicHue, transparent: enemy().transparent, flying: enemy().flying });
        expect(after.enemies[0]).toEqual({ ...before.enemies[0], speciesId: created?.id });
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().database).toEqual(before);
        expect(getMapEditHistoryState().canUndo).toBe(false);
      } finally { unsubscribe(); }
    });
    it.each(["link", "delete-enemy", "delete-species", "project"] as const)("does not apply stale confirmation after %s changes", async (change) => {
      render();
      control("db-enemy-create-species").click();
      const pending = pendingConfirmation();
      if (change === "project") store.replaceProject(structuredClone(store.getCurrent()));
      else store.update((project) => {
        if (change === "delete-enemy") project.database.enemies = [];
        else if (change === "delete-species") project.database.monsterSpecies = [];
        else {
          const target = project.database.enemies[0];
          if (target) target.speciesId = undefined;
        }
      });
      const before = JSON.stringify(store.getCurrent());
      control("app-modal-confirm").click();
      await pending;
      expect(JSON.stringify(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    });
    it("seeds latest edited values after confirmation without reverting unrelated changes", async () => {
      render();
      control("db-enemy-create-species").click();
      const pending = pendingConfirmation();
      store.update((project) => {
        const target = project.database.enemies[0];
        if (target) { target.name = "Latest fixture"; target.stats.attack = 77; target.graphicHue = 120; }
      });
      const before = structuredClone(store.getCurrent().database);
      control("app-modal-confirm").click();
      await pending;
      const created = store.getCurrent().database.monsterSpecies?.at(-1);
      expect(created?.name).toBe("Latest fixture");
      expect(created?.baseStats.attack).toBe(77);
      expect(created?.graphic.graphicHue).toBe(120);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().database).toEqual(before);
    });
  });
  describe.each(["explicit", "legacy"] as const)("one-time species appearance copy via %s", (link) => {
    it("exposes a picture difference and changes only the four copy fields", () => {
      seed(link);
      store.update((project) => {
        const species = project.database.monsterSpecies?.[0];
        if (!species) throw new Error("Missing species");
        species.graphic.monsterResourceId = "different-resource";
      });
      const before = structuredClone(store.getCurrent().database);
      const graphic = before.monsterSpecies?.[0]?.graphic;
      if (!graphic) throw new Error("Missing species graphic");
      render();
      control("db-enemy-species-copy-graphic").click();
      expect(store.getCurrent().database).toEqual({ ...before, enemies: [{ ...before.enemies[0], monsterResourceId: graphic.monsterResourceId, graphicHue: graphic.graphicHue, transparent: graphic.transparent, flying: graphic.flying }] });
      expect(document.querySelector('[data-testid="db-enemy-species-copy-graphic"]')).toBeNull();
    });

    // 색조·투명·비행은 화면에서 지운 칸이다(2026-10-02) — 그 차이만으로는 고칠 데 없는 경고를 띄우지 않는다.
    it.each(["graphicHue", "transparent", "flying"] as const)("does not flag a %s-only difference", (key) => {
      seed(link);
      store.update((project) => {
        const species = project.database.monsterSpecies?.[0];
        if (!species) throw new Error("Missing species");
        if (key === "graphicHue") species.graphic.graphicHue = 90;
        else species.graphic[key] = true;
      });
      render();
      expect(document.querySelector('[data-testid="db-enemy-species-graphic-mismatch"]')).toBeNull();
      expect(document.querySelector('[data-testid="db-enemy-species-copy-graphic"]')).toBeNull();
    });
  });
});

describe("databaseEnemySelectionTrust", () => {
  isolateTimers();
  let fixtureId = 0;
  let record: EnemyRecord;
  let form: HTMLElement;
  let skills: string[];
  function action(skillId: string, priority: number): EnemyActionPattern {
    return { skillId, priority, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } };
  }
  function live(): EnemyRecord {
    const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === record.id);
    if (!enemy) throw new Error("Missing fixture enemy");
    return enemy;
  }
  function control(id: string): HTMLElement {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }
  function picker(): HTMLSelectElement {
    const node = control("db-picker-enemy-action-skill");
    if (!(node instanceof HTMLSelectElement)) throw new Error("Expected skill select");
    return node;
  }
  function row(index: number): HTMLElement { return control(`db-enemy-action-row-${index}`); }
  function changeSkill(value: string): void {
    const select = picker();
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // Deliberately retain obsolete props: the store is the authority on every render and edit.
  function render(): void {
    form.replaceChildren();
    renderEnemyRecordForm(form, record, render);
  }
  function selected(index: number): void {
    expect(form.querySelectorAll(".db-enemy-attack-table tr.active")).toHaveLength(1);
    expect(row(index).classList.contains("active")).toBe(true);
    expect(picker().value).toBe(live().actions[index]?.skillId);
  }
  beforeEach(() => {
    vi.useFakeTimers();
    const project = createBlankProject();
    const enemy = project.database.enemies[0];
    if (!enemy) throw new Error("Missing default enemy");
    skills = project.database.skills.slice(0, 3).map((entry) => entry.id);
    expect(skills).toHaveLength(3);
    fixtureId += 1;
    record = { ...enemy, id: `selection-trust-${fixtureId}`, actions: [action(skills[0], 10), action(skills[1], 90)] };
    project.database.enemies = [record];
    store.replace(project);
    form = document.createElement("section");
    document.body.append(form);
    render();
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  describe("enemy action selection through the real record form and store", () => {
    it("changes original row 1, not row 0, when the first sorted row is clicked", () => {
      const before = structuredClone(live().actions);
      expect(Array.from(form.querySelectorAll("[data-action-index]")).map((node) => node.getAttribute("data-action-index"))).toEqual(["1", "0"]);
      const target = row(1);
      target.click();
      expect(row(1)).toBe(target); // Selection must not destroy the double-click target.
      changeSkill(skills[2]);
      expect(live().actions[1]).toEqual({ ...before[1], skillId: skills[2] });
      expect(live().actions[0]).toEqual(before[0]);
      selected(1);
    });

    it("keeps the skill picker focused after changing the selected action and rerendering", async () => {
      row(1).click();
      const before = structuredClone(live().actions);
      const select = picker();
      select.focus();
      expect(document.activeElement).toBe(select);
      const changed = new Promise<void>((resolve) => {
        select.addEventListener("change", () => queueMicrotask(resolve), { once: true });
      });
      changeSkill(skills[2]);
      await changed;
      vi.advanceTimersToNextFrame();
      expect(picker()).not.toBe(select);
      expect(select.isConnected).toBe(false);
      expect(live().actions).toEqual([before[0], { ...before[1], skillId: skills[2] }]);
      selected(1);
      expect(document.activeElement).toBe(picker());
    }, 30_000);

    it("restores a second same-record replacement after the first successful frame", () => {
      picker().focus();
      changeSkill(skills[2]);
      vi.advanceTimersToNextFrame();
      const firstRestored = picker();
      expect(document.activeElement).toBe(firstRestored);
      // The editor's store subscription can replace the form after the direct render.
      render();
      expect(firstRestored.isConnected).toBe(false);
      expect(document.activeElement).toBe(document.body);
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(picker());
      for (let frame = 0; frame < 8; frame += 1) vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(picker());
    });

    it.each(["keyboard", "pointer", "focus"])("yields to %s navigation and then dialog focus after restoration", (navigation) => {
      picker().focus();
      changeSkill(skills[2]);
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(picker());
      const add = control("db-enemy-action-add");
      if (navigation === "keyboard") picker().dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
      if (navigation === "pointer") add.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      // happy-dom does not perform native Tab/pointer default focus movement.
      add.focus();
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(add);
      row(1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      const rating = control("db-enemy-action-rating");
      rating.focus();
      for (let frame = 0; frame < 8; frame += 1) {
        vi.advanceTimersToNextFrame();
        expect(document.activeElement).toBe(rating);
      }
      control("db-enemy-action-cancel").click();
    });

    it("yields to a dialog opened directly after the first successful restoration", () => {
      picker().focus();
      changeSkill(skills[2]);
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(picker());
      row(1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      const rating = control("db-enemy-action-rating");
      rating.focus();
      for (let frame = 0; frame < 9; frame += 1) {
        vi.advanceTimersToNextFrame();
        expect(document.activeElement).toBe(rating);
      }
      control("db-enemy-action-cancel").click();
    });

    it.each(["keyboard", "pointer", "focus"])("does not resume after %s navigation leaves focus on BODY", (navigation) => {
      picker().focus();
      changeSkill(skills[2]);
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(picker());
      if (navigation === "keyboard") picker().dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
      if (navigation === "pointer") form.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      if (navigation === "focus") control("db-enemy-action-add").focus();
      render();
      expect(document.activeElement).toBe(document.body);
      for (let frame = 0; frame < 9; frame += 1) {
        vi.advanceTimersToNextFrame();
        expect(document.activeElement).toBe(document.body);
      }
    });

    it("yields to navigation before the first restoration frame", () => {
      picker().focus();
      changeSkill(skills[2]);
      const add = control("db-enemy-action-add");
      add.focus();
      for (let frame = 0; frame < 9; frame += 1) {
        vi.advanceTimersToNextFrame();
        expect(document.activeElement).toBe(add);
      }
    });

    it.each([0, 1])("does not transfer restoration to another record after %s frames", (frames) => {
      const other = { ...record, id: `${record.id}-other` };
      store.update((project) => { project.database.enemies.push(other); });
      picker().focus();
      changeSkill(skills[2]);
      if (frames) {
        vi.advanceTimersToNextFrame();
        expect(document.activeElement).toBe(picker());
      }
      record = other;
      render();
      expect(document.activeElement).toBe(document.body);
      for (let frame = 0; frame < 9; frame += 1) {
        vi.advanceTimersToNextFrame();
        expect(document.activeElement).toBe(document.body);
      }
    });

    it("retargets the skill picker when a row receives keyboard focus", () => {
      row(1).focus();
      selected(1);
      changeSkill(skills[2]);
      expect(live().actions.map((entry) => entry.skillId)).toEqual([skills[0], skills[2]]);
    });

    it.each(["Enter", " "])("selects and opens the live row on %s without a preceding click", (key) => {
      const next = action(skills[2], 73);
      updateDatabaseRecord("enemies", record.id, { actions: [live().actions[0], next] });
      row(1).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      const rating = control("db-enemy-action-rating");
      expect(rating instanceof HTMLInputElement && rating.value).toBe("73");
      control("db-enemy-action-cancel").click();
      selected(1);
    });

    it("selects the context-menu target and opens current rather than captured action data", () => {
      updateDatabaseRecord("enemies", record.id, { actions: [live().actions[0], action(skills[2], 71)] });
      row(1).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
      control("db-enemy-action-context-edit").click();
      const rating = control("db-enemy-action-rating");
      expect(rating instanceof HTMLInputElement && rating.value).toBe("71");
      control("db-enemy-action-cancel").click();
      selected(1);
    });

    it("opens live data on double click while preserving the clicked row node", () => {
      const target = row(1);
      target.click();
      updateDatabaseRecord("enemies", record.id, { actions: [live().actions[0], action(skills[2], 69)] });
      target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      const rating = control("db-enemy-action-rating");
      expect(rating instanceof HTMLInputElement && rating.value).toBe("69");
      control("db-enemy-action-cancel").click();
      expect(row(1)).toBe(target);
    });

    it("merges only the skill into the selected live action when props are obsolete", () => {
      row(1).click();
      const current = { ...action(skills[1], 67), condition: { kind: "turn", start: 3, interval: 4 } as const, switchOnAfterAction: { enabled: true, switchId: "switch_1" } };
      updateDatabaseRecord("enemies", record.id, { name: "Live name", actions: [action(skills[2], 12), current] });
      changeSkill(skills[0]);
      expect(live().actions).toEqual([action(skills[2], 12), { ...current, skillId: skills[0] }]);
      expect(live().name).toBe("Live name");
      selected(1);
    });

    it("preserves original-index selection when changed priorities reorder the display", () => {
      row(1).click();
      updateDatabaseRecord("enemies", record.id, { actions: [action(skills[0], 99), action(skills[1], 1)] });
      render();
      expect(Array.from(form.querySelectorAll("[data-action-index]")).map((node) => node.getAttribute("data-action-index"))).toEqual(["0", "1"]);
      selected(1);
    });

    it.each(["add", "duplicate"])("selects the new original-index row after %s with obsolete render props", (operation) => {
      row(1).click();
      const before = structuredClone(live().actions);
      control(`db-enemy-action-${operation}`).click();
      expect(live().actions).toHaveLength(3);
      expect(live().actions.slice(0, 2)).toEqual(before);
      if (operation === "duplicate") expect(live().actions[2]).toEqual(before[1]);
      selected(2);
      changeSkill(skills[2]);
      expect(live().actions[2]?.skillId).toBe(skills[2]);
      expect(live().actions.slice(0, 2)).toEqual(before);
    });

    it("selects the preceding original row after deletion and keeps empty controls disabled", () => {
      row(1).click();
      const first = structuredClone(live().actions[0]);
      control("db-enemy-action-delete").click();
      expect(live().actions).toEqual([first]);
      selected(0);
      control("db-enemy-action-delete").click();
      expect(live().actions).toEqual([]);
      expect(form.querySelectorAll("[data-action-index]")).toHaveLength(0);
      expect(picker().disabled).toBe(true);
      expect(picker().value).toBe("");
      for (const id of ["duplicate", "delete"]) expect(control(`db-enemy-action-${id}`).hasAttribute("disabled")).toBe(true);
      expect(control("db-enemy-action-add").hasAttribute("disabled")).toBe(false);
      control("db-enemy-action-add").click();
      selected(0);
      expect(picker().disabled).toBe(false);
    });

    it("does not recreate removed actions from a still-mounted obsolete picker", () => {
      row(1).click();
      updateDatabaseRecord("enemies", record.id, { actions: [] });
      changeSkill(skills[2]);
      expect(live().actions).toEqual([]);
    });
  });
});
