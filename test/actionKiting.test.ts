// 원거리 적의 거리 유지(kiting) + 어그로 획득/포기.
// 예전에는 적이 전부 같은 추격 묘버를 써서, 활을 든 해골 궁수도 플레이어 얼굴까지
// 걸어와 접촉 피해로 싸웠다. 투사체 적은 최소 거리 안으로 들어오면 물러나고
// 선호 거리보다 멀면 다가온다.
import { describe, expect, it } from "vitest";

import { kiteBandForAttack, resolveKiteIntent } from "@/battle/action/kiting";
import { nextChaseDecision, type ChaseRuntimeState } from "@/player/chaseAi";
import { createBlankProject } from "@/project/defaults";
import type { EnemyActionAttack, GameMap, Project } from "@/project/types";

const PROJECTILE: EnemyActionAttack = {
  kind: "projectile",
  windupMs: 700,
  recoverMs: 300,
  damage: 18,
  range: 8,
  cooldownMs: 1400,
};

const MELEE: EnemyActionAttack = { kind: "melee", windupMs: 300, recoverMs: 250, damage: 14, range: 1 };

function fixture(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = Object.values(project.maps)[0] as GameMap;
  return { project, map };
}

function mover(): ChaseRuntimeState {
  return { timer: 999, moveIntervalMs: 0 };
}

describe("kiteBandForAttack", () => {
  it("gives a band only to projectile attackers", () => {
    const band = kiteBandForAttack(PROJECTILE);
    expect(band).not.toBeNull();
    expect(band?.minRange).toBeGreaterThanOrEqual(2);
    expect(band?.preferredRange).toBeLessThanOrEqual(PROJECTILE.range);
    expect(band?.preferredRange).toBeGreaterThan(band?.minRange ?? 0);
    expect(kiteBandForAttack(MELEE)).toBeNull();
    expect(kiteBandForAttack(undefined)).toBeNull();
  });

  it("keeps the band coherent for a very short-ranged projectile", () => {
    const band = kiteBandForAttack({ ...PROJECTILE, range: 2 });
    expect(band).not.toBeNull();
    expect(band?.preferredRange).toBeGreaterThan(band?.minRange ?? 0);
  });
});

describe("resolveKiteIntent", () => {
  const band = { minRange: 3, preferredRange: 6 } as const;

  it("retreats when the player closes inside the minimum range", () => {
    expect(resolveKiteIntent({ distance: 0, band })).toBe("retreat");
    expect(resolveKiteIntent({ distance: 3, band })).toBe("retreat");
  });

  it("holds inside the preferred band", () => {
    expect(resolveKiteIntent({ distance: 4, band })).toBe("hold");
    expect(resolveKiteIntent({ distance: 6, band })).toBe("hold");
  });

  it("advances when out of the preferred band", () => {
    expect(resolveKiteIntent({ distance: 7, band })).toBe("advance");
    expect(resolveKiteIntent({ distance: 20, band })).toBe("advance");
  });
});

describe("nextChaseDecision with a kite band", () => {
  it("backs away from the player when inside the minimum range", () => {
    const { project, map } = fixture();
    const player = { x: 6, y: 7 };
    const decision = nextChaseDecision({
      project,
      map,
      from: { x: 8, y: 7 },
      player,
      deltaMs: 16,
      mover: mover(),
      sightRange: 12,
      giveUpRange: 20,
      pathfind: true,
      kite: { minRange: 3, preferredRange: 6 },
    });
    expect(decision.kind).toBe("move");
    if (decision.kind !== "move") return;
    expect(Math.max(Math.abs(decision.x - player.x), Math.abs(decision.y - player.y))).toBeGreaterThan(2);
    expect(decision.x).toBe(9);
    expect(decision.y).toBe(7);
  });

  it("holds position while inside the preferred band", () => {
    const { project, map } = fixture();
    const decision = nextChaseDecision({
      project,
      map,
      from: { x: 11, y: 7 },
      player: { x: 6, y: 7 },
      deltaMs: 16,
      mover: mover(),
      sightRange: 12,
      giveUpRange: 20,
      pathfind: true,
      kite: { minRange: 3, preferredRange: 6 },
    });
    expect(decision).toEqual({ kind: "wait" });
  });

  it("advances when the player is beyond the preferred band", () => {
    const { project, map } = fixture();
    const player = { x: 6, y: 7 };
    const from = { x: 15, y: 7 };
    const decision = nextChaseDecision({
      project,
      map,
      from,
      player,
      deltaMs: 16,
      mover: mover(),
      sightRange: 14,
      giveUpRange: 24,
      pathfind: true,
      kite: { minRange: 3, preferredRange: 6 },
    });
    expect(decision.kind).toBe("move");
    if (decision.kind !== "move") return;
    const before = Math.abs(from.x - player.x) + Math.abs(from.y - player.y);
    const after = Math.abs(decision.x - player.x) + Math.abs(decision.y - player.y);
    expect(after).toBeLessThan(before);
  });

  it("never walks into contact even when the player is adjacent", () => {
    const { project, map } = fixture();
    const player = { x: 6, y: 7 };
    const decision = nextChaseDecision({
      project,
      map,
      from: { x: 7, y: 7 },
      player,
      deltaMs: 16,
      mover: mover(),
      sightRange: 12,
      giveUpRange: 20,
      pathfind: true,
      kite: { minRange: 3, preferredRange: 6 },
    });
    expect(decision.kind).not.toBe("touch");
    if (decision.kind !== "move") return;
    expect(Math.abs(decision.x - player.x) + Math.abs(decision.y - player.y)).toBeGreaterThan(1);
  });
});

describe("aggro acquisition and give-up", () => {
  it("stays put until the player enters the aggro range, then keeps chasing", () => {
    const { project, map } = fixture();
    const state = mover();
    const far = nextChaseDecision({
      project, map, from: { x: 16, y: 7 }, player: { x: 6, y: 7 },
      deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
    });
    expect(far).toEqual({ kind: "wait" });
    expect(state.chaseActive).not.toBe(true);

    state.timer = 999;
    const near = nextChaseDecision({
      project, map, from: { x: 10, y: 7 }, player: { x: 6, y: 7 },
      deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
    });
    expect(near.kind).toBe("move");
    expect(state.chaseActive).toBe(true);
  });

  it("gives up aggro past the give-up range and has to re-acquire", () => {
    const { project, map } = fixture();
    const state: ChaseRuntimeState = { timer: 999, moveIntervalMs: 0, chaseActive: true };
    const lost = nextChaseDecision({
      project, map, from: { x: 19, y: 7 }, player: { x: 6, y: 7 },
      deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
    });
    expect(lost).toEqual({ kind: "wait" });
    expect(state.chaseActive).toBe(false);

    state.timer = 999;
    const stillLost = nextChaseDecision({
      project, map, from: { x: 14, y: 7 }, player: { x: 6, y: 7 },
      deltaMs: 16, mover: state, sightRange: 5, giveUpRange: 12, pathfind: true,
    });
    expect(stillLost).toEqual({ kind: "wait" });
  });
});
