import { describe, expect, it } from "vitest";
import { resolveBattlerAuras, resolveStateAura } from "@/assets/battleStateAuras";
import { runTool } from "@/editor/tools";
import { normalizeBattleBackdropLayers, resolvedBattleBackdropLayer } from "@/project/battleBackdropLayers";
import { cellTransformFields, normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeDisplayFilter } from "@/project/displayFilter";
import { normalizeEnemyCollapseEffect } from "@/project/enemyCollapse";
import { createBlankProject } from "@/project/defaults/blankProject";

describe("적 쓰러짐 연출", () => {
  it("기본(dissolve)·모르는 값은 저장하지 않는다", () => {
    expect(normalizeEnemyCollapseEffect("pixelBreak")).toBe("pixelBreak");
    expect(normalizeEnemyCollapseEffect("dissolve")).toBeUndefined();
    expect(normalizeEnemyCollapseEffect("explode")).toBeUndefined();
    const record = normalizeEnemyRecord({ id: "e", name: "보스", collapseEffect: "bossSink" });
    expect(record.collapseEffect).toBe("bossSink");
    expect("collapseEffect" in normalizeEnemyRecord({ id: "e", name: "잡몹" })).toBe(false);
  });

  it("upsert_enemy 가 collapseEffect 를 받아 저장하고 dissolve 로 되돌린다", () => {
    const ctx = { project: createBlankProject() };
    const set = runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_boss_fx", name: "마왕", collapseEffect: "bossSink" } });
    expect(set.ok, JSON.stringify(set.issues)).toBe(true);
    expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_boss_fx")?.collapseEffect).toBe("bossSink");
    runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_boss_fx", name: "마왕", collapseEffect: "dissolve" } });
    expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_boss_fx")?.collapseEffect).toBeUndefined();
  });
});

describe("전투 배경 겹", () => {
  it("프리셋도 그림도 없는 겹은 버리고, 최대 4겹·범위로 자른다", () => {
    const layers = normalizeBattleBackdropLayers([
      { preset: "fog" },
      { front: true },
      { preset: "rain", scrollY: 99999, opacity: 140, blendMode: "normal" },
      { resourceId: "  my-clouds  ", front: true, blendMode: "screen" },
      { preset: "snow" },
      { preset: "stars" },
    ]);
    expect(layers).toEqual([
      { preset: "fog" },
      { preset: "rain", scrollY: 1200, opacity: 100 },
      { resourceId: "my-clouds", front: true, blendMode: "screen" },
      { preset: "snow" },
    ]);
    expect(normalizeBattleBackdropLayers([{ preset: "lava" }])).toBeUndefined();
  });

  it("값을 주지 않으면 프리셋 기본값으로 그리고, 그림 겹은 정지·불투명", () => {
    expect(resolvedBattleBackdropLayer({ preset: "embers" })).toEqual({ scrollX: 8, scrollY: -50, opacity: 85, blendMode: "add" });
    expect(resolvedBattleBackdropLayer({ preset: "fog", opacity: 30 }).opacity).toBe(30);
    expect(resolvedBattleBackdropLayer({ resourceId: "x", preset: "rain" })).toEqual({ scrollX: 0, scrollY: 0, opacity: 100, blendMode: "normal" });
  });

  it("트룹 정규화가 겹을 보존하고, upsert_troop 이 받는다", () => {
    const troop = normalizeTroopRecord({ id: "t", name: "동굴", enemyIds: [], backdropLayers: [{ preset: "mist", front: true, opacity: 40 }] });
    expect(troop.backdropLayers).toEqual([{ preset: "mist", front: true, opacity: 40 }]);
    const ctx = { project: createBlankProject() };
    runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_fx", name: "까마귀", stats: { maxHp: 30, attack: 10 } } });
    const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_fx", name: "폭풍 전야", enemyIds: ["enemy_fx"], backdropLayers: [{ preset: "rain" }, { preset: "fog", front: true, opacity: 35 }] } });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.database.troops.find((entry) => entry.id === "troop_fx")?.backdropLayers).toHaveLength(2);
  });
});

