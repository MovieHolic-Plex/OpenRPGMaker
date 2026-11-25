import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActorRecordForm } from "@/editor/panels/actorRecordView";
import { getDatabaseActiveTab, setDatabaseActiveTab } from "@/editor/panels/database";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { actorBuildPreview, classBuildSummary } from "@/editor/panels/databasePartyBuildSummary";
import { resetRecordViewSessionState, selectedRecordIdForSession } from "@/editor/panels/databaseRecordViewSession";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ActorParameterCurves } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { createWorldPanelState, setPersistedCodexView } from "@/editor/panels/worldManager";
import { resolveRelationTarget } from "@/editor/panels/worldRelationTarget";
import type { WorldEntity } from "@/project/world/types";
import { isolateTimers } from "./mergedTeardown";

describe("databasePartyBuildStudio", () => {
  isolateTimers();
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
});

describe("worldDocumentWorkspace", () => {
  isolateTimers();
  let cleanup: () => void;
  beforeEach(() => {
    cleanup = installFakeDom();
    setPersistedCodexView("overview", null);
    const project = createBlankProject();
    project.world = {
      entities: [
        { id: "w_person", type: "character", name: "기록관", summary: "", origin: "user" },
        { id: "w_event", type: "event", name: "일식", summary: "", origin: "user" },
        { id: "w_place", type: "place", name: "항구", summary: "", origin: "user" },
        { id: "w_faction", type: "faction", name: "의회", summary: "", origin: "user" },
      ],
      relations: [{ a: "w_person", b: "w_faction", kind: "memberOf" }],
    };
    store.replace(project);
  });
  afterEach(() => cleanup());
  function control(panel: FakeElement, id: string): FakeElement {
    const node = findByTestId(panel, id);
    if (!node) throw new Error(`Missing control: ${id}`);
    return node;
  }
  describe("world document navigation", () => {
    it("clears an unrelated reading selection when the category changes", () => {
      const panel = renderWithFakeDom(() => renderWorldPanel());
      control(panel, "world-card-w_person").click();
      control(panel, "world-tab-event").click();
      expect(control(panel, "world-wiki-view").dataset.entityId).toBeUndefined();
      expect(findByTestId(panel, "world-card-w_event")).toBeTruthy();
    });

    it("clears reading details when search excludes the selected document", () => {
      const panel = renderWithFakeDom(() => renderWorldPanel());
      control(panel, "world-card-w_person").click();
      const search = control(panel, "world-search");
      search.value = "not-found";
      search.dispatchEvent(new Event("input"));
      expect(control(panel, "world-wiki-view").dataset.entityId).toBeUndefined();
      expect(control(panel, "world-search")).toBe(search);
    });

    it("preserves an out-of-filter draft and explicitly marks its context", () => {
      const state = createWorldPanelState();
      const panel = renderWithFakeDom(() => renderWorldPanel({ state }));
      control(panel, "world-card-w_person").click();
      control(panel, "world-edit-toggle").click();
      const input = control(panel, "world-edit-name");
      input.value = "작성 중인 인물";
      input.dispatchEvent(new Event("input"));
      control(panel, "world-tab-event").click();
      expect(state.editDraft?.name).toBe("작성 중인 인물");
      expect(control(panel, "world-draft-outside-filter").dataset.entityId).toBe("w_person");
    });

    it("browses places separately from factions", () => {
      const panel = renderWithFakeDom(() => renderWorldPanel());
      control(panel, "world-tab-place").click();
      expect(findByTestId(panel, "world-card-w_place")).toBeTruthy();
      expect(findByTestId(panel, "world-card-w_faction")).toBeNull();
    });

    it("opens a related document in its category", () => {
      const state = createWorldPanelState();
      const panel = renderWithFakeDom(() => renderWorldPanel({ state }));
      control(panel, "world-tab-character").click();
      control(panel, "world-card-w_person").click();
      control(panel, "world-relation-chip").click();
      expect(state.tab).toBe("faction");
      expect(control(panel, "world-wiki-view").dataset.entityId).toBe("w_faction");
      expect(findByTestId(panel, "world-card-w_faction")).toBeTruthy();
    });
  });
});

describe("worldRelationTarget", () => {
  isolateTimers();
  const card = (id: string, name: string): WorldEntity => ({ id, type: "place", name, summary: "", origin: "user" });
  const targets = [card("w_a", "은빛 항구"), card("w_b", "은빛 상단"), card("w_c", "폐탑"), card("w_d", "폐탑 지하")];
  const labels = new Map(targets.map((entity) => [entity.id, entity.name] as const));
  describe("연결 속성 입력 → 문서 id", () => {
    it("id 와 정확한 이름은 바로 찾는다", () => {
      expect(resolveRelationTarget("w_a", targets, labels)).toEqual({ kind: "found", id: "w_a" });
      expect(resolveRelationTarget(" 은빛 항구 ", targets, labels)).toEqual({ kind: "found", id: "w_a" });
    });
    it("정확한 이름이 부분 일치보다 먼저다", () => {
      expect(resolveRelationTarget("폐탑", targets, labels)).toEqual({ kind: "found", id: "w_c" });
    });
    it("유일한 부분 일치만 찾고, 여럿이면 모호하다고 돌려준다", () => {
      expect(resolveRelationTarget("지하", targets, labels)).toEqual({ kind: "found", id: "w_d" });
      expect(resolveRelationTarget("은빛", targets, labels)).toEqual({ kind: "ambiguous" });
    });
    it("없는 이름과 빈 입력은 저장하지 않는다", () => {
      expect(resolveRelationTarget("없는 문서", targets, labels)).toEqual({ kind: "none" });
      expect(resolveRelationTarget("  ", targets, labels)).toEqual({ kind: "none" });
    });
    it("같은 이름이 둘이면 「이름 · id」 표시 이름으로 고른다", () => {
      const dup = [card("w_x", "마을"), card("w_y", "마을")];
      const dupLabels = new Map([["w_x", "마을 · w_x"], ["w_y", "마을 · w_y"]]);
      expect(resolveRelationTarget("마을", dup, dupLabels)).toEqual({ kind: "ambiguous" });
      expect(resolveRelationTarget("마을 · w_y", dup, dupLabels)).toEqual({ kind: "found", id: "w_y" });
    });
  });
});
