import { describe, expect, it } from "vitest";
import { RETRO_CLASS_SKILLS } from "@/assets/retroClassSkills";
import { retroClassSkillTimeline, retroSoundForLayer } from "@/battle/retroSkillTimeline";

describe("side-view contact timing", () => {
  it("lands the hero's blade pose and impact sound on the same contact cue", () => {
    const skill = RETRO_CLASS_SKILLS.find(row => row.id === "skill_hero_cross_slash")!;
    const timeline = retroClassSkillTimeline(skill);
    const contact = timeline.events.find(event => event.kind === "hit")!.at;
    expect(timeline.events).toContainEqual({ kind: "pose", at: contact, pose: "attack" });
    expect(timeline.events).toContainEqual({ kind: "sound", at: contact, id: retroSoundForLayer("hero_cross") });
    const strike = timeline.events.find(event => event.kind === "pose" && event.pose === "attack_strike")!;
    expect(contact - strike.at).toBeLessThanOrEqual(60);
  });

  it("plays projectile arrival before contact and delays the burst sound until that contact", () => {
    const skill = RETRO_CLASS_SKILLS.find(row => row.id === "skill_mage_fireball")!;
    const timeline = retroClassSkillTimeline(skill);
    const contact = timeline.events.find(event => event.kind === "hit")!.at;
    const projectile = timeline.events.find(event => event.kind === "projectile")!;
    expect(projectile.kind).toBe("projectile");
    if (projectile.kind === "projectile") expect(projectile.at + projectile.durationMs).toBeLessThan(contact);
    expect(timeline.events).toContainEqual({ kind: "sound", at: contact, id: retroSoundForLayer("mage_fire_burst") });
  });

  it("keeps healing audio at the start of its blessing layer", () => {
    const skill = RETRO_CLASS_SKILLS.find(row => row.id === "skill_cleric_heal_light")!;
    const timeline = retroClassSkillTimeline(skill, { side: "allies" });
    const layer = timeline.events.find(event => event.kind === "fx" && event.key === "cleric_heal")!;
    expect(timeline.events).toContainEqual({ kind: "sound", at: layer.at, id: retroSoundForLayer("cleric_heal") });
  });
});
