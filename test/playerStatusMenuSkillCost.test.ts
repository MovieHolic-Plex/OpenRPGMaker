// 스킬 메뉴의 소모 글자가 전투와 같은 값인지 — 고정 MP 만 보이면 최대 MP %·장비 절반·연계 몫이 0 으로 읽힌다.
import { describe, expect, it } from "vitest";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { createBlankProject, DEFAULT_EQUIPMENT_ID } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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
