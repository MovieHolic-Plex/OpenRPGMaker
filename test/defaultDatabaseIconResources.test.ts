import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { ensureBundledBattleAnimations } from "@/project/defaults/defaultDatabase";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { normalizeEquipmentRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
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
import { isolateTimers } from "./mergedTeardown";

// test/bootNormalizerReferenceSafety.test.ts
// 계약: 부팅 정규화기는 프로젝트의 참조 무결성을 깨지 않는다.
//
// 현재 계약(2026-09-05): 기존 행의 이미지 연결만 보정하고 삭제한 카탈로그는 복구하지 않는다.
// 과거 결함 근거(2026-08-30): `ensureDefaultDatabaseIconResources` 는 이름과 달리 기본 아이템 카탈로그
// 187종을 프로젝트에 밀어넣는다. 그 아이템들은 기본 스킬·상태를 참조하므로, 자기 스킬·상태 세트가
// 더 작은 프로젝트(예제 어드벤처 = 이슬 장터: items 21 / skills 21 / states 5)에 아이템만 넣으면
// 참조 위반이 82건 생겼다. 그 상태에서 AI 런의 run_lint 가 레이어 검증을 3회 연속 실패시켜 런이
// 죽었고, 에이전트가 고아 레코드를 지우려 하면 커밋 게이트가 같은 왕복 오류로 거부해 청소가
// 불가능한 교착이 됐다.
describe("bootNormalizerReferenceSafety", () => {
  isolateTimers();
  /** store.normalizeCurrentProject 가 부팅마다 도는 두 DB 정규화기(선언 순서 그대로). */
  function runBootDatabaseNormalizers(project: ReturnType<typeof createBlankProject>): void {
    ensureDefaultDatabaseIconResources(project);
    ensureBundledBattleAnimations(project);
  }
  describe("boot normalizers keep reference integrity", () => {
    it("빈 프로젝트도 정규화 후 참조 위반 0건 (기본 세트 자체는 자기충족적이다)", () => {
      const project = createBlankProject();
      runBootDatabaseNormalizers(project);
      expect(collectProjectReferenceIssues(project)).toEqual([]);
    });

    it("아이콘 보정은 삭제한 카탈로그 행이나 그 의존성을 재주입하지 않는다", () => {
      const project = createBlankProject();
      project.database.items = [];
      project.database.equipment = [];
      project.database.skills = [];
      project.database.states = [];

      expect(ensureDefaultDatabaseIconResources(project)).toBe(false);

      expect(project.database.items).toEqual([]);
      expect(project.database.equipment).toEqual([]);
      expect(project.database.skills).toEqual([]);
      expect(project.database.states).toEqual([]);
    });

    it("기존 아이템의 스킬·상태 참조를 유지한다", () => {
      const project = createScarloxyDemoProject();
      // 아이콘 연결만 보정한 뒤에도 모든 기존 효과 참조가 유효하다.
      ensureDefaultDatabaseIconResources(project);
      const skillIds = new Set(project.database.skills.map((skill) => skill.id));
      const stateIds = new Set([...project.database.states.map((state) => state.id), "state_death"]);
      for (const item of project.database.items) {
        for (const id of [item.skillId, item.learnedSkillId, item.activateSkillId]) {
          if (typeof id === "string" && id !== "") expect(skillIds.has(id)).toBe(true);
        }
        for (const effect of item.stateEffects) expect(stateIds.has(effect.stateId)).toBe(true);
        for (const id of item.healStateIds) expect(stateIds.has(id)).toBe(true);
      }
    });
  });
});

describe("defaultEquipmentBackfill", () => {
  isolateTimers();
  describe("default equipment backfill", () => {
    it("preserves the existing equipment catalog without adding missing defaults", () => {
      const project = createScarloxyDemoProject();
      const existingEquipment = project.database.equipment[0];
      if (existingEquipment === undefined) throw new Error("sample project has no equipment");
      existingEquipment.name = "사용자 편집 장비";

      const before = project.database.equipment.map((entry) => entry.id);
      ensureDefaultDatabaseIconResources(project);
      expect(project.database.equipment.find((equipment) => equipment.id === existingEquipment.id)?.name).toBe(
        "사용자 편집 장비",
      );

      expect(project.database.equipment.map((entry) => entry.id)).toEqual(before);
    });
  });
});

describe("itemEquipmentAuthoringTrust", () => {
  isolateTimers();
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
  it("infers legacy skill items without overriding an explicitly authored ordinary-good kind", () => {
    const skillId = store.getCurrent().database.skills[0]!.id;
    const legacy = normalizeItemRecord({ id: "legacy_skill_item", name: "이전 스킬 물품", skillId });
    expect(legacy.type).toBe("special");
    const project = store.getCurrent();
    project.database.items.push(legacy);
    expect(deserialize(serialize(project)).database.items.find((entry) => entry.id === legacy.id)?.type).toBe("special");
    const explicit = normalizeItemRecord({ ...legacy, type: "normalGoods" });
    expect(explicit.type).toBe("normalGoods");
    expect(itemEffectStory(project, explicit).effects).toEqual(["직접 효과 없음"]);
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
    // halfMpCost 는 전투 MP 소모 계산이 소비하므로 저작 가능한 플래그다(mgL3HalfMpCost 테스트).
    // 여전히 런타임에 없는 플래그(선제 공격)는 토글 없이 「적용되지 않는 효과」 안내로만 남는다.
    record.effectFlags.halfMpCost = true;
    record.effectFlags.preemptive = true;
    const node = document.createElement("section") as unknown as FakeElement;
    renderEquipmentRecordForm(node as unknown as HTMLElement, record);
    expect(findByTestId(node, "db-field-equipment-effect-half-mp")).not.toBeNull();
    expect(findByTestId(node, "db-field-equipment-effect-preemptive")).toBeNull();
    expect(field(node, "db-equipment-unsupported-effects").textContent).toContain("선제 공격");
    expect(field(node, "db-equipment-unsupported-effects").textContent).not.toContain("MP 소모 절반");
    expect(equipmentEffectStory(store.getCurrent(), record).effects).toContain("MP 소모 절반");
    expect(equipmentEffectStory(store.getCurrent(), record).effects).not.toContain("선제 공격");
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
});
