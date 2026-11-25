import { describe, expect, it } from "vitest";
import { buildFieldBattleMonsterEvent, buildComplexEnemy, buildComplexTroop, buildComplexMonsterBundle, layoutTroopMembers, seedHomeDungeonComplexTroops } from "@/project/defaults/complexMonsterAuthoring";
import { evalCondition, startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { CURRENT_MONSTER_STAND_IN } from "@/project/defaults/currentMonsterStandIns";
import { isolateTimers } from "./mergedTeardown";

describe("battleResultErasePattern", () => {
  isolateTimers();
  function flatten(commands: readonly Command[]): Command[] {
    const out: Command[] = [];
    for (const command of commands) {
      out.push(command);
      if (command.kind === "fork") {
        out.push(...flatten(command.then));
        if (command.else) out.push(...flatten(command.else));
      }
    }
    return out;
  }
  describe("field monster victory erase pattern", () => {
    it("builds battle then victory-only erase + clear switch", () => {
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
      const live = event.pages[0]!;
      const flat = flatten(live.commands);
      expect(flat.some((c) => c.kind === "battleProcessing" && c.troopId === "troop_test_boss")).toBe(true);
      expect(
        flat.some(
          (c) =>
            c.kind === "m2Command" &&
            c.commandId === "m2-086-erase-event"
        )
      ).toBe(true);
      expect(flat.some((c) => c.kind === "setSwitch" && c.switchId === "sw_0099" && c.value === true)).toBe(true);

      const victoryFork = live.commands.find((c) => c.kind === "fork");
      expect(victoryFork).toMatchObject({
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
      });
    });

    it("battleResult condition evaluates session battle outcome", () => {
      const project = createBlankProject();
      const session = startSession(project);
      expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(false);
      session.battleResult = "victory";
      expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(true);
      expect(evalCondition(session, { kind: "battleResult", result: "escape" })).toBe(false);
    });
  });
});

describe("complexMonsterAuthoring", () => {
  isolateTimers();
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
});

describe("dbImageMatching", () => {
  isolateTimers();
  describe("database image matching", () => {
    it("assigns unique matching monster graphics for default enemies and species", () => {
      const project = createBlankProject();
      // qa1124 항목 4(오너 2026-11-24 «최신 몬스터들 반영»): 새 프로젝트 기본 적은 모두 현행 20칸 세트 그림이다.
      // 현행 그림이 없던 종은 대역 표(currentMonsterStandIns)의 가장 가까운 종 그림을 나눠 쓴다 — 그 밖의 공유는 실패.
      const monsterIds = project.database.enemies.map((enemy) => enemy.monsterResourceId);
      const generatedIds = monsterIds.filter((id) => id?.startsWith("generated-enemy-"));
      expect(generatedIds.length).toBe(monsterIds.length);
      expect(generatedIds.length).toBeGreaterThanOrEqual(100);
      expect(monsterIds.filter((id) => !isCurrentMonsterArt(id))).toEqual([]);
      for (const enemy of project.database.enemies) {
        const owners = project.database.enemies.filter((other) => other.monsterResourceId === enemy.monsterResourceId);
        if (owners.length === 1) continue;
        const tails = owners.map((other) => CURRENT_MONSTER_STAND_IN[other.id.replace(/^enemy_/u, "")] ?? other.id.replace(/^enemy_/u, ""));
        expect(new Set(tails).size, `${enemy.monsterResourceId}: ${owners.map((o) => o.id).join(", ")}`).toBe(1);
      }
      for (const id of monsterIds) {
        expect(resolveAssetResourceUrl(id), id).toBeTruthy();
      }

      const bySpecies = Object.fromEntries(
        (project.database.monsterSpecies ?? []).map((species) => [species.id, species.graphic.monsterResourceId]),
      );
      expect(Object.keys(bySpecies).sort()).toEqual([
        "species_aqualing", "species_cave_bat", "species_ember_drake", "species_forest_hornet",
        "species_king_slime", "species_leafling", "species_mine_skeleton", "species_sparkit",
        "species_stone_golem", "species_wild_slime",
      ]);
      expect(bySpecies.species_wild_slime).toBe("generated-enemy-slime-01");
      expect(bySpecies.species_king_slime).toBe("generated-enemy-slime-01");
      expect(bySpecies.species_cave_bat).toBe("generated-enemy-bat-01");
      expect(bySpecies.species_stone_golem).toBe("generated-enemy-golem-01");
      expect(bySpecies.species_ember_drake).toBe("generated-enemy-dragon-01");
      expect(bySpecies.species_leafling).toBe("generated-enemy-leafling-01");
      expect(bySpecies.species_forest_hornet).toBe("generated-enemy-sylph-hornet");
      expect(bySpecies.species_sparkit).toBe("generated-enemy-sparkit-fire");
      expect(bySpecies.species_aqualing).toBe("generated-enemy-aqualing-01");
      expect(bySpecies.species_mine_skeleton).toBe("generated-enemy-skeleton-01");
      for (const id of ["species_leafling", "species_sparkit", "species_aqualing"]) {
        expect(project.database.monsterSpecies?.find((species) => species.id === id)?.graphic.graphicHue).toBe(0);
      }
      expect(project.database.monsterSpecies?.find((species) => species.id === "species_sparkit")?.types).toEqual(["fire"]);
      for (const id of Object.values(bySpecies)) {
        expect(resolveAssetResourceUrl(id), id).toBeTruthy();
      }
    });

    it("uses distinct item and equipment icons for similar gear tiers", () => {
      const project = createBlankProject();
      const iron = project.database.equipment.find((entry) => entry.id === "equip_iron_sword");
      const steel = project.database.equipment.find((entry) => entry.id === "equip_steel_sword");
      const bronze = project.database.equipment.find((entry) => entry.id === "equip_sword");
      expect(bronze?.iconResourceId).toBe("cc0-jetrel-bronze-sword");
      expect(iron?.iconResourceId).toBe("cc0-jetrel-iron-sword");
      expect(steel?.iconResourceId).toBe("cc0-jetrel-steel-sword");

      const capture = project.database.items.find((item) => item.id === "item_capture_orb");
      const hiPotion = project.database.items.find((item) => item.id === "item_hi_potion");
      const elixir = project.database.items.find((item) => item.id === "item_elixir");
      const panacea = project.database.items.find((item) => item.id === "item_panacea");
      expect(capture?.iconResourceId).toBe("cc0-jetrel-capture-orb");
      expect(hiPotion?.iconResourceId).toBe("cc0-jetrel-hi-potion");
      expect(elixir?.iconResourceId).toBe("cc0-jetrel-elixir");
      expect(panacea?.iconResourceId).toBe("cc0-jetrel-panacea");

      for (const id of [
        bronze?.iconResourceId,
        iron?.iconResourceId,
        steel?.iconResourceId,
        capture?.iconResourceId,
        hiPotion?.iconResourceId,
        elixir?.iconResourceId,
        panacea?.iconResourceId,
      ]) {
        expect(resolveAssetResourceUrl(id), String(id)).toBeTruthy();
      }
    });

    it("seeds dungeon bone guards with skeleton art instead of bat art", () => {
      const project = createBlankProject();
      const { enemies } = seedHomeDungeonComplexTroops(project);
      const bone = enemies.find((enemy) => enemy.id === "enemy_stone_bone_guard");
      expect(bone?.monsterResourceId).toBe("generated-enemy-skeleton-01");
      expect(resolveAssetResourceUrl("generated-enemy-skeleton-01")).toBe(
        "/assets/generated/pixel-enemy-portraits/skeleton-01.png",
      );
    });
  });
});
