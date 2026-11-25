import { describe, expect, it, afterEach, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeEquipmentRecord, normalizeSkillRecord, normalizeSystemRecords, normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession, getFriendship } from "@/project/session";
import { equipmentToGoods, itemToGoods } from "@/player/playSceneShopGoods";
import { previewShopEquipment as preview } from "@/player/shopEquipmentPreview";
import { fixedDamageAmount, normalizeFixedDamage, normalizeMultiHit, recoilDamageFor, rollMultiHitCount, skillBattleRuleLabels } from "@/project/skillBattleRules";
import { applyStoredCameraState, smallMapFillZoom } from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { smallMapFillDensity, smallMapFitScale } from "@/project/mapViewScale";
import { SMALL_MAP_FILL_DEFAULT, resolveSmallMapFill } from "@/project/smallMapFill";
import { store } from "@/project/store";
import { getTool } from "@/editor/tools";
import type { GameMap, Project, GameEvent } from "@/project/types";
import { giveGiftToNpc, isTalkFriendshipEnabled, trySocialTalk } from "@/project/friendship";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { isolateTimers } from "./mergedTeardown";

describe("shopEquipmentPreview", () => {
  isolateTimers();
  function required<T>(value: T | undefined): T {
    if (value === undefined) throw new Error("Fixture record missing");
    return value;
  }
  function fixture() {
    const project = createBlankProject();
    const actor = required(project.database.actors[0]);
    actor.options.fixedEquipment = false;
    actor.options.dualWield = false;
    actor.initialLevel = 1;
    actor.parameterCurves = {
      maxHp: Array(99).fill(100), maxMp: Array(99).fill(30),
      attack: Array(99).fill(20), defense: Array(99).fill(10),
      mind: Array(99).fill(8), agility: Array(99).fill(6),
    };
    project.growth = undefined;
    for (const klass of project.database.classes) {
      klass.options.fixedEquipment = false;
      klass.options.dualWield = false;
      klass.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
    }
    const oldWeapon = normalizeEquipmentRecord({
      id: "preview-old", name: "Old weapon", slot: "weapon",
      equippableActorIds: [actor.id], statBonuses: { attack: 10, defense: 8, mind: 0, agility: 0 },
    });
    const candidate = normalizeEquipmentRecord({
      id: "preview-candidate", name: "Candidate", slot: "weapon",
      equippableActorIds: [actor.id], statBonuses: { attack: 5, defense: 0, mind: 0, agility: 0 },
    });
    // The authoring normalizer clamps negatives; exercise the specified runtime
    // oracle directly without changing authoring/schema policy in this task.
    candidate.statBonuses.agility = -2;
    const shield = normalizeEquipmentRecord({
      id: "preview-shield", name: "Shield", slot: "shield",
      equippableActorIds: [actor.id], statBonuses: { attack: 0, defense: 8, mind: 0, agility: 0 },
    });
    project.database.equipment = [oldWeapon, candidate, shield];
    actor.initialEquipment = { weapon: oldWeapon.id };
    const session = startSession(project);
    session.partyActorIds = [actor.id];
    session.actorEquipment = { [actor.id]: { weapon: oldWeapon.id } };
    session.actorLevels = { [actor.id]: 1 };
    session.classOverrides = {};
    session.actorParamBonuses = {};
    session.inventory = {};
    return { project, session, actor, oldWeapon, candidate, shield };
  }
  const downgradeRows = [
    { key: "attack", current: 30, next: 25, delta: -5 },
    { key: "defense", current: 18, next: 10, delta: -8 },
    { key: "mind", current: 8, next: 8, delta: 0 },
    { key: "agility", current: 6, next: 4, delta: -2 },
  ];
  function freezeDeep(value: unknown): void {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  describe("pure actor-specific shop equipment preview", () => {
    it("shows authorable positive-bonus downgrades and lost zero-bonus stats without negative authored bonuses", async () => {
      const f = fixture();
      const oldWeapon = normalizeEquipmentRecord({ ...f.oldWeapon,
        statBonuses: { attack: 10, defense: 8, mind: 0, agility: 2 } });
      const candidate = normalizeEquipmentRecord({ ...f.candidate,
        statBonuses: { attack: 5, defense: 0, mind: 0, agility: 0 } });
      f.project.database.equipment = [oldWeapon, candidate, f.shield];
      expect(oldWeapon.statBonuses).toEqual({ attack: 10, defense: 8, mind: 0, agility: 2 });
      expect(candidate.statBonuses).toEqual({ attack: 5, defense: 0, mind: 0, agility: 0 });
      const result = await preview({ ...f, goods: equipmentToGoods(candidate) });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.stats).toEqual([
        { key: "attack", current: 30, next: 25, delta: -5 },
        { key: "defense", current: 18, next: 10, delta: -8 },
        { key: "mind", current: 8, next: 8, delta: 0 },
        { key: "agility", current: 8, next: 6, delta: -2 },
      ]);
      expect(result.displaced).toEqual([{ id: oldWeapon.id, count: 1 }]);
    });

    it("handles the runtime-only negative-bonus edge with all four truthful totals", async () => {
      const f = fixture();
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result).toMatchObject({ kind: "ready", actorId: f.actor.id, slot: "weapon", sameEquipment: false });
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.stats).toEqual(downgradeRows);
      expect(result.currentEquipment).toEqual({ weapon: f.oldWeapon.id });
      expect(result.nextEquipment).toEqual({ weapon: f.candidate.id });
      expect(result.displaced).toEqual([{ id: f.oldWeapon.id, count: 1 }]);
      expect(f.session.inventory).toEqual({});
    });

    it("returns same-equipment zero deltas without displacing or inventing inventory", async () => {
      const f = fixture();
      const result = await preview({ ...f, goods: equipmentToGoods(f.oldWeapon) });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.sameEquipment).toBe(true);
      expect(result.stats).toEqual([
        { key: "attack", current: 30, next: 30, delta: 0 },
        { key: "defense", current: 18, next: 18, delta: 0 },
        { key: "mind", current: 8, next: 8, delta: 0 },
        { key: "agility", current: 6, next: 6, delta: 0 },
      ]);
      expect(result.nextEquipment).toEqual(result.currentEquipment);
      expect(result.displaced).toEqual([]);
      expect(result.effects).toEqual({ gained: [], lost: [], changed: [] });
    });

    it("counts a two-hand mirror once, displaces both hands, and compares derived effects", async () => {
      const f = fixture();
      f.oldWeapon.statBonuses.defense = 0;
      f.oldWeapon.effectFlags.doubleAttack = true;
      f.oldWeapon.accuracy = 90;
      f.oldWeapon.criticalRate = 10;
      f.shield.elementalDefenseIds = ["fire"];
      f.shield.stateDefenseIds = ["poison"];
      f.shield.stateResistanceChance = 40;
      f.candidate.twoHanded = true;
      f.candidate.statBonuses.attack = 15;
      f.candidate.effectFlags.attackAll = true;
      f.candidate.accuracy = 80;
      f.candidate.criticalRate = 5;
      f.candidate.attackElementIds = ["ice"];
      f.session.actorEquipment[f.actor.id] = { weapon: f.oldWeapon.id, shield: f.shield.id };
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.stats).toEqual([
        { key: "attack", current: 30, next: 35, delta: 5 },
        { key: "defense", current: 18, next: 10, delta: -8 },
        { key: "mind", current: 8, next: 8, delta: 0 },
        { key: "agility", current: 6, next: 4, delta: -2 },
      ]);
      expect(result.nextEquipment).toEqual({ weapon: f.candidate.id, shield: f.candidate.id });
      expect(result.displaced).toEqual([{ id: f.oldWeapon.id, count: 1 }, { id: f.shield.id, count: 1 }]);
      expect(result.effects).toEqual({
        gained: [{ key: "attackAll" }, { key: "attackElementIds", id: "ice" }],
        lost: [{ key: "doubleAttack" }, { key: "elementalDefenseIds", id: "fire" }, { key: "stateDefenseIds", id: "poison" }],
        changed: [
          { key: "accuracy", current: 90, next: 80, delta: -10 },
          { key: "criticalRate", current: 10, next: 5, delta: -5 },
          { key: "stateResistanceChance", current: 40, next: 0, delta: -40 },
        ],
      });
    });

    it("retains shared derived effects instead of claiming that every removed item's effect was lost", async () => {
      const f = fixture();
      f.oldWeapon.effectFlags.doubleAttack = true;
      f.oldWeapon.elementalDefenseIds = ["fire", "fire"];
      f.shield.effectFlags.doubleAttack = true;
      f.shield.elementalDefenseIds = ["fire"];
      f.session.actorEquipment[f.actor.id] = { weapon: f.oldWeapon.id, shield: f.shield.id };
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.effects).toEqual({ gained: [], lost: [], changed: [] });
    });

    it("keeps all six actual party actors selectable and uses their distinct current totals and session names", async () => {
      const f = fixture();
      const actors = Array.from({ length: 6 }, (_, index) => ({
        ...structuredClone(f.actor), id: `preview-actor-${index + 1}`,
        parameterCurves: { ...structuredClone(f.actor.parameterCurves), attack: Array(99).fill(20 + index * 10) },
      }));
      f.project.database.actors = actors;
      f.session.partyActorIds = actors.map(actor => actor.id);
      f.session.actorEquipment = Object.fromEntries(actors.map(actor => [actor.id, { weapon: f.oldWeapon.id }]));
      f.candidate.equippableActorIds = actors.map(actor => actor.id);
      f.session.actorNames = { "preview-actor-6": "Renamed sixth" };
      for (const [actorId, current, next] of [["preview-actor-5", 70, 65], ["preview-actor-6", 80, 75]] as const) {
        const result = await preview({ ...f, goods: equipmentToGoods(f.candidate), actorId });
        expect(result.kind).toBe("ready");
        if (result.kind !== "ready") throw new Error("Expected ready preview");
        expect(result.targets.map(target => target.actorId)).toEqual(f.session.partyActorIds);
        expect(result.targets[5]?.name).toBe("Renamed sixth");
        expect(result.actorId).toBe(actorId);
        expect(result.stats).toEqual([
          { key: "attack", current, next, delta: -5 },
          { key: "defense", current: 18, next: 10, delta: -8 },
          { key: "mind", current: 8, next: 8, delta: 0 },
          { key: "agility", current: 6, next: 4, delta: -2 },
        ]);
      }
    });

    it.each(["actor", "class"] as const)("preserves the requested dual-wield shield slot granted by %s", async source => {
      const f = fixture();
      if (source === "actor") f.actor.options.dualWield = true;
      else required(f.project.database.classes.find(c => c.id === f.actor.classId)).options.dualWield = true;
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate), actorId: f.actor.id, slot: "shield" });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.targets[0]?.slots.map(slot => slot.id)).toEqual(["weapon", "shield"]);
      expect(result.slot).toBe("shield");
      expect(result.nextEquipment).toEqual({ weapon: f.oldWeapon.id, shield: f.candidate.id });
      expect(result.stats.map(row => row.next)).toEqual([35, 18, 8, 4]);
      expect(result.displaced).toEqual([]);
    });

    it("counts two identical dual-wield copies as two displaced objects", async () => {
      const f = fixture();
      f.actor.options.dualWield = true;
      f.session.actorEquipment[f.actor.id] = { weapon: f.oldWeapon.id, shield: f.oldWeapon.id };
      f.candidate.twoHanded = true;
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate), slot: "shield" });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.slot).toBe("weapon");
      expect(result.targets[0]?.slots.map(slot => slot.id)).toEqual(["weapon"]);
      expect(result.displaced).toEqual([{ id: f.oldWeapon.id, count: 2 }]);
      expect(result.stats.map(row => row.current)).toEqual([40, 26, 8, 6]);
      expect(result.stats.map(row => row.next)).toEqual([25, 10, 8, 4]);
    });

    it("uses the authored charm catalog slot and replaces an incompatible previous slot default", async () => {
      const f = fixture();
      f.project.database.equipmentSlots = [{ id: "charm", label: "Charm" }];
      f.candidate.slot = "charm";
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate), actorId: f.actor.id, slot: "weapon" });
      expect(result).toMatchObject({ kind: "ready", actorId: f.actor.id, slot: "charm" });
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.targets[0]?.slots).toEqual([{ id: "charm", label: "Charm" }]);
      expect(result.nextEquipment).toEqual({ weapon: f.oldWeapon.id, charm: f.candidate.id });
      expect(result.stats.map(row => row.next)).toEqual([35, 18, 8, 4]);
    });

    it("preserves level, current class curves, invested growth, earned promotion lineage and permanent bonuses", async () => {
      const f = fixture();
      const original = required(f.project.database.classes.find(c => c.id === f.actor.classId));
      const promoted = { ...structuredClone(original), id: "preview-promoted", parameterCurves: {
        maxHp: [100, 120, 140], maxMp: [20, 30, 40], attack: [30, 35, 40],
        defense: [12, 16, 20], mind: [9, 10, 12], agility: [7, 8, 10],
      } };
      f.project.database.classes.push(promoted);
      f.session.actorLevels[f.actor.id] = 3;
      f.session.classOverrides[f.actor.id] = promoted.id;
      f.session.promotionLineage = { [f.actor.id]: [original.id, promoted.id] };
      f.project.growth = { initialPoints: 0, pointsPerLevel: 1, classPositions: {}, skillTrees: [{
        id: "inherited", name: "Inherited", description: "", classIds: [original.id], inheritOnPromotion: true,
        allowReset: true, nodes: [{ id: "power", name: "Power", description: "", cost: 1,
          maxRank: 2, level: 1, prerequisites: [], x: 0, y: 0,
          effect: { kind: "parameter", parameter: "attack", amount: 3 } }],
      }] };
      f.session.growthProgress = { [f.actor.id]: { inherited: { power: { rank: 2, spent: 2 } } } };
      f.session.actorParamBonuses = { [f.actor.id]: { attack: 4, defense: 2, mind: 1, agility: 3 } };
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.stats).toEqual([
        { key: "attack", current: 60, next: 55, delta: -5 },
        { key: "defense", current: 30, next: 22, delta: -8 },
        { key: "mind", current: 13, next: 13, delta: 0 },
        { key: "agility", current: 13, next: 11, delta: -2 },
      ]);
      f.session.promotionLineage = { [f.actor.id]: [promoted.id] };
      const unearned = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(unearned.kind).toBe("ready");
      if (unearned.kind !== "ready") throw new Error("Expected ready preview");
      expect(unearned.stats[0]).toEqual({ key: "attack", current: 54, next: 49, delta: -5 });
    });

    it.each(["actorFixed", "classFixed", "gearFixed", "cursed", "actorRestricted", "classRestricted"] as const)("retains readable actor and current stats when %s blocks replacement", async restriction => {
      const f = fixture();
      const klass = required(f.project.database.classes.find(c => c.id === f.actor.classId));
      if (restriction === "actorFixed") f.actor.options.fixedEquipment = true;
      if (restriction === "classFixed") klass.options.fixedEquipment = true;
      if (restriction === "gearFixed") f.oldWeapon.effectFlags.fixedEquipment = true;
      if (restriction === "cursed") f.oldWeapon.cursed = true;
      if (restriction === "actorRestricted" || restriction === "classRestricted") {
        f.candidate.equippableActorIds = restriction === "actorRestricted" ? ["other-actor"] : [];
        f.candidate.equippableClassIds = restriction === "classRestricted" ? ["other-class"] : [];
      }
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate), actorId: f.actor.id });
      expect(result.kind).toBe("blocked");
      if (result.kind !== "blocked") throw new Error("Expected blocked preview");
      expect(result.reason).toBe(restriction === "cursed" ? "cursedEquipment" : restriction.endsWith("Restricted") ? "notEquippable" : "fixedEquipment");
      expect(result.actorId).toBe(f.actor.id);
      expect(result.targets.map(target => target.actorId)).toEqual([f.actor.id]);
      expect(result.currentEquipment).toEqual({ weapon: f.oldWeapon.id });
      expect(result.stats).toEqual([{ key: "attack", current: 30 }, { key: "defense", current: 18 }, { key: "mind", current: 8 }, { key: "agility", current: 6 }]);
      expect(result).not.toHaveProperty("nextEquipment");
    });

    it("uses current class permissions and falls back from a deleted class override", async () => {
      const f = fixture();
      const original = required(f.project.database.classes.find(c => c.id === f.actor.classId));
      const changed = { ...structuredClone(original), id: "preview-class", parameterCurves: structuredClone(f.actor.parameterCurves) };
      f.project.database.classes.push(changed);
      f.candidate.equippableActorIds = [];
      f.candidate.equippableClassIds = [changed.id];
      f.session.classOverrides[f.actor.id] = changed.id;
      expect((await preview({ ...f, goods: equipmentToGoods(f.candidate) })).kind).toBe("ready");
      f.session.classOverrides[f.actor.id] = "deleted";
      expect(await preview({ ...f, goods: equipmentToGoods(f.candidate) })).toMatchObject({ kind: "blocked", reason: "notEquippable" });
      f.candidate.equippableClassIds = [original.id];
      const fallback = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(fallback.kind).toBe("ready");
      if (fallback.kind !== "ready") throw new Error("Expected ready preview");
      expect(fallback.stats).toEqual(downgradeRows);
    });

    it.each(["actorFixed", "gearFixed", "cursed", "restricted"] as const)("does not bypass transition permission for same-item %s", async restriction => {
      const f = fixture();
      if (restriction === "actorFixed") f.actor.options.fixedEquipment = true;
      if (restriction === "gearFixed") f.oldWeapon.effectFlags.fixedEquipment = true;
      if (restriction === "cursed") f.oldWeapon.cursed = true;
      if (restriction === "restricted") f.oldWeapon.equippableActorIds = [];
      const result = await preview({ ...f, goods: equipmentToGoods(f.oldWeapon) });
      if (restriction === "actorFixed" || restriction === "restricted") {
        expect(result).toMatchObject({ kind: "blocked", reason: restriction === "actorFixed" ? "fixedEquipment" : "notEquippable" });
      } else {
        expect(result).toMatchObject({ kind: "ready", sameEquipment: true, displaced: [] });
      }
    });

    it("passes raw hand occupancy to authority, so a hidden cursed shield still blocks displacement", async () => {
      const f = fixture();
      f.oldWeapon.twoHanded = true;
      f.shield.cursed = true;
      f.session.actorEquipment[f.actor.id] = { weapon: f.oldWeapon.id, shield: f.shield.id };
      f.candidate.twoHanded = true;
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result).toMatchObject({ kind: "blocked", reason: "cursedEquipment", currentEquipment: { weapon: f.oldWeapon.id, shield: f.oldWeapon.id } });
    });

    it("returns real raw-state displaced objects even when the stat projection hides a shield", async () => {
      const f = fixture();
      f.oldWeapon.twoHanded = true;
      f.session.actorEquipment[f.actor.id] = { weapon: f.oldWeapon.id, shield: f.shield.id };
      f.candidate.twoHanded = true;
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.displaced).toEqual([{ id: f.oldWeapon.id, count: 1 }, { id: f.shield.id, count: 1 }]);
      expect(result.stats).toEqual(downgradeRows);
    });

    it("does not fabricate targets for an empty or missing party actor", async () => {
      const f = fixture();
      f.session.partyActorIds = [];
      expect(await preview({ ...f, goods: equipmentToGoods(f.candidate) })).toMatchObject({ kind: "unavailable", reason: "noActor", targets: [] });
      f.session.partyActorIds = ["deleted"];
      expect(await preview({ ...f, goods: equipmentToGoods(f.candidate) })).toMatchObject({ kind: "unavailable", reason: "noActor", targets: [] });
      f.session.partyActorIds = [f.actor.id];
      expect(await preview({ ...f, goods: equipmentToGoods(f.candidate), actorId: "deleted" })).toMatchObject({ kind: "unavailable", reason: "missingActor" });
    });

    it("explicitly rejects non-equipment, missing equipment and legacy item-source weapons", async () => {
      const f = fixture();
      const item = { ...required(f.project.database.items[0]), type: "medicine" as const };
      expect(await preview({ ...f, goods: itemToGoods(item) })).toMatchObject({ kind: "unavailable", reason: "notEquipment" });
      // Even a colliding equipment ID must not manufacture equip semantics for an item source.
      expect(await preview({ ...f, goods: itemToGoods({ ...item, id: f.candidate.id, type: "weapon" }) })).toMatchObject({ kind: "unavailable", reason: "unsupportedItemEquipment" });
      const goods = equipmentToGoods(f.candidate);
      f.project.database.equipment = [];
      expect(await preview({ ...f, goods })).toMatchObject({ kind: "unavailable", reason: "missingEquipment" });
    });

    it("keeps incompatible custom equipment inspectable with an invalid-slot reason", async () => {
      const f = fixture();
      f.candidate.slot = "deleted-slot";
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result).toMatchObject({ kind: "blocked", reason: "invalidSlot", targets: [{ actorId: f.actor.id, slots: [] }] });
    });

    it("reads initial equipment when the session lacks an override", async () => {
      const f = fixture();
      delete f.session.actorEquipment[f.actor.id];
      const result = await preview({ ...f, goods: equipmentToGoods(f.candidate) });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw new Error("Expected ready preview");
      expect(result.stats).toEqual(downgradeRows);
    });

    it("never mutates deeply frozen project, session or goods, on ready or blocked paths", async () => {
      const f = fixture();
      f.session.inventory = { [f.candidate.id]: 3, unrelated: 9 };
      f.session.gold = 123;
      f.session.growthProgress = {};
      f.session.promotionLineage = { [f.actor.id]: [f.actor.classId] };
      f.session.actorParamBonuses = { [f.actor.id]: { attack: 2 } };
      const goods = equipmentToGoods(f.candidate);
      const before = structuredClone({ project: f.project, session: f.session, goods });
      freezeDeep(f.project); freezeDeep(f.session); freezeDeep(goods);
      const result = await preview({ ...f, goods });
      expect(result.kind).toBe("ready");
      expect({ project: f.project, session: f.session, goods }).toEqual(before);
      const blockedProject = structuredClone(f.project);
      required(blockedProject.database.actors[0]).options.fixedEquipment = true;
      freezeDeep(blockedProject);
      expect(await preview({ project: blockedProject, session: f.session, goods })).toMatchObject({ kind: "blocked", reason: "fixedEquipment" });
      expect({ project: f.project, session: f.session, goods }).toEqual(before);
    });
  });
});

