import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderActorRecordForm, actorSummarySentence } from "@/editor/panels/actorRecordView";
import { getDatabaseActiveTab, setDatabaseActiveTab, TAB_GROUPS, PARTY_SUBVIEW_PARENT, databaseTabPath, renderDatabasePanel, refreshDatabasePanel } from "@/editor/panels/database";
import { renderClassRecordForm, classSummarySentence } from "@/editor/panels/databaseClassRecordView";
import { actorBuildPreview, classBuildSummary } from "@/editor/panels/databasePartyBuildSummary";
import { resetRecordViewSessionState, selectedRecordIdForSession, setViewModeForCollection, searchQueryForCollection, setCategoryFilterForCollection, setShowsPresetRecords } from "@/editor/panels/databaseRecordViewSession";
import { normalizeEquipmentRecord, normalizeItemRecord, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ActorParameterCurves } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { visibleActorColumns } from "@/editor/panels/databaseActorStudio";
import { skillSentenceFragments } from "@/editor/panels/databaseSkillRecordView";
import { itemSummarySentence } from "@/editor/panels/databaseItemRecordView";
import { isolateTimers } from "./mergedTeardown";
import { type DatabaseCollection, addDatabaseRecord } from "@/editor/databaseActions";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { renderSystemTab, requestSystemSection, resetRequestedSystemSection } from "@/editor/panels/databaseSystemView";
import { DEFAULT_MENU_SKIN_ID, listMenuSkinIds, MENU_SKINS } from "@/player/menuSkins/registry";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { resolveTimeSystem } from "@/project/gameTime";
import { listTitleMenuOptions } from "@/player/titleScreen";
import { getAudioEngine } from "@/player/audio";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";

describe("databaseParty", () => {
  isolateTimers();
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
  // 파티 그룹 정보량 줄이기(2026-09-23) — 레일 4칸·하위 보기 경로·머리 한 문장·같은 값 열 숨김.
  describe("databasePartySimplify", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
      Reflect.deleteProperty(globalThis, "window");
    });
    function mountPanel(tab: Parameters<typeof setDatabaseActiveTab>[0]): FakeElement {
      restoreDom = installFakeDom();
      const storage = new Map<string, string>();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } } },
      });
      store.replace(createBlankProject());
      setDatabaseActiveTab(tab);
      const host = document.createElement("div") as unknown as FakeElement;
      host.className = "database-modal-body";
      renderDatabasePanel(host as unknown as HTMLElement);
      return host;
    }
    describe("party rail", () => {
      // Break caught: 승급 트리·스킬 트리·공유 외형을 레일에 다시 올리면 초보가 「직업」과 「직업 승급 트리」를
      // 다른 데이터로 읽는 7칸 레일로 되돌아간다.
      it("keeps five primary party destinations and routes subviews under their owner", () => {
        const party = TAB_GROUPS.find((group) => group.slug === "party");
        expect(party?.tabs).toEqual(["actors", "characterGraphics", "classes", "skills", "items"]);
        expect(PARTY_SUBVIEW_PARENT).toEqual({ characterAppearances: "actors", promotionTree: "classes", skillTrees: "skills", comboTechs: "skills", animations: "retroChoreographies", itemCrafting: "items" });
        expect(databaseTabPath("promotionTree")).toEqual(["classes", "promotionTree"]);
        expect(databaseTabPath("skillTrees")).toEqual(["skills", "skillTrees"]);
        expect(databaseTabPath("characterAppearances")).toEqual(["actors", "characterAppearances"]);
      });
    });
    describe("party subview strip", () => {
      // Break caught: 레일에서 뺀 세 목적지에 닿을 길이 탭 검색뿐이 되면 사실상 사라진 기능이 된다.
      it("switches between an owner and its view without a rail row, keeping the owner active in the rail", () => {
        const host = mountPanel("classes");
        const strip = findByTestId(host, "db-party-subviews");
        expect(strip?.textContent).toBe("직업 편집승급 트리");
        findByTestId(host, "db-subview-promotion-tree")?.click();
        expect(getDatabaseActiveTab()).toBe("promotionTree");
        expect(findByTestId(host, "db-tab-classes")?.classList.contains("active")).toBe(true);
        expect(findByTestId(host, "db-subview-promotion-tree")?.classList.contains("active")).toBe(true);
        findByTestId(host, "db-subview-classes")?.click();
        expect(getDatabaseActiveTab()).toBe("classes");
      });

      it("does not draw the strip on tabs without views", () => {
        const host = mountPanel("elements");
        expect(findByTestId(host, "db-party-subviews")).toBeNull();
      });
    });
    describe("actor list columns", () => {
      it("hides level, HP and map columns when every actor shares the value", () => {
        const project = createBlankProject();
        const actors = project.database.actors.map((actor) => ({ ...actor, initialLevel: 1, characterTransparent: false, parameterCurves: { ...actor.parameterCurves, maxHp: project.database.actors[0]!.parameterCurves.maxHp } }));
        expect([...visibleActorColumns(actors)]).toEqual([]);
      });

      it("brings a column back as soon as one actor differs", () => {
        const project = createBlankProject();
        const base = project.database.actors[0]!;
        const actors = [base, { ...base, id: "other", initialLevel: base.initialLevel + 4, characterTransparent: !base.characterTransparent }];
        const columns = visibleActorColumns(actors);
        expect(columns.has("level")).toBe(true);
        expect(columns.has("map")).toBe(true);
      });
    });
    describe("record summary sentences", () => {
      it("says the actor's class, start level and party membership", () => {
        const project = createBlankProject();
        const actor = project.database.actors[0]!;
        const klass = project.database.classes.find((entry) => entry.id === actor.classId);
        project.system.startActorIds = [actor.id];
        expect(actorSummarySentence(project, actor)).toBe(`${klass?.name} 직업으로 Lv ${actor.initialLevel}에 시작하고, 처음부터 파티에 있습니다.`);
        project.system.startActorIds = [];
        expect(actorSummarySentence(project, actor)).toContain("이벤트로 합류할 때까지 대기합니다");
      });

      it("reads class counts as one sentence", () => {
        expect(classSummarySentence({ role: "striker", skillCount: 3, commandCount: 6, equipmentCount: 12, promotionCount: 0 }))
          .toBe("공격형 직업. 스킬 3개를 배우고, 전투 명령 6개 · 착용 장비 12종을 씁니다. 승급 경로는 없습니다.");
        expect(classSummarySentence({ role: "guardian", skillCount: 1, commandCount: 4, equipmentCount: 2, promotionCount: 2 }))
          .toContain("승급 경로 2개");
      });

      it("describes a skill without repeating defaults", () => {
        const project = createBlankProject();
        const skill = { ...project.database.skills[0]!, effect: { kind: "damage", statistic: "attack", affects: "hp" } as const, power: 10, successRate: 100, hitRate: 100, stateEffects: [], elementId: undefined };
        const fragments = skillSentenceFragments(project, skill);
        expect(fragments.primary).toBe("공격력 기반 HP 피해 · 위력 10");
        expect(fragments.element).toBe("");
        expect(fragments.states).toBe("");
        expect(skillSentenceFragments(project, { ...skill, hitRate: 90 }).primary).toContain("명중 90%");
      });

      it("answers what an item does when used", () => {
        const project = createBlankProject();
        const item = project.database.items.find((entry) => entry.hpRecovery.flat > 0 || entry.hpRecovery.percentMax > 0);
        expect(item).toBeDefined();
        const sentence = itemSummarySentence(project, item!);
        expect(sentence.startsWith("사용하면 ")).toBe(true);
        expect(sentence).toContain("HP");
      });
    });
  });
});

