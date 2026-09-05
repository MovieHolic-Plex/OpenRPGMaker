import { afterEach, beforeEach, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";
import { serialize, deserialize } from "@/project/io";
import { actorBattlers } from "@/battle/battleBattlers";
import { store } from "@/project/store";
import { renderItemRecordForm, itemEffectStory } from "@/editor/panels/databaseItemRecordView";
import { renderEquipmentRecordForm, equipmentEffectStory } from "@/editor/panels/databaseEquipmentRecordView";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { useItemFromMenu } from "@/player/playerItemUse";
import { startSession } from "@/project/session";
import { itemAllowsBattle, itemAllowsMenu } from "@/project/itemUsage";
import { transitionItemState } from "@/project/itemTransitions";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restore: () => void;
beforeEach(() => { restore = installFakeDom(); store.replace(createBlankProject()); });
afterEach(() => restore());
const item = () => store.getCurrent().database.items[0]!;
function form() {
  const node = document.createElement("section") as unknown as FakeElement;
  renderItemRecordForm(node as unknown as HTMLElement, item(), () => undefined);
  return node;
}
function field(node: FakeElement, id: string) {
  const result = findByTestId(node, id);
  if (!result) throw new Error(`Missing ${id}`);
  return result;
}
function select(node: FakeElement, id: string, value: string) {
  const control = field(node, id);
  control.value = value;
  control.dispatchEvent(new Event("change"));
}

it("uses one occasion control and restores field+battle after a field-only edit", () => {
  const node = form();
  select(node, "db-field-item-occasion", "field");
  expect(itemAllowsMenu(item())).toBe(true);
  expect(itemAllowsBattle(item())).toBe(false);
  select(node, "db-field-item-occasion", "always");
  expect(item()).toMatchObject({ occasionField: true, occasionBattle: true, onlyUsableInMenu: false });
  expect(itemAllowsBattle(item())).toBe(true);
  expect(field(node, "db-item-story-occasion").textContent).toContain("전투");
});

it("preserves inactive book settings through serialization without teaching a skill as medicine", () => {
  const skill = store.getCurrent().database.skills[0]!;
  updateDatabaseRecord("items", item().id, { type: "book", learnedSkillId: skill.id, skillId: skill.id, usableActorIds: [], usableClassIds: [], hpRecovery: { flat: 50, percentMax: 0 } });
  select(form(), "db-field-item-type", "medicine");
  const project = deserialize(serialize(store.getCurrent()));
  const saved = project.database.items.find((entry) => entry.id === item().id)!;
  const actor = project.database.actors[0]!;
  const session = startSession(project);
  session.inventory[saved.id] = 2;
  session.actorSkillIds = { [actor.id]: [] };
  session.actorVitals[actor.id]!.hp = 1;
  expect(saved.learnedSkillId).toBe(skill.id);
  expect(useItemFromMenu(project, session, saved.id, actor.id).kind).toBe("used");
  expect(session.actorSkillIds[actor.id]).toEqual([]);
  expect(session.actorVitals[actor.id]!.hp).toBe(51);
  expect(itemEffectStory(project, saved).effects.some((effect) => effect.includes("스킬 습득"))).toBe(false);
});

it("inactive recovery and seed settings cannot be used by a normal good", () => {
  select(form(), "db-field-item-type", "normalGoods");
  const project = store.getCurrent(), actor = project.database.actors[0]!;
  const session = startSession(project);
  session.inventory[item().id] = 1;
  session.actorVitals[actor.id]!.hp = 1;
  expect(useItemFromMenu(project, session, item().id, actor.id).kind).toBe("unusable");
  expect(session.inventory[item().id]).toBe(1);
});

it("preserves deleted default rows through save/load and the boot normalizer", () => {
  const project = createBlankProject();
  const deletedItem = project.database.items.pop()!, deletedEquipment = project.database.equipment.pop()!;
  const reloaded = deserialize(serialize(project));
  ensureDefaultDatabaseIconResources(reloaded);
  expect(reloaded.database.items.some((entry) => entry.id === deletedItem.id)).toBe(false);
  expect(reloaded.database.equipment.some((entry) => entry.id === deletedEquipment.id)).toBe(false);
});

it("has a single special-item skill selector and refreshes scope immediately", () => {
  updateDatabaseRecord("items", item().id, { type: "special", scope: "ally" });
  const node = form(), skill = store.getCurrent().database.skills[1]!;
  expect(findByTestId(node, "db-picker-skill")).toBeNull();
  expect(findByTestId(node, "db-item-card-usable")).toBeNull();
  expect(findByTestId(node, "db-field-item-usage-message")).toBeNull();
  select(node, "db-picker-item-activate-skill", skill.id);
  expect(item()).toMatchObject({ skillId: skill.id, activateSkillId: skill.id });
  select(node, "db-field-scope", "enemy");
  expect(field(node, "db-item-story-target").textContent).toContain("적");
});

it("makes reusable/finite/single use explicit and the runtime respects them", () => {
  const node = form();
  expect(field(node, "db-field-item-consumption-limit").textContent).not.toContain("제한 없음");
  select(node, "db-field-item-consumption-limit", "reusable");
  expect(transitionItemState({ inventory: { [item().id]: 2 } }, [item()], { kind: "successfulUse", itemId: item().id }).inventory[item().id]).toBe(2);
  select(node, "db-field-item-consumption-limit", "2");
  const once = transitionItemState({ inventory: { [item().id]: 2 } }, [item()], { kind: "successfulUse", itemId: item().id });
  expect(once.inventory[item().id]).toBe(2);
  expect(transitionItemState(once, [item()], { kind: "successfulUse", itemId: item().id }).inventory[item().id]).toBe(1);
});

it("capture mode hides the saved skill effect and does not hide medicine controls after a type change", () => {
  const skillId = store.getCurrent().database.skills[0]!.id;
  updateDatabaseRecord("items", item().id, { type: "special", activateSkillId: skillId, skillId, captureProfile: { multiplier: 2 } });
  const node = form();
  expect(findByTestId(node, "db-picker-item-activate-skill")).toBeNull();
  expect(itemEffectStory(store.getCurrent(), item()).effects).toEqual(["포획 배율 ×2"]);
  select(node, "db-field-item-type", "medicine");
  expect(item().captureProfile).toEqual({ multiplier: 2 });
  expect(findByTestId(form(), "db-item-card-state-effects")).not.toBeNull();
  expect(itemEffectStory(store.getCurrent(), item()).effects).not.toContain("포획 배율 ×2");
});

it("does not offer new equipment types in Items", () => {
  const choices = field(form(), "db-field-item-type").children.map((option) => option.attrs.value);
  expect(choices).not.toContain("weapon");
  expect(choices).not.toContain("shield");
});

it("does not advertise unsupported flags and keeps one attack element input", () => {
  const record = store.getCurrent().database.equipment[0]!;
  record.effectFlags.halfMpCost = true;
  const node = document.createElement("section") as unknown as FakeElement;
  renderEquipmentRecordForm(node as unknown as HTMLElement, record);
  expect(findByTestId(node, "db-field-equipment-effect-half-mp")).toBeNull();
  expect(field(node, "db-equipment-unsupported-effects").textContent).toContain("MP 소모 절반");
  expect(equipmentEffectStory(store.getCurrent(), record).effects).not.toContain("MP 소모 절반");
  expect(findByTestId(node, "db-picker-skill")).toBeNull();
  select(node, "db-field-equipment-attack-element", "fire");
  expect(store.getCurrent().database.equipment[0]!.attackElementIds).toEqual(["fire"]);
});

it("a legacy inflict record cannot disable another equipment's state resistance", () => {
  const project = store.getCurrent(), actor = project.database.actors[0]!;
  const shield = normalizeEquipmentRecord({ id: "audit_shield", name: "방어", slot: "shield", equippableActorIds: [actor.id], stateDefenseIds: ["state_poison"], stateDefenseMode: "resist", stateResistanceChance: 100 });
  const weapon = normalizeEquipmentRecord({ id: "audit_weapon", name: "이전 장비", slot: "weapon", equippableActorIds: [actor.id], stateDefenseIds: ["state_sleep"], stateDefenseMode: "inflict", stateResistanceChance: 100 });
  project.database.equipment.push(shield, weapon);
  actor.initialEquipment = { weapon: weapon.id, shield: shield.id };
  const effects = actorBattlers(project, { partyActorIds: [actor.id] })[0]!.equipmentEffects;
  expect(effects.stateDefenseMode).toBe("resist");
  expect(effects.stateDefenseIds).toEqual(["state_poison"]);
});
