import { describe, expect, it } from "vitest";
import {
  buildDungeonThemeMap,
  countUpperDecorations,
  canReachDungeonLandmarks,
  DUNGEON_MAP_HEIGHT,
  DUNGEON_MAP_WIDTH,
  summarizeDungeonThemeMap,
  type DungeonTheme,
} from "@/project/defaults/dungeonThemedLayouts";

const THEMES: DungeonTheme[] = ["lava", "stone", "ice"];

describe("dungeonThemedLayouts", () => {
  for (const theme of THEMES) {
    it(`${theme}: sized grid, dense upper decor, landmarks reachable`, () => {
      const built = buildDungeonThemeMap(theme);
      expect(built.width).toBe(DUNGEON_MAP_WIDTH);
      expect(built.height).toBe(DUNGEON_MAP_HEIGHT);
      expect(built.grid.lower).toHaveLength(DUNGEON_MAP_WIDTH * DUNGEON_MAP_HEIGHT);
      expect(built.grid.upper).toHaveLength(DUNGEON_MAP_WIDTH * DUNGEON_MAP_HEIGHT);
      const decor = countUpperDecorations(built.grid);
      expect(decor).toBeGreaterThanOrEqual(18);
      expect(canReachDungeonLandmarks(built)).toBe(true);
      const summary = summarizeDungeonThemeMap(built);
      expect(summary.landmarksReachable).toBe(true);
      expect(summary.upperDecor).toBe(decor);
      expect(built.landmarks.some((l) => l.role === "exit")).toBe(true);
      expect(built.landmarks.length).toBeGreaterThanOrEqual(3);
    });
  }

  it("lava has shaped lava hazard cells and plank bridge", () => {
    const built = buildDungeonThemeMap("lava");
    const lavaBodies = built.grid.lower.filter((t) => t === 304 || (t >= 243 && t <= 335 && [243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335].includes(t)));
    expect(lavaBodies.length).toBeGreaterThan(4);
    const planks = built.grid.upper.filter((t) => t === 252 || t === 253 || t === 254);
    expect(planks.length).toBeGreaterThanOrEqual(3);
  });

  it("stone has chasm + vertical plank", () => {
    const built = buildDungeonThemeMap("stone");
    const chasm = built.grid.lower.filter((t) => t === 190 || t === 191 || t === 160 || t === 161 || t === 219 || t === 220 || t === 221);
    expect(chasm.length).toBeGreaterThan(4);
    const vPlank = built.grid.upper.filter((t) => t === 171 || t === 201 || t === 231);
    expect(vPlank.length).toBeGreaterThanOrEqual(3);
  });

  it("ice has ice hazard and floe props", () => {
    const built = buildDungeonThemeMap("ice");
    const ice = built.grid.lower.filter((t) => [9, 10, 11, 39, 40, 41, 69, 70, 71, 99, 100, 101].includes(t));
    expect(ice.length).toBeGreaterThan(4);
    const floe = built.grid.upper.filter((t) => [282, 283, 284, 312, 313, 314, 342, 343, 344].includes(t));
    expect(floe.length).toBeGreaterThanOrEqual(6);
  });
});
