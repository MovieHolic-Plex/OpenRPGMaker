import { describe, expect, it } from "vitest";
import { resolveBattleBackdrop, terrainBattleBackgroundAt } from "@/battle/battleBackdrop";
import { hitFeelFromActionResult, resolveBattlerPose } from "@/battle/battlePose";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { TroopRecord } from "@/project/types/database";

describe("battle poses", () => {
  it("maps idle, attack, hit, defend, and dead from action result", () => {
    const idle = resolveBattlerPose({
      battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: false },
    });
    expect(idle).toBe("idle");

    const attack = resolveBattlerPose({
      battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: false },
      lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 5, critical: false },
    });
    expect(attack).toBe("attack");

    const hit = resolveBattlerPose({
      battler: { id: "e1", recordId: "enemy_slime", defeated: false, defending: false },
      lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 5, critical: false },
    });
    expect(hit).toBe("hit");

    const defend = resolveBattlerPose({
      battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: true },
    });
    expect(defend).toBe("defend");

    const dead = resolveBattlerPose({
      battler: { id: "e1", recordId: "enemy_slime", defeated: true, defending: false },
      lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 99, critical: true },
    });
    expect(dead).toBe("dead");
  });

  it("surfaces attack/hit poses on a real runtime snapshot after an attack", () => {
    const project = createBlankProject();
    const troopId = project.database.troops[0]?.id;
    if (!troopId) throw new Error("missing default troop");
    for (const enemy of project.database.enemies) {
      enemy.stats.maxHp = 9999;
      enemy.stats.defense = 1;
      enemy.stats.agility = 1;
    }
    // Gauge mode: after actor acts, phase is charging and lastActionResult is still the actor's blow
    // (enemy has not ticked yet).
    const rt = createBattleRuntime({ project, troopId, canEscape: true, canLose: true, battleFlow: "gauge" });
    for (let i = 0; i < 20_000; i += 1) {
      rt.tick(50);
      if (rt.snapshot().phase === "actorCommand") break;
    }
    let snap = rt.snapshot();
    expect(snap.phase).toBe("actorCommand");
    const eid = snap.enemies[0]?.id;
    const aid = snap.activeActorId;
    if (!eid || !aid) throw new Error("missing combatants");
    rt.performActorCommand({ kind: "attack", targetEnemyId: eid });
    snap = rt.snapshot();
    const actor = snap.actors.find((entry) => entry.recordId === aid);
    const enemy = snap.enemies.find((entry) => entry.id === eid);
    expect(snap.lastActionResult?.userRecordId).toBe(aid);
    expect(actor?.pose).toBe("attack");
    expect(enemy?.defeated).toBe(false);
    if (snap.lastActionResult?.hit) {
      expect(enemy?.pose).toBe("hit");
      expect(snap.hitFeel?.targetId).toBe(eid);
    }
  });
});

describe("hit-feel helper", () => {
  it("builds hit-feel only for damaging hits", () => {
    expect(hitFeelFromActionResult(undefined)).toBeUndefined();
    expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: false, amount: 0, critical: false })).toBeUndefined();
    expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: true, amount: 0, critical: false })).toBeUndefined();
    expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: true, amount: 12, critical: true })).toEqual({
      targetId: "e",
      amount: 12,
      critical: true,
      healing: false,
    });
  });
});