describe("databaseRecordViewSession", () => {
  isolateTimers();
  describe("databaseGalleryView", () => {
    isolateTimers();
    // 갤러리 뷰 fakeDom 테스트 — 정적 import 를 쓴다(vi.resetModules + 동적 import 는 이
    // 머신에서 모듈 그래프 재평가에 ~9초가 걸려 기본 15초 타임아웃을 넘긴다). 세션 모듈은
    // import 시점(window 미정의)에 localStorage 기본값(gallery)을 읽으므로 items 탭은 항상
    // 갤러리 기본값으로 렌더된다.
    type ProjectStoreLike = {
      replace(project: ReturnType<typeof createBlankProject>): void;
      update(mutator: (project: ReturnType<typeof createBlankProject>) => void): void;
    };
    const GALLERY_FIXTURE_COUNT = 133;
    let restoreDom: (() => void) | undefined;
    let previousWindow: typeof globalThis.window | undefined;
    let storage: Storage;
    beforeEach(() => {
      restoreDom = installFakeDom();
      previousWindow = globalThis.window;
      storage = createFakeLocalStorage();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          clearTimeout,
          localStorage: storage,
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
      (store as unknown as ProjectStoreLike).replace(createBlankProject());
      resetDatabaseRecordViewSession();
      // 뷰 모드는 세션 리셋을 가로질러 지속되므로(설계) 각 테스트가 갤러리 기본값에서 시작하게
      // 명시적으로 되돌린다 — 앞선 토글 테스트가 items 를 list 로 바꿔도 뒤 테스트가 안 깨진다.
      setViewModeForCollection("items", "gallery");
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
      restoreBrowserGlobal("window", previousWindow);
      Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    });
    describe("database gallery view", () => {
      it("renders cards by default for items and windows the grid so card count < total", () => {
        seedItems(GALLERY_FIXTURE_COUNT);
        const host = renderHost("items");

        // 갤러리 기본값: 카드가 렌더되고 리스트 행은 없다.
        const cards = host.querySelectorAll(".db-gallery-card");
        expect(cards.length).toBe(GALLERY_FIXTURE_COUNT);
        expect(host.querySelectorAll(".db-list-row")).toHaveLength(0);

        // 뷰포트 높이를 주면 가상화가 켜진다 — 렌더 카드 수 < 전체 레코드 수.
        const list = requireList(host);
        (list as unknown as { clientHeight: number }).clientHeight = 400;
        (list as unknown as { scrollTop: number }).scrollTop = 0;
        list.dispatchEvent(new Event("scroll"));
        const windowed = host.querySelectorAll(".db-gallery-card");
        expect(windowed.length).toBeGreaterThan(0);
        expect(windowed.length).toBeLessThan(GALLERY_FIXTURE_COUNT);
      });

      it("card testids follow db-record-card-<id> and carry recordId/recordName datasets", () => {
        seedItems(10);
        const host = renderHost("items");

        const cards = host.querySelectorAll(".db-gallery-card");
        expect(cards.length).toBe(10);
        for (const card of cards) {
          const id = card.dataset.recordId ?? "";
          expect(card.dataset.testid).toBe(`db-record-card-${id}`);
          expect(card.dataset.recordName).toBe(`아이템 ${id.slice(1)}`);
          expect(card.className).toContain("db-gallery-card");
          expect(card.tagName).toBe("BUTTON");
          expect(card.querySelector(".db-gallery-name")?.textContent).toBe(`아이템 ${id.slice(1)}`);
        }
      });

      it("cards show the category tag from existing record fields (items type / equipment slot)", () => {
        seedItems(5, { weaponCount: 3 });
        const host = renderHost("items");

        const weaponCards = host.querySelectorAll(".db-gallery-card").filter((card) => {
          const id = Number(card.dataset.recordId?.slice(1));
          return id >= 1 && id <= 3;
        });
        expect(weaponCards.length).toBe(3);
        for (const card of weaponCards) {
          expect(card.querySelector(".db-gallery-tag")?.textContent).toBe("무기");
        }
        const normalCards = host.querySelectorAll(".db-gallery-card").filter((card) => {
          const id = Number(card.dataset.recordId?.slice(1));
          return id > 3;
        });
        for (const card of normalCards) {
          expect(card.querySelector(".db-gallery-tag")?.textContent).toBe("일반 물품");
        }
      });

      it("clicking a card selects it (.active) and swaps the detail pane without rebuilding the list", () => {
        seedItems(20);
        const host = renderHost("items");
        const listElBefore = host.querySelector(".db-list");

        const card = findByTestId(host, "db-record-card-g5");
        if (!card) throw new Error("missing card g5");
        card.click();

        // 선택 카드만 active — 전체 리스트 재빌드 없이(같은 .db-list 노드) 디테일만 교체.
        // (fake DOM 은 복합 클래스 셀렉터를 지원하지 않으므로 필터로 확인한다.)
        const activeCards = host.querySelectorAll(".db-gallery-card").filter((card) => card.classList.contains("active"));
        expect(activeCards.map((card) => card.dataset.recordId)).toEqual(["g5"]);
        expect(host.querySelector(".db-list")).toBe(listElBefore);
        // 디테일 교체 검증: 디테일 팬(recordIdentity + 폼)에 선택한 레코드의 이름/ID가 보인다.
        // (recordIdentity 는 db-detail-form 섹션 밖 형제 노드라 팬 기준으로 확인한다.)
        const detailPane = host.querySelector(".db-detail-pane");
        expect(detailPane?.textContent).toContain("아이템 5");
        expect(detailPane?.textContent).toContain("g5");
      });

      it("search narrows the rendered cards", () => {
        seedItems(GALLERY_FIXTURE_COUNT);
        const host = renderHost("items");

        const search = host.querySelector(".db-search input");
        if (!(search instanceof FakeElement)) throw new Error("missing search input");
        search.value = "아이템 77";
        search.dispatchEvent(new Event("input"));

        const ids = cardIds(host);
        expect(ids).toEqual(["g77"]);
      });

      it("toggling to list mode re-renders db-list-row instead of cards", () => {
        seedItems(GALLERY_FIXTURE_COUNT);
        const host = renderHost("items");
        expect(host.querySelectorAll(".db-gallery-card").length).toBe(GALLERY_FIXTURE_COUNT);

        const listToggle = findByTestId(host, "db-view-toggle-list");
        if (!listToggle) throw new Error("missing list toggle");
        listToggle.click();

        expect(host.querySelectorAll(".db-gallery-card")).toHaveLength(0);
        expect(host.querySelectorAll(".db-list-row").length).toBe(GALLERY_FIXTURE_COUNT);
        expect(findByTestId(host, "db-record-row-g1")).not.toBeNull();
      });

      it("restores the gallery scroll position on remount", () => {
        seedItems(GALLERY_FIXTURE_COUNT);
        const host = renderHost("items");
        const list = requireList(host);
        (list as unknown as { clientHeight: number }).clientHeight = 400;
        (list as unknown as { scrollTop: number }).scrollTop = 500;
        list.dispatchEvent(new Event("scroll"));

        // 탭 전환 후 복귀 — 새 호스트에서 스크롤 위치가 복원된다.
        const freshHost = renderHost("items");
        const freshList = requireList(freshHost);
        expect(freshList.scrollTop).toBe(500);

        // 복원된 스크롤 위치에서 뷰포트 높이를 주면 윈도잉이 유지된다 (카드 수 < 전체).
        (freshList as unknown as { clientHeight: number }).clientHeight = 400;
        freshList.dispatchEvent(new Event("scroll"));
        expect(freshHost.querySelectorAll(".db-gallery-card").length).toBeLessThan(GALLERY_FIXTURE_COUNT);
      });

      it("derives columns from the modal window width (3 @<=1100px, 4 above)", () => {
        seedItems(GALLERY_FIXTURE_COUNT);
        const modal = document.createElement("div") as unknown as FakeElement;
        modal.className = "database-modal-window";
        (modal as unknown as { clientWidth: number }).clientWidth = 1024;

        const host = document.createElement("div") as unknown as FakeElement;
        modal.append(host);
        const rerender = (): void => {
          host.replaceChildren();
          renderRecordTab(host, "items", rerender);
        };
        rerender();
        expect(requireList(host).style.getPropertyValue("--db-gallery-columns")).toBe("3");

        // 모달 폭이 1100px 을 넘으면 열 수가 4 로 갱신된다 (scroll 이벤트가 render() 를 연결).
        (modal as unknown as { clientWidth: number }).clientWidth = 1280;
        const list = requireList(host);
        list.dispatchEvent(new Event("scroll"));
        expect(list.style.getPropertyValue("--db-gallery-columns")).toBe("4");
      });

      it("empty collection renders an empty gallery without crashing", () => {
        (store as unknown as ProjectStoreLike).update((project) => {
          project.database.items = [];
        });
        const host = renderHost("items");
        expect(host.querySelectorAll(".db-gallery-card")).toHaveLength(0);
        expect(host.querySelector(".db-list")).not.toBeNull();
        expect(host.textContent).toContain("0개");
      });
    });
    // 시드 픽스처: 기본 normalGoods + 앞쪽 weaponCount 개는 weapon 타입(태그 검증용).
    // 리소스 미지정이라 썸네일은 빈 슬롯 — fake DOM 에서 이미지 로딩/크로마키 경로를 피한다.
    function seedItems(count: number, options: { readonly weaponCount?: number } = {}): void {
      const weaponCount = options.weaponCount ?? 0;
      (store as unknown as ProjectStoreLike).update((project) => {
        project.database.items = Array.from({ length: count }, (_, index) => {
          const number = index + 1;
          return normalizeItemRecord({
            id: `g${number}`,
            name: `아이템 ${number}`,
            type: number <= weaponCount ? "weapon" : "normalGoods",
          });
        });
      });
    }
    function renderHost(collection: DatabaseCollection): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderRecordTab(host, collection, rerender);
      };
      rerender();
      return host;
    }
    function requireList(host: FakeElement): FakeElement {
      const list = host.querySelector(".db-list");
      if (list instanceof FakeElement) return list;
      throw new Error("missing .db-list container");
    }
    function cardIds(host: FakeElement): string[] {
      return host.querySelectorAll(".db-gallery-card").map((card) => card.dataset.recordId ?? "");
    }
    function createFakeLocalStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      } as Storage;
    }
    function restoreBrowserGlobal(name: "window", value: typeof globalThis.window | undefined): void {
      if (value === undefined) {
        Reflect.deleteProperty(globalThis, name);
        return;
      }
      Object.defineProperty(globalThis, name, { configurable: true, value });
    }
  });
  describe("databaseRecordPartialRender", () => {
    isolateTimers();
    type FakeBrowserGlobals = {
      readonly Image: typeof globalThis.Image | undefined;
      readonly window: typeof globalThis.window | undefined;
      readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
    };
    let restoreDom: (() => void) | undefined;
    let previousBrowserGlobals: FakeBrowserGlobals;
    beforeEach(() => {
      restoreDom = installFakeDom();
      previousBrowserGlobals = {
        Image: globalThis.Image,
        requestAnimationFrame: globalThis.requestAnimationFrame,
        window: globalThis.window,
      };
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: class {
          addEventListener(): void {}
          set src(_value: string) {}
        },
      });
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          clearTimeout,
          localStorage: createFakeLocalStorage(),
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
      setDatabaseActiveTab("terms");
      resetDatabaseRecordViewSession();
      // 스킬 탭은 갤러리 기본값이지만 이 테스트는 리스트 행 부분 렌더 계약을 검증한다 — 명시적으로 list.
      setViewModeForCollection("skills", "list");
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
      restoreBrowserGlobal("window", previousBrowserGlobals.window);
      restoreBrowserGlobal("Image", previousBrowserGlobals.Image);
      restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
    });
    describe("Database record tab partial rendering", () => {
      it("Given the actors collection When the record tab renders Then it uses the studio table and contextual inspector contract", () => {
        // Break caught: actors still render as the old narrow roster beside a card-heavy form.
        const host = renderRecordHost("actors");

        expect(findByTestId(host, "db-actor-studio")).not.toBeNull();
        expect(findByTestId(host, "db-actor-studio")?.textContent).toContain("주인공");
        expect(findByTestId(host, "db-actor-studio-summary")).toBeNull();
        expect(findByTestId(host, "db-actor-table-header")?.textContent).toContain("캐릭터");
        // 75f5319ace: 직업은 목록 열이 아니라 행 부제·인스펙터가 말한다 — 표 머리는 캐릭터 열(+값이 갈리는 선택 열)만 갖는다.
        expect(findByTestId(host, "db-actor-table-header")?.textContent).not.toContain("직업");
        // 레벨·HP·맵 표시 열은 주인공마다 값이 다를 때만 선다(visibleActorColumns — databasePartySimplify.test.ts).
        expect(host.querySelector(".db-studio-table-pane")).not.toBeNull();
        expect(host.querySelector(".db-studio-inspector-pane")).not.toBeNull();

        const actorId = store.getCurrent().database.actors[0]?.id ?? "";
        expect(findByTestId(host, `db-record-row-${actorId}`)).not.toBeNull();
        expect(findByTestId(host, "db-detail-form")).not.toBeNull();
        // 얼굴 한 칸 = 파일 한 장 — 히어로 헤더는 시트 크롭이 아니라 그림 한 장을 그린다.
        expect(findByTestId(host, "db-record-hero")?.querySelector(".actor-face-image")).not.toBeNull();
        expect(findByTestId(host, "db-record-hero")?.querySelector(".actor-sheet-crop")).toBeNull();
      });

      it("Given an actor opens When the inspector renders Then hierarchy is expressed by direct tabs without guidance copy", () => {
        // Break caught: a tutorial card and numbered long-form document explain hierarchy instead of embodying it.
        const host = renderRecordHost("actors");

        expect(findByTestId(host, "db-actor-beginner-guide")).toBeNull();
        expect(host.querySelector(".actor-task-next")).toBeNull();
        expect(findByTestId(host, "db-actor-section-tabs")?.textContent).toBe("기본외형성장전투결과");
        expect(findByTestId(host, "db-actor-tab-identity")?.attrs["aria-selected"]).toBe("true");
        expect(findByTestId(host, "db-actor-panel-identity")?.hidden).toBe(false);
        expect(findByTestId(host, "db-actor-panel-appearance")?.hidden).toBe(true);
        expect(findByTestId(host, "db-record-hero")?.textContent).toContain("시작 파티");

        findByTestId(host, "db-actor-tab-battle")?.click();
        expect(findByTestId(host, "db-actor-tab-identity")?.attrs["aria-selected"]).toBe("false");
        expect(findByTestId(host, "db-actor-tab-battle")?.attrs["aria-selected"]).toBe("true");
        expect(findByTestId(host, "db-actor-panel-identity")?.hidden).toBe(true);
        expect(findByTestId(host, "db-actor-panel-battle")?.hidden).toBe(false);
        expect(findByTestId(host, "db-actor-panel-battle")?.textContent).toContain("크리티컬 공격");
      });

      it("Given the actors gallery preference When the tab renders Then it preserves the existing card gallery", () => {
        setViewModeForCollection("actors", "gallery");
        const host = renderRecordHost("actors");

        expect(findByTestId(host, "db-actor-studio")).toBeNull();
        const actorId = store.getCurrent().database.actors[0]?.id ?? "";
        expect(findByTestId(host, `db-record-card-${actorId}`)).not.toBeNull();
      });

      it("Given a record selection When another record row is clicked Then the list is not rebuilt and only the active row changes", () => {
        // 목록은 기본으로 「이 게임 것만」이라(#5026) 새 레코드가 생기면 기본 카탈로그 행은 가려진다 — 두 행 모두 더한 것으로 잰다.
        const firstId = addDatabaseRecord("skills");
        const secondId = addDatabaseRecord("skills");
        const host = renderRecordHost("skills");

        const firstRowBefore = findByTestId(host, `db-record-row-${firstId}`);
        const secondRowBefore = findByTestId(host, `db-record-row-${secondId}`);
        expect(firstRowBefore).not.toBeNull();
        expect(secondRowBefore).not.toBeNull();

        secondRowBefore?.click();

        // 리스트 행 노드는 재생성되지 않고 그대로 유지되어야 한다(스크롤/포커스 보존의 근거).
        expect(findByTestId(host, `db-record-row-${firstId}`)).toBe(firstRowBefore);
        expect(findByTestId(host, `db-record-row-${secondId}`)).toBe(secondRowBefore);
        // 활성 표시는 클릭한 행으로만 이동한다.
        expect(secondRowBefore?.attrs["aria-pressed"]).toBe("true");
        expect(firstRowBefore?.attrs["aria-pressed"]).toBe("false");
        // 디테일 폼은 선택한 레코드로 교체된다.
        expect(nameInputValue(host)).toBe(store.getCurrent().database.skills.find((entry) => entry.id === secondId)?.name);
      });

      it("Given a name field edit When the value changes Then the list row label updates without rebuilding the detail form", () => {
        const skillId = store.getCurrent().database.skills[0]?.id ?? "";
        const host = renderRecordHost("skills");

        const detailFormBefore = findByTestId(host, "db-detail-form");
        const nameInput = findByTestId(host, "db-field-name");
        expect(detailFormBefore).not.toBeNull();
        expect(nameInput).not.toBeNull();

        nameInput!.value = "번개 강타";
        nameInput!.dispatchEvent(new Event("input"));

        // 리스트 행 라벨이 즉시 갱신된다.
        const row = findByTestId(host, `db-record-row-${skillId}`);
        expect(row?.querySelector(".db-list-name")?.textContent).toBe("번개 강타");
        expect(row?.dataset.recordName).toBe("번개 강타");
        // 스토어에도 반영된다.
        expect(store.getCurrent().database.skills.find((entry) => entry.id === skillId)?.name).toBe("번개 강타");
        // 디테일 폼 노드는 재생성되지 않아 입력 포커스가 유지된다.
        expect(findByTestId(host, "db-detail-form")).toBe(detailFormBefore);
      });

      it("Given an actor name edit When the inspector changes Then the studio row updates without rebuilding", () => {
        setViewModeForCollection("actors", "list");
        const actorId = store.getCurrent().database.actors[0]?.id ?? "";
        const host = renderRecordHost("actors");
        const detailFormBefore = findByTestId(host, "db-detail-form");
        const nameInput = findByTestId(host, "db-field-name");

        nameInput!.value = "새 주인공 이름";
        nameInput!.dispatchEvent(new Event("input"));

        const row = findByTestId(host, `db-record-row-${actorId}`);
        expect(row?.querySelector(".db-list-name")?.textContent).toBe("새 주인공 이름");
        expect(store.getCurrent().database.actors[0]?.name).toBe("새 주인공 이름");
        expect(findByTestId(host, "db-detail-form")).toBe(detailFormBefore);
      });

      it("Given a scrolled record list When the tab is re-rendered Then the scroll position is restored", () => {
        const firstHost = renderRecordHost("skills");
        const listBefore = firstHost.querySelector(".db-list");
        expect(listBefore).not.toBeNull();

        (listBefore as unknown as { scrollTop: number }).scrollTop = 144;
        listBefore!.dispatchEvent(new Event("scroll"));

        const secondHost = renderRecordHost("skills");
        const listAfter = secondHost.querySelector(".db-list");
        expect((listAfter as unknown as { scrollTop: number }).scrollTop).toBe(144);
      });
    });
    describe("Database panel partial refresh (undo/redo path)", () => {
      it("Given a mounted panel When refreshDatabasePanel runs Then the tab scaffold is preserved and only the body re-renders", () => {
        const container = document.createElement("div") as unknown as FakeElement;
        renderDatabasePanel(container as unknown as HTMLElement);
        const headerBefore = container.querySelector(".db-tabs");
        const bodyBefore = container.querySelector(".db-body");
        expect(headerBefore).not.toBeNull();
        expect(bodyBefore).not.toBeNull();

        refreshDatabasePanel(container as unknown as HTMLElement);

        // 헤더 스캐폴드는 동일 인스턴스로 유지되고 본문만 다시 그려진다.
        expect(container.querySelector(".db-tabs")).toBe(headerBefore);
        expect(container.querySelector(".db-body")).toBe(bodyBefore);
        expect(container.querySelectorAll(".db-tabs").length).toBe(1);
        expect(bodyBefore?.childNodes.length).toBeGreaterThan(0);
      });
    });
    describe("Database tab render cache", () => {
      it("Given an unchanged project When a previously visited tab is reopened Then its rendered view is reused", () => {
        // Break caught: sidebar tab clicks discard a complete tab view and rebuild its list, thumbnails, and form.
        setDatabaseActiveTab("terms");
        const container = document.createElement("div") as unknown as FakeElement;
        renderDatabasePanel(container as unknown as HTMLElement);
        const termsViewBefore = container.querySelector(".db-body")?.firstChild;

        findByTestId(container, "db-tab-variables")?.click();
        findByTestId(container, "db-tab-terms")?.click();

        expect(container.querySelector(".db-body")?.firstChild).toBe(termsViewBefore);
      });

      it("Given a cached tab When project data changes Then reopening the tab renders fresh data", () => {
        // Break caught: a tab cache survives a project mutation and shows stale record data.
        setDatabaseActiveTab("terms");
        const container = document.createElement("div") as unknown as FakeElement;
        renderDatabasePanel(container as unknown as HTMLElement);
        const termsViewBefore = container.querySelector(".db-body")?.firstChild;

        findByTestId(container, "db-tab-variables")?.click();
        store.update((project) => {
          project.meta.terms.gold = "Cache invalidated gold";
        }, { scope: "database", collection: "terms" });
        findByTestId(container, "db-tab-terms")?.click();

        expect(container.querySelector(".db-body")?.firstChild).not.toBe(termsViewBefore);
        expect(findByTestId(container, "db-field-gold")?.value).toBe("Cache invalidated gold");
      });
    });
    function renderRecordHost(collection: Parameters<typeof renderRecordTab>[1]): FakeElement {
      const host = document.createElement("div");
      renderRecordTab(host, collection, () => undefined);
      if (host instanceof FakeElement) return host;
      throw new Error("Expected fake database host");
    }
    function nameInputValue(host: FakeElement): string | undefined {
      return findByTestId(host, "db-field-name")?.value;
    }
    function createFakeLocalStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      } as Storage;
    }
    function restoreBrowserGlobal(name: keyof FakeBrowserGlobals, value: FakeBrowserGlobals[typeof name]): void {
      if (value === undefined) {
        Reflect.deleteProperty(globalThis, name);
        return;
      }
      Object.defineProperty(globalThis, name, { configurable: true, value });
    }
  });
  describe("databaseRecordSearch", () => {
    isolateTimers();
    // 목록 검색은 80ms 뒤에 탭을 다시 그린다. 타이머를 즉시 돌리면, 그 사이에 옮긴 커서와
    // 조합 중인 음절을 구분할 수 없다.
    type PendingTimer = { id: number; run: () => void };
    let restoreDom: (() => void) | undefined;
    let previousWindow: typeof globalThis.window | undefined;
    let storage: Storage;
    let timers: PendingTimer[] = [];
    let nextTimerId = 1;
    beforeEach(() => {
      restoreDom = installFakeDom();
      previousWindow = globalThis.window;
      storage = createFakeLocalStorage();
      timers = [];
      nextTimerId = 1;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          localStorage: storage,
          setTimeout: (handler: TimerHandler): number => {
            const id = nextTimerId;
            nextTimerId += 1;
            if (typeof handler === "function") timers.push({ id, run: () => handler() });
            return id;
          },
          clearTimeout: (id: number): void => {
            timers = timers.filter((timer) => timer.id !== id);
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
      resetDatabaseRecordViewSession();
      setViewModeForCollection("items", "list");
      setCategoryFilterForCollection("items", "all");
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
      restoreBrowserGlobal("window", previousWindow);
      Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    });
    describe("database record scope — 이 게임 것만", () => {
      it("기본 프리셋 사이에 이 게임 레코드가 있으면 그것만 보이고, 개수 단추로 프리셋까지 펼친다", () => {
        setShowsPresetRecords("items", false);
        const presetCount = store.getCurrent().database.items.length;
        store.update((project) => {
          project.database.items = [...project.database.items, normalizeItemRecord({ id: "it_game_sword", name: "동검", type: "medicine" })];
        });
        const host = document.createElement("div") as unknown as FakeElement;
        document.body.append(host);
        const rerender = (): void => {
          host.replaceChildren();
          renderRecordTab(host, "items", rerender);
        };
        rerender();

        expect(visibleRecordIds(host)).toEqual(["it_game_sword"]);
        const scope = findByTestId(host, "db-record-scope");
        if (!(scope instanceof FakeElement)) throw new Error("missing scope toggle");
        expect(scope.textContent).toBe("이 게임 것 1개");
        expect(scope.dataset.scope).toBe("game");

        scope.click();
        const widened = findByTestId(host, "db-record-scope");
        if (!(widened instanceof FakeElement)) throw new Error("missing scope toggle");
        expect(widened.dataset.scope).toBe("all");
        expect(widened.textContent).toBe(`기본 포함 ${presetCount + 1}개`);
        expect(visibleRecordIds(host).length).toBeGreaterThan(1);
        setShowsPresetRecords("items", false);
      });

      it("기본 프리셋뿐이면 가리지 않고 단추도 없다", () => {
        const host = document.createElement("div") as unknown as FakeElement;
        document.body.append(host);
        renderRecordTab(host, "items", () => undefined);
        expect(findByTestId(host, "db-record-scope")).toBeFalsy();
        expect(visibleRecordIds(host).length).toBeGreaterThan(1);
      });
    });
    describe("database record search", () => {
      it("puts the caret back where it was when the list rebuilds", () => {
        const host = renderItems();
        const search = searchInput(host);
        search.value = "회복약";
        search.setSelectionRange(1, 1);
        search.dispatchEvent(new Event("input", { bubbles: true }));
        expect(searchInput(host)).toBe(search);
        expect(searchQueryForCollection("items")).toBe("");

        // 디바운스 안에 커서를 옮긴다. 예전의 구현은 첫 input 시점의 칸(1)으로 되돌렸다.
        search.setSelectionRange(2, 2);
        flushTimers();

        const next = searchInput(host);
        expect(next).not.toBe(search);
        expect(next.value).toBe("회복약");
        expect(next.selectionStart).toBe(2);
        expect(next.selectionEnd).toBe(2);
        expect(visibleRecordIds(host)).toEqual(["it_potion"]);
      });

      it("keeps the search field while an IME composition is in progress", () => {
        const host = renderItems();
        const search = searchInput(host);
        search.dispatchEvent(new Event("compositionstart"));
        search.value = "회";
        const composing = new Event("input", { bubbles: true });
        Object.defineProperty(composing, "isComposing", { value: true });
        search.dispatchEvent(composing);
        flushTimers();
        expect(searchInput(host)).toBe(search);
        expect(searchQueryForCollection("items")).toBe("");
        expect(visibleRecordIds(host)).toEqual(["it_potion", "it_ether"]);

        search.value = "회복";
        search.setSelectionRange(1, 1);
        search.dispatchEvent(new Event("compositionend", { bubbles: true }));
        const next = searchInput(host);
        expect(next).not.toBe(search);
        expect(next.value).toBe("회복");
        expect(next.selectionStart).toBe(1);
        expect(next.selectionEnd).toBe(1);
        expect(visibleRecordIds(host)).toEqual(["it_potion"]);

        // 조합이 끝난 칸에 같은 값의 input 이 한 번 더 와도 커서를 끝으로 밀지 않는다.
        search.setSelectionRange(search.value.length, search.value.length);
        search.dispatchEvent(new Event("input", { bubbles: true }));
        flushTimers();
        expect(searchInput(host).selectionStart).toBe(1);
        expect(searchInput(host).selectionEnd).toBe(1);
      });

      it("does not bake an in-progress syllable when the debounce fires during composition", () => {
        const host = renderItems();
        const search = searchInput(host);
        search.value = "회";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        search.dispatchEvent(new Event("compositionstart"));
        search.value = "회복";
        flushTimers();
        expect(searchInput(host)).toBe(search);
        expect(searchQueryForCollection("items")).toBe("");

        search.value = "회";
        search.setSelectionRange(1, 1);
        search.dispatchEvent(new Event("compositionend", { bubbles: true }));
        const next = searchInput(host);
        expect(next.value).toBe("회");
        expect(next.selectionStart).toBe(1);
        expect(searchQueryForCollection("items")).toBe("회");
        expect(visibleRecordIds(host)).toEqual(["it_potion"]);
      });

      it("forgets an unfinished syllable when IME composition is cancelled", () => {
        const host = renderItems();
        const search = searchInput(host);
        search.dispatchEvent(new Event("compositionstart"));
        search.value = "회";
        const composing = new Event("input", { bubbles: true });
        Object.defineProperty(composing, "isComposing", { value: true });
        search.dispatchEvent(composing);
        search.value = "";
        search.dispatchEvent(new Event("compositionend", { bubbles: true }));
        expect(searchQueryForCollection("items")).toBe("");
        expect(searchInput(host)).toBe(search);
        expect(search.value).toBe("");
        expect(visibleRecordIds(host)).toEqual(["it_potion", "it_ether"]);
      });
    });
    function flushTimers(): void {
      const pending = timers.splice(0);
      for (const timer of pending) timer.run();
    }
    function renderItems(): FakeElement {
      store.update((project) => {
        project.database.items = [
          normalizeItemRecord({ id: "it_potion", name: "회복약", type: "medicine" }),
          normalizeItemRecord({ id: "it_ether", name: "마력약", type: "medicine" }),
        ];
      });
      const host = document.createElement("div") as unknown as FakeElement;
      document.body.append(host);
      const rerender = (): void => {
        host.replaceChildren();
        renderRecordTab(host, "items", rerender);
      };
      rerender();
      return host;
    }
    function searchInput(host: FakeElement): FakeElement {
      const input = findByTestId(host, "db-record-search");
      if (!(input instanceof FakeElement)) throw new Error("missing record search");
      return input;
    }
    function visibleRecordIds(host: FakeElement): string[] {
      return [
        ...host.querySelectorAll(".db-list-row"),
        ...host.querySelectorAll(".db-gallery-card"),
      ].map((row) => row.dataset.recordId ?? "");
    }
    function createFakeLocalStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      } as Storage;
    }
    function restoreBrowserGlobal(name: "window", value: typeof globalThis.window | undefined): void {
      if (value === undefined) {
        Reflect.deleteProperty(globalThis, name);
        return;
      }
      Object.defineProperty(globalThis, name, { configurable: true, value });
    }
  });
});

