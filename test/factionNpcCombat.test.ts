/** @vitest-environment happy-dom */
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  initializeActionCombatForScene,
  syncActionEnemiesForScene,
  tryActionCombatSwing,
  updateActionCombatForScene,
} from "@/player/playSceneActionCombat";
import { createFieldSpawnRuntime } from "@/player/fieldSpawns";
import { effectiveFactionStance } from "@/project/factionRuntime";
import { PLAYER_FACTION_ID } from "@/project/factions";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { EnemyActionProfile, GameMap, Project } from "@/project/types";

const MELEE: EnemyActionProfile = {
  contactDamage: 5,
  moveIntervalMs: 100,
  aggroRange: 10,
  attack: { kind: "melee", windupMs: 100, recoverMs: 50, damage: 40, range: 1, cooldownMs: 100 },
};

function graphicsStub() {
  const api = {
    clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn(), fillPoints: vi.fn(),
    setDepth: vi.fn(), destroy: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    fillPath: vi.fn(), lineStyle: vi.fn(), strokePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
  };
  return api as unknown as Phaser.GameObjects.Graphics;
}

function spriteStub(x: number, y: number) {
  return {
    x, y, displayWidth: 16, displayHeight: 16, originX: 0.5, originY: 1,
    scaleX: 1, scaleY: 1, alpha: 1,
    texture: { key: "stub" }, frame: { name: 0 },
    setTintFill: vi.fn(), clearTint: vi.fn(), setPosition: vi.fn(), setOrigin: vi.fn(),
    setDisplaySize: vi.fn(), setDepth: vi.fn(), setScale: vi.fn(), destroy: vi.fn(),
    setAlpha: vi.fn(), setTint: vi.fn(), setVisible: vi.fn(), setFrame: vi.fn(), setFlipX: vi.fn(),
  };
}

/**
 * 최소 PlaySceneContext 대역. Phaser 표면(tweens/add/cameras)만 스텁이고
 * 진영·타깃·피해 규칙은 전부 실제 코드가 돈다 — 목을 통과해도 통합이 깨지면 실패해야 한다.
 */
function fakeScene(project: Project, map: GameMap, playerAt: { x: number; y: number }) {
  const session = startSession(project);
  session.x = playerAt.x;
  session.y = playerAt.y;
  const fieldSpawnState = createFieldSpawnRuntime(project, map, playerAt);
  const eventPositions: Record<string, { x: number; y: number; direction: "down" }> = {};
  const eventSprites = new Map<string, ReturnType<typeof spriteStub>>();
  for (const entry of fieldSpawnState.entries) {
    for (const instance of entry.alive) {
      eventPositions[instance.eventId] = { x: instance.x, y: instance.y, direction: "down" };
      eventSprites.set(instance.eventId, spriteStub(instance.x * 16, instance.y * 16));
    }
  }
  const scene = {
    map,
    session,
    fieldSpawnState,
    eventPositions,
    eventSprites,
    autonomousNPCs: new Map(),
    actionCombatState: null,
    events: new EventEmitter(),
    tileX: playerAt.x,
    tileY: playerAt.y,
    movingTo: { x: playerAt.x, y: playerAt.y },
    moving: false,
    running: false,
    dashing: false,
    inputEnabled: true,
    facing: "down" as const,
    player: { setTintFill: vi.fn(), clearTint: vi.fn(), setScale: vi.fn() },
    input_: {
      setAttackMode: vi.fn(),
      isGuardHeld: () => false,
      consumeSkillCycleEdge: () => false,
    },
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })), killTweensOf: vi.fn() },
    add: {
      graphics: vi.fn(graphicsStub),
      circle: vi.fn(() => ({ setDepth: vi.fn(), setStrokeStyle: vi.fn(), setPosition: vi.fn(), destroy: vi.fn() })),
      text: vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn(), setScale: vi.fn(), destroy: vi.fn() })),
      sprite: vi.fn(() => spriteStub(0, 0)),
    },
    cameras: { main: { shake: vi.fn() } },
    game: { canvas: { closest: () => null } },
    renderTiles: vi.fn(),
    registerPageMoveRoutes: vi.fn(),
    showGameOverScreen: vi.fn(),
    refreshRuntimeSurfaces: vi.fn(),
    setInputEnabled: vi.fn(),
  };
  return scene as unknown as PlaySceneContext & { showGameOverScreen: ReturnType<typeof vi.fn> };
}

