import { afterEach, describe, expect, it, vi } from "vitest";
import { canPayActionSkill, skillRay, skillLineClear, tickFieldStatus } from "@/battle/action/skillEffects";
import { castActionFieldProfile, updateActionSkills, clearActionSkills, canCastActionProfile, markActionCast, applyActionFieldStatus } from "@/player/playSceneActionSkills";
import { actionFieldSlow } from "@/player/actionFieldSlow";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ActionEnemyState } from "@/player/actionCombatTypes";
vi.mock("@/project/store", () => ({ store: { getCurrent: () => ({}) } }));
vi.mock("@/project/collision", () => ({ inBounds: (_: unknown, x: number, y: number) => x >= 0 && y >= 0 && x < 10 && y < 10,
  isPassable: (_: unknown, __: unknown, x: number) => x !== 4 }));
function fixture() {
  const object = { setStrokeStyle: vi.fn(), setDepth: vi.fn(), destroy: vi.fn() };
  const enemy = { eventId: "enemy", hp: 100, maxHp: 100, footprint: { width: 1, height: 1 } } as ActionEnemyState;
  const mover = {};
  const scene = { tileX: 1, tileY: 2, facing: "right", map: {}, events: { once: vi.fn(), off: vi.fn() }, playerRoute: null, autonomousNPCs: new Map([["enemy", mover]]),
    actionCombatState: { enemies: new Map([["enemy", enemy]]) }, add: { circle: () => object } } as unknown as PlaySceneContext;
  return { scene, enemy, mover, object };
}
afterEach(() => vi.clearAllMocks());
describe("feature16 bounded field effects", () => {
  it("rejects insufficient MP/ammo atomically, including malformed balances", () => {
    const inventory = Object.freeze({ arrow: 2 });
    expect(canPayActionSkill(5, 5, inventory, { itemId: "arrow", amount: 2 })).toBe(true);
    expect(canPayActionSkill(4, 5, inventory, { itemId: "arrow", amount: 2 })).toBe(false);
    expect(canPayActionSkill(5, 5, inventory, { itemId: "arrow", amount: 3 })).toBe(false);
    expect(canPayActionSkill(NaN, 5, inventory)).toBe(false);
    expect(inventory.arrow).toBe(2);
  });
  it("ray stops before walls and line-of-sight rejects occluded melee", () => {
    expect(skillRay(1, 2, 1, 0, 8, (x) => x < 4)).toEqual([{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(skillLineClear(1, 2, 5, 2, (x) => x !== 4)).toBe(false);
  });
  it("melee respects facing, range and wall occlusion", () => {
    const { scene } = fixture(); const hit = vi.fn(() => true);
    const profile = { kind: "melee" as const, damage: 10, range: 6 };
    castActionFieldProfile(scene, profile, undefined, () => ({ x: 5, y: 2 }), hit);
    castActionFieldProfile(scene, profile, undefined, () => ({ x: 0, y: 2 }), hit);
    expect(hit).not.toHaveBeenCalled();
    castActionFieldProfile(scene, profile, undefined, () => ({ x: 3, y: 2 }), hit);
    expect(hit).toHaveBeenCalledTimes(1);
  });
  it("dash uses a finite collision-respecting route and hits a target only once", () => {
    const { scene } = fixture(); const hit = vi.fn(() => true);
    castActionFieldProfile(scene, { kind: "dash", range: 3, damage: 12 }, undefined, () => ({ x: 2, y: 2 }), hit);
    expect(scene.playerRoute).toMatchObject({ repeat: false, stopOnBlocked: true });
    expect(scene.playerRoute?.moves).toHaveLength(3);
    expect(scene.playerRoute?.through).toBeUndefined();
    updateActionSkills(scene, 100, () => ({ x: 2, y: 2 }), hit);
    expect(hit).toHaveBeenCalledTimes(1);
    clearActionSkills(scene); expect(scene.playerRoute).toBeNull();
  });
  it("trap triggers once, ignores friendly targets, expires and destroys visuals", () => {
    const { scene, object } = fixture(); const hit = vi.fn(() => false);
    castActionFieldProfile(scene, { kind: "trap", range: 2, damage: 12, durationMs: 1000 }, undefined, () => null, hit);
    updateActionSkills(scene, 100, () => ({ x: 3, y: 2 }), hit);
    expect(object.destroy).not.toHaveBeenCalled();
    hit.mockReturnValue(true);
    updateActionSkills(scene, 100, () => ({ x: 3, y: 2 }), hit);
    updateActionSkills(scene, 100, () => ({ x: 3, y: 2 }), hit);
    expect(hit).toHaveBeenCalledTimes(2); expect(object.destroy).toHaveBeenCalledTimes(1);
    castActionFieldProfile(scene, { kind: "trap", range: 2, damage: 12, durationMs: 100 }, undefined, () => null, hit);
    updateActionSkills(scene, 101, () => null, hit);
    expect(object.destroy).toHaveBeenCalledTimes(2);
  });
  it("cooldown and trap capacity reject before the caller spends resources", () => {
    const { scene } = fixture(); const profile = { kind: "trap" as const, range: 1, damage: 1, cooldownMs: 500 };
    markActionCast(scene, profile); expect(canCastActionProfile(scene, profile)).toBe(false);
    updateActionSkills(scene, 500, () => null, () => true); expect(canCastActionProfile(scene, profile)).toBe(true);
    for (let i = 0; i < 16; i++) castActionFieldProfile(scene, profile, undefined, () => null, () => true);
    expect(canCastActionProfile(scene, profile)).toBe(false); clearActionSkills(scene);
  });
  it("poison ticks only within its lifetime and slow clears on expiry/map exit", () => {
    expect(tickFieldStatus(1500, 0, 10000)).toEqual({ remainingMs: 0, tickMs: 500, ticks: 1 });
    const { scene, enemy, mover } = fixture(); const hit = vi.fn(() => true);
    for (const kind of ["poison", "slow"] as const) applyActionFieldStatus(scene, enemy,
      { kind: "melee", damage: 1, range: 1, fieldStatus: { kind, durationMs: 2000 } });
    expect(actionFieldSlow.get(mover)).toBe(0.5);
    updateActionSkills(scene, 3000, () => null, hit);
    expect(hit).toHaveBeenCalledWith(enemy, { kind: "melee", range: 1, damage: 10 });
    expect(actionFieldSlow.has(mover)).toBe(false);
    updateActionSkills(scene, 3000, () => null, hit); expect(hit).toHaveBeenCalledTimes(1);
    applyActionFieldStatus(scene, enemy, { kind: "trap", range: 1, damage: 1, fieldStatus: { kind: "slow", durationMs: 3000 } });
    clearActionSkills(scene); expect(actionFieldSlow.has(mover)).toBe(false);
  });
});
