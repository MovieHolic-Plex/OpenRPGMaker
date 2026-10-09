import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActorRecordForm } from "@/editor/panels/actorRecordView";
import { getDatabaseActiveTab, setDatabaseActiveTab } from "@/editor/panels/database";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { actorBuildPreview, classBuildSummary } from "@/editor/panels/databasePartyBuildSummary";
import {
  resetRecordViewSessionState,
  selectedRecordIdForSession,
} from "@/editor/panels/databaseRecordViewSession";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ActorParameterCurves } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousImage: typeof globalThis.Image | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousImage = globalThis.Image;
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      addEventListener(): void {
        // Image loading is outside this DOM-navigation contract.
      }
    },
  });
  resetRecordViewSessionState();
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousImage === undefined) Reflect.deleteProperty(globalThis, "Image");
  else Object.defineProperty(globalThis, "Image", { configurable: true, value: previousImage });
  previousImage = undefined;
});

function levelCurves(values: Partial<Record<keyof ActorParameterCurves, number>> = {}): ActorParameterCurves {
  const curve = (base: number): number[] => Array.from({ length: 99 }, (_, index) => base + index * 10);
  return {
    maxHp: curve(values.maxHp ?? 100),
    maxMp: curve(values.maxMp ?? 20),
    attack: curve(values.attack ?? 10),
    defense: curve(values.defense ?? 8),
    mind: curve(values.mind ?? 6),
    agility: curve(values.agility ?? 4),
  };
}

function mountInDatabaseBody(form: HTMLElement): FakeElement {
  const root = document.createElement("div") as unknown as FakeElement;
  root.className = "database-modal-body";
  const body = document.createElement("div") as unknown as FakeElement;
  body.className = "db-body";
  body.append(form as unknown as FakeElement);
  root.append(body);
  return root;
}

