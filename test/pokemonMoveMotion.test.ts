import { describe, expect, it } from "vitest";
import { pokemonMoveColor, pokemonMoveMotion, pokemonStrikeFromBelow, spriteEmitPoint } from "@/battle/pokemonMoveMotion";
import type { SkillRecord } from "@/project/types";

type MoveSkill = Pick<SkillRecord, "effect" | "scope" | "animationId" | "moveMotion" | "elementId">;

const physical = (animationId: string, scope: SkillRecord["scope"] = "enemy"): MoveSkill => ({ effect: { kind: "damage", statistic: "attack", affects: "hp" }, scope, animationId });
const special = (animationId: string, elementId?: string): MoveSkill => ({ effect: { kind: "damage", statistic: "mind", affects: "hp" }, scope: "enemy", animationId, elementId });

describe("pokemonMoveMotion (기술 → 움직임 종류)", () => {
  it("기술이 없거나 몸으로 치는 물리 기술은 접촉", () => {
    expect(pokemonMoveMotion(undefined)).toBe("contact");
    expect(pokemonMoveMotion(physical("anim_gen_tackle_impact"))).toBe("contact");
    expect(pokemonMoveMotion(physical("anim_gen_slash_steel"))).toBe("contact");
  });

  it("던지는 물리 기술·특수 기술은 발사체, 물대포는 물줄기라 발사체", () => {
    expect(pokemonMoveMotion(physical("anim_gen_projectile_shot"))).toBe("projectile");
    expect(pokemonMoveMotion(physical("anim_gen_leaf_volley"))).toBe("projectile");
    expect(pokemonMoveMotion(special("anim_gen_fire_burst", "fire"))).toBe("projectile");
    expect(pokemonMoveMotion(special("anim_gen_water_column", "water"))).toBe("projectile");
  });

  it("번개·빛기둥은 위에서, 바위 솟음은 아래에서 — 현장 발생", () => {
    expect(pokemonMoveMotion(special("anim_gen_thunder_strike", "thunder"))).toBe("strike");
    expect(pokemonMoveMotion(special("anim_gen_holy_beam", "holy"))).toBe("strike");
    expect(pokemonMoveMotion(special("anim_gen_earth_spike", "earth"))).toBe("strike");
    expect(pokemonStrikeFromBelow({ animationId: "anim_gen_earth_spike" })).toBe(true);
    expect(pokemonStrikeFromBelow({ animationId: "anim_gen_thunder_strike" })).toBe(false);
  });

  it("상대 전부를 치면 범위, 회복은 회복, 보조는 대상 편으로 능력 올리기·상태 걸기", () => {
    expect(pokemonMoveMotion(physical("anim_gen_earth_spike", "allEnemies"))).toBe("area");
    expect(pokemonMoveMotion({ effect: { kind: "healing", statistic: "mind", affects: "hp" }, scope: "ally", animationId: "anim_heal" })).toBe("heal");
    expect(pokemonMoveMotion({ effect: { kind: "support" }, scope: "self", animationId: "anim_gen_power_aura" })).toBe("boost");
    expect(pokemonMoveMotion({ effect: { kind: "support" }, scope: "enemy", animationId: "anim_gen_sleep_dust" })).toBe("status");
  });

  it("저자가 적은 moveMotion 이 판정을 이긴다", () => {
    expect(pokemonMoveMotion({ ...special("anim_gen_fire_burst", "fire"), moveMotion: "contact" })).toBe("contact");
  });

  it("색은 속성 → 이펙트 낱말 → 흰색", () => {
    expect(pokemonMoveColor(special("anim_gen_fire_burst", "fire"))).toBe("#ff7a26");
    expect(pokemonMoveColor(special("anim_gen_shadow_pulse"))).toBe("#8a4ad0");
    expect(pokemonMoveColor(physical("anim_gen_tackle_impact"))).toBe("#ffffff");
  });
});

describe("spriteEmitPoint (입·손 자리)", () => {
  // 10×10: 몸통(아래) + 왼쪽으로 튀어나온 머리(위) + 오른쪽으로 더 튀어나온 발(맨 아래 줄)
  const rows = [
    "..........",
    "..........",
    ".####.....",
    "#####.....",
    ".#######..",
    "..######..",
    "..######..",
    "..######..",
    "..######..",
    "..#########",
  ];
  const at = (x: number, y: number) => rows[y]?.[x] === "#";

  it("상대가 왼쪽이면 몸 위쪽에서 가장 왼쪽 칸 — 발끝은 보지 않는다", () => {
    expect(spriteEmitPoint(10, 10, at, { x: -1, y: 1 })).toEqual({ x: 0, y: 3 });
  });

  it("상대가 오른쪽이면 위쪽 60% 안에서 가장 오른쪽 칸 (맨 아래 발끝 x=9 는 제외)", () => {
    expect(spriteEmitPoint(10, 10, at, { x: 1, y: -1 })).toEqual({ x: 7, y: 4 });
  });

  it("빈 그림이면 null", () => {
    expect(spriteEmitPoint(4, 4, () => false, { x: 1, y: -1 })).toBeNull();
  });
});
