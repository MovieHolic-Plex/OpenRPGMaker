import { describe, expect, it } from "vitest";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { activeItemEffects } from "@/project/itemUsage";
import { canUseMenuItemOnActor, useItemFromMenu } from "@/player/playerItemUse";
import type { ItemCaptureProfile, ItemRecord } from "@/project/types";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions: PlayerStatusMenuActions = {
  onCommand: () => undefined,
  onOpenGroup: () => undefined,
  onSaveSlot: () => undefined,
  onLoadSlot: () => undefined,
  onSelectItemTarget: () => undefined,
  onUseItem: () => undefined,
  onSelectSkillActor: () => undefined,
  onSelectSkill: () => undefined,
  onSelectEquipmentActor: () => undefined,
  onSelectEquipmentSlot: () => undefined,
  onEquipItem: () => undefined,
  onUnequipItem: () => undefined,
  onToggleRow: () => undefined,
  onSelectFormationActor: () => undefined,
  onMoveFormationActor: () => undefined,
  onToggleMonsterView: () => undefined,
  onMoveMonster: () => undefined,
  onToggleWait: () => undefined,
  onToTitle: () => undefined,
};

function factValue(entry: { facts?: readonly { id: string; value: string }[] } | undefined, id: string): string | undefined {
  return entry?.facts?.find((fact) => fact.id === id)?.value;
}

const SEED_KEYS = ["attack", "defense", "mind", "agility"] as const satisfies readonly (keyof ItemRecord["seedParameterBonuses"])[];

function metadataFixture(changes: Partial<ItemRecord> = {}) {
  const project = createBlankProject();
  const item = project.database.items.find((record) => record.id === "item_potion");
  if (!item) throw new Error("missing item_potion fixture");
  const [removed, added] = project.database.states;
  if (!removed || !added) throw new Error("missing two state fixtures");
  const skill = project.database.skills.at(-1);
  if (!skill) throw new Error("missing skill fixture");
  Object.assign(item, {
    type: "medicine", scope: "ally", occasion: "field", consumable: true, consumptionLimit: 1,
    skillId: undefined, learnedSkillId: undefined, activateSkillId: undefined,
    hpRecovery: { flat: 0, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
    healStateIds: [], stateEffects: [], usableActorIds: [], usableClassIds: [],
    ...changes,
  });
  const session = startSession(project, 42);
  session.inventory = { [item.id]: 2 };
  const actorId = session.partyActorIds[0];
  if (!actorId) throw new Error("missing party actor fixture");
  const vitals = session.actorVitals[actorId];
  if (!vitals) throw new Error("missing party actor vitals fixture");
  const secondActor = project.database.actors.find((actor) => actor.id !== actorId);
  if (!secondActor) throw new Error("missing second actor fixture");
  const detail = () => createStatusMenuDetail({
    project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
    onUseItem: () => undefined, onSelectItemTarget: () => undefined,
  });
  const fact = (id: string) => detail().entries.find((entry) => entry.testId === `status-menu-item-${item.id}`)?.facts?.find((entry) => entry.id === id);
  const text = (id: string) => {
    const restore = installFakeDom();
    try {
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project, session, slots: [], selectedCommand: "items", mode: "function",
        selectedDetailActionIndex: 0, actions: noopActions,
      }));
      return findByTestId(menu, `status-menu-item-fact-${id}`)?.textContent ?? "";
    } finally { restore(); }
  };
  return { project, session, item, actorId, vitals, secondActor, removed, added, skill, detail, fact, text };
}