describe("상태 오라", () => {
  it("수면·마비·침묵·혼란·매혹·화상이 기본 상태 id 로 자동", () => {
    expect(resolveStateAura("state_sleep")).toBe("sleep-zzz");
    expect(resolveStateAura("state_paralysis")).toBe("paralyze-spark");
    expect(resolveStateAura("state_silence")).toBe("silence-mute");
    expect(resolveStateAura("state_confuse")).toBe("confuse-stars");
    expect(resolveStateAura("state_charm")).toBe("charm-heart");
    expect(resolveStateAura("state_burn")).toBe("burn-ember");
  });

  it("몬스터 주 상태는 id 와 무관하게 의미로 고르고, 저자 지정·none 이 앞선다", () => {
    expect(resolveStateAura("st_gen1_slp", { gen1MajorStatus: "sleep" })).toBe("sleep-zzz");
    expect(resolveStateAura("st_gen1_brn", { gen1MajorStatus: "burn", battleAura: "none" })).toBeNull();
    expect(resolveStateAura("state_sleep", { battleAura: "charm-heart" })).toBe("charm-heart");
    expect(resolveBattlerAuras(["st_x"], [{ id: "st_x", gen1MajorStatus: "paralysis" }])).toEqual(["paralyze-spark"]);
  });
});

describe("전투 이펙트 셀 회전·뒤집기·겹치기", () => {
  it("기본값(0·false)은 저장하지 않고, 회전은 -360~360 정수", () => {
    expect(cellTransformFields({ rotation: 0, mirror: false })).toEqual({});
    expect(cellTransformFields({ rotation: 721.4, mirror: true })).toEqual({ rotation: 360, mirror: true });
    const record = normalizeBattleAnimationRecord({
      id: "a", name: "베기", blendMode: "add",
      frames: [{ cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true, rotation: 45, mirror: true }] }],
    });
    expect(record.blendMode).toBe("add");
    expect(record.frames?.[0]?.cells[0]).toMatchObject({ rotation: 45, mirror: true });
    expect("blendMode" in normalizeBattleAnimationRecord({ id: "b", name: "b", blendMode: "normal" as never })).toBe(false);
  });

  it("upsert_battle_animation 이 blendMode 를 걸고 normal 로 걷는다", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "upsert_battle_animation", { animation: { id: "anim_fx", name: "번개", blendMode: "add" } }).ok).toBe(true);
    expect(ctx.project.database.battleAnimations.find((entry) => entry.id === "anim_fx")?.blendMode).toBe("add");
    runTool(ctx, "upsert_battle_animation", { animation: { id: "anim_fx", name: "번개", blendMode: "normal" } });
    expect(ctx.project.database.battleAnimations.find((entry) => entry.id === "anim_fx")?.blendMode).toBeUndefined();
  });
});

describe("화면 필터", () => {
  it("none·모르는 값은 저장하지 않고, set_project_settings 가 켜고 끈다", () => {
    expect(normalizeDisplayFilter("crt")).toBe("crt");
    expect(normalizeDisplayFilter("none")).toBeUndefined();
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "set_project_settings", { displayFilter: "scanlines" }).ok).toBe(true);
    expect(ctx.project.system.displayFilter).toBe("scanlines");
    runTool(ctx, "set_project_settings", { displayFilter: "none" });
    expect(ctx.project.system.displayFilter).toBeUndefined();
    expect(runTool(ctx, "set_project_settings", { displayFilter: "vhs" }).ok).toBe(false);
  });
});

describe("연출 지침", () => {
  it("전투 연출 절이 새 칸을 모두 안내한다", () => {
    const text = JSON.stringify(runTool({ project: createBlankProject() }, "read_directing_guide", {}));
    for (const word of ["collapseEffect", "backdropLayers", "battleAura", "blendMode", "displayFilter"]) expect(text).toContain(word);
  });
});
