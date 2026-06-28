import { describe, expect, it } from "vitest";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { RM2K3_GENERATED_ASSET_PLAN } from "@/assets/rm2k3GeneratedAssetPlan";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";

const MOJIBAKE_PATTERN = /[占�]|[?][\u3131-\uD7A3]|[\u00C0-\u00FF]{2,}/u;

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectStrings(entry));
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap((entry) => collectStrings(entry));
}

describe("Korean default localization and EasyRPG RTP defaults", () => {
  it("creates the default database with readable Korean labels and no mojibake", () => {
    // Given: a blank project builds the default Korean database seed.
    const project = createBlankProject();

    // When: user-facing seed strings are collected from database and system records.
    const checkedStrings = collectStrings({
      terms: project.meta.terms,
      database: project.database,
      system: project.system,
    });

    // Then: the visible defaults remain readable Korean, not mojibake.
    expect(project.database.actors[0]?.name).toBe("주인공");
    expect(project.database.classes[0]?.name).toBe("전사");
    expect(project.database.items[0]?.name).toBe("회복약");
    expect(project.database.equipment[0]?.name).toBe("청동 검");
    expect(project.database.enemies[0]?.name).toBe("말벌");
    expect(checkedStrings.filter((value) => MOJIBAKE_PATTERN.test(value))).toEqual([]);
  });

  it("uses inspected EasyRPG RTP image references for non-tileset default surfaces where available", () => {
    // Given: the EasyRPG RTP asset manifest is bundled with the project.
    const project = createBlankProject();
    const ids: ReadonlySet<string> = new Set(EASYRPG_RTP_ASSETS.map((asset) => asset.id));

    // When: default resource IDs are read from actors, enemies, and system settings.
    const defaultIds = [
      project.database.actors[0]?.faceResourceId,
      project.database.actors[0]?.characterResourceId,
      project.database.enemies[0]?.monsterResourceId,
      project.system.titleResourceId,
      project.system.systemResourceId,
      project.system.battleSystemResourceId,
    ];

    // Then: each default resource points at an existing RTP asset.
    expect(project.database.actors[0]?.faceResourceId).toBe("easyrpg-faceset-actor1");
    expect(project.database.actors[0]?.characterResourceId).toBe("easyrpg-charset-actor1");
    expect(project.database.enemies[0]?.monsterResourceId).toBe("easyrpg-monster-hornet");
    expect(project.system.titleResourceId).toBe("easyrpg-title-title1");
    expect(project.system.systemResourceId).toBe("easyrpg-system-system");
    expect(project.system.battleSystemResourceId).toBe("easyrpg-system2-system2-c");
    for (const id of defaultIds) expect(ids.has(id ?? "")).toBe(true);
  });

  it("ships RTP-backed early battle defaults with valid enemy, troop, and animation references", () => {
    // Given: the default DB combines EasyRPG RTP resources and generated battle resources.
    const project = createBlankProject();
    const easyRpgIds = new Set<string>(EASYRPG_RTP_ASSETS.map((asset) => asset.id));
    const generatedIds = new Set<string>(RM2K3_GENERATED_ASSET_PLAN.assets.map((asset) => asset.resourceId));
    const resourceIds = new Set<string>([...easyRpgIds, ...generatedIds]);

    // When: battle seed records are inspected and a starter troop runtime is created.
    const enemyIds = new Set(project.database.enemies.map((enemy) => enemy.id));
    const troopIds = new Set(project.database.troops.map((troop) => troop.id));
    const animationIds = new Set(project.database.battleAnimations.map((animation) => animation.id));

    // Then: battle DB records are unique, resource-backed, and runtime-loadable.
    expect(enemyIds.size).toBe(project.database.enemies.length);
    expect(troopIds.size).toBe(project.database.troops.length);
    expect(animationIds.size).toBe(project.database.battleAnimations.length);
    expect(project.database.enemies).toHaveLength(29);
    expect(project.database.troops).toHaveLength(6);
    expect(animationIds).toEqual(new Set(["anim_hit", "anim_sword", "anim_arrow", "anim_magic", "anim_heal", "anim_poison"]));

    for (const enemy of project.database.enemies) expect(resourceIds.has(enemy.monsterResourceId ?? "")).toBe(true);
    for (const troop of project.database.troops) {
      expect(resourceIds.has(troop.previewBackgroundResourceId ?? "")).toBe(true);
      for (const member of troop.members ?? []) expect(enemyIds.has(member.enemyId)).toBe(true);
    }
    for (const animation of project.database.battleAnimations) expect(easyRpgIds.has(animation.resourceId ?? "")).toBe(true);

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_golem_guard",
      canEscape: true,
      canLose: true,
    });
    expect(runtime.snapshot().enemies.map((enemy) => enemy.recordId)).toEqual([
      "enemy_meadow_slime",
      "enemy_stone_golem",
      "enemy_cave_bat",
    ]);
  });
});