describe("actor build preview", () => {
  it("projects invalid and missing initial equipment through the runtime equipment authority", () => {
    // Break caught: raw initialEquipment contributes stats and links even when runtime rejects its slot/reference.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    if (!actor) throw new Error("fixture needs an actor");
    actor.parameterCurves = levelCurves({ defense: 8 });
    const armorInShieldSlot = normalizeEquipmentRecord({
      id: "equip_wrong_shield_slot",
      name: "Armor in shield slot",
      slot: "armor",
      statBonuses: { attack: 0, defense: 70, mind: 0, agility: 0 },
    });
    project.database.equipment = [armorInShieldSlot];
    actor.initialEquipment = { shield: armorInShieldSlot.id, accessory: "equip_missing_preview" };

    const preview = actorBuildPreview(project, actor.id, 1);

    expect(preview?.stats.defense.value).toBe(8);
    expect(preview?.stats.defense.equipmentBonus).toBe(0);
    expect(preview?.equipment).toEqual([]);
    expect(preview?.referenceWarnings).toEqual([
      { kind: "equipment", id: armorInShieldSlot.id, slot: "shield", reason: "invalid-slot" },
      { kind: "equipment", id: "equip_missing_preview", slot: "accessory", reason: "missing" },
    ]);
  });

  it("switches the growth authority only when a runtime class override is present", () => {
    // Break caught: assigned classes accidentally replace actor-base curves before a runtime class change.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !klass) throw new Error("fixture needs an actor and assigned class");
    actor.initialEquipment = {};
    actor.parameterCurves = levelCurves({ attack: 10 });
    klass.parameterCurves = levelCurves({ attack: 900 });

    const initial = actorBuildPreview(project, actor.id, 20);
    const changed = actorBuildPreview(project, actor.id, 20, { classOverrideId: klass.id });

    expect(initial?.growth.source).toBe("actor-base");
    expect(initial?.stats.attack.value).toBe(200);
    expect(changed?.growth.source).toBe("class-override");
    expect(changed?.stats.attack.value).toBe(1090);
  });

  it("evaluates the selected level through actor-base runtime semantics and initial equipment", () => {
    // Break caught: replacing the build preview with raw actor fields, class curves, or a level-insensitive ledger.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !klass) throw new Error("fixture needs an actor and assigned class");
    actor.parameterCurves = levelCurves({ attack: 10 });
    klass.parameterCurves = levelCurves({ attack: 900 });
    const sword = normalizeEquipmentRecord({
      id: "equip_preview_sword",
      name: "미리보기 검",
      slot: "weapon",
      statBonuses: { attack: 7, defense: 0, mind: 0, agility: 0 },
    });
    project.database.equipment.push(sword);
    actor.initialEquipment = { ...actor.initialEquipment, weapon: sword.id };
    store.replace(project);

    const form = renderActorRecordForm(actor, () => undefined) as unknown as FakeElement;
    const level = findByTestId(form, "db-actor-build-level");
    if (!level) throw new Error("missing actor build level control");
    level.value = "20";
    level.dispatchEvent(new Event("input"));

    expect(findByTestId(form, "db-actor-build-preview")).not.toBeNull();
    expect(findByTestId(form, "db-actor-build-stat-attack")?.textContent).toBe("207");
    expect(findByTestId(form, "db-actor-build-growth-source")?.dataset.source).toBe("actor-base");
    expect(findByTestId(form, `db-actor-build-open-equipment-${sword.id}`)).not.toBeNull();
  });

  it("opens linked class and skills inside the current Database modal", () => {
    // Break caught: cross-record links reopen the modal or fail to preserve the selected destination record.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const actorSkill = project.database.skills[0];
    const classSkill = project.database.skills[1];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !actorSkill || !classSkill || !klass) throw new Error("fixture needs linked party records");
    actor.learnedSkills = [{ level: 1, skillId: actorSkill.id }];
    klass.learnedSkills = [{ level: 1, skillId: classSkill.id }];
    store.replace(project);

    const form = renderActorRecordForm(actor, () => undefined);
    const root = mountInDatabaseBody(form);
    findByTestId(form as unknown as FakeElement, "db-actor-build-open-class")?.click();
    expect(getDatabaseActiveTab()).toBe("classes");
    expect(selectedRecordIdForSession("classes")).toBe(klass.id);

    setDatabaseActiveTab("actors");
    const nextForm = renderActorRecordForm(actor, () => undefined);
    const nextRoot = mountInDatabaseBody(nextForm);
    findByTestId(nextForm as unknown as FakeElement, `db-actor-build-open-skill-${classSkill.id}`)?.click();
    expect(getDatabaseActiveTab()).toBe("skills");
    expect(selectedRecordIdForSession("skills")).toBe(classSkill.id);
    expect(root).not.toBe(nextRoot);
  });

  it("renders broken skill and equipment references as inert warnings instead of navigation links", () => {
    // Break caught: a missing id is selected, then tab navigation silently falls back to the first record.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    if (!actor) throw new Error("fixture needs an actor");
    actor.learnedSkills = [{ level: 1, skillId: "skill_missing_preview" }];
    actor.initialEquipment = { weapon: "equip_missing_preview" };
    store.replace(project);

    const form = renderActorRecordForm(actor, () => undefined) as unknown as FakeElement;
    mountInDatabaseBody(form as unknown as HTMLElement);

    expect(findByTestId(form, "db-actor-build-open-skill-skill_missing_preview")).toBeNull();
    expect(findByTestId(form, "db-actor-build-open-equipment-equip_missing_preview")).toBeNull();
    findByTestId(form, "db-actor-build-warning-skill-skill_missing_preview")?.click();
    findByTestId(form, "db-actor-build-warning-equipment-equip_missing_preview")?.click();
    expect(getDatabaseActiveTab()).toBe("actors");
    expect(selectedRecordIdForSession("skills")).not.toBe("skill_missing_preview");
    expect(selectedRecordIdForSession("equipment")).not.toBe("equip_missing_preview");
  });

  it("previews runtime levels through 99 and exposes the natural max separately with live-region wiring", () => {
    // Break caught: actor.maxLevel truncates a valid runtime preview level and the control does not announce updates.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    if (!actor) throw new Error("fixture needs an actor");
    actor.maxLevel = 12;
    actor.parameterCurves = levelCurves({ attack: 10 });
    store.replace(project);

    expect(actorBuildPreview(project, actor.id, 99)?.level).toBe(99);
    const form = renderActorRecordForm(actor, () => undefined) as unknown as FakeElement;
    const level = findByTestId(form, "db-actor-build-level");
    const result = findByTestId(form, "db-actor-build-result");
    expect(level?.getAttribute("max")).toBe("99");
    expect(level?.getAttribute("aria-controls")).toBe(result?.getAttribute("id"));
    expect(result?.getAttribute("aria-live")).toBe("polite");
    expect(findByTestId(form, "db-actor-build-natural-max")?.dataset.maxLevel).toBe("12");
    expect(findByTestId(form, "db-actor-build-skills")?.dataset.scope).toBe("database-growth");
  });

  it("refreshes linked class and projected equipment immediately after consecutive actor edits", () => {
    // Break caught: the preview keeps the record snapshot until the whole actor form is reopened.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const nextClass = project.database.classes.find((entry) => entry.id !== actor?.classId);
    if (!actor || !nextClass) throw new Error("fixture needs an actor and a second class");
    actor.initialEquipment = {};
    actor.parameterCurves = levelCurves({ attack: 10 });
    const sword = normalizeEquipmentRecord({
      id: "equip_refresh_sword",
      name: "Refresh Sword",
      slot: "weapon",
      statBonuses: { attack: 23, defense: 0, mind: 0, agility: 0 },
    });
    project.database.equipment.push(sword);
    store.replace(project);

    const form = renderActorRecordForm(actor, () => undefined) as unknown as FakeElement;
    const classSelect = findByTestId(form, "db-picker-class");
    const equipmentSelect = findByTestId(form, "db-picker-actor-equipment-weapon");
    if (!classSelect || !equipmentSelect) throw new Error("missing actor build inputs");
    classSelect.value = nextClass.id;
    classSelect.dispatchEvent(new Event("change"));
    expect(findByTestId(form, "db-actor-build-open-class")?.textContent).toContain(nextClass.name);

    equipmentSelect.value = sword.id;
    equipmentSelect.dispatchEvent(new Event("change"));
    expect(findByTestId(form, `db-actor-build-open-equipment-${sword.id}`)).not.toBeNull();
    expect(findByTestId(form, "db-actor-build-stat-attack")?.textContent).toBe("33");
  });
});

