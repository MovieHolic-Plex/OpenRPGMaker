/** @vitest-environment happy-dom */
// 액션 전투 동료(system.actionCombat.allies): 따라오는 파티원이 가까운 적을 때리고, V 키로 선두를 바꾼다.
import { describe, expect, it, vi } from "vitest";
import * as combat from "@/player/playSceneActionCombat";
import { planAllyStrikes, rotateActionLeader } from "@/player/actionAllies";
import { RuntimeKeyHoldTracker } from "@/player/input";
import { createFieldSpawnRuntime } from "@/player/fieldSpawns";
import { createBlankProject } from "@/project/defaults";
import { normalizeActionCombatConfig } from "@/project/actionCombat";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { startSession } from "@/project/session";
import { syncActorVitals } from "@/project/sessionVitals";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Project } from "@/project/types";

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

const HERO = "hero_a";
const ALLY = "hero_b";

/**
 * 파티 2인(선두 HERO + 동료 ALLY) · 적 1마리 · 동료는 플레이어 옆 궤적 칸(3,3)에 선다.
 * 적은 동료 옆 (4,3), 플레이어(1,3)의 스윙 범위 밖이다 — 동료만 닿는다.
 */
function setup(allies: boolean) {
  const project: Project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const base = project.database.actors[0]!;
  project.database.actors = [
    { ...structuredClone(base), id: HERO, name: "선두" },
    { ...structuredClone(base), id: ALLY, name: "동료" },
  ];
  project.system.startActorIds = [HERO, ALLY];
  project.system.companions = { fromParty: true };
  project.system.actionCombat = { enabled: true, ...(allies ? { allies: true } : {}) };
  map.actionCombat = true;
  map.safeZones = [];
  project.database.enemies.push(normalizeEnemyRecord({
    id: "ally_enemy", name: "Target",
    stats: { maxHp: 9999, maxMp: 0, attack: 0, defense: 0, mind: 0, agility: 1 },
    rewards: { exp: 0, gold: 0, dropRatePercent: 0 },
  }));
  project.database.troops.push({ id: "ally_troop", name: "T", enemyIds: ["ally_enemy"], members: [{ enemyId: "ally_enemy", x: 0, y: 0 }], autoAlign: true, battleEventPages: [] });
  map.fieldSpawns = [{ id: "ally_spawn", troopId: "ally_troop", area: { x: 4, y: 3, w: 1, h: 1 }, maxAlive: 1 }];
  store.replace(project);

  const session = startSession(project);
  session.partyActorIds = [HERO, ALLY];
  session.x = 1;
  session.y = 3;
  session.followers = [{ id: `actor:${ALLY}`, eventId: ALLY, name: "동료", kind: "actor", source: "party", graphic: { direction: "down", pattern: 0 } } as never];
  session.followerTrail = [{ x: 3, y: 3, direction: "left" }];
  const fieldSpawnState = createFieldSpawnRuntime(project, map, { x: 1, y: 3 });
  const eventPositions: Record<string, { x: number; y: number; direction: "down" }> = {};
  const eventSprites = new Map<string, ReturnType<typeof spriteStub>>();
  for (const entry of fieldSpawnState.entries) {
    for (const instance of entry.alive) {
      eventPositions[instance.eventId] = { x: instance.x, y: instance.y, direction: "down" };
      eventSprites.set(instance.eventId, spriteStub(instance.x * 16, instance.y * 16));
    }
  }
  const tracker = new RuntimeKeyHoldTracker();
  const refreshRuntimeSurfaces = vi.fn();
  const scene = {
    map, session, fieldSpawnState, eventPositions, eventSprites,
    autonomousNPCs: new Map(), actionCombatState: null,
    tileX: 1, tileY: 3, movingTo: { x: 1, y: 3 }, moving: false, running: false, dashing: false,
    inputEnabled: true, facing: "left" as const,
    player: { setTintFill: vi.fn(), clearTint: vi.fn(), setScale: vi.fn() },
    input_: {
      setAttackMode: vi.fn(),
      isGuardHeld: () => false,
      consumeSkillCycleEdge: () => false,
      consumeLeaderSwitchEdge: () => tracker.consumeLeaderSwitchEdge(),
    },
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })), killTweensOf: vi.fn() },
    add: {
      graphics: vi.fn(graphicsStub),
      circle: vi.fn(() => ({ setDepth: vi.fn(), setStrokeStyle: vi.fn(), setPosition: vi.fn(), destroy: vi.fn() })),
      text: vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn(), setScale: vi.fn(), destroy: vi.fn() })),
      sprite: vi.fn(() => spriteStub(0, 0)),
    },
    cameras: { main: { shake: vi.fn() } },
    events: { once: vi.fn(), off: vi.fn() },
    game: { registry: { get: () => true }, canvas: { closest: () => null } },
    renderTiles: vi.fn(), registerPageMoveRoutes: vi.fn(), showGameOverScreen: vi.fn(),
    refreshRuntimeSurfaces, setInputEnabled: vi.fn(),
  };
  const ctx = scene as unknown as PlaySceneContext;
  combat.initializeActionCombatForScene(ctx);
  return { scene: ctx, tracker, refreshRuntimeSurfaces, project };
}