function warProject(options: { readonly banditFaction?: string; readonly spawnFaction?: string } = {}) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  project.system.actionCombat = { enabled: true };
  map.actionCombat = true;
  map.safeZones = [];

  project.database.enemies.push(normalizeEnemyRecord({
    id: "enemy_bandit",
    name: "산적",
    stats: { maxHp: 60, maxMp: 0, attack: 20, defense: 0, mind: 0, agility: 10 },
    actionProfile: MELEE,
    ...(options.banditFaction ? { factionId: options.banditFaction } : {}),
  }));
  project.database.enemies.push(normalizeEnemyRecord({
    id: "enemy_guard",
    name: "경비병",
    stats: { maxHp: 60, maxMp: 0, attack: 20, defense: 0, mind: 0, agility: 10 },
    actionProfile: MELEE,
    factionId: "guard",
  }));
  project.database.troops.push({ id: "troop_bandit", name: "산적", enemyIds: ["enemy_bandit"], members: [{ enemyId: "enemy_bandit", x: 0, y: 0 }], autoAlign: true, battleEventPages: [] });
  project.database.troops.push({ id: "troop_guard", name: "경비병", enemyIds: ["enemy_guard"], members: [{ enemyId: "enemy_guard", x: 0, y: 0 }], autoAlign: true, battleEventPages: [] });

  map.fieldSpawns = [
    {
      id: "spawn_bandit",
      troopId: "troop_bandit",
      area: { x: 2, y: 2, w: 1, h: 1 },
      maxAlive: 1,
      chase: true,
      ...(options.spawnFaction ? { factionId: options.spawnFaction } : {}),
    },
    { id: "spawn_guard", troopId: "troop_guard", area: { x: 3, y: 2, w: 1, h: 1 }, maxAlive: 1, chase: true },
  ];

  project.factions = {
    defs: [
      { id: "bandit", name: "산적" },
      { id: "guard", name: "경비병" },
      { id: "militia", name: "민병대" },
    ],
    relations: [
      { a: "bandit", b: "guard", stance: -1 },
      { a: "militia", b: "guard", stance: -1 },
      { a: "guard", b: PLAYER_FACTION_ID, stance: 1 },
    ],
  };
  store.replace(project);
  return { project, map };
}

function tick(scene: PlaySceneContext, ticks: number, deltaMs = 50): void {
  for (let i = 0; i < ticks; i += 1) updateActionCombatForScene(scene, deltaMs);
}

describe("faction identity on spawned combatants", () => {
  it("resolves faction from the enemy record", () => {
    const { project, map } = warProject({ banditFaction: "bandit" });
    const scene = fakeScene(project, map, { x: 20, y: 20 });
    initializeActionCombatForScene(scene);
    syncActionEnemiesForScene(scene);
    const factions = [...scene.actionCombatState!.enemies.values()].map((enemy) => enemy.factionId).sort();
    expect(factions).toEqual(["bandit", "guard"]);
  });

  it("lets the spawn definition override the enemy record faction", () => {
    const { project, map } = warProject({ banditFaction: "bandit", spawnFaction: "militia" });
    const scene = fakeScene(project, map, { x: 20, y: 20 });
    initializeActionCombatForScene(scene);
    const factions = [...scene.actionCombatState!.enemies.values()].map((enemy) => enemy.factionId).sort();
    expect(factions).toEqual(["guard", "militia"]);
  });

  it("falls back to the reserved enemy faction when nothing is authored", () => {
    const { project, map } = warProject();
    const scene = fakeScene(project, map, { x: 20, y: 20 });
    initializeActionCombatForScene(scene);
    const bandit = [...scene.actionCombatState!.enemies.values()].find((enemy) => enemy.enemyId === "enemy_bandit");
    expect(bandit?.factionId).toBe("enemy");
  });
});

