import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { equipmentToGoods, itemToGoods } from "@/player/playSceneShopGoods";
import { previewShopEquipment as preview } from "@/player/shopEquipmentPreview";

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
