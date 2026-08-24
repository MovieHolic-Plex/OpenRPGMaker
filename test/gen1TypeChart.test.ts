import { describe, expect, it } from "vitest";
import { gen1TypeModifiersForTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function projectWithChart(): Project {
  const project = deserialize(JSON.stringify(battleFixture));
  project.system.typeChart = {
    types: ["fire", "grass", "water"],
    multipliers: {
      fire: { fire: 1, grass: 2, water: 0.5 },
      grass: { fire: 0.5, grass: 1, water: 2 },
      water: { fire: 2, grass: 0.5, water: 1 },
    },
  };
  return project;
}

describe("Gen1 type modifier extraction", () => {
  it("break: exposes STAB separately and preserves dual-type factors for sequential floors", () => {
    const result = gen1TypeModifiersForTypes(
      projectWithChart(),
      "fire",
      ["fire"],
      ["grass", "water"],
    );
    expect(result).toEqual({ stab: true, typeFactors: [20, 5] });
  });

  it("break: effectiveness order follows the authored chart, not a species' type-slot order", () => {
    expect(gen1TypeModifiersForTypes(projectWithChart(), "fire", ["fire"], ["water", "grass"]))
      .toEqual({ stab: true, typeFactors: [20, 5] });
  });

  it("break: a duplicate monotype slot must not apply effectiveness twice", () => {
    const project = projectWithChart();
    expect(gen1TypeModifiersForTypes(project, "fire", [], ["grass", "grass"]))
      .toEqual({ stab: false, typeFactors: [20] });
  });

  it("keeps the existing combined multiplier API byte-for-byte compatible", () => {
    const project = projectWithChart();
    expect(typeChartMultiplierForTypes(project, "fire", ["fire"], ["grass", "water"]))
      .toBe(1.5);
  });
});