describe("item showcase executable metadata regressions", () => {
  it("deduplicates removal IDs across both sources in first-occurrence order without changing use", () => {
    const f = metadataFixture();
    const third = f.project.database.states[2];
    if (!third) throw new Error("missing third state fixture");
    f.removed.name = "Removal-A-271";
    f.added.name = "Removal-B-389";
    third.name = "Removal-C-593";
    f.item.healStateIds = [f.added.id, f.removed.id, f.added.id];
    f.item.stateEffects = [
      { stateId: f.removed.id, operation: "remove", chance: 0 },
      { stateId: third.id, operation: "remove", chance: 0 },
      { stateId: f.added.id, operation: "remove", chance: 100 },
      { stateId: third.id, operation: "remove", chance: 37 },
    ];
    f.session.actorStateIds = { [f.actorId]: [f.removed.id, f.added.id, third.id] };
    const before = structuredClone(f.session);
    const effects = f.fact("effects")?.value;
    const text = f.text("effects");
    expect(f.session).toEqual(before);
    expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(true);
    expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
    expect(f.session.actorStateIds[f.actorId]).toEqual([]);
    expect(f.session.inventory[f.item.id]).toBe(1);
    expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(false);
    expect(effects?.split(",")).toEqual([f.added.id, f.removed.id, third.id].map((id) => `heal:${encodeURIComponent(id)}`));
    for (const state of [f.added, f.removed, third]) {
      expect(text.split(state.name)).toHaveLength(2);
    }
    expect(text.indexOf(f.added.name)).toBeLessThan(text.indexOf(f.removed.name));
    expect(text.indexOf(f.removed.name)).toBeLessThan(text.indexOf(third.name));
  });

  it("keeps add-state probability separate from duplicate removals of the same ID", () => {
    const f = metadataFixture();
    f.item.healStateIds = [f.removed.id, f.removed.id];
    f.item.stateEffects = [
      { stateId: f.removed.id, operation: "add", chance: 100 },
      { stateId: f.removed.id, operation: "remove", chance: 0 },
    ];
    f.session.actorStateIds = { [f.actorId]: [f.removed.id] };
    const effects = f.fact("effects")?.value;
    expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
    expect(f.session.actorStateIds[f.actorId]).toEqual([f.removed.id]);
    expect(f.session.inventory[f.item.id]).toBe(1);
    expect(effects?.split(",")).toEqual([
      `heal:${encodeURIComponent(f.removed.id)}`,
      `state:${encodeURIComponent(f.removed.id)}:100`,
    ]);
  });

  it("groups consecutive heal prefixes while keeping unique resolved names and other effect kinds", () => {
    const f = metadataFixture();
    const states = f.project.database.states.slice(0, 8);
    if (states.length < 8) throw new Error("need eight state fixtures");
    f.item.healStateIds = states.map((state) => state.id);
    f.item.stateEffects = [];
    f.item.hpRecovery = { flat: 12, percentMax: 0 };
    const text = f.text("effects");
    expect(text.match(/치료/g)?.length ?? 0).toBe(1);
    expect(text).toContain(`HP +12`);
    expect(text.indexOf("HP +12")).toBeLessThan(text.indexOf("치료"));
    for (const state of states) {
      expect(text.split(state.name)).toHaveLength(2);
    }
    f.item.healStateIds = [states[0].id];
    f.item.stateEffects = [{ stateId: states[1].id, operation: "add", chance: 40 }];
    const mixed = f.text("effects");
    expect(mixed).toContain(states[0].name);
    expect(mixed).toContain(states[1].name);
    expect(mixed).toContain("40%");
    expect(mixed).toContain("치료");
    expect(mixed).toContain("상태");
  });

  it("retains zero-chance removal while excluding impossible additions, matching eligibility and mutation", () => {
    const f = metadataFixture();
    const { removed, added } = f;
    f.item.stateEffects = [
      { stateId: removed.id, operation: "remove", chance: 0 },
      { stateId: added.id, operation: "add", chance: 0 },
    ];
    f.session.actorStateIds = { [f.actorId]: [removed.id] };
    expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(true);
    const before = structuredClone(f.session);
    const effects = f.fact("effects")?.value;
    expect(f.session).toEqual(before);
    expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
    expect(f.session.actorStateIds[f.actorId]).toEqual([]);
    expect(f.session.inventory[f.item.id]).toBe(1);
    expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(false);
    expect(effects).toContain(`heal:${removed.id}`);
    expect(effects).not.toContain(`state:${added.id}`);
  });

  it.each(["switch", "special"] as const)("ignores stale restriction arrays after changing medicine to %s", (type) => {
    const f = metadataFixture({ usableActorIds: ["other-actor"], usableClassIds: ["other-class"] });
    expect(f.fact("eligibility")?.value).toBe("restricted");
    f.item.type = type;
    f.item.switchId = "metadata-switch";
    f.item.stateEffects = [{ stateId: f.added.id, operation: "add", chance: 100 }];
    expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
    if (type === "switch") expect(f.session.switches[f.item.switchId]).toBe(true);
    else expect(f.session.actorStateIds?.[f.actorId]).toContain(f.added.id);
    expect(f.fact("eligibility")?.value).toBe("usable");
  });

  it("renders resolved state identities and add chances as safe text", () => {
    const f = metadataFixture();
    const { removed, added } = f;
    removed.name = "Cure <b>A</b>,: 271";
    added.name = "Ward <img src=x> 389";
    f.item.healStateIds = [removed.id];
    const effect: ItemRecord["stateEffects"][number] = { stateId: added.id, operation: "add", chance: 37 };
    f.item.stateEffects = [effect];
    const text = f.text("effects");
    expect(text).toContain(removed.name);
    expect(text).toContain(added.name);
    expect(text).toContain(`${effect.chance}%`);
  });

  it.each(["book", "special", "switch"] as const)("resolves %s effect identity including legacy skillId", (type) => {
    const f = metadataFixture({ type });
    const { skill } = f;
    skill.name = "Record <strong>593</strong>";
    f.item.skillId = skill.id;
    f.item.learnedSkillId = undefined;
    f.item.activateSkillId = undefined;
    const switchDef = { id: "metadata-switch", name: "Gate <b>617</b>" };
    f.project.switches.push(switchDef);
    f.item.switchId = switchDef.id;
    expect(f.text("effects")).toContain(type === "switch" ? switchDef.name : skill.name);
  });

  it.each(["feed", "toy"] as const)("shows %s care amounts", (kind) => {
    const careProfile = { kind, friendshipDelta: 17, expDelta: 43 };
    const f = metadataFixture({ type: "special", careProfile });
    const text = f.text("effects");
    expect(text).toContain(`+${careProfile.friendshipDelta}`);
    expect(text).toContain(`+${careProfile.expDelta}`);
  });

  it.each(["rm2k3", undefined] as const)("shows capture multiplier for battle model %s", (battleModel) => {
    const captureProfile: ItemCaptureProfile = { multiplier: 2.75, ballClass: "master" };
    const f = metadataFixture({ type: "special", captureProfile });
    f.project.system.battleModel = battleModel;
    const initialText = f.text("effects");
    expect(initialText).toContain(String(captureProfile.multiplier));
    expect(initialText).not.toContain(captureProfile.ballClass);
    captureProfile.ballClass = "poke";
    expect(f.text("effects")).toBe(initialText);
    captureProfile.multiplier = 4.25;
    expect(f.text("effects")).toContain(String(captureProfile.multiplier));
    expect(f.text("effects")).not.toBe(initialText);
  });

  it.each(["poke", "great", "ultra", "master", undefined] as const)("shows effective Gen1 capture class %s without inactive multiplier", (ballClass) => {
    const captureProfile: ItemCaptureProfile = { multiplier: 2.75, ballClass };
    const f = metadataFixture({ type: "special", captureProfile });
    f.project.system.battleModel = "gen1";
    const effectiveClass = ballClass ?? "poke";
    expect(f.fact("effects")?.value).toBe(`capture-class:${effectiveClass}`);
    expect(f.text("effects")).toContain(effectiveClass);
    expect(f.text("effects")).not.toContain(String(captureProfile.multiplier));
  });

  it("keeps Gen1 capture details invariant when only the inactive multiplier changes", () => {
    const captureProfile: ItemCaptureProfile = { multiplier: 2.75, ballClass: "great" };
    const f = metadataFixture({ type: "special", captureProfile });
    f.project.system.battleModel = "gen1";
    const initialText = f.text("effects");
    const initialFacts = f.fact("effects");
    captureProfile.multiplier = 4.25;
    expect(f.text("effects")).toBe(initialText);
    expect(f.fact("effects")).toEqual(initialFacts);
  });

  it("distinguishes all Gen1 capture classes and defaults an omitted class to poke", () => {
    const captureProfile: ItemCaptureProfile = { multiplier: 2.75 };
    const f = metadataFixture({ type: "special", captureProfile });
    f.project.system.battleModel = "gen1";
    const defaultText = f.text("effects");
    const classTexts = ["poke", "great", "ultra", "master"] as const;
    const rendered = classTexts.map((ballClass) => {
      captureProfile.ballClass = ballClass;
      return f.text("effects");
    });
    expect(new Set(rendered).size).toBe(classTexts.length);
    expect(rendered[0]).toBe(defaultText);
  });

  it("shows each seed parameter with signed amounts and matches the actual negative mutation", () => {
    const f = metadataFixture({ type: "seed", seedParameterBonuses: { attack: -7, defense: 13, mind: 19, agility: 23 } });
    const text = f.text("effects");
    expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
    for (const key of SEED_KEYS) {
      const delta = f.item.seedParameterBonuses[key];
      expect(f.session.actorParamBonuses?.[f.actorId]?.[key]).toBe(delta);
      expect(text).toContain(`${delta > 0 ? "+" : ""}${delta}`);
      expect(f.fact("effects")?.value).toContain(`seed:${key}:${delta}`);
    }
    expect(new Set(f.fact("effects")?.value.split(",")).size).toBe(4);
    // Equal amounts must still be distinguishable by their data-derived parameter labels.
    const parameterTexts = SEED_KEYS.map((key) => {
      f.item.seedParameterBonuses = { attack: 0, defense: 0, mind: 0, agility: 0, [key]: 11 };
      return f.text("effects");
    });
    expect(new Set(parameterTexts).size).toBe(4);
  });

  it.each([
    { type: "medicine", scope: "ally", dead: false, target: "ally" },
    { type: "medicine", scope: "allAllies", dead: false, target: "allAllies" },
    { type: "medicine", scope: "allAllies", dead: true, target: "allAllies" },
    { type: "book", scope: "allAllies", dead: true, target: "ally" },
    { type: "seed", scope: "allAllies", dead: true, target: "ally" },
    { type: "switch", scope: "allAllies", dead: true, target: "none" },
    { type: "book", scope: "none", dead: false, target: "ally" },
    { type: "seed", scope: "none", dead: false, target: "ally" },
  ] as const)("projects effective targeting $type/$scope/dead=$dead", ({ type, scope, dead, target }) => {
    const f = metadataFixture({ type, scope, onlyEffectiveOnDeadActors: dead,
      seedParameterBonuses: { attack: -7, defense: 0, mind: 0, agility: 0 } });
    f.item.learnedSkillId = f.skill.id;
    f.item.switchId = "metadata-switch";
    expect(f.fact("eligibility")?.targeting).toEqual({ scope: target, deadOnly: type === "medicine" && dead });
    const secondId = f.secondActor.id;
    f.session.partyActorIds = [f.actorId, secondId];
    f.session.actorSkillIds = { [f.actorId]: [], [secondId]: [] };
    f.session.actorParamBonuses = {};
    f.session.actorVitals[f.actorId] = { hp: dead ? 0 : 1, maxHp: 100, mp: 10, maxMp: 10 };
    f.session.actorVitals[secondId] = { hp: 1, maxHp: 100, mp: 10, maxMp: 10 };
    f.item.hpRecovery = { flat: 9, percentMax: 0 };
    expect(useItemFromMenu(f.project, f.session, f.item.id, target === "none" ? undefined : f.actorId).kind).toBe("used");
    if (type === "book") {
      expect(f.session.actorSkillIds[f.actorId]).toContain(f.item.learnedSkillId);
      expect(f.session.actorSkillIds[secondId]).toEqual([]);
    } else if (type === "seed") {
      expect(f.session.actorParamBonuses[f.actorId]?.attack).toBe(-7);
      expect(f.session.actorParamBonuses[secondId]).toBeUndefined();
    } else if (type === "switch") expect(f.session.switches[f.item.switchId]).toBe(true);
    else {
      expect(f.session.actorVitals[f.actorId]?.hp).toBe(dead ? 9 : 10);
      expect(f.session.actorVitals[secondId]?.hp).toBe(scope === "allAllies" && !dead ? 10 : 1);
    }
  });

  it("distinguishes target cases in rendered text without pinning copy", () => {
    const f = metadataFixture();
    const single = f.text("target");
    f.item.scope = "allAllies";
    const all = f.text("target");
    f.item.onlyEffectiveOnDeadActors = true;
    const dead = f.text("target");
    f.item.type = "switch";
    const none = f.text("target");
    expect(new Set([single, all, dead, none]).size).toBe(4);
  });

  it("projects FIFO remaining uses across partially charged and fresh copies without mutating session", () => {
    const f = metadataFixture({ consumptionLimit: 3, hpRecovery: { flat: 1, percentMax: 0 } });
    f.session.itemUseCharges = { [f.item.id]: 2 };
    const before = structuredClone(f.session);
    const fact = f.fact("eligibility");
    const text = f.text("consumption");
    expect(f.session).toEqual(before);
    expect(fact?.consumption).toEqual({ consumable: true, usesPerCopy: 3, remainingCopyUses: 1, remainingUses: 4 });
    expect(text).toContain("1/3");
    expect(text).toMatch(/\b4\b/);
    f.vitals.hp = 1;
    expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
    expect(f.session.inventory[f.item.id]).toBe(1);
    expect(f.session.itemUseCharges[f.item.id]).toBeUndefined();
    expect(f.fact("eligibility")?.consumption).toEqual({ consumable: true, usesPerCopy: 3, remainingCopyUses: 3, remainingUses: 3 });
    expect(f.text("consumption")).toContain("3/3");
  });

  it("distinguishes reusable from one-use consumables despite stale finite-use settings", () => {
    const f = metadataFixture({ consumptionLimit: "noLimit", hpRecovery: { flat: 1, percentMax: 0 } });
    const consumableText = f.text("consumption");
    expect(f.fact("eligibility")?.consumption).toEqual({ consumable: true, usesPerCopy: 1, remainingCopyUses: 1, remainingUses: 2 });
    f.item.consumable = false;
    f.item.consumptionLimit = 5;
    f.session.itemUseCharges = { [f.item.id]: 2 };
    expect(f.fact("eligibility")?.consumption).toEqual({ consumable: false });
    expect(f.text("consumption")).not.toBe(consumableText);
    const reusableText = f.text("consumption");
    f.item.consumptionLimit = 3;
    f.session.itemUseCharges[f.item.id] = 1;
    expect(f.text("consumption")).toBe(reusableText);
    f.vitals.hp = 1;
    expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
    expect(f.session.inventory[f.item.id]).toBe(2);
  });
});

