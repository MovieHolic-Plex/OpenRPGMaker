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
});

describe("class build summary", () => {
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
});
