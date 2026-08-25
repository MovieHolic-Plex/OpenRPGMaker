import { describe, expect, it } from "vitest";
import { createBlankProject, DEFAULT_ANIMATION_ID, DEFAULT_ITEM_ID, DEFAULT_SKILL_ID, DEFAULT_STATE_ID } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

describe("default database starter records", () => {
  it("ships stable RTP-backed starter skills, items, states, and animations", () => {
    // Given: a freshly created project includes the default database seed pack.
    const database = createBlankProject().database;

    // When: starter record ids are collected for editor database surfaces.
    const skillIds = database.skills.map((skill) => skill.id);
    const itemIds = database.items.map((item) => item.id);
    const stateIds = database.states.map((state) => state.id);

    // Then: stable starter records and real EasyRPG animation resources are present.
    expect(skillIds).toEqual(
      expect.arrayContaining([
        DEFAULT_SKILL_ID,
        "skill_sword_slash",
        "skill_arcane_bolt",
        "skill_heal",
        "skill_poison_sting",
        "skill_sleep_mist",
        "skill_focus",
        "skill_weaken",
      ])
    );
    expect(itemIds).toEqual(
      expect.arrayContaining([DEFAULT_ITEM_ID, "item_ether", "item_antidote", "item_wake_herb", "item_poison_dart", "item_old_key"])
    );
    expect(stateIds).toEqual(expect.arrayContaining([DEFAULT_STATE_ID, "state_sleep", "state_attack_up", "state_defense_down"]));
    expect(database.battleAnimations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: DEFAULT_ANIMATION_ID, resourceId: "easyrpg-battle-blow" }),
        expect.objectContaining({ id: "anim_sword", resourceId: "easyrpg-battle-sword1" }),
        expect.objectContaining({ id: "anim_arrow", resourceId: "easyrpg-battle-arrow" }),
        // 마법·회복·독은 근접 타격 아트(blow/arrow) 대신 절차 생성 이펙트 시트를 쓴다.
        expect.objectContaining({ id: "anim_magic", resourceId: "generated-battle-anim-arcane-nova" }),
        expect.objectContaining({ id: "anim_heal", resourceId: "generated-battle-anim-heal-bloom" }),
        expect.objectContaining({ id: "anim_poison", resourceId: "generated-battle-anim-poison-mist" }),
      ])
    );
    expect(database.items.find((item) => item.id === "item_poison_dart")).toMatchObject({
      type: "special",
      skillId: "skill_poison_sting",
      occasion: "battle",
    });
    expect(database.items.find((item) => item.id === DEFAULT_ITEM_ID)).toMatchObject({
      type: "medicine",
      hpRecovery: { flat: 50, percentMax: 0 },
    });
    expect(database.items.find((item) => item.id === "item_hi_potion")).toMatchObject({
      type: "medicine",
      hpRecovery: { flat: 150, percentMax: 0 },
      skillId: "skill_item_hi_potion",
    });
    expect(database.items.find((item) => item.id === "item_elixir")).toMatchObject({
      type: "medicine",
      hpRecovery: { flat: 0, percentMax: 100 },
      mpRecovery: { flat: 0, percentMax: 100 },
    });
    expect(database.items.find((item) => item.id === "item_sword_manual")).toMatchObject({
      type: "book",
      learnedSkillId: "skill_sword_slash",
      consumable: true,
    });
    expect(stateIds).toEqual(expect.arrayContaining([DEFAULT_STATE_ID, "state_sleep", "state_attack_up", "state_defense_up", "state_defense_down"]));
    expect(skillIds).toEqual(
      expect.arrayContaining([
        "skill_item_hi_potion",
        "skill_item_elixir",
        "skill_throwing_knife",
        "skill_item_poison_vial",
        "skill_item_antidote",
        "skill_item_guard",
      ])
    );
  });

  it("backs item-use animations with known EasyRPG RTP sounds", () => {
    // Given: item records use existing battle animation ids for use feedback.
    const project = createBlankProject();

    // When: the default project is round-tripped through resource validation.
    const restored = deserialize(serialize(project));

    // Then: item-use animations reference bundled EasyRPG sound effects.
    expect(restored.database.items.find((item) => item.id === DEFAULT_ITEM_ID)?.animationId).toBe("anim_heal");
    expect(restored.database.items.find((item) => item.id === "item_ether")?.animationId).toBe("anim_gen_psychic_wave");
    expect(restored.database.items.find((item) => item.id === "item_poison_dart")?.animationId).toBe("anim_poison");
    expect(restored.database.battleAnimations.find((animation) => animation.id === "anim_heal")?.timings).toEqual(
      expect.arrayContaining([expect.objectContaining({ soundResourceId: "easyrpg-sound-recovery5" })])
    );
    expect(restored.database.battleAnimations.find((animation) => animation.id === "anim_gen_psychic_wave")?.timings).toEqual(
      expect.arrayContaining([expect.objectContaining({ soundResourceId: "easyrpg-sound-confusion" })])
    );
    expect(restored.database.battleAnimations.find((animation) => animation.id === "anim_poison")?.timings).toEqual(
      expect.arrayContaining([expect.objectContaining({ soundResourceId: "easyrpg-sound-poison" })])
    );
  });
});