// 기술 규칙 어휘(고정 피해·연속 타수·반동·풀죽음) — 정규화·굴림·기본값 불변.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("skillBattleRules", () => {
  isolateTimers();
  describe("skill battle rule normalization", () => {
    it("keeps an ordinary skill byte-identical (no new keys appear)", () => {
      const plain = normalizeSkillRecord({ id: "s", name: "툭" });
      for (const key of ["recoilPercent", "fixedDamage", "multiHit", "flinchChance"]) expect(plain).not.toHaveProperty(key);
    });

    it("round-trips valid rules and drops invalid shapes", () => {
      const skill = normalizeSkillRecord({ id: "s", name: "x", recoilPercent: 25, flinchChance: 30, fixedDamage: { mode: "amount", amount: 40 }, multiHit: { min: 2, max: 5 } });
      expect(skill.recoilPercent).toBe(25);
      expect(skill.flinchChance).toBe(30);
      expect(skill.fixedDamage).toEqual({ mode: "amount", amount: 40 });
      expect(skill.multiHit).toEqual({ min: 2, max: 5 });
      expect(normalizeFixedDamage({ mode: "amount", amount: 0 })).toBeUndefined();
      expect(normalizeFixedDamage({ mode: "bogus" })).toBeUndefined();
      expect(normalizeMultiHit({ min: 1, max: 1 })).toEqual({ min: 2, max: 2 });
      expect(normalizeMultiHit({ min: 3, max: 99 })).toEqual({ min: 3, max: 5 });
      expect(normalizeMultiHit("x")).toBeUndefined();
    });
  });
  describe("skill battle rule math", () => {
    it("fixed damage reads the user level or the amount", () => {
      expect(fixedDamageAmount({ mode: "level" }, 17)).toBe(17);
      expect(fixedDamageAmount({ mode: "level" }, undefined)).toBe(1);
      expect(fixedDamageAmount({ mode: "amount", amount: 40 }, 3)).toBe(40);
      expect(fixedDamageAmount(undefined, 17)).toBeUndefined();
    });

    it("multi-hit uses the 3/8 3/8 1/8 1/8 split for 2-5 and does not roll without a rule", () => {
      let calls = 0;
      expect(rollMultiHitCount(undefined, () => { calls += 1; return 0; })).toBeUndefined();
      expect(calls).toBe(0);
      const rule = { min: 2, max: 5 } as const;
      expect([0, 0.37, 0.4, 0.74, 0.8, 0.87, 0.9, 0.999].map((r) => rollMultiHitCount(rule, () => r))).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
      expect(rollMultiHitCount({ min: 3, max: 3 }, () => 0.5)).toBe(3);
      expect(rollMultiHitCount({ min: 2, max: 3 }, () => 0.99)).toBe(3);
    });

    it("recoil is a percentage of the damage dealt, at least 1, only for real damage", () => {
      expect(recoilDamageFor(50, 31)).toBe(15);
      expect(recoilDamageFor(10, 3)).toBe(1);
      expect(recoilDamageFor(50, 0)).toBe(0);
      expect(recoilDamageFor(undefined, 30)).toBe(0);
    });

    it("labels summarise the rules for the database view", () => {
      expect(skillBattleRuleLabels({ multiHit: { min: 2, max: 5 }, recoilPercent: 25, flinchChance: 10, fixedDamage: { mode: "level" } }))
        .toEqual(["고정 피해(레벨만큼)", "2~5회 연속", "반동 25%", "풀죽음 10%"]);
      expect(skillBattleRuleLabels({})).toEqual([]);
    });
  });
});

