import { describe, expect, it } from "vitest";
import { createBlankProject, createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

describe("DB write tools", () => {
  it("upsert_item 부분 수정은 기존 필드를 보존하고 최종 레코드 전체를 반환한다", () => {
    const ctx: ToolContext = { project: createSampleAdventureProject() };
    const before = structuredClone(ctx.project.database.items.find((item) => item.id === "item_potion"));
    expect(before).toBeDefined();

    const result = runTool(ctx, "upsert_item", { item: { id: "item_potion", price: 120 } }, { dryRun: false });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const after = ctx.project.database.items.find((item) => item.id === "item_potion");
    expect(after?.price).toBe(120);
    expect(after?.name).toBe(before?.name);
    expect(after?.description).toBe(before?.description);
    expect(after?.skillId).toBe(before?.skillId);
    expect(after?.hpRecovery).toEqual(before?.hpRecovery);
    expect(result.data).toEqual(after);
  });

  it("upsert_equipment은 중첩 statBonuses를 반영하고 알 수 없는 필드를 거부한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const created = runTool(ctx, "upsert_equipment", {
      equipment: { id: "equip_test_sword", name: "시험검", slot: "weapon", statBonuses: { attack: 12 } },
    }, { dryRun: false });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);
    expect(ctx.project.database.equipment.find((entry) => entry.id === "equip_test_sword")?.statBonuses.attack).toBe(12);

    const rejected = runTool(ctx, "upsert_equipment", {
      equipment: { id: "equip_test_sword", statBonuses: { attackPower: 99 } },
    }, { dryRun: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.code).toBe("unknown-db-field");
    expect(rejected.issues?.[0]?.message).toContain("허용 필드");
  });

  it("upsert_actor 신규 기본 maxLevel은 99다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const klass = ctx.project.database.classes[0];
    const result = runTool(ctx, "upsert_actor", { actor: { id: "actor_new", name: "새 동료", classId: klass.id } }, { dryRun: false });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.database.actors.find((actor) => actor.id === "actor_new")?.maxLevel).toBe(99);
  });

  it("monsterResourceId는 DB 툴 실행 시점에 검색어를 리소스로 해석하거나 invalid-args로 거부한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const enemy = runTool(ctx, "upsert_enemy", {
      enemy: { id: "enemy_query_slime", name: "검색 슬라임", monsterResourceId: "slime" },
    }, { dryRun: false });
    expect(enemy.ok, JSON.stringify(enemy.issues)).toBe(true);
    expect(ctx.project.database.enemies.find((record) => record.id === "enemy_query_slime")?.monsterResourceId).toBe("generated-enemy-slime-01");
    expect(enemy.diff?.warnings.some((warning) => warning.includes("enemy.monsterResourceId 자동 해석"))).toBe(true);

    const species = runTool(ctx, "define_monster_species", {
      species: { id: "species_query_dragon", name: "검색 드래곤", graphic: { monsterResourceId: "dragon" } },
    }, { dryRun: false });
    expect(species.ok, JSON.stringify(species.issues)).toBe(true);
    expect(ctx.project.database.monsterSpecies?.find((record) => record.id === "species_query_dragon")?.graphic.monsterResourceId).toBe("generated-enemy-dragon-01");

    const missing = runTool(ctx, "define_monster_species", {
      species: { id: "species_missing_graphic", name: "없는 그래픽", graphic: { monsterResourceId: "definitely_missing_monster_graphic" } },
    });
    expect(missing.ok).toBe(false);
    expect(missing.issues?.[0]?.code).toBe("invalid-args");
    expect(missing.issues?.[0]?.message).toContain("사용 가능한 monster 리소스 예시");
    expect(missing.issues?.[0]?.message).toContain("generated-enemy");
  });

  it("upsert_state는 raw spread로 임의 필드를 저장하지 않는다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_state", { state: { id: "state_x", name: "X", rawInjected: true } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(ctx.project.database.states.some((state) => state.id === "state_x")).toBe(false);
  });

  it("set_title_screen creates titleScreen when missing and nested-merges sounds/titleGraphic", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    delete ctx.project.system.titleScreen;

    const created = runTool(ctx, "set_title_screen", {
      title: "신규 타이틀",
      menuLabels: { quit: "닫기" },
      sounds: { confirmSeResourceId: "easyrpg-sound-decision1" },
      titleGraphic: { mode: "both", resourceId: "easyrpg-title-title1", x: 40, y: 20 },
      showInputHint: false,
    }, { dryRun: false });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);
    expect(ctx.project.system.titleScreen?.title).toBe("신규 타이틀");
    expect(ctx.project.system.titleScreen?.menuLabels.quit).toBe("닫기");
    expect(ctx.project.system.titleScreen?.menuLabels.newGame).toBeTruthy();
    expect(ctx.project.system.titleScreen?.sounds).toEqual({ confirmSeResourceId: "easyrpg-sound-decision1" });
    expect(ctx.project.system.titleScreen?.titleGraphic).toEqual({
      mode: "both",
      resourceId: "easyrpg-title-title1",
      x: 40,
      y: 20,
    });
    expect(ctx.project.system.titleScreen?.showInputHint).toBe(false);

    const merged = runTool(ctx, "set_title_screen", {
      title: "신규 타이틀",
      sounds: { cursorSeResourceId: "easyrpg-sound-cursor1" },
      titleGraphic: { y: 88 },
      backgroundResourceId: "easyrpg-title-title2",
    }, { dryRun: false });
    expect(merged.ok, JSON.stringify(merged.issues)).toBe(true);
    expect(ctx.project.system.titleScreen?.sounds).toEqual({
      confirmSeResourceId: "easyrpg-sound-decision1",
      cursorSeResourceId: "easyrpg-sound-cursor1",
    });
    expect(ctx.project.system.titleScreen?.titleGraphic).toEqual({
      mode: "both",
      resourceId: "easyrpg-title-title1",
      x: 40,
      y: 88,
    });
    expect(ctx.project.system.titleScreen?.backgroundResourceId).toBe("easyrpg-title-title2");
    // background must not clear system.titleResourceId
    expect(ctx.project.system.titleResourceId).toBeDefined();
  });
});
