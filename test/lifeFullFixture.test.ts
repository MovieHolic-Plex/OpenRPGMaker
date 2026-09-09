import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { Project } from "@/project/types";
import {
  createLifeFullFixture,
  LIFE_FULL_DETERMINISM,
  LIFE_FULL_PENDING_STARTER_ROWS,
  LIFE_FULL_REQUIRED_ITEM_IDS,
  LIFE_FULL_REQUIRED_MAP_IDS,
  LIFE_FULL_SCENARIOS,
} from "./fixtures/life-full/lifeFullProject";
import {
  LIFE_FULL_FEATURE_SCENARIOS,
  LIFE_FULL_FINDING_SCENARIOS,
} from "./fixtures/life-full/lifeFullCoverageMap";

const coverage = JSON.parse(
  readFileSync(join(__dirname, "fixtures/life-full/coverage.json"), "utf8"),
) as {
  features: { id: string }[];
  findings: { id: string }[];
};

const scenarioIds = new Set<string>(Object.values(LIFE_FULL_SCENARIOS));

describe("life-full deterministic fixture", () => {
  it("is a valid project that round-trips through the real serializer", () => {
    const project = createLifeFullFixture();
    expect(collectProjectReferenceIssues(project)).toEqual([]);

    const once = serialize(project);
    const restored = deserialize(once);
    expect(collectProjectReferenceIssues(restored)).toEqual([]);

    // Deserialize normalizes (fills record defaults and reorders optional keys such
    // as farmBuildingTypes[].allowedMapIds), so the FIRST pass is intentionally not
    // byte-identical. What the harness actually depends on is that normalization is
    // idempotent and lossless, so assert both instead of raw byte equality.
    const twice = serialize(restored);
    expect(serialize(deserialize(twice))).toBe(twice);

    // Lossless for the fields the fixture's scenarios rely on.
    const mapAllowed = (p: Project) =>
      (p.database.farmBuildingTypes ?? []).map((t) => [t.id, t.allowedMapIds ?? []] as const);
    expect(mapAllowed(restored)).toEqual(mapAllowed(project));
    const decorAllowed = (p: Project) =>
      (p.database.homeDecorationTypes ?? []).map((t) => [t.id, t.allowedMapIds ?? []] as const);
    expect(decorAllowed(restored)).toEqual(decorAllowed(project));
    expect(restored.system.craftRecipes).toEqual(project.system.craftRecipes);
    expect(restored.system.bundles).toEqual(project.system.bundles);
    expect(restored.session.inventory).toEqual(project.session.inventory);
  });

  it("pins the determinism knobs the harness depends on", () => {
    const project = createLifeFullFixture();
    expect(project.startPos).toEqual(LIFE_FULL_DETERMINISM.startPos);
    expect(project.system.timeSystem?.enabled).toBe(true);
    expect(project.system.timeSystem?.dayStartHour).toBe(LIFE_FULL_DETERMINISM.dayStartHour);
    expect(project.system.timeSystem?.dayEndHour).toBe(LIFE_FULL_DETERMINISM.dayEndHour);
    expect(project.system.energy?.max).toBe(LIFE_FULL_DETERMINISM.energyMax);
    expect(project.system.energy?.initial).toBe(LIFE_FULL_DETERMINISM.energyInitial);
  });

  it("carries no injected runtime results", () => {
    const project = createLifeFullFixture();
    // Gated recipes must still be locked; unlocking is earned by playing.
    expect(project.session.unlockedRecipeIds ?? []).toEqual([]);
    // No pre-staged maker outputs and no pre-harvested goods in starting inventory.
    for (const output of ["item_pickled_potato", "item_iron_bar", "item_preserves_jar"]) {
      expect(project.session.inventory[output] ?? 0).toBe(0);
    }
  });

  it("keeps the authorable starter's life economy intact", () => {
    const project = createLifeFullFixture();
    // The ordinary starter authors these; the fixture must extend, not replace.
    expect((project.system.craftRecipes ?? []).length).toBeGreaterThan(0);
    expect((project.system.itemUpgrades ?? []).length).toBeGreaterThan(0);
    expect((project.system.makers ?? []).length).toBeGreaterThan(0);
    expect((project.database.lifeSkills ?? []).length).toBeGreaterThan(0);
    // A bundle must actually open a real path (switch or world unlock reward).
    const bundles = project.system.bundles ?? [];
    const opensPath = bundles.some(
      (bundle) => bundle.reward?.switchId || (bundle.reward?.worldUnlockIds ?? []).length > 0,
    );
    expect(opensPath).toBe(true);
    // The gated recipe branch must exist so "locked" failure is reachable.
    expect((project.system.craftRecipes ?? []).some((r) => r.requiresUnlock === true)).toBe(true);
  });

  it("maps every one of the 51 coverage rows and F01..F13 to a real scenario", () => {
    const featureIds = coverage.features.map((f) => f.id);
    expect(featureIds).toHaveLength(51);

    // Total: every audited row is mapped, and nothing unknown is mapped.
    expect(Object.keys(LIFE_FULL_FEATURE_SCENARIOS).sort()).toEqual([...featureIds].sort());
    expect(Object.keys(LIFE_FULL_FINDING_SCENARIOS).sort()).toEqual(
      coverage.findings.map((f) => f.id).sort(),
    );

    for (const [id, scenario] of Object.entries(LIFE_FULL_FEATURE_SCENARIOS)) {
      expect(scenarioIds.has(scenario), `${id} -> unknown scenario ${scenario}`).toBe(true);
    }
    for (const [id, scenario] of Object.entries(LIFE_FULL_FINDING_SCENARIOS)) {
      expect(scenarioIds.has(scenario), `${id} -> unknown scenario ${scenario}`).toBe(true);
    }
    // Every declared scenario must be used by at least one row — no dead scenarios.
    const used = new Set([
      ...Object.values(LIFE_FULL_FEATURE_SCENARIOS),
      ...Object.values(LIFE_FULL_FINDING_SCENARIOS),
    ]);
    expect([...scenarioIds].filter((id) => !used.has(id))).toEqual([]);
  });

  it("carries the real starter tree that C6/L5/F06 depend on", () => {
    const project = createLifeFullFixture();
    // Task 81 landed and was proven on the shipped player (npm run qa:runtime --scenario
    // life-tree-chop): the ordinary starter now authors one choppable tree. These rows are
    // therefore no longer pending — assert the real resource exists rather than asserting
    // its absence, which is the stronger claim.
    for (const row of LIFE_FULL_PENDING_STARTER_ROWS) {
      expect(LIFE_FULL_FEATURE_SCENARIOS[row] ?? LIFE_FULL_FINDING_SCENARIOS[row]).toBe(
        LIFE_FULL_SCENARIOS.treeChop,
      );
    }
    const trees = Object.values(project.session.placeables ?? {})
      .filter((placeable) => (placeable as { kind?: string }).kind === "tree");
    expect(trees).toHaveLength(1);
    expect(trees[0]).toMatchObject({ kind: "tree", itemId: "item_wood", x: 6, y: 11 });
    // The chop must still be EARNED: no wood and no foraging XP are pre-granted.
    expect(project.session.inventory.item_wood ?? 0).toBe(0);
    expect(project.session.inventory.item_axe).toBe(1);
  });

  describe("validator rejects a fixture missing a required piece", () => {
    const clone = (project: Project): Project => JSON.parse(JSON.stringify(project)) as Project;

    it("fails when a required item is removed", () => {
      const project = clone(createLifeFullFixture());
      const removed = LIFE_FULL_REQUIRED_ITEM_IDS[0];
      project.database.items = project.database.items.filter((item) => item.id !== removed);
      expect(collectProjectReferenceIssues(project).length).toBeGreaterThan(0);
    });

    it("fails when a required map is removed", () => {
      const project = clone(createLifeFullFixture());
      for (const mapId of LIFE_FULL_REQUIRED_MAP_IDS) delete project.maps[mapId];
      expect(collectProjectReferenceIssues(project).length).toBeGreaterThan(0);
    });

    it("fails when a reference target is removed", () => {
      const project = clone(createLifeFullFixture());
      // Crop records reference seed/harvest items by id; drop the harvest target.
      const crop = (project.database.crops ?? [])[0];
      expect(crop).toBeDefined();
      project.database.items = project.database.items.filter((item) => item.id !== crop!.harvestItemId);
      expect(collectProjectReferenceIssues(project).length).toBeGreaterThan(0);
    });
  });
});
