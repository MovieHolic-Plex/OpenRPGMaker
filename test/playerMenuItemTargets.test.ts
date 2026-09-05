import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { useItemFromMenu } from "@/player/playerItemUse";
import type { ItemRecord } from "@/project/types";

function fixture(changes: Partial<ItemRecord> = {}) {
  const project = createBlankProject();
  const item = project.database.items.find((item) => item.id === "item_potion")!;
  Object.assign(item, {
    type: "medicine", scope: "ally", occasion: "field", consumable: true,
    consumptionLimit: 1, skillId: undefined, activateSkillId: undefined,
    hpRecovery: { flat: 0, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
    healStateIds: [], stateEffects: [], usableActorIds: [], usableClassIds: [],
    ...changes,
  });
  const session = startSession(project);
  const actorId = session.partyActorIds[0]!;
  session.inventory = { [item.id]: 2 };
  const use = vi.fn((id: string, target?: string) => useItemFromMenu(project, session, id, target));
  const select = vi.fn();
  const detail = (targetItemId?: string) => createStatusMenuDetail({
    project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
    targetItemId, onSelectItemTarget: select, onUseItem: use,
  });
  const target = () => detail(item.id).entries.find((entry) => entry.testId === `status-menu-item-target-${actorId}`)!;
  return { project, session, item, actorId, detail, target, use, select };
}

describe("item menu targets agree with executable effects", () => {
  it.each(["healStateIds", "remove"] as const)("allows %s cures at full HP/MP", (kind) => {
    const f = fixture();
    const stateId = f.project.database.states[0]!.id;
    f.session.actorStateIds![f.actorId] = [stateId];
    if (kind === "healStateIds") f.item.healStateIds = [stateId];
    else f.item.stateEffects = [{ stateId, operation: "remove", chance: 100 }];
    expect(f.target().disabled).toBe(false);
    f.target().onActivate!();
    expect(f.use.mock.results[0]?.value.kind).toBe("used");
    expect(f.session.actorStateIds?.[f.actorId]).toEqual([]);
    expect(f.session.inventory[f.item.id]).toBe(1);
    expect(f.target().disabled).toBe(true);
  });

  it("allows an add-state item at full HP without rolling RNG while browsing", () => {
    const f = fixture();
    const stateId = f.project.database.states[0]!.id;
    f.item.stateEffects = [{ stateId, operation: "add", chance: 100 }];
    const before = structuredClone(f.session);
    expect(f.target().disabled).toBe(false);
    expect(f.session).toEqual(before);
    f.target().onActivate!();
    expect(f.session.actorStateIds?.[f.actorId]).toContain(stateId);
    expect(f.session.inventory[f.item.id]).toBe(1);
    expect(f.target().disabled).toBe(true);
  });

  it.each(["book", "seed"] as const)("selects a recipient for a %s even when its stored scope is none", (type) => {
    const f = fixture({ type, scope: "none" });
    const skillId = f.project.database.skills.at(-1)!.id;
    f.item.learnedSkillId = skillId;
    f.session.actorSkillIds[f.actorId] = [];
    f.item.seedParameterBonuses = { attack: 3, defense: 0, mind: 0, agility: 0 };
    f.detail().entries.find((entry) => entry.testId === `status-menu-item-${f.item.id}`)!.onActivate!();
    expect(f.select).toHaveBeenCalledWith(f.item.id);
    expect(f.use).not.toHaveBeenCalled();
    expect(f.target().disabled).toBe(false);
    f.target().onActivate!();
    expect(f.use.mock.results[0]?.value.kind).toBe("used");
    expect(f.session.inventory[f.item.id]).toBe(1);
    if (type === "book") {
      expect(f.session.actorSkillIds[f.actorId]).toContain(skillId);
      expect(f.target().disabled).toBe(true);
    } else expect(f.session.actorParamBonuses?.[f.actorId]?.attack).toBe(3);
  });

  it("does not enter a stale recovery target screen for ordinary goods", () => {
    const f = fixture({ type: "normalGoods", hpRecovery: { flat: 50, percentMax: 0 } });
    f.session.actorVitals[f.actorId]!.hp = 1;
    f.detail().entries.find((entry) => entry.testId === `status-menu-item-${f.item.id}`)!.onActivate!();
    expect(f.select).not.toHaveBeenCalled();
    expect(f.use.mock.results[0]?.value.kind).toBe("unusable");
    expect(f.target().disabled).toBe(true);
    expect(f.session.inventory[f.item.id]).toBe(2);
  });

  it("honors actor and effective class restrictions before a target can be selected", () => {
    const f = fixture({ hpRecovery: { flat: 50, percentMax: 0 } });
    f.session.actorVitals[f.actorId]!.hp = 1;
    f.item.usableActorIds = ["another_actor"];
    expect(f.target().disabled).toBe(true);
    f.item.usableActorIds = [];
    f.item.usableClassIds = ["promoted_class"];
    expect(f.target().disabled).toBe(true);
    f.project.database.classes.push({ ...f.project.database.classes[0]!, id: "promoted_class" });
    f.session.classOverrides[f.actorId] = "promoted_class";
    expect(f.target().disabled).toBe(false);
  });
});
