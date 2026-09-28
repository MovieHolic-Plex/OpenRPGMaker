// 기본 도트 창(메뉴 스킨 pixel) — 상점 기본 프리셋과 같은 창 체계가 ESC 메뉴·장비·아이템 대상으로 이어진다.
// 화면 모양은 런타임 QA(esc-pixel · inn-battle-pixel)가 본다. 여기서는 수치 계약만 고정한다.
import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { bestEquipmentPlan } from "@/player/playerStatusMenuDetails";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noop = () => undefined;
const actions: PlayerStatusMenuActions = {
  onCommand: noop, onOpenGroup: noop, onSaveSlot: noop, onLoadSlot: noop, onSelectItemTarget: noop, onUseItem: noop,
  onSelectSkillActor: noop, onSelectSkill: noop, onSelectEquipmentActor: noop, onSelectEquipmentSlot: noop,
  onEquipItem: noop, onUnequipItem: noop, onOptimizeEquipment: noop, onToggleRow: noop, onSelectFormationActor: noop,
  onMoveFormationActor: noop, onToggleMonsterView: noop, onMoveMonster: noop, onToggleWait: noop, onToTitle: noop,
};

function fourParty() {
  const project = createBlankProject();
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
    expect(plan.gain).toBe(12);
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
      expect(findByTestId(slots, "status-menu-equipment-optimize")?.textContent).toContain("합계 +12");
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
      const antidote = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "items", targetItemId: "item_antidote" }));
      expect(findByTestId(antidote, "status-menu-item-target-actor_mage-states")?.textContent).toBe("독 → 정상");
      expect(findByTestId(antidote, "status-menu-item-target-actor_hero-states")?.textContent).toBe("정상");
      const potion = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "items", targetItemId: "item_potion" }));
      expect(findByTestId(potion, "status-menu-item-target-actor_hero")?.textContent).toMatch(/HP 50\/100 → \d+ ▲\d+/);
    } finally { restore(); }
  });
});

