import { describe, expect, it, vi } from "vitest";
import { createBlankProject, DEFAULT_EQUIPMENT_ID } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createStatusMenuDetail, bestEquipmentPlan } from "@/player/playerStatusMenuDetails";
import { useItemFromMenu } from "@/player/playerItemUse";
import type { ItemRecord } from "@/project/types";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("playerMenuItemTargets", () => {
  isolateTimers();
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

    it("activates a switch directly despite a stale ally scope", () => {
      const f = fixture({ type: "switch", scope: "ally", switchId: "qa_device" });
      f.detail().entries.find((entry) => entry.testId === `status-menu-item-${f.item.id}`)!.onActivate!();
      expect(f.select).not.toHaveBeenCalled();
      expect(f.use.mock.results[0]?.value.kind).toBe("used");
      expect(f.session.switches.qa_device).toBe(true);
      expect(f.session.inventory[f.item.id]).toBe(1);
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
});

// 기본 도트 창(메뉴 스킨 pixel) — 상점 기본 프리셋과 같은 창 체계가 ESC 메뉴·장비·아이템 대상으로 이어진다.
// 화면 모양은 런타임 QA(esc-pixel · inn-battle-pixel)가 본다. 여기서는 수치 계약만 고정한다.
describe("playerStatusMenuPixel", () => {
  isolateTimers();
  const noop = () => undefined;
  const actions: PlayerStatusMenuActions = {
    onCommand: noop, onOpenGroup: noop, onSaveSlot: noop, onLoadSlot: noop, onSelectItemTarget: noop, onUseItem: noop,
    onSelectSkillActor: noop, onSelectSkill: noop, onSelectEquipmentActor: noop, onSelectEquipmentSlot: noop,
    onEquipItem: noop, onUnequipItem: noop, onOptimizeEquipment: noop, onToggleRow: noop, onSelectFormationActor: noop,
    onMoveFormationActor: noop, onToggleMonsterView: noop, onMoveMonster: noop, onToggleWait: noop, onToTitle: noop,
  };
  /** 전투가 있는 게임으로 만든다 — 전투 없는 게임은 첫 화면이 파티 개요 대신 이야기 개요다(combatPresence, #3660). */
  function withCombat<T extends ReturnType<typeof createBlankProject>>(project: T): T {
    const map = project.maps[project.startMapId]!;
    map.encounterRate = 30;
    map.troopIds = [project.database.troops[0]!.id];
    return project;
  }
  function fourParty() {
    const project = withCombat(createBlankProject());
    const session = startSession(project);
    session.partyActorIds = ["actor_hero", "actor_guardian", "actor_mage", "actor_scout"];
    for (const id of session.partyActorIds) session.actorVitals[id] ??= { hp: 50, maxHp: 100, mp: 5, maxMp: 20 };
    return { project, session };
  }
  describe("pixel window menu (default skin)", () => {
    it("첫 화면 파티 창에 상태이상과 다음 레벨까지 EXP 를 숫자로 보인다", () => {
      const restore = installFakeDom();
      try {
        const { project, session } = fourParty();
        session.actorStateIds = { actor_mage: ["state_poison"] };
        const menu = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "main" }));
        expect(menu.getAttribute("data-menu-skin")).toBe("pixel");
        expect(menu.getAttribute("data-menu-skin-stats")).toBe("true");
        expect(findByTestId(menu, "status-menu-party-overview")).not.toBeNull();
        expect(findByTestId(menu, "status-menu-overview-states-2")?.textContent).toBe("독");
        expect(findByTestId(menu, "status-menu-overview-states-0")?.textContent).toBe("정상");
        expect(findByTestId(menu, "status-menu-overview-exp-0")?.getAttribute("role")).toBe("meter");
        expect(findByTestId(menu, "status-menu-overview-row-0")?.textContent).toMatch(/다음 \d+/);
      } finally { restore(); }
    });

    it("최강 장비는 가방 속 더 강한 무기를 고르고 증감을 현재 → 변경 후로 계산한다", () => {
      const { project, session } = fourParty();
      session.inventory = { equip_iron_sword: 1, equip_steel_sword: 1 };
      const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
      const plan = bestEquipmentPlan({ project, session }, hero)!;
      expect(plan.changes.map((change) => [change.slotId, change.equipmentId])).toEqual([["weapon", "equip_steel_sword"]]);
      const attack = plan.statDelta.find((delta) => delta.label === "공격")!;
      expect(attack.next - attack.current).toBe(20 - 8);
      // 강철 검은 공격 +12 를 주지만 민첩 −1 도 낸다(0b13578d30 이후 음수 장비 보정이 0 으로 깎이지 않는다) — 합계는 12 − 1 = 11.
      expect(plan.gain).toBe(11);
      // 가방이 비면 바꿀 것이 없다.
      session.inventory = {};
      expect(bestEquipmentPlan({ project, session }, hero)!.changes).toEqual([]);
    });

    it("장비 부위 화면 끝에 「최강 장비 합계 +N」, 후보 행에는 가장 큰 변화와 ▲ 가 붙는다", () => {
      const restore = installFakeDom();
      try {
        const { project, session } = fourParty();
        session.inventory = { equip_steel_sword: 1 };
        const slots = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "equipment", equipmentActorId: "actor_hero" }));
        expect(findByTestId(slots, "status-menu-equipment-optimize")?.textContent).toContain("합계 +11");
        const candidates = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "equipment", equipmentActorId: "actor_hero", equipmentSlotId: "weapon", selectedDetailActionIndex: 1 }));
        expect(findByTestId(candidates, "status-menu-equipment-item-equip_steel_sword")?.textContent).toContain("공격+12");
        expect(findByTestId(candidates, "status-menu-stat-delta-공격")?.textContent).toContain("▲12");
      } finally { restore(); }
    });

    it("해독 아이템 대상 카드는 「독 → 정상」, 회복 아이템은 늘어나는 양을 ▲ 로 보인다", () => {
      const restore = installFakeDom();
      try {
        const { project, session } = fourParty();
        session.actorStateIds = { actor_mage: ["state_poison"] };
        session.inventory = { item_antidote: 1, item_potion: 1 };
        // startSession 이 시작 파티의 체력을 이미 채워 두므로(fourParty 의 ??= 는 주인공을 건너뛴다) 회복 대상 주인공을 다치게 둔다.
        session.actorVitals.actor_hero = { hp: 50, maxHp: 100, mp: 5, maxMp: 20 };
        const antidote = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "items", targetItemId: "item_antidote" }));
        expect(findByTestId(antidote, "status-menu-item-target-actor_mage-states")?.textContent).toBe("독 → 정상");
        expect(findByTestId(antidote, "status-menu-item-target-actor_hero-states")?.textContent).toBe("정상");
        const potion = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "items", targetItemId: "item_potion" }));
        expect(findByTestId(potion, "status-menu-item-target-actor_hero")?.textContent).toMatch(/HP 50\/100 → \d+ ▲\d+/);
      } finally { restore(); }
    });
  });
});

