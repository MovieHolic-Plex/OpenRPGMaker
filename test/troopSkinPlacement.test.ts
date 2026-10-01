import { describe, expect, it } from "vitest";

import { enemyBattlers } from "@/battle/battleBattlers";
import {
  BATTLER_PLACEMENTS,
  CANONICAL_SIDEVIEW_ANCHOR_X,
  MANUAL_FRONTAL_DAMPING,
  resolveManualFrontalRow,
  resolveSkinEnemyPosition,
  resolveSkinEnemyPositions,
} from "@/battle/battlerPlacements";
import { BATTLE_SKINS } from "@/battle/skins/registry";
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import type { BattleSkinId } from "@/battle/skins/types";

const SKIN_IDS = Object.keys(BATTLER_PLACEMENTS) as BattleSkinId[];
const sideview = SKIN_IDS.filter((id) => {
  const layout = BATTLE_SKINS[id]?.layout;
  return layout === "sideview" || layout === "active";
});
const frontal = SKIN_IDS.filter((id) => {
  const layout = BATTLE_SKINS[id]?.layout;
  return layout === "frontview" || layout === "firstperson";
});

describe("resolveSkinEnemyPosition", () => {
  it("auto matches the placement table", () => {
    for (const skin of SKIN_IDS) {
      for (const n of [1, 2, 3, 4]) {
        for (let i = 0; i < n; i += 1) {
          expect(resolveSkinEnemyPosition(skin, { x: 200, y: 200 }, i, n, true)).toEqual(
            BATTLER_PLACEMENTS[skin].enemy(i, n),
          );
        }
      }
    }
  });

  it("auto works without canonical coords", () => {
    for (const skin of SKIN_IDS) {
      expect(resolveSkinEnemyPosition(skin, undefined, 0, 3, true)).toEqual(
        BATTLER_PLACEMENTS[skin].enemy(0, 3),
      );
    }
  });

  // 2026-10-01: 측면 스킨은 모두 도트 측면 뼈대라 저작 좌표를 적 구역(RETRO_ZONE x 34~150 · y 92~142)에 가둔다.
  it("manual sideview clamps authored x into the dot-sideview enemy zone", () => {
    expect(resolveSkinEnemyPosition("rm2003", { x: 200, y: 180 }, 0, 3, false)).toEqual({
      x: 150,
      y: 120,
    });
  });

  it("manual sideview keeps in-range coords and clamps display range", () => {
    expect(resolveSkinEnemyPosition("rm2003", { x: 100, y: 180 }, 0, 3, false)).toEqual({
      x: 100,
      y: 120,
    });
    expect(resolveSkinEnemyPosition("rm2003", { x: 400, y: 300 }, 0, 1, false)).toEqual({
      x: 150,
      y: 142,
    });
    expect(resolveSkinEnemyPosition("rm2003", { x: -10, y: -5 }, 0, 1, false).x).toBe(34);
  });

  it("manual frontal keeps y and shifts x by the damped offset", () => {
    for (const skin of frontal) {
      const fallback = BATTLER_PLACEMENTS[skin].enemy(1, 3);
      expect(
        resolveSkinEnemyPosition(skin, { x: CANONICAL_SIDEVIEW_ANCHOR_X, y: 0 }, 1, 3, false),
      ).toEqual(fallback);
      const moved = resolveSkinEnemyPosition(
        skin,
        { x: CANONICAL_SIDEVIEW_ANCHOR_X + 40, y: 0 },
        1,
        3,
        false,
      );
      expect(moved.y).toBe(fallback.y);
      expect(moved.x).toBe(
        Math.max(0, Math.min(320, Math.round(fallback.x + 40 * MANUAL_FRONTAL_DAMPING))),
      );
    }
  });

  it("manual frontal keeps raw authored x beyond the old recenter line", () => {
    const fallback = BATTLER_PLACEMENTS.rm2000.enemy(0, 1);
    const moved = resolveSkinEnemyPosition("rm2000", { x: 200, y: 80 }, 0, 1, false);
    expect(moved.y).toBe(fallback.y);
    expect(moved.x).toBe(
      Math.max(0, Math.min(320, Math.round(fallback.x + (200 - CANONICAL_SIDEVIEW_ANCHOR_X) * MANUAL_FRONTAL_DAMPING))),
    );
  });

  it("manual without coords falls back to auto seats", () => {
    for (const skin of SKIN_IDS) {
      expect(resolveSkinEnemyPosition(skin, undefined, 2, 4, false)).toEqual(
        BATTLER_PLACEMENTS[skin].enemy(2, 4),
      );
      expect(resolveSkinEnemyPosition(skin, { x: Number.NaN, y: 50 }, 2, 4, false)).toEqual(
        BATTLER_PLACEMENTS[skin].enemy(2, 4),
      );
    }
  });
});

