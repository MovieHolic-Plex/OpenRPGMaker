import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  buildComplexEnemy,
  buildComplexTroop,
  buildComplexMonsterBundle,
  buildFieldBattleMonsterEvent,
  layoutTroopMembers,
  seedHomeDungeonComplexTroops,
} from "@/project/defaults/complexMonsterAuthoring";

describe("complexMonsterAuthoring", () => {
  it("layouts multi-member troops with distinct x positions", () => {
    const members = layoutTroopMembers([
      { enemyId: "a" },
      { enemyId: "b" },
      { enemyId: "c" },
    ]);
    expect(members).toHaveLength(3);
    expect(members[0]!.x).toBeLessThan(members[1]!.x);
    expect(members[1]!.x).toBeLessThan(members[2]!.x);
    expect(new Set(members.map((m) => m.enemyId)).size).toBe(3);
  });

  it("builds enemy with actions and troop with multi members + intro battle page", () => {
    const enemy = buildComplexEnemy({
      id: "enemy_test_boss",
      name: "테스트 보스",
      monsterResourceId: "generated-enemy-dragon-01",
      stats: { maxHp: 80, attack: 20, defense: 15 },
      skillIds: ["skill_fire"],
    });
    expect(enemy.id).toBe("enemy_test_boss");
    expect(enemy.monsterResourceId).toBe("generated-enemy-dragon-01");
    expect(enemy.stats.maxHp).toBe(80);
    expect(enemy.actions.length).toBeGreaterThanOrEqual(2);

    const troop = buildComplexTroop({
      id: "troop_test_boss",
      name: "테스트 트룹",
      members: [
        { enemyId: enemy.id },
        { enemyId: enemy.id },
      ],
      previewBackgroundResourceId: "easyrpg-backdrop-sunset1",
      introMessage: "보스가 등장했다!",
      uncapturable: true,
    });
    expect(troop.members).toHaveLength(2);
    expect(troop.enemyIds).toEqual([enemy.id, enemy.id]);
    expect(troop.uncapturable).toBe(true);
    expect(troop.battleEventPages.length).toBeGreaterThanOrEqual(1);
    expect(troop.battleEventPages[0]!.commands.some((c) => c.kind === "text")).toBe(true);
    // sky panoramas may be rewritten; still has some background
    expect(troop.previewBackgroundResourceId).toBeTruthy();
  });

  it("builds field battle monster with live/defeated pages", () => {
    const event = buildFieldBattleMonsterEvent({
      id: "monster_test",
      name: "시험체",
      x: 5,
      y: 6,
      troopId: "troop_test_boss",
      intro: "싸운다!",
      victory: "이겼다!",
      spriteId: "tex_easyrpg_charset_monster1",
      characterIndex: 0,
      clearSwitch: "sw_0099",
    });
    expect(event.pages).toHaveLength(2);
    const live = event.pages[0]!;
    expect(live.conditions).toEqual([{ kind: "switch", switchId: "sw_0099", value: false }]);
    expect(live.commands.some((c) => c.kind === "battleProcessing" && c.troopId === "troop_test_boss")).toBe(true);
    const flat = live.commands.flatMap((c) =>
      c.kind === "fork" ? [c, ...c.then, ...(c.else ?? [])] : [c]
    );
    expect(flat.some((c) => c.kind === "setSwitch" && c.switchId === "sw_0099" && c.value === true)).toBe(true);
    expect(flat.some((c) => c.kind === "m2Command" && c.commandId === "m2-086-erase-event")).toBe(true);
    const gone = event.pages[1]!;
    expect(gone.conditions).toEqual([{ kind: "switch", switchId: "sw_0099", value: true }]);
  });

  it("bundle + home dungeon seed upsert multi-enemy themed troops", () => {
    const project = createBlankProject();
    const beforeTroops = project.database.troops.length;
    const beforeEnemies = project.database.enemies.length;
    const seeded = seedHomeDungeonComplexTroops(project);
    expect(seeded.enemies.length).toBeGreaterThanOrEqual(6);
    expect(seeded.troops.length).toBeGreaterThanOrEqual(6);
    expect(project.database.enemies.length).toBeGreaterThanOrEqual(beforeEnemies + 6);
    expect(project.database.troops.length).toBeGreaterThanOrEqual(beforeTroops + 6);

    const lavaBoss = project.database.troops.find((t) => t.id === "troop_lava_ember_pack");
    expect(lavaBoss).toBeTruthy();
    expect((lavaBoss!.members?.length ?? 0)).toBeGreaterThanOrEqual(3);
    expect(lavaBoss!.battleEventPages.length).toBeGreaterThanOrEqual(1);

    const iceDrake = project.database.troops.find((t) => t.id === "troop_ice_azure_drake");
    expect(iceDrake?.uncapturable).toBe(true);
    expect(iceDrake?.members?.[0]?.enemyId).toBe("enemy_ice_azure_drake");

    const bundle = buildComplexMonsterBundle({
      enemySeeds: [
        {
          id: "enemy_bundle_a",
          name: "A",
          monsterResourceId: "generated-enemy-slime-01",
          stats: { maxHp: 20, attack: 8 },
        },
      ],
      troop: {
        id: "troop_bundle",
        name: "번들",
        members: [{ enemyId: "enemy_bundle_a" }, { enemyId: "enemy_bundle_a" }],
      },
      field: {
        id: "monster_bundle",
        name: "번들몹",
        x: 1,
        y: 1,
        troopId: "troop_bundle",
        intro: "i",
        victory: "v",
        spriteId: "tex_easyrpg_charset_monster2",
        characterIndex: 1,
        clearSwitch: "sw_0001",
      },
    });
    expect(bundle.enemies).toHaveLength(1);
    expect(bundle.troop.members).toHaveLength(2);
    expect(bundle.fieldEvent.id).toBe("monster_bundle");
  });
});