// 스킬 메뉴의 소모 글자가 전투와 같은 값인지 — 고정 MP 만 보이면 최대 MP %·장비 절반·연계 몫이 0 으로 읽힌다.
describe("playerStatusMenuSkillCost", () => {
  isolateTimers();
  const noop = () => undefined;
  const actions: PlayerStatusMenuActions = {
    onCommand: noop, onOpenGroup: noop, onSaveSlot: noop, onLoadSlot: noop, onSelectItemTarget: noop, onUseItem: noop,
    onSelectSkillActor: noop, onSelectSkill: noop, onSelectEquipmentActor: noop, onSelectEquipmentSlot: noop,
    onEquipItem: noop, onUnequipItem: noop, onOptimizeEquipment: noop, onToggleRow: noop, onSelectFormationActor: noop,
    onMoveFormationActor: noop, onToggleMonsterView: noop, onMoveMonster: noop, onToggleWait: noop, onToTitle: noop,
  };
  function skillMenu() {
    const project = createBlankProject();
    const session = startSession(project);
    const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
    hero.initialLevel = 1;
    hero.parameterCurves = { ...hero.parameterCurves, maxMp: [100, ...hero.parameterCurves.maxMp.slice(1)] };
    session.actorLevels.actor_hero = 1;
    session.actorSkillIds = { ...session.actorSkillIds, actor_hero: ["skill_fire"] };
    const fire = project.database.skills.find((skill) => skill.id === "skill_fire")!;
    fire.mpCost = { flat: 4, percentMax: 10 };
    const sword = project.database.equipment.find((record) => record.id === DEFAULT_EQUIPMENT_ID)!;
    session.actorEquipment = { ...session.actorEquipment, actor_hero: { ...session.actorEquipment.actor_hero, weapon: sword.id } };
    const row = () => createStatusMenuDetail({
      project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills", skillActorId: "actor_hero",
    }).entries.find((entry) => entry.testId === "status-menu-skill-actor_hero-skill_fire")!;
    return { project, session, fire, sword, row };
  }
  describe("status menu skill cost", () => {
    it("shows flat plus percent of max MP, and halves that when equipment says so", () => {
      const { fire, sword, row } = skillMenu();
      // 4 + floor(100 * 10 / 100) = 14. 고정 4 만 보이면 전투에서 실제로 내는 값과 다르다.
      expect(row().value).toBe("MP 14");
      sword.effectFlags.halfMpCost = true;
      // (14 + 1) / 2 = 7. 1 짜리 기술이 0 이 되지 않는 전투 내림과 같다.
      expect(row().value).toBe("MP 7");
      fire.fieldCommonEventId = "common_field_fire";
      expect(row().value).toBe("MP 7 · 필드에서 사용");
    });

    it("uses the project MP term, a combo share, and the second resource when that gauge is on", () => {
      const { project, fire, row } = skillMenu();
      project.meta.terms = { ...project.meta.terms, mp: "마나" };
      expect(row().value).toBe("마나 14");
      fire.comboActorIds = ["actor_hero", "actor_mage"];
      fire.comboMpCosts = [{ actorId: "actor_hero", mp: 6 }, { actorId: "actor_mage", mp: 9 }];
      expect(row().value).toBe("마나 6");
      expect(row().description).toContain("연계:");
      expect(row().description).toContain("마나 6");
      expect(row().description).toContain("마나 9");
      fire.comboActorIds = undefined;
      fire.comboMpCosts = undefined;
      fire.resource2Cost = 5;
      project.system.resource2 = { enabled: true, label: "기력" };
      expect(row().value).toBe("마나 14 · 기력 5");
    });

    it("keeps the equipped mark and still shows the cost the battle will charge", () => {
      const { project, session } = skillMenu();
      const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
      hero.loadoutSlots = 2;
      session.actorSkillLoadouts = { actor_hero: ["skill_fire"] };
      const detail = createStatusMenuDetail({
        project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills", skillActorId: "actor_hero",
        onToggleSkillLoadout: () => undefined,
      });
      const row = detail.entries.find((entry) => entry.testId === "status-menu-skill-actor_hero-skill_fire")!;
      expect(row.label.startsWith("● ")).toBe(true);
      expect(row.attributes?.loadoutEquipped).toBe("true");
      expect(row.value).toBe("MP 14");
    });

    it("party row shows the skill count, and the drill-down lists every skill", () => {
      // 이름을 다 잇던 행이 1890px 로 늘어 열 경계에서 잘렸다(폴른 스타 QA, 2026-11-08).
      const { project, session } = skillMenu();
      const names = project.database.skills.slice(0, 13);
      session.actorSkillIds = { ...session.actorSkillIds, actor_hero: names.map((skill) => skill.id) };
      const party = createStatusMenuDetail({ project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills" });
      const heroRow = party.entries.find((entry) => entry.testId === "status-menu-skill-actor-actor_hero")!;
      const listed = createStatusMenuDetail({
        project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills", skillActorId: "actor_hero",
      }).entries;
      expect(listed.length).toBeGreaterThanOrEqual(names.length);
      expect(heroRow.value).toBe(`스킬 ${listed.length}개`);
      for (const skill of names) expect(heroRow.value).not.toContain(skill.name);
    });

    it("paints the same cost on the skill screen row", () => {
      const restore = installFakeDom();
      try {
        const { project, session } = skillMenu();
        const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
          project, session, slots: [], actions, mode: "function", selectedCommand: "skills", skillActorId: "actor_hero",
        }));
        expect(findByTestId(menu, "status-menu-skill-actor_hero-skill_fire")?.textContent).toContain("MP 14");
      } finally { restore(); }
    });
  });
});