describe("resolveSkinEnemyPositions", () => {
  it("manual frontal shifts the whole row uniformly from the troop mean", () => {
    const xs = [84, 128, 84, 128];
    const row = resolveSkinEnemyPositions(
      "rm2000",
      xs.map((x) => ({ x, y: 80 })),
      false,
    );
    const fallback = xs.map((_, i) => BATTLER_PLACEMENTS.rm2000.enemy(i, 4));
    const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const shift = Math.round((mean - CANONICAL_SIDEVIEW_ANCHOR_X) * MANUAL_FRONTAL_DAMPING);
    expect(row.map((p) => p.x)).toEqual(fallback.map((seat) => seat.x + shift));
    expect(row.map((p) => p.y)).toEqual(fallback.map((seat) => seat.y));
    const sorted = row.map((p) => p.x).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]! - sorted[i - 1]!).toBe(70);
    }
  });

  it("member x=200 keeps raw authored coords while battleX stays SC12-recentered", () => {
    const project = createScarloxyPokemonDemoProject();
    const troop = project.database.troops.find((t) => t.id === "troop_pkmn_grass_a");
    if (!troop) throw new Error("missing troop");
    const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0]!;
    const battlers = enemyBattlers(project, {
      ...troop,
      members: [{ enemyId, x: 200, y: 80 }],
    });
    expect(battlers[0]!.authoredX).toBe(200);
    expect(battlers[0]!.battleX).toBeLessThanOrEqual(150);
    const fromAuthored = resolveSkinEnemyPositions("rm2000", [{ x: battlers[0]!.authoredX, y: battlers[0]!.authoredY }], false);
    const fromBattle = resolveSkinEnemyPositions("rm2000", [{ x: battlers[0]!.battleX, y: battlers[0]!.battleY }], false);
    expect(fromAuthored).not.toEqual(fromBattle);
    const preview = resolveSkinEnemyPositions("rm2000", [{ x: 200, y: 80 }], false);
    expect(fromAuthored).toEqual(preview);
    expect(preview[0]!.x).toBeGreaterThan(BATTLER_PLACEMENTS.rm2000.enemy(0, 1).x);
  });

  it("row helper falls back to auto seats without authored coords", () => {
    const row = resolveManualFrontalRow("rm2000", [Number.NaN, Number.NaN]);
    expect(row).toEqual([
      BATTLER_PLACEMENTS.rm2000.enemy(0, 2).x,
      BATTLER_PLACEMENTS.rm2000.enemy(1, 2).x,
    ]);
  });

  it("auto rows match the placement table", () => {
    for (const skin of SKIN_IDS) {
      const row = resolveSkinEnemyPositions(
        skin,
        [{ x: 200, y: 200 }, { x: 100, y: 90 }],
        true,
      );
      expect(row).toEqual([
        BATTLER_PLACEMENTS[skin].enemy(0, 2),
        BATTLER_PLACEMENTS[skin].enemy(1, 2),
      ]);
    }
  });

  it("sideview rows only", () => {
    expect(sideview.length).toBeGreaterThan(0);
    expect(frontal.length).toBeGreaterThan(0);
    expect(new Set([...sideview, ...frontal]).size).toBe(SKIN_IDS.length);
  });
});