describe("class build summary", () => {
  it("counts class-side equipment and ignores actor-only canEquip grants", () => {
    // Break caught: actor-only grants and classIds self-wildcard inflated the banner to the whole catalog.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !klass) throw new Error("fixture needs an actor and assigned class");
    klass.equipmentPermissions = { actorIds: [actor.id], classIds: [klass.id], equipmentIds: [] };
    project.database.equipment = [
      normalizeEquipmentRecord({
        id: "equip_actor_allowed",
        name: "Actor allowed",
        slot: "weapon",
        equippableActorIds: [actor.id],
      }),
      normalizeEquipmentRecord({
        id: "equip_class_allowed",
        name: "Class allowed",
        slot: "armor",
        equippableClassIds: [klass.id],
      }),
      normalizeEquipmentRecord({ id: "equip_disallowed", name: "Disallowed", slot: "helmet" }),
    ];

    expect(classBuildSummary(project, klass.id)?.equipmentCount).toBe(1);
  });

  it("counts class-common equipment for a promotion-only class with no directly assigned actors", () => {
    // Break caught: an actorless promotion target reports zero despite class-side runtime equipment permissions.
    const project = createBlankProject();
    const klass = project.database.classes[1];
    if (!klass) throw new Error("fixture needs a promotion-only class");
    project.database.actors = project.database.actors.filter((actor) => actor.classId !== klass.id);
    klass.equipmentPermissions = {
      actorIds: [],
      classIds: [],
      equipmentIds: ["equip_permission_allowed"],
    };
    project.database.equipment = [
      normalizeEquipmentRecord({
        id: "equip_class_side_allowed",
        name: "Class-side allowed",
        slot: "weapon",
        equippableClassIds: [klass.id],
      }),
      normalizeEquipmentRecord({
        id: "equip_permission_allowed",
        name: "Permission allowed",
        slot: "armor",
      }),
      normalizeEquipmentRecord({ id: "equip_promotion_denied", name: "Denied", slot: "helmet" }),
    ];

    expect(classBuildSummary(project, klass.id)?.equipmentCount).toBe(2);
  });

  it("does not treat classIds self-listing as an all-equipment grant on the class tab", () => {
    // Break caught: classIds:[self] made the banner count every item while the checklist showed a handful.
    const project = createBlankProject();
    const klass = project.database.classes[1];
    if (!klass) throw new Error("fixture needs a promotion-only class");
    project.database.actors = project.database.actors.filter((actor) => actor.classId !== klass.id);
    klass.equipmentPermissions = { actorIds: [], classIds: [klass.id], equipmentIds: [] };
    project.database.equipment = [
      normalizeEquipmentRecord({ id: "equip_class_id_one", name: "Class id one", slot: "weapon" }),
      normalizeEquipmentRecord({ id: "equip_class_id_two", name: "Class id two", slot: "armor" }),
    ];

    expect(classBuildSummary(project, klass.id)?.equipmentCount).toBe(0);
  });

  it("derives its role and backlink counts without mutating project data", () => {
    // Break caught: summary metadata is persisted into the schema or ignores the actual actor backlinks.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !klass) throw new Error("fixture needs an actor and assigned class");
    klass.parameterCurves = levelCurves({ attack: 20, defense: 300, mind: 10, agility: 5 });
    const before = JSON.stringify(project);

    const summary = classBuildSummary(project, klass.id);

    expect(summary?.role).toBe("guardian");
    expect(summary?.actorIds).toContain(actor.id);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("shows a derived role, factual build counts, and actor backlinks", () => {
    // Break caught: the class form remains an unconnected field ledger with no build summary or users.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    if (!actor || !klass) throw new Error("fixture needs an actor and assigned class");
    klass.parameterCurves = levelCurves({ attack: 20, defense: 300, mind: 10, agility: 5 });
    store.replace(project);

    const form = document.createElement("section") as unknown as FakeElement;
    renderClassRecordForm(form as unknown as HTMLElement, klass);
    mountInDatabaseBody(form as unknown as HTMLElement);

    const summary = findByTestId(form, "db-class-build-summary");
    expect(summary?.dataset.role).toBe("guardian");
    expect(summary?.dataset.actorCount).toBe("1");
    expect(summary?.dataset.skillCount).toBe(String(klass.learnedSkills.length));
    findByTestId(form, `db-class-build-open-actor-${actor.id}`)?.click();
    expect(getDatabaseActiveTab()).toBe("actors");
    expect(selectedRecordIdForSession("actors")).toBe(actor.id);
  });

  it("keeps summary counts fresh across consecutive class build edits", () => {
    // Break caught: local editors update the store but leave summary counts frozen at the first render.
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes.find((entry) => entry.id === actor?.classId);
    const skill = project.database.skills[0];
    const equipment = project.database.equipment[0];
    if (!actor || !klass || !skill || !equipment) throw new Error("fixture needs class build records");
    klass.battleCommands = [{ id: "cmd_only", name: "Only", kind: "attack" }];
    klass.learnedSkills = [];
    klass.promotions = [];
    klass.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
    equipment.equippableActorIds = [];
    equipment.equippableClassIds = [];
    project.database.equipment = [equipment];
    store.replace(project);

    const form = document.createElement("section") as unknown as FakeElement;
    renderClassRecordForm(form as unknown as HTMLElement, klass);
    mountInDatabaseBody(form as unknown as HTMLElement);

    findByTestId(form, "db-class-command-add")?.click();
    expect(findByTestId(form, "db-class-build-summary")?.dataset.commandCount).toBe("3");
    findByTestId(form, "db-class-command-add")?.click();
    expect(findByTestId(form, "db-class-build-summary")?.dataset.commandCount).toBe("4");

    findByTestId(form, "db-add-class-skill")?.click();
    expect(findByTestId(form, "db-class-build-summary")?.dataset.skillCount).toBe("1");
    findByTestId(form, "db-add-class-skill")?.click();
    expect(findByTestId(form, "db-class-build-summary")?.dataset.skillCount).toBe("2");

    const equipmentToggle = findByTestId(form, `db-field-class-equipment-${equipment.id}`);
    if (!equipmentToggle) throw new Error("missing class equipment toggle");
    equipmentToggle.checked = true;
    equipmentToggle.dispatchEvent(new Event("change"));
    expect(findByTestId(form, "db-class-build-summary")?.dataset.equipmentCount).toBe("1");

    findByTestId(form, "db-class-promotion-add")?.click();
    expect(findByTestId(form, "db-class-build-summary")?.dataset.promotionCount).toBe("1");
    expect(form.querySelectorAll(".db-class-promotion-row").length).toBe(1);
    findByTestId(form, "db-class-promotion-add")?.click();
    expect(findByTestId(form, "db-class-build-summary")?.dataset.promotionCount).toBe("2");
    expect(form.querySelectorAll(".db-class-promotion-row").length).toBe(2);
  });

  it("labels a Korean build eyebrow and a unique default warrior role", () => {
    const project = createBlankProject();
    const klass = project.database.classes[0];
    if (!klass) throw new Error("fixture needs the default warrior class");
    store.replace(project);

    const form = document.createElement("section") as unknown as FakeElement;
    renderClassRecordForm(form as unknown as HTMLElement, klass);

    expect(findByTestId(form, "db-class-build-eyebrow")?.textContent).toBe("직업 설계");
    expect(classBuildSummary(project, klass.id)?.role).toBe("striker");
    expect(findByTestId(form, "db-class-build-summary")?.dataset.role).toBe("striker");
    const catalog = project.database.equipment.length;
    expect(classBuildSummary(project, klass.id)?.equipmentCount).toBeLessThan(catalog);
    const sprite = findByTestId(form, "db-class-sprite-preview");
    expect(sprite?.getAttribute("style") ?? "").toContain("--class-sprite-url:");
    expect(findByTestId(form, "db-picker-class-state-rate-state_death")?.textContent).toContain("매우 약함");
    expect(findByTestId(form, "db-picker-class-state-rate-state_death")?.textContent).toContain("약함");
    const kindValues = (findByTestId(form, "db-field-class-command-kind")?.children ?? [])
      .filter((child) => child.tagName === "OPTION")
      .map((child) => child.getAttribute("value") ?? child.value);
    expect(kindValues).not.toContain("guard");
    expect(kindValues).not.toContain("event");
  });

  it("calls equal growth uniform instead of a designed balanced role", () => {
    const project = createBlankProject();
    const klass = project.database.classes[0];
    if (!klass) throw new Error("fixture needs a class");
    klass.parameterCurves = levelCurves({ attack: 10, defense: 10, mind: 10, agility: 10 });
    expect(classBuildSummary(project, klass.id)?.role).toBe("uniform");
  });
});