describe("status menu inventory showcase parity", () => {
  it("exposes authored icon, count, type, effects, and use eligibility on the selected item", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const potion = project.database.items.find((record) => record.id === "item_potion");
      if (!potion) throw new Error("missing item_potion fixture");
      session.inventory[potion.id] = 3;
      const item = activeItemEffects(potion);

      const detail = createStatusMenuDetail({
        project,
        session,
        slots: [],
        waitModeEnabled: true,
        selectedCommand: "items",
        onSelectItemTarget: () => undefined,
        onUseItem: () => undefined,
      });
      const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-item-${potion.id}`);
      expect(entry?.icon?.resourceId).toBe(potion.iconResourceId ?? potion.imageResourceId);
      expect(entry?.value).toBe("3개");
      expect(factValue(entry, "type")).toBe(item.type);
      expect(factValue(entry, "effects")).toContain(`hp:${item.hpRecovery.flat}`);
      expect(factValue(entry, "eligibility")).toBe("usable");

      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail, {
        showcase: true,
        selectedActionIndex: 0,
      }));
      expect(findByTestId(panel, "status-menu-detail-showcase")).not.toBeNull();
      expect(findByTestId(panel, "status-menu-showcase-art")).not.toBeNull();
      expect(findByTestId(panel, "status-menu-showcase-name")?.textContent).toBe(item.name);
      expect(findByTestId(panel, "status-menu-item-fact-effects")?.textContent).toContain(`HP +${item.hpRecovery.flat}`);
    } finally {
      restoreDom();
    }
  });

  it("marks a battle-only item ineligible without dropping it from keyboard selection", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const potion = project.database.items.find((record) => record.id === "item_potion");
      if (!potion) throw new Error("missing item_potion fixture");
      potion.occasion = "battle";
      session.inventory[potion.id] = 1;

      const detail = createStatusMenuDetail({
        project,
        session,
        slots: [],
        waitModeEnabled: true,
        selectedCommand: "items",
        onSelectItemTarget: () => undefined,
        onUseItem: () => undefined,
      });
      const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-item-${potion.id}`);
      expect(entry?.onActivate).toBeTypeOf("function");
      expect(factValue(entry, "eligibility")).toBe("battle");
      expect(entry?.unavailableReason).toBeTruthy();

      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail, {
        showcase: true,
        selectedActionIndex: 0,
      }));
      expect(findByTestId(panel, "status-menu-showcase-description")?.textContent).toBe(entry?.unavailableReason);
    } finally {
      restoreDom();
    }
  });

  it("keeps the production items work panel showcase wired the same way as equipment", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const potion = project.database.items.find((record) => record.id === "item_potion");
      if (!potion) throw new Error("missing item_potion fixture");
      session.inventory[potion.id] = 2;
      const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
        project,
        session,
        slots: [],
        selectedCommand: "items",
        mode: "function",
        selectedDetailActionIndex: 0,
        actions: noopActions,
      }));
      expect(findByTestId(menu, "status-menu-detail")?.className).toContain("has-showcase");
      expect(findByTestId(menu, "status-menu-detail-showcase")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-item-facts")?.className.split(/\s+/)).toContain("status-menu-item-facts");
      expect(findByTestId(menu, "status-menu-item-fact-effects")?.textContent).toContain(`HP +${activeItemEffects(potion).hpRecovery.flat}`);
      expect(findByTestId(menu, "status-menu-item-fact-target")?.textContent).toMatch(/\S/);
      expect(findByTestId(menu, "status-menu-item-fact-consumption")?.textContent).toMatch(/\S/);
      expect(findByTestId(menu, "status-menu-entry-icon-item-item_potion")).not.toBeNull();
    } finally {
      restoreDom();
    }
  });
});