function enemyHp(scene: PlaySceneContext): number {
  const [enemy] = [...scene.actionCombatState!.enemies.values()];
  return enemy!.hp;
}

describe("동료 공격 계획(순수)", () => {
  it("사거리 안 가장 가까운 적을 고르고 쿨다운 동안은 다시 휘두르지 않는다", () => {
    const cooldowns = new Map<string, number>();
    const allies = [{ actorId: "a", x: 0, y: 0 }];
    const enemies = [{ eventId: "far", x: 3, y: 0 }, { eventId: "near", x: 1, y: 1 }];
    expect(planAllyStrikes(allies, enemies, cooldowns, 16)).toEqual([{ actorId: "a", eventId: "near" }]);
    expect(planAllyStrikes(allies, enemies, cooldowns, 16)).toEqual([]);
    expect(planAllyStrikes(allies, enemies, cooldowns, 900)).toEqual([{ actorId: "a", eventId: "near" }]);
  });

  it("사거리 밖 적만 있으면 휘두르지 않는다", () => {
    expect(planAllyStrikes([{ actorId: "a", x: 0, y: 0 }], [{ eventId: "far", x: 2, y: 0 }], new Map(), 16)).toEqual([]);
  });
});

describe("액션 전투 동료(실제 디스패처)", () => {
  it("allies 가 켜진 맵에서 따라오는 동료가 옆의 적을 때린다", () => {
    const { scene } = setup(true);
    const before = enemyHp(scene);
    combat.updateActionCombatForScene(scene, 16);
    expect(enemyHp(scene)).toBeLessThan(before);
  });

  it("allies 가 없으면 동료는 싸우지 않는다(기존 동작)", () => {
    const { scene } = setup(false);
    const before = enemyHp(scene);
    combat.updateActionCombatForScene(scene, 16);
    combat.updateActionCombatForScene(scene, 1000);
    expect(enemyHp(scene)).toBe(before);
  });

  it("V 키가 선두를 살아 있는 다음 파티원으로 바꾸고 화면을 새로 그린다", () => {
    const { scene, tracker, refreshRuntimeSurfaces } = setup(true);
    tracker.keyDown("v");
    combat.updateActionCombatForScene(scene, 16);
    expect(scene.session.partyActorIds).toEqual([ALLY, HERO]);
    expect(refreshRuntimeSurfaces).toHaveBeenCalledTimes(1);
    // 엣지는 한 번만 소비된다.
    combat.updateActionCombatForScene(scene, 16);
    expect(scene.session.partyActorIds).toEqual([ALLY, HERO]);
  });
});

describe("선두 교대 규칙", () => {
  it("쓰러진 파티원은 건너뛰고, 혼자면 바꾸지 않는다", () => {
    const { scene, project } = setup(true);
    const session = scene.session;
    session.partyActorIds = [HERO, ALLY, "hero_c"];
    project.database.actors.push({ ...structuredClone(project.database.actors[0]!), id: "hero_c", name: "셋째" });
    rotateActionLeader(project, session);
    expect(session.partyActorIds[0]).toBe(ALLY);
    syncActorVitals(project, session.actorVitals, HERO);
    session.actorVitals[HERO]!.hp = 0;
    session.partyActorIds = [ALLY, HERO, "hero_c"];
    expect(rotateActionLeader(project, session)).toBe("hero_c");
    expect(session.partyActorIds).toEqual(["hero_c", ALLY, HERO]);
    session.partyActorIds = [HERO];
    expect(rotateActionLeader(project, session)).toBeUndefined();
  });

  it("allies 설정은 정규화에서 살아남는다", () => {
    expect(normalizeActionCombatConfig({ enabled: true, allies: true })?.allies).toBe(true);
    expect(normalizeActionCombatConfig({ enabled: true })).not.toHaveProperty("allies");
  });
});