// 작은 맵 화면 채우기(system.smallMapFill) — 2026-11-04 오너 결정 「모든 게임 기본값을 끄기로 해」.
describe("smallMapFill", () => {
  isolateTimers();
  function room(project: Project, width: number, height: number): GameMap {
    return { ...structuredClone(project.maps[project.startMapId]!), id: "room", width, height };
  }
  function scene(project: Project, map: GameMap, density: number, width = 480, height = 270) {
    vi.spyOn(store, "getCurrent").mockReturnValue(project);
    const camera = {
      width: width * density, height: height * density, zoom: 1, zoomX: 1, zoomY: 1,
      setZoom(value: number) { this.zoom = value; this.zoomX = value; this.zoomY = value; },
      setBounds() { return undefined; },
      startFollow() { return undefined; },
      stopFollow() { return undefined; },
      centerOn() { return undefined; },
    };
    const context = {
      cameras: { main: camera }, player: { x: 0, y: 0 }, eventSprites: new Map(), session: startSession(project), map,
      eventPositions: {}, syncRuntimeState: () => undefined,
      game: { registry: { get: (key: string) => (key === "playPixelDensity" ? density : undefined) } },
    } as unknown as PlaySceneContext;
    return { context, camera };
  }
  describe("smallMapFill 기본값", () => {
    afterEach(() => vi.restoreAllMocks());

    it("기본은 끔이고 저작값이 이긴다", () => {
      expect(SMALL_MAP_FILL_DEFAULT).toBe(false);
      const project = createBlankProject();
      expect(resolveSmallMapFill(project)).toBe(false);
      project.system.smallMapFill = true;
      expect(resolveSmallMapFill(project)).toBe(true);
    });

    it("끄면 작은 방도 1배 그대로 — 캔버스 밀도도 1", () => {
      const project = createBlankProject();
      project.system.playResolution = { width: 320, height: 240 };
      const small = room(project, 8, 9);
      project.maps = { ...project.maps, room: small };
      const { context, camera } = scene(project, small, 1, 320, 240);
      applyStoredCameraState(context);
      expect(camera.zoom).toBe(1);
    });

    it("켜면 예전처럼 작은 방을 채운다", () => {
      const project = createBlankProject();
      project.system.smallMapFill = true;
      const small = room(project, 8, 9);
      project.maps = { ...project.maps, room: small };
      const { context, camera } = scene(project, small, 3, 320, 240);
      applyStoredCameraState(context);
      expect(camera.zoom).toBeGreaterThan(3);
    });

    it("저장 정규화를 지나도 값이 남는다", () => {
      expect(normalizeSystemRecords({ smallMapFill: true } as never).smallMapFill).toBe(true);
      expect(normalizeSystemRecords({ smallMapFill: false } as never).smallMapFill).toBe(false);
      expect(normalizeSystemRecords({ smallMapFill: "yes" } as never).smallMapFill).toBeUndefined();
    });

    it("set_project_settings 는 기본과 같은 값을 지우고 다른 값만 남긴다", () => {
      const project = createBlankProject();
      getTool("set_project_settings")!.run(project, { smallMapFill: true });
      expect(project.system.smallMapFill).toBe(true);
      getTool("set_project_settings")!.run(project, { smallMapFill: false });
      expect(project.system.smallMapFill).toBeUndefined();
    });
  });
  describe("1배에 들어가는 방은 반 칸 여백 때문에 키우지 않는다", () => {
    afterEach(() => vi.restoreAllMocks());

    it("smallMapFitScale: 맵이 들어가면 한 축 채우기 없음", () => {
      expect(smallMapFitScale(1.4, 0.94, true)).toBe(1);
      expect(smallMapFitScale(1.4, 0.94, false)).toBe(1.4);
    });

    it("20×16 방(320×256)은 480×270 에서 1배 — 켜도 1.333배가 아니다", () => {
      const project = createBlankProject();
      project.system.smallMapFill = true;
      project.system.playResolution = { width: 480, height: 270 };
      const sg = room(project, 20, 16);
      expect(smallMapFillZoom({ width: 480 * 3, height: 270 * 3 }, sg, { integer: true, base: 3 })).toBe(3);
      project.maps = { [sg.id]: sg };
      expect(smallMapFillDensity(project, { width: 480, height: 270 })).toBe(1);
    });
  });
});

