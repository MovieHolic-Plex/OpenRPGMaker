/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import * as combat from "@/player/playSceneActionCombat";
import { createFieldSpawnRuntime } from "@/player/fieldSpawns";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { GameMap, Project } from "@/project/types";
import type { ActionCombatObservation } from "@/testing/actionCombatProof";
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
      text: vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn(), destroy: vi.fn() })),
      sprite: vi.fn(() => spriteStub(0, 0)),
    },
    cameras: { main: { shake: vi.fn() } },
    game: { registry: { get: () => true }, canvas: { closest: () => null } },
    renderTiles: vi.fn(),
    registerPageMoveRoutes: vi.fn(),
    showGameOverScreen: vi.fn(),
    refreshRuntimeSurfaces: vi.fn(),
    setInputEnabled: vi.fn(),
  };
  return scene as unknown as PlaySceneContext & { showGameOverScreen: ReturnType<typeof vi.fn> };
}

function setup() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  project.system.actionCombat = { enabled: true, dodgeIframesMs: 300, dodgeStaminaCost: 25 };
  map.actionCombat = true;
  map.safeZones = [];
  project.database.enemies.push(normalizeEnemyRecord({
    id: "proof_enemy", name: "Proof enemy",
    stats: { maxHp: 1, maxMp: 0, attack: 20, defense: 0, mind: 0, agility: 10 },
    rewards: { exp: 2, gold: 3, dropRatePercent: 0 },
    actionProfile: { attack: { kind: "melee", windupMs: 100, recoverMs: 100, damage: 5, range: 1, cooldownMs: 1000 } },
  }));
  project.database.troops.push({ id: "proof_troop", name: "Proof", enemyIds: ["proof_enemy"], members: [{ enemyId: "proof_enemy", x: 0, y: 0 }], autoAlign: true, battleEventPages: [] });
  map.fieldSpawns = [{ id: "proof_spawn", troopId: "proof_troop", area: { x: 2, y: 2, w: 1, h: 1 }, maxAlive: 1, chase: true }];
  store.replace(project);
  const scene = fakeScene(project, map, { x: 2, y: 3 });
  combat.initializeActionCombatForScene(scene);
  return scene;
}

describe("action dispatcher observations", () => {
  it("stationary Shift takes damage; the same strike is rejected only by an actual dodge", () => {
    const run = (moving: boolean) => {
      const scene = setup();
      const observations: ActionCombatObservation[] = [];
      const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
      scene.dashing = true;
      scene.moving = moving;
      scene.movingTo = { x: 3, y: 3 };
      combat.updateActionCombatForScene(scene, 1);
      combat.updateActionCombatForScene(scene, 100);
      stop();
      return observations;
    };
    const stationary = run(false);
    const dodging = run(true);
    const hit = stationary.find(entry => entry.outcome === "player-damage");
    const rejected = dodging.find(entry => entry.outcome === "dodge-rejection");
    expect(hit).toBeDefined();
    expect(hit!.before).toBeGreaterThan(hit!.after);
    expect(stationary.some(entry => entry.outcome === "dodge-rejection")).toBe(false);
    expect(rejected).toBeDefined();
    expect(rejected!.before).toBe(rejected!.after);
    expect(rejected!.attackId).toBe(hit!.attackId);
    expect(dodging.some(entry => entry.outcome === "player-damage")).toBe(false);
    expect(dodging.some(entry => entry.outcome === "stamina-spent")).toBe(true);
  });

  it("reports actual swing, kill, reward and stamina deltas then unsubscribes", () => {
    const scene = setup();
    scene.facing = "up";
    const observations: ActionCombatObservation[] = [];
    const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
    combat.tryActionCombatSwing(scene);
    combat.updateActionCombatForScene(scene, 100);
    combat.updateActionCombatForScene(scene, 100);
    expect(observations.map(entry => entry.outcome)).toEqual(expect.arrayContaining(["swing-hit", "enemy-defeat", "reward-granted", "stamina-spent", "stamina-recovered"]));
    expect(observations.every(entry => entry.mapId === scene.map.id)).toBe(true);
    const count = observations.length;
    stop();
    combat.updateActionCombatForScene(scene, 100);
    expect(observations).toHaveLength(count);
  });

  it("does not confuse hurt invulnerability with dodge rejection", () => {
    const scene = setup();
    const observations: ActionCombatObservation[] = [];
    const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
    scene.actionCombatState!.playerIframesMs = 1000;
    scene.actionCombatState!.dodgeIframesMs = 1000;
    combat.updateActionCombatForScene(scene, 1);
    combat.updateActionCombatForScene(scene, 100);
    stop();
    expect(observations.some(entry => entry.outcome === "dodge-rejection")).toBe(false);
  });

  it("does not count positive dodge frames or moving out of range as rejected damage", () => {
    const scene = setup();
    const observations: ActionCombatObservation[] = [];
    const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
    combat.updateActionCombatForScene(scene, 1);
    scene.tileX = 12;
    scene.tileY = 12;
    scene.actionCombatState!.dodgeIframesMs = 1000;
    combat.updateActionCombatForScene(scene, 100);
    stop();
    expect(scene.actionCombatState!.dodgeIframesMs).toBeGreaterThan(0);
    expect(observations.some(entry => entry.outcome === "dodge-rejection")).toBe(false);
    expect(observations.some(entry => entry.outcome === "player-damage")).toBe(false);
  });

  it("records projectiles only after the authored enemy dispatcher creates them", () => {
    const scene = setup();
    const enemy = [...scene.actionCombatState!.enemies.values()][0]!;
    enemy.actionAttack = { kind: "projectile", windupMs: 100, recoverMs: 100, damage: 5, range: 5, cooldownMs: 1000 };
    scene.tileY = 5;
    const observations: ActionCombatObservation[] = [];
    const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
    combat.updateActionCombatForScene(scene, 1);
    expect(observations.some(entry => entry.outcome === "enemy-projectile")).toBe(false);
    combat.updateActionCombatForScene(scene, 100);
    stop();
    expect(observations.find(entry => entry.outcome === "enemy-projectile"))
      .toMatchObject({ eventId: enemy.eventId, before: 0, after: 1 });
    expect(scene.actionCombatState!.projectiles).toHaveLength(1);
  });

  it("installs no observation subscription when the QA boot capability is absent", () => {
    const scene = setup();
    vi.spyOn(scene.game.registry, "get").mockReturnValue(false);
    const receive = vi.fn();
    const stop = combat.subscribeActionCombatObservations(scene, receive);
    combat.updateActionCombatForScene(scene, 1);
    combat.updateActionCombatForScene(scene, 100);
    stop();
    expect(receive).not.toHaveBeenCalled();
  });

  it("records defeat using the actual pre-hit HP, not the enemy maximum", () => {
    const scene = setup();
    const enemy = [...scene.actionCombatState!.enemies.values()][0]!;
    enemy.maxHp = 100;
    scene.facing = "up";
    const observations: ActionCombatObservation[] = [];
    const stop = combat.subscribeActionCombatObservations(scene, entry => observations.push(entry));
    combat.tryActionCombatSwing(scene);
    stop();
    expect(observations.find(entry => entry.outcome === "enemy-defeat")).toMatchObject({ before: 1, after: 0 });
  });
});