describe("battle backdrop resolution", () => {
  it("uses troop preview when set, otherwise terrain at location, else forest", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("missing start map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");

    // Author terrain tag 1 on the start tile → grassland dawn backdrop.
    const x = project.startPos.x;
    const y = project.startPos.y;
    const tile = map.lowerTiles[y * map.width + x] ?? 0;
    if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
    while (tileset.terrain.length <= tile) tileset.terrain.push(0);
    tileset.terrain[tile] = 1;
    tileset.tileMeta = { ...(tileset.tileMeta ?? {}), [tile]: { ...(tileset.tileMeta?.[tile] ?? {}), terrainTag: 1 } };
    project.database.terrains = [
      {
        id: "terrain_grassland",
        name: "초원",
        damage: 0,
        encounterRatePercent: 100,
        battleBackgroundResourceId: "easyrpg-backdrop-dawn1",
        characterDisplay: "normal",
        vehiclePassage: { boat: false, ship: false, airshipLand: true },
      },
    ];

    const troop = project.database.troops[0];
    if (!troop) throw new Error("missing troop");
    delete troop.previewBackgroundResourceId;

    expect(terrainBattleBackgroundAt(project, { mapId, x, y })).toBe("easyrpg-backdrop-dawn1");
    const fromTerrain = resolveBattleBackdrop({
      project,
      troopId: troop.id,
      location: { mapId, x, y },
    });
    expect(fromTerrain).toBe("easyrpg-backdrop-dawn1");

    troop.previewBackgroundResourceId = "generated-battle-reference-forest";
    expect(resolveBattleBackdrop({ project, troopId: troop.id, location: { mapId, x: project.startPos.x, y: project.startPos.y } })).toBe(
      "generated-battle-reference-forest"
    );

    troop.previewBackgroundResourceId = undefined;
    // Off-map / no tag → forest fallback
    expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
  });

  it("uses the monster skin fallback without overriding authored battle backgrounds", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "pokemon";
    const troop = project.database.troops[0]!;
    delete troop.previewBackgroundResourceId;
    expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("battle-skin-pokemon-backdrop");
    troop.previewBackgroundResourceId = "generated-battle-reference-forest";
    expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("generated-battle-reference-forest");
    project.system.battleUiStyle = "rm2000";
    delete troop.previewBackgroundResourceId;
    expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
  });

  it("rewrites night-sky troop previews to forest via runtime create", () => {
    const project = createBlankProject();
    const troop = project.database.troops[0];
    if (!troop) throw new Error("missing troop");
    troop.previewBackgroundResourceId = "easyrpg-backdrop-night-sky1";
    // normalizeTroop on blank already rewrote; force raw id and resolve helper
    expect(
      resolveBattleBackdrop({
        project: {
          ...project,
          database: {
            ...project.database,
            troops: [{ ...troop, previewBackgroundResourceId: "easyrpg-backdrop-night-sky1" }],
          },
        },
        troopId: troop.id,
      })
    ).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
  });
});

describe("battle event command expansion", () => {
  function stubBattler(recordId: string): MutableBattler {
    return {
      id: recordId,
      recordId,
      name: recordId,
      maxHp: 50,
      maxMp: 10,
      attackPower: 10,
      defense: 5,
      mind: 5,
      agility: 10,
      chargeRate: 0.1,
      skillIds: [],
      hidden: false,
      hp: 50,
      mp: 10,
      gauge: 0,
      stateIds: [],
      stateTurns: {},
      defending: false,
    };
  }

  it("executes changeGold, changeExp, learnSkill, and changeParty for real", () => {
    const project = createBlankProject();
    const actorId = project.system.startActorIds[0] ?? "actor_hero";
    const troop: TroopRecord = {
      id: "troop_event_test",
      name: "event test",
      enemyIds: [],
      members: [],
      autoAlign: true,
      battleEventPages: [
        {
          id: "page1",
          name: "on start",
          conditions: [{ kind: "onRound", round: 0 }],
          span: "battle",
          runOnce: true,
          commands: [
            { kind: "changeGold", op: "+=", amount: 25 },
            { kind: "changeExp", actorId, op: "+=", amount: 40 },
            { kind: "learnSkill", actorId, skillId: project.database.skills[0]?.id ?? "skill_attack" },
            { kind: "changeParty", actorId: "actor_extra", action: "add" },
            { kind: "transfer", mapId: "nope", x: 0, y: 0 },
          ],
        },
      ],
    };
    const state = {
      switches: {} as Record<string, boolean>,
      variables: {} as Record<string, number>,
      inventory: {} as Record<string, number>,
      gold: 10,
      partyActorIds: [actorId],
      actorSkillIds: { [actorId]: [] as string[] },
      actorExperience: { [actorId]: 0 },
      actorLevels: { [actorId]: 1 },
    };
    const actors = [stubBattler(actorId)];
    const runtime = createBattleEventRuntime({
      project,
      troopRecord: troop,
      actors,
      enemies: [],
      stateIds: [],
      state,
    });
    runtime.applyTroopEvents({ turn: 0 });
    const snap = runtime.snapshot();
    expect(snap.gold).toBe(35);
    expect(snap.actorExperience?.[actorId]).toBe(40);
    expect(snap.actorSkillIds?.[actorId]).toContain(project.database.skills[0]?.id ?? "skill_attack");
    expect(snap.partyActorIds).toContain("actor_extra");
    const logs = runtime.logs();
    expect(logs.some((entry) => entry.kind === "unsupported" && entry.detail === "transfer")).toBe(true);
    expect(logs.some((entry) => entry.kind === "message" && entry.detail?.startsWith("gold→"))).toBe(true);
  });
});