describe("socialTalk", () => {
  isolateTimers();
  describe("social talk channel", () => {
    it("grants default +10 once per day and rejects same-day re-talk", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const event = talkEvent("ev_npc", "char_npc", true);

      expect(isTalkFriendshipEnabled(event)).toBe(true);
      expect(trySocialTalk(session, event)).toMatchObject({
        ok: true,
        npcKey: "char_npc",
        delta: 10,
        friendship: 10,
      });
      expect(session.dailyTalks?.char_npc).toBeDefined();
      expect(getFriendship(session, "char_npc")).toBe(10);

      expect(trySocialTalk(session, event)).toMatchObject({
        ok: false,
        reason: "already-talked",
        npcKey: "char_npc",
      });
      expect(getFriendship(session, "char_npc")).toBe(10);

      session.gameTime = { minute: 0, hour: 6, day: 2, season: "spring", year: 1 };
      expect(trySocialTalk(session, event)).toMatchObject({
        ok: true,
        delta: 10,
        friendship: 20,
      });
    });

    it("uses custom delta from talkFriendship object", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const event = talkEvent("ev_npc", "char_npc", { delta: 25 });

      expect(trySocialTalk(session, event)).toMatchObject({
        ok: true,
        delta: 25,
        friendship: 25,
      });
    });

    it("fails closed without characterId", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const event = talkEvent("ev_npc", undefined, true);
      delete event.characterId;

      expect(isTalkFriendshipEnabled(event)).toBe(false);
      expect(trySocialTalk(session, event)).toMatchObject({ ok: false, reason: "not-enabled" });
      expect(session.dailyTalks).toEqual({});
      expect(session.friendship).toEqual({});
    });

    it("fails when talkFriendship is not enabled", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const event = talkEvent("ev_npc", "char_npc", undefined);

      expect(isTalkFriendshipEnabled(event)).toBe(false);
      expect(trySocialTalk(session, event)).toMatchObject({ ok: false, reason: "not-enabled" });
    });

    it("is independent of dailyGifts", () => {
      const project = giftTalkProject();
      const session = startSession(project);
      const event = talkEvent("ev_farmer", "char_farmer", true);
      event.giftPrefs = { loved: ["item_strawberry"] };
      event.giftResponses = { loved: "thanks" };

      expect(trySocialTalk(session, event)).toMatchObject({ ok: true, delta: 10, friendship: 10 });
      expect(session.dailyTalks?.char_farmer).toBeDefined();
      expect(session.dailyGifts?.char_farmer).toBeUndefined();

      expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
        ok: true,
        delta: 80,
        friendship: 90,
      });
      expect(session.dailyGifts?.char_farmer).toBeDefined();
      expect(session.dailyTalks?.char_farmer).toBeDefined();

      // Gift already used today, talk already used today — independent reasons.
      expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
        ok: false,
        reason: "already-gifted",
      });
      expect(trySocialTalk(session, event)).toMatchObject({
        ok: false,
        reason: "already-talked",
      });
    });

    it("uses resolveSocialKey characterId, never event.id", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const event = talkEvent("ev_map_copy", "char_shared", true);

      expect(trySocialTalk(session, event)).toMatchObject({ ok: true, npcKey: "char_shared" });
      expect(session.friendship?.char_shared).toBe(10);
      expect(session.friendship?.ev_map_copy).toBeUndefined();
      expect(session.dailyTalks?.char_shared).toBeDefined();
      expect(session.dailyTalks?.ev_map_copy).toBeUndefined();
    });

    it("round-trips dailyTalks through save/load", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const event = talkEvent("ev_npc", "char_npc", true);
      expect(trySocialTalk(session, event)).toMatchObject({ ok: true, friendship: 10 });

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.dailyTalks).toEqual(session.dailyTalks);
      expect(restored.friendship).toEqual({ char_npc: 10 });
      expect(trySocialTalk(restored, event)).toMatchObject({
        ok: false,
        reason: "already-talked",
      });
    });
  });
  function talkEvent(
    id: string,
    characterId: string | undefined,
    talkFriendship: GameEvent["talkFriendship"]
  ): GameEvent {
    return {
      id,
      ...(characterId ? { characterId } : {}),
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      ...(talkFriendship !== undefined ? { talkFriendship } : {}),
    };
  }
  function giftTalkProject(): Project {
    const project = createBlankProject();
    project.system.giftSystem = true;
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    project.database.items.push(
      normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 12 })
    );
    project.session.inventory = { item_strawberry: 2 };
    return project;
  }
});
