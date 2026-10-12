import { describe, expect, it } from "vitest";
import { planJpCityStreet, runJpStreetPlan, shopsFromText, streetStyleFromText } from "@/project/jpCityStreetComposer";

describe("jp_city street composer", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const a = planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 3 });
    expect(planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 3 })).toEqual(a);
    const shapes = new Set(Array.from({ length: 20 }, (_, i) => planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: i }).summary));
    expect(shapes.size).toBeGreaterThan(14);
  });

  it("puts requested shops first and keeps buildings inside the rows", () => {
    const plan = planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 5, shops: ["ramen", "konbini"] });
    expect(plan.summary).toMatch(/ramen/);
    for (const step of plan.steps) if (step.tool === "build_jp_city_building") {
      const { x, w, y } = step.args as { x: number; w: number; y: number };
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(52);
      expect(y).toBeLessThan(34);
    }
  });

  it("tries candidate buildings in order and stops at the first success", () => {
    const plan = planJpCityStreet({ mapId: "m", width: 52, height: 34, seed: 1 });
    const seen: string[] = [];
    let fails = 0;
    const outcome = runJpStreetPlan(plan, (tool, args) => {
      if (tool !== "build_jp_city_building") return;
      if (fails++ % 3 !== 2) throw new Error("rejected");
      seen.push(`${args.x},${args.y}`);
    });
    expect(outcome.built).toBe(new Set(seen).size);
    expect(outcome.built).toBeGreaterThan(5);
  });

  it("reads shop words and style from a brief", () => {
    expect(shopsFromText("편의점 야간알바가 본 살인, 라멘집과 카페")).toEqual(["konbini", "ramen", "cafe"]);
    expect(streetStyleFromText("조용한 주택가 골목")).toBe("residential");
    expect(streetStyleFromText("번화한 상가 거리")).toBe("shopping");
  });
});
