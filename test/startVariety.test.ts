import { describe, expect, it } from "vitest";
import { briefTilesetHint, planStart, START_FORMS_BY_THEME, START_TERRAINS_BY_THEME, startPlanPrompt } from "@/project/startVariety";
import { paintStartRoute, routeStyleFor, startMapSizeFor } from "@/project/startRoutePaint";

describe("planStart", () => {
  it("is deterministic for the same seed text and differs between texts", () => {
    expect(planStart({ seedText: "concept:a" })).toEqual(planStart({ seedText: "concept:a" }));
    const shapes = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(planStart({ seedText: `concept:${i}` }))));
    expect(shapes.size).toBeGreaterThan(40);
  });

  it("keeps route geometry inside the map and bends the road by at most 3 rows", () => {
    for (let i = 0; i < 200; i++) {
      const plan = planStart({ seedText: `x${i}` });
      expect(plan.routeW).toBeGreaterThanOrEqual(22);
      expect(plan.routeW).toBeLessThanOrEqual(34);
      expect(plan.routeH).toBeGreaterThanOrEqual(10);
      expect(plan.routeH).toBeLessThanOrEqual(16);
      expect(plan.entryY).toBeGreaterThanOrEqual(3);
      expect(plan.entryY).toBeLessThanOrEqual(plan.routeH - 4);
      expect(plan.endY).toBeGreaterThanOrEqual(3);
      expect(plan.endY).toBeLessThanOrEqual(plan.routeH - 4);
      expect(Math.abs(plan.endY - plan.entryY)).toBeLessThanOrEqual(3);
    }
  });

  it("only picks themes/forms/terrains the village builder accepts, and never defaults to plaza", () => {
    for (let i = 0; i < 300; i++) {
      const plan = planStart({ seedText: `y${i}`, stageText: i % 3 === 0 ? "눈 덮인 설원 마을" : i % 3 === 1 ? "사막 오아시스" : undefined });
      expect(START_FORMS_BY_THEME[plan.theme]).toContain(plan.form);
      expect(START_TERRAINS_BY_THEME[plan.theme]).toContain(plan.terrain);
      expect(plan.form).not.toBe("plaza");
    }
  });

  it("uses desert/snow/swamp only when the stage names them", () => {
    for (let i = 0; i < 100; i++) expect(["river", "coast"]).toContain(planStart({ seedText: `z${i}`, stageText: "방과 후 연금술 동아리" }).theme);
    expect(planStart({ seedText: "q", stageText: "설원 위의 항구" }).theme).toBe("snow");
  });

  it("prebuilds the beodeul town only when the concept has no other tileset", () => {
    expect(planStart({ seedText: "a" }).prebuildTown).toBe(true);
    expect(planStart({ seedText: "a", tilesetHint: "beodeul_city" }).prebuildTown).toBe(true);
    expect(planStart({ seedText: "a", tilesetHint: "jp_city" })).toMatchObject({ prebuildTown: false, tilesetId: "jp_city" });
  });

  it("reads the tileset line of a concept brief", () => {
    expect(briefTilesetHint("컨셉: x\n타일셋: jp_city (이 공용 번들 타일셋으로 맵을 깐다)\n주인공: y")).toBe("jp_city");
    expect(briefTilesetHint("컨셉: x")).toBeUndefined();
  });
});

describe("start prompt and kit maps", () => {
  it("never tells a kit concept to rebuild the start map with the beodeul tool", () => {
    for (const tilesetId of ["jp_city", "joseon_baram", "wizarding_world"]) {
      const text = startPlanPrompt(planStart({ seedText: "k", tilesetHint: tilesetId }));
      expect(text).toContain(tilesetId);
      expect(text).not.toContain("author_beodeul_town({");
    }
    expect(startPlanPrompt(planStart({ seedText: "k" }))).toContain("author_beodeul_town");
  });

  it("gives kit start maps room for a street and buildings", () => {
    for (const tilesetId of ["jp_city", "joseon_baram", "wizarding_world"]) {
      const size = startMapSizeFor(tilesetId, planStart({ seedText: "s", tilesetHint: tilesetId }))!;
      expect(size.width).toBeGreaterThanOrEqual(48);
      expect(size.height).toBeGreaterThanOrEqual(34);
    }
    expect(startMapSizeFor("beodeul_city", planStart({ seedText: "s" }))).toBeUndefined();
  });

  it("covers the entry cell, the end-event cell and bends between them", () => {
    const plan = planStart({ seedText: "p", tilesetHint: "joseon_baram" });
    const route = { width: plan.routeW, height: plan.routeH, entryY: plan.entryY, endY: plan.endY };
    const painted = new Set<string>();
    paintStartRoute((rect, _material, optional) => {
      if (optional) return;
      for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) painted.add(`${x},${y}`);
    }, routeStyleFor("joseon_baram")!, plan, route);
    expect(painted.has(`0,${route.entryY}`)).toBe(true);
    expect(painted.has(`${route.width - 2},${route.endY}`)).toBe(true);
  });
});