describe("databaseSystemView", () => {
  isolateTimers();
  // 자료집 시스템 탭 「게임 메뉴 디자인」 — ESC 메뉴 스킨 12종을 고르고, 기본값은 저장에서 지운다.
  describe("databaseSystemMenuSkin", () => {
    isolateTimers();
    function renderSystem(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderSystemTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    describe("system tab menu skin cards", () => {
      let cleanup: (() => void) | undefined;

      beforeEach(() => {
        cleanup = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        cleanup?.();
        cleanup = undefined;
      });

      it("스킨 12종을 레지스트리 순서·라벨로 내놓고 기본이 선택돼 있다", () => {
        const host = renderSystem();
        const select = findByTestId(host, "db-field-system-menu-ui-style");
        expect(select).not.toBeNull();
        const cards = select!.children;
        expect(cards.map((card) => card.dataset.testid)).toEqual(listMenuSkinIds().map((id) => `db-system-menu-skin-${id}`));
        expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual(listMenuSkinIds().map((id) => MENU_SKINS[id].label));
        // 기본 스킨은 2026-09-28 에 workbench → pixel 로 바뀌었다(registry.ts DEFAULT_MENU_SKIN_ID). 이름을 박지 않고 상수를 본다.
        expect(findByTestId(host, `db-system-menu-skin-${DEFAULT_MENU_SKIN_ID}`)?.getAttribute("aria-pressed")).toBe("true");
      });

      it("선택을 바꾸면 store 에 반영되고 선택 표시와 설명이 따라온다, 기본으로 돌리면 키를 지운다", () => {
        const host = renderSystem();
        findByTestId(host, "db-system-menu-skin-hub")!.click();
        expect(store.getCurrent().system.menuUiStyle).toBe("hub");
        expect(findByTestId(host, "db-system-menu-skin-hub")?.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(host, `db-system-menu-skin-${DEFAULT_MENU_SKIN_ID}`)?.getAttribute("aria-pressed")).toBe("false");
        expect(findByTestId(host, "db-system-menu-skin-description")?.textContent).toContain(MENU_SKINS.hub.label);
        findByTestId(host, `db-system-menu-skin-${DEFAULT_MENU_SKIN_ID}`)!.click();
        expect(store.getCurrent().system.menuUiStyle).toBeUndefined();
      });

      it("저장된 선택으로 다시 열면 그 값이 선택돼 있고 스튜디오 게임 메뉴 카드에도 라벨이 보인다", () => {
        store.update((draft) => {
          draft.system.menuUiStyle = "sheet";
        });
        const host = renderSystem();
        expect(findByTestId(host, "db-system-menu-skin-sheet")?.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(host, "db-system-studio-card-menu")?.textContent).toContain(MENU_SKINS.sheet.label);
      });
    });
  });
  describe("databaseSystemModern", () => {
    isolateTimers();
    let cleanup: (() => void) | undefined;
    function render(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      document.body.append(host as unknown as HTMLElement);
      const refresh = (): void => {
        host.replaceChildren();
        renderSystemTab(host as unknown as HTMLElement, refresh);
        // fakeDom does not reflect the type attribute into HTMLInputElement.type.
        for (const input of host.querySelectorAll("input")) input.type = input.getAttribute("type") ?? "text";
      };
      refresh();
      return host;
    }
    function node(host: FakeElement, id: string): FakeElement {
      const result = findByTestId(host, id);
      if (!result) throw new Error(`Missing ${id}`);
      return result;
    }
    function change(host: FakeElement, id: string, value: string): void {
      const input = node(host, id); input.value = value; input.dispatchEvent(new Event("change"));
    }
    function checkbox(host: FakeElement, id: string, checked: boolean): void {
      const input = node(host, id); input.checked = checked; input.dispatchEvent(new Event("change"));
    }
    beforeEach(() => { cleanup = installFakeDom(); store.replace(createBlankProject()); resetMapEditHistory(); resetRequestedSystemSection(); });
    afterEach(() => { vi.unstubAllGlobals(); cleanup?.(); resetRequestedSystemSection(); });
    describe("System workspace contracts", () => {
      it("indexes all nine editing destinations and filters without dirtying or replacing search", () => {
        const host = render();
        const studio = node(host, "db-system-studio");
        const targets = new Set(studio.querySelectorAll("button").map((button) => button.dataset.systemTarget).filter(Boolean));
        expect([...targets].sort()).toEqual(["party", "display", "menu", "hud", "font", "resources", "sound", "startup", "optin", "time", "typechart", "title"].sort());
        const before = JSON.stringify(store.getCurrent());
        const search = node(host, "db-system-studio-command-search");
        search.focus(); search.value = "__no_matching_setting__"; search.dispatchEvent(new Event("input"));
        expect(node(host, "db-system-studio-no-results").hidden).toBe(false);
        expect(node(host, "db-system-studio-command-search")).toBe(search);
        node(host, "db-system-studio-search-reset").click();
        expect(search.value).toBe("");
        expect(node(host, "db-system-studio-no-results").hidden).toBe(true);
        expect(JSON.stringify(store.getCurrent())).toBe(before);
        expect(getMapEditHistoryEntries()).toHaveLength(0);
      });

      it("routes requested focus and preserves all mounted section identities during navigation", () => {
        requestSystemSection("display", "db-field-system-resolution-width");
        const host = render();
        expect(host.dataset.dbSystemSection).toBe("display");
        expect(document.activeElement).toBe(node(host, "db-field-system-resolution-width"));
        const sections = host.querySelectorAll(".db-system-section");
        const nav = node(host, "db-system-section-nav");
        // 「소리」 구획(#4968)이 더해져 14개다.
        expect(nav.querySelectorAll(".db-system-section-button")).toHaveLength(14);
        expect(nav.querySelectorAll(".db-system-section-nav")).toHaveLength(0);
        node(host, "db-system-nav-party").click();
        expect(host.querySelectorAll(".db-system-section")).toEqual(sections);
        expect(sections.filter((section) => !section.hidden).map((section) => section.dataset.systemSection)).toEqual(["party"]);
      });

      it("keeps focused title typing mounted and updates preview and authored menu labels", () => {
        const host = render();
        node(host, "db-system-nav-title").click();
        const title = node(host, "db-field-title-screen-title");
        title.focus(); title.value = "새 제목 sentinel"; title.dispatchEvent(new Event("input"));
        expect(node(host, "db-field-title-screen-title")).toBe(title);
        expect(document.activeElement).toBe(title);
        expect(node(host, "db-title-workbench-title-text").textContent).toBe(title.value);
        const resume = node(host, "db-field-title-screen-resume");
        resume.focus(); resume.value = "resume-sentinel"; resume.dispatchEvent(new Event("input"));
        expect(node(host, "db-field-title-screen-resume")).toBe(resume);
        const expected = listTitleMenuOptions(store.getCurrent().system.titleScreen!, { autosaveAvailable: true });
        const preview = node(host, "db-title-workbench-menu-preview");
        expect(preview.childNodes.map((entry) => (entry as FakeElement).textContent)).toEqual(expected.map((option) => option.label));
      });

      it("retains disabled calendars through normalization and keeps the runtime clock off", () => {
        store.update((draft) => { draft.system.timeSystem = { enabled: true, daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5, forceSleep: true }; });
        const host = render();
        checkbox(host, "db-field-system-time-enabled", false);
        const normalized = normalizeSystemRecords(store.getCurrent().system);
        expect(normalized.timeSystem).toMatchObject({ enabled: false, daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5, forceSleep: true });
        expect(resolveTimeSystem(normalized.timeSystem)).toBeUndefined();
        checkbox(host, "db-field-system-time-enabled", true);
        expect(resolveTimeSystem(store.getCurrent())).toMatchObject({ daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5 });
      });

      it("directly clears a logo, preserves sibling fields, and supports undo and reopening", () => {
        store.update((draft) => { draft.system.titleScreen!.titleGraphic = { mode: "both", resourceId: "easyrpg-title-title1", x: 32, y: 24 }; });
        resetMapEditHistory();
        const host = render();
        node(host, "db-field-title-screen-logo-clear").click();
        expect(normalizeSystemRecords(store.getCurrent().system).titleScreen?.titleGraphic).toMatchObject({ mode: "both", x: 32, y: 24 });
        expect(store.getCurrent().system.titleScreen?.titleGraphic?.resourceId).toBeUndefined();
        expect(undoMapEdit()).toBe(true);
        // 다시 열기 = 먼저 연 탭은 닫히고 새로 그린다. 첫 탭을 문서에 붙여 둔 채 둘째 탭을 그리면, 가짜 DOM 의 MutationObserver 가 변경 하나마다
        // 지켜보는 나무 전체(붙어 있는 첫 탭까지)를 훑어(fakeDom FakeNode.contains) 이 한 경우가 러너에서 17.8~37.9초 걸렸고 기본 한도 15초를 넘겼다.
        // 제품 시간이 아니다 — 첫 탭을 떼면 둘째 그리기는 첫째와 같은 시간이다. 한도는 그대로 둔다.
        host.remove();
        expect(node(render(), "db-field-title-screen-logo").value).toBe("easyrpg-title-title1");
      });

      it("preserves authored parallax when editing a title layer and omits default scroll", () => {
        store.update((draft) => { draft.system.titleScreen!.backgroundLayers = [{ resourceId: "easyrpg-title-title1", parallax: 2.5, scrollXPerSec: 7 }]; });
        const host = render();
        change(host, "db-field-title-screen-layer-0-opacity", "65");
        change(host, "db-field-title-screen-layer-0-scroll-x", "0");
        expect(store.getCurrent().system.titleScreen?.backgroundLayers).toEqual([{ resourceId: "easyrpg-title-title1", parallax: 2.5, opacity: .65 }]);
      });

      it("provides direct matrix entry, bounded mutation, diagonal protection and clear cancellation", () => {
        store.update((draft) => { draft.system.typeChart = { types: ["fire", "water"], multipliers: { fire: { water: .5 } } }; });
        const host = render();
        expect(node(host, "db-type-chart-fire-fire").disabled).toBe(true);
        const direct = node(host, "db-type-chart-direct-edit");
        direct.click();
        expect(node(host, "db-type-chart-popover").hidden).toBe(false);
        node(host, "db-type-chart-popover-input").value = "1.25";
        node(host, "db-type-chart-popover-confirm").click();
        expect(store.getCurrent().system.typeChart?.multipliers.fire?.water).toBe(1.25);
        expect(document.activeElement).toBe(direct);
        direct.click(); node(host, "db-type-chart-popover-input").value = "9";
        node(host, "db-type-chart-popover-confirm").click();
        expect(store.getCurrent().system.typeChart?.multipliers.fire?.water).toBe(4);
        const before = structuredClone(store.getCurrent().system.typeChart);
        vi.stubGlobal("confirm", () => false);
        change(host, "db-field-system-type-chart-types", "");
        expect(store.getCurrent().system.typeChart).toEqual(before);
        vi.stubGlobal("confirm", () => true);
        change(host, "db-field-system-type-chart-types", "");
        expect(store.getCurrent().system.typeChart).toBeUndefined();
      });
    });
  });
  describe("databaseSystemSections", () => {
    isolateTimers();
    function renderSystem(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderSystemTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    function sectionNavButtons(host: FakeElement): FakeElement[] {
      const nav = findByTestId(host, "db-system-section-nav");
      if (!nav) throw new Error("missing section nav");
      return nav.querySelectorAll(".db-system-section-button");
    }
    function sectionNode(host: FakeElement, slug: string): FakeElement {
      const node = host.querySelector(`[data-system-section="${slug}"]`);
      if (!node) throw new Error(`missing section ${slug}`);
      return node;
    }
    function clickNav(host: FakeElement, slug: string): void {
      const button = findByTestId(host, `db-system-nav-${slug}`);
      if (!button) throw new Error(`missing nav button ${slug}`);
      button.click();
    }
    /** 각 섹션을 대표하는 testid — 섹션 상태와 무관하게 DOM 에 존재해야 한다. */
    // 게임 메뉴·대화창·HUD 의 키 testid 는 실제 컨트롤 이름이다(스킨 카드 묶음·대화창 스타일 갤러리·HUD 스튜디오 뿌리).
    const SECTION_KEY_TESTIDS: readonly { readonly slug: string; readonly testid: string }[] = [
      { slug: "overview", testid: "db-system-studio" },
      { slug: "party", testid: "db-picker-system-start-actor" },
      { slug: "startup", testid: "db-field-system-battle-flow" },
      { slug: "optin", testid: "db-field-system-skill-system" },
      { slug: "time", testid: "db-field-system-time-enabled" },
      { slug: "typechart", testid: "db-field-system-type-chart-types" },
      { slug: "display", testid: "db-field-system-resolution-preset" },
      { slug: "menu", testid: "db-field-system-menu-ui-style" },
      { slug: "dialogue", testid: "db-field-system-dialogue-style" },
      { slug: "hud", testid: "db-field-hud" },
      { slug: "font", testid: "db-field-system-font-ui" },
      { slug: "resources", testid: "db-field-title-resource" },
      { slug: "sound", testid: "db-field-system-default-bgm" },
      { slug: "title", testid: "db-title-workbench" },
    ];
    describe("database system section navigation", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
        resetMapEditHistory();
      });

      afterEach(() => {
        vi.restoreAllMocks();
        cleanupDom?.();
        cleanupDom = undefined;
      });

      it("renders 14 section nav buttons in order under 3 subheadings and lifts title jump links", () => {
        const host = renderSystem();
        const nav = findByTestId(host, "db-system-section-nav")!;
        const buttons = sectionNavButtons(host);
        expect(buttons.map((button) => button.dataset.testid)).toEqual([
          "db-system-nav-overview",
          "db-system-nav-party",
          "db-system-nav-startup",
          "db-system-nav-optin",
          "db-system-nav-time",
          "db-system-nav-typechart",
          "db-system-nav-display",
          "db-system-nav-menu",
          "db-system-nav-dialogue",
          "db-system-nav-hud",
          "db-system-nav-font",
          "db-system-nav-resources",
          "db-system-nav-sound",
          "db-system-nav-title",
        ]);
        expect(buttons.map((button) => button.textContent)).toEqual([
          "개요",
          "초기 파티",
          "시작 설정",
          "기능 확장",
          "시간",
          "타입 상성",
          "화면",
          "게임 메뉴",
          "대화창",
          "인게임 HUD",
          "폰트",
          "리소스",
          "소리",
          "타이틀",
        ]);
        expect(nav.querySelectorAll(".db-system-section-subhead").map((subhead) => subhead.textContent)).toEqual([
          "규칙",
          "보이는 것",
          "시작·끝",
        ]);
        const jump = findByTestId(nav, "db-title-workbench-jump")!;
        expect(jump.hidden).toBe(true);
        expect(jump.querySelectorAll(".db-title-workbench-jump-link").map((link) => link.textContent)).toEqual([
          "오프닝 효과",
          "글자·배경",
          "메뉴",
          "연출",
          "소리",
        ]);
        clickNav(host, "title");
        expect(jump.hidden).toBe(false);
      });

      it("gathers default, battle, and title sound pickers in the sound section once", () => {
        const host = renderSystem();
        const sound = sectionNode(host, "sound");
        for (const testid of [
          "db-field-system-default-bgm",
          "db-field-system-battle-bgm",
          "db-field-system-battle-victory-me",
          "db-field-system-battle-defeat-se",
          "db-field-system-battle-escape-se",
          "db-field-title-screen-music",
          "db-field-title-screen-se-cursor",
          "db-field-title-screen-se-confirm",
          "db-field-title-screen-se-cancel",
        ]) {
          expect(host.querySelectorAll(`[data-testid="${testid}"]`)).toHaveLength(1);
          expect(findByTestId(sound, testid)).not.toBeNull();
        }
        // 옛 자리(시작 설정 「전투 오디오」, 타이틀 「소리」)에는 소리 구획 링크만 남는다.
        expect(findByTestId(sectionNode(host, "startup"), "db-system-startup-open-sound")?.dataset.systemTarget).toBe("sound");
        expect(findByTestId(sectionNode(host, "title"), "db-title-open-sound")?.dataset.systemTarget).toBe("sound");
        clickNav(host, "startup");
        findByTestId(host, "db-system-startup-open-sound")!.click();
        expect(sectionNode(host, "sound").hidden).toBe(false);
      });

      it("defaults to the overview section active and keeps the party editor hidden", () => {
        const host = renderSystem();
        const buttons = sectionNavButtons(host);
        expect(buttons[0]?.classList.contains("active")).toBe(true);
        expect(buttons.every((button, index) => button.classList.contains("active") === (index === 0))).toBe(true);
        expect(sectionNode(host, "overview").hidden).toBe(false);
        expect(sectionNode(host, "party").hidden).toBe(true);
        // 비활성 섹션은 [hidden] 처리 — 여전히 DOM 에 존재하지만 숨겨진다.
        for (const { slug } of SECTION_KEY_TESTIDS) {
          if (slug === "overview") continue;
          expect(sectionNode(host, slug).hidden).toBe(true);
        }
      });

      it("switches the active section on nav click", () => {
        const host = renderSystem();

        clickNav(host, "typechart");
        expect(sectionNode(host, "typechart").hidden).toBe(false);
        expect(sectionNode(host, "party").hidden).toBe(true);
        const buttons = sectionNavButtons(host);
        const active = buttons.filter((button) => button.classList.contains("active"));
        expect(active.map((button) => button.dataset.testid)).toEqual(["db-system-nav-typechart"]);

        clickNav(host, "title");
        expect(sectionNode(host, "title").hidden).toBe(false);
        expect(sectionNode(host, "typechart").hidden).toBe(true);
        const activeAfter = sectionNavButtons(host).filter((button) => button.classList.contains("active"));
        expect(activeAfter.map((button) => button.dataset.testid)).toEqual(["db-system-nav-title"]);

        clickNav(host, "party");
        expect(sectionNode(host, "party").hidden).toBe(false);
        expect(sectionNode(host, "title").hidden).toBe(true);
      });

      it("keeps every section's key testids in the DOM (mounted-hidden approach)", () => {
        const host = renderSystem();
        for (const { testid } of SECTION_KEY_TESTIDS) {
          expect(findByTestId(host, testid)).not.toBeNull();
        }
        // 각 섹션으로 전환하면 해당 섹션의 키 testid 가 그대로 조회된다.
        for (const { slug, testid } of SECTION_KEY_TESTIDS) {
          clickNav(host, slug);
          expect(sectionNode(host, slug).hidden).toBe(false);
          expect(findByTestId(host, testid)).not.toBeNull();
        }
      });

      it("nav clicking produces zero store.update calls (no snapshot-history growth)", () => {
        const host = renderSystem();
        expect(getMapEditHistoryState().canUndo).toBe(false);
        const entriesBefore = getMapEditHistoryEntries().length;
        const projectBefore = JSON.stringify(store.getCurrent());

        for (const { slug } of SECTION_KEY_TESTIDS) clickNav(host, slug);
        clickNav(host, "party");

        expect(getMapEditHistoryEntries().length).toBe(entriesBefore);
        expect(getMapEditHistoryState().canUndo).toBe(false);
        expect(JSON.stringify(store.getCurrent())).toBe(projectBefore);
      });

      it("stops title BGM preview when leaving the title section", () => {
        const project = createBlankProject();
        project.system.titleScreen = { ...defaultTitleScreenSettings(), musicResourceId: "cc0-music-field-loop" };
        store.replace(project);
        const host = renderSystem();
        document.body.append(host);
        clickNav(host, "title");
        const engine = getAudioEngine();
        vi.spyOn(engine, "play").mockImplementation(() => undefined);
        const stop = vi.spyOn(engine, "stopChannel");
        clickNav(host, "startup");
        expect(stop).not.toHaveBeenCalled();
        clickNav(host, "title");
        findByTestId(host, "db-title-bgm-play")!.click();
        clickNav(host, "startup");
        expect(stop).toHaveBeenCalledWith("bgm", 0);
      });
    });
  });
  describe("databaseSystemStudio", () => {
    isolateTimers();
    function renderSystem(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderSystemTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    describe("database system studio", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        const project = createBlankProject();
        const switchId = project.switches[0]?.id;
        const variableId = project.variables[0]?.id;
        if (!switchId || !variableId) throw new Error("blank project needs state records");
        project.switches[0]!.name = "다리 복구 완료";
        project.variables[0]!.name = "현재 챕터";
        project.storyFlags = [
          {
            id: "bridge-repaired",
            kind: "switch",
            targetId: switchId,
            description: "다리 복구 퀘스트 진행 상태",
            questId: "quest",
          },
          {
            id: "chapter-current",
            kind: "variable",
            targetId: variableId,
            description: "현재 진행 중인 챕터",
          },
        ];
        store.replace(project);
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
      });

      it("renders the modern overview, semantic state registry, and live preview", () => {
        // Break named: System still opens as a legacy fieldset page without the studio overview.
        const host = renderSystem();

        expect(findByTestId(host, "db-system-studio")).not.toBeNull();
        expect(findByTestId(host, "db-system-studio-header")?.textContent).toContain("시스템 개요");
        expect(findByTestId(host, "db-system-studio-command-search")).not.toBeNull();
        expect(findByTestId(host, "db-system-studio-state-table")?.textContent).toContain("quest.bridge-repaired");
        expect(findByTestId(host, "db-system-studio-state-table")?.textContent).toContain("chapter-current");
        expect(findByTestId(host, "db-system-studio-live-preview")).not.toBeNull();
        expect(findByTestId(host, "db-system-studio-impact-list")).not.toBeNull();
      });

      it("only presents project-backed settings as actionable cards", () => {
        // Break named: hard-coded Save, Economy, and Input cards pretend unimplemented settings are complete.
        const host = renderSystem();
        const studio = findByTestId(host, "db-system-studio");
        if (!studio) throw new Error("missing system studio");

        for (const id of ["startup", "party", "display", "time", "sound", "combat", "features", "title"]) {
          expect(findByTestId(host, `db-system-studio-card-${id}`)).not.toBeNull();
        }
        for (const id of ["save", "economy", "input"]) {
          expect(findByTestId(host, `db-system-studio-card-${id}`)).toBeNull();
        }
        expect(studio.textContent).not.toContain("구성 완료");
        expect(studio.textContent).not.toContain("주의 1개");
        expect(studio.textContent).not.toContain("자동 저장 사용");
      });

      it("derives every rule-card detail from authored project values", () => {
        // Break named: rule-card rows keep fixed completion claims when the authored System values change.
        const project = createBlankProject();
        project.system.playResolution = { width: 640, height: 360 };
        project.system.battleFlow = "strict";
        project.system.activeSlots = 2;
        project.system.battleUiStyle = "retro2003";
        project.system.battleModel = "gen1";
        project.system.skillSystem = { enabled: true };
        project.system.actionCombat = { enabled: true };
        store.replace(project);
        const host = renderSystem();

        expect(findByTestId(host, "db-system-studio-card-display")?.textContent).toContain("640×360");
        expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("턴 전투");
        expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("2명");
        // 전투 카드는 이제 스킨 이름·전투 모델 대신 「전투 방식」(측면/몬스터 두 단추)과 「전투 화면」 요약을 보인다
        // (자료집 전투 정리 — databaseSystemStudio.ts ruleCardGrid, 공개 기준 커밋 0d4f13e7c8 에 이미 반영). 저작 값에서 나온다:
        // battleUiStyle retro2003 → 측면, pokemon → 몬스터.
        expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("도트 측면 (RM2003식)");
        store.update((draft) => { draft.system.battleUiStyle = "pokemon"; });
        const monsterHost = renderSystem();
        expect(findByTestId(monsterHost, "db-system-studio-card-combat")?.textContent).toContain("몬스터 대치 (포켓몬식)");
        expect(findByTestId(host, "db-system-studio-card-features")?.textContent).toContain("생활 스킬사용");
        expect(findByTestId(host, "db-system-studio-card-features")?.textContent).toContain("액션 전투사용");

        for (const id of ["combat", "features", "title"]) {
          for (let index = 0; index < 4; index += 1) {
            expect(findByTestId(host, `db-system-studio-card-${id}-detail-${index}`)).not.toBeNull();
          }
          expect(findByTestId(host, `db-system-studio-card-${id}-open`)).not.toBeNull();
        }
      });

      it("renders preview facts as non-interactive project values", () => {
        // Break named: inert preview buttons and 'all screens' affordances imply navigation that does not exist.
        const host = renderSystem();
        const impactList = findByTestId(host, "db-system-studio-impact-list");
        if (!impactList) throw new Error("missing impact list");

        const rows = impactList.querySelectorAll(".db-system-studio-impact-row");
        expect(rows).toHaveLength(4);
        expect(rows.every((row) => row.tagName !== "BUTTON")).toBe(true);
        expect(impactList.querySelector(".db-system-studio-all-screens")).toBeNull();
        expect(impactList.textContent).not.toContain("저장/불러오기");
      });

      it("includes configured resume in the overview title summary", () => {
        store.update((draft) => {
          draft.system.titleScreen!.menuLabels.resume = "resume-authored-sentinel";
          draft.system.titleScreen!.menuVisibility.resume = true;
        });
        const host = renderSystem();
        expect(findByTestId(host, "db-system-studio-live-preview")?.textContent).toContain("resume-authored-sentinel");
      });

      it("navigates from an overview card without writing project state", () => {
        // Break named: overview cards are decorative and cannot enter the existing authoring section.
        const host = renderSystem();
        const before = JSON.stringify(store.getCurrent());
        const startup = findByTestId(host, "db-system-studio-card-startup");
        if (!startup) throw new Error("missing startup card");

        startup.click();

        expect(findByTestId(host, "db-system-nav-startup")?.classList.contains("active")).toBe(true);
        expect(host.querySelector('[data-system-section="startup"]')?.hidden).toBe(false);
        expect(JSON.stringify(store.getCurrent())).toBe(before);
      });
    });
  });
});