describe("NPC vs NPC action combat", () => {
  it("makes hostile factions kill each other with the player far away", () => {
    const { project, map } = warProject({ banditFaction: "bandit" });
    const scene = fakeScene(project, map, { x: 20, y: 20 });
    initializeActionCombatForScene(scene);
    const state = scene.actionCombatState!;
    expect(state.enemies.size).toBe(2);

    const leadId = scene.session.partyActorIds[0]!;
    const hpBefore = scene.session.actorVitals[leadId]?.hp;

    tick(scene, 200);

    expect(state.enemies.size).toBeLessThan(2);
    expect(scene.session.actorVitals[leadId]?.hp).toBe(hpBefore);
    expect(scene.showGameOverScreen).not.toHaveBeenCalled();
  });

  it("grants the player no gold, exp, or kill persistence for an NPC-inflicted kill", () => {
    const { project, map } = warProject({ banditFaction: "bandit" });
    const scene = fakeScene(project, map, { x: 20, y: 20 });
    initializeActionCombatForScene(scene);
    const goldBefore = scene.session.gold;
    const expBefore = { ...scene.session.actorExperience };

    tick(scene, 200);

    expect(scene.actionCombatState!.enemies.size).toBeLessThan(2);
    expect(scene.session.gold).toBe(goldBefore);
    expect(scene.session.actorExperience).toEqual(expBefore);
    expect(scene.session.killedFieldSpawns ?? {}).toEqual({});
  });

  it("keeps neutral factions from fighting at all", () => {
    const { project, map } = warProject({ banditFaction: "bandit" });
    project.factions = { defs: project.factions!.defs, relations: [] };
    store.replace(project);
    const scene = fakeScene(project, map, { x: 20, y: 20 });
    initializeActionCombatForScene(scene);
    const state = scene.actionCombatState!;

    tick(scene, 200);

    expect(state.enemies.size).toBe(2);
    expect([...state.enemies.values()].every((enemy) => enemy.hp === enemy.maxHp)).toBe(true);
  });

  it("spares a protectedFromNpcs faction at 1 hp", () => {
    const { project, map } = warProject({ banditFaction: "bandit" });
    project.factions = {
      defs: [
        { id: "bandit", name: "산적" },
        { id: "guard", name: "경비병", protectedFromNpcs: true },
      ],
      relations: [{ a: "bandit", b: "guard", stance: -1 }],
    };
    store.replace(project);
    const scene = fakeScene(project, map, { x: 20, y: 20 });
    initializeActionCombatForScene(scene);
    const state = scene.actionCombatState!;

    tick(scene, 400);

    const guard = [...state.enemies.values()].find((enemy) => enemy.enemyId === "enemy_guard");
    expect(guard).toBeDefined();
    expect(guard!.hp).toBe(1);
  });

  it("does not let an enemy fighting another NPC damage the player it walks past", () => {
    const { project, map } = warProject({ banditFaction: "bandit" });
    const scene = fakeScene(project, map, { x: 2, y: 3 });
    initializeActionCombatForScene(scene);
    const leadId = scene.session.partyActorIds[0]!;
    const hpBefore = scene.session.actorVitals[leadId]?.hp;

    tick(scene, 60);

    // 산적은 경비병과 교전 중이고 플레이어와는 중립이므로 인접해도 접촉 피해가 없다.
    expect(scene.session.actorVitals[leadId]?.hp).toBe(hpBefore);
  });

  it("applies opt-in kill reputation exactly once on a player kill", () => {
    const { project, map } = warProject({ banditFaction: "bandit" });
    project.factions!.playerKillReputation = {};
    store.replace(project);
    const scene = fakeScene(project, map, { x: 2, y: 3 });
    scene.facing = "up";
    initializeActionCombatForScene(scene);
    const state = scene.actionCombatState!;
    const bandit = [...state.enemies.values()].find((enemy) => enemy.factionId === "bandit");
    if (!bandit) throw new Error("bandit missing");
    bandit.hp = 1;

    tryActionCombatSwing(scene);

    expect(effectiveFactionStance(state.factions, scene.session.factionStanceOverrides, "guard", PLAYER_FACTION_ID)).toBe(1.25);
    expect(effectiveFactionStance(state.factions, scene.session.factionStanceOverrides, "bandit", PLAYER_FACTION_ID)).toBe(-0.25);
  });

  it("still routes hostile enemies onto the player when the player is the nearest hostile", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    project.system.actionCombat = { enabled: true };
    map.actionCombat = true;
    map.safeZones = [];
    project.database.enemies.push(normalizeEnemyRecord({
      id: "enemy_plain",
      name: "슬라임",
      stats: { maxHp: 40, maxMp: 0, attack: 20, defense: 0, mind: 0, agility: 10 },
      actionProfile: MELEE,
    }));
    project.database.troops.push({ id: "troop_plain", name: "슬라임", enemyIds: ["enemy_plain"], members: [{ enemyId: "enemy_plain", x: 0, y: 0 }], autoAlign: true, battleEventPages: [] });
    map.fieldSpawns = [{ id: "spawn_plain", troopId: "troop_plain", area: { x: 2, y: 2, w: 1, h: 1 }, maxAlive: 1, chase: true }];
    store.replace(project);

    const scene = fakeScene(project, map, { x: 2, y: 3 });
    initializeActionCombatForScene(scene);
    const leadId = scene.session.partyActorIds[0]!;
    const hpBefore = scene.session.actorVitals[leadId]!.hp;

    tick(scene, 40);

    expect(scene.session.actorVitals[leadId]!.hp).toBeLessThan(hpBefore);
  });
});
