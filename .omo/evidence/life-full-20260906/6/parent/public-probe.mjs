import assert from "node:assert/strict";
import { createServer } from "vite";
import { resolve } from "node:path";
import { writeFileSync, rmSync } from "node:fs";

const evidence = resolve(".omo/evidence/life-full-20260906/6/parent");
const server = await createServer({
  configFile: false, cacheDir: resolve(evidence, "probe-cache"),
  resolve: { alias: { "@": resolve("src") } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom",
});
const records = [];
try {
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const { normalizeItemRecord } = await server.ssrLoadModule("/src/project/databaseRecordModel.ts");
  const { startSession } = await server.ssrLoadModule("/src/project/session.ts");
  const { interactWithFarmPlot } = await server.ssrLoadModule("/src/player/farming.ts");
  const { attemptFishingCatch } = await server.ssrLoadModule("/src/project/fishing.ts");
  const { advanceSeasonalForage, collectForageAt } = await server.ssrLoadModule("/src/project/seasonalForage.ts");
  const { ITEM_QUANTITY_MAX } = await server.ssrLoadModule("/src/project/itemQuantities.ts");
  for (const kind of (process.argv.length > 2 ? process.argv.slice(2) : ["crop", "rock", "tree", "fish", "forage"])) {
    for (const scenario of ["disabled", "omitted", "enabled", "invalid-reward", "capacity", ...(kind === "forage" ? [] : ["energy"]), ...(kind === "fish" ? ["min-skill"] : [])]) {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      assert.ok(map);
      map.farmableArea = [{ x: 0, y: 0, w: 4, h: 4 }];
      project.database.items.push(...[
        { id: "probe-drop", name: "Drop" }, { id: "probe-seed", name: "Seed", type: "seed" },
        { id: "probe-pick", name: "Pick", farmTool: "pickaxe" }, { id: "probe-axe", name: "Axe", farmTool: "axe" },
      ].map(item => normalizeItemRecord({ ...item, scope: "none" })));
      const skillType = { crop: "farming", rock: "mining", tree: "foraging", fish: "fishing", forage: "foraging" }[kind];
      project.database.lifeSkills = [{ id: "probe-skill", name: "Skill", skillType, maxLevel: 10,
        levelUpRewards: scenario === "invalid-reward" ? [{ level: 2, switchId: "absent-reward" }] : [] }];
      project.system.skillSystem = { enabled: scenario === "enabled" || scenario === "invalid-reward" };
      if (scenario === "omitted") delete project.system.skillSystem;
      project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
      project.system.energy = { max: 10, initial: 10, restorePerDay: 0 };
      project.system.collections = { enabled: true, trackedItemIds: ["probe-drop"] };
      project.database.crops = [{ id: "probe-crop", name: "Crop", seedItemId: "probe-seed", harvestItemId: "probe-drop", harvestCount: 1, stages: [{ days: 1 }], seasons: ["spring"] }];
      project.database.fishSpecies = [{ id: "probe-fish", name: "Fish", itemId: "probe-drop", skillXp: 12 }];
      project.system.fishing = { enabled: true, energyCost: 3, spots: [{ id: "probe-spot", mapId: map.id, area: { x: 0, y: 0, w: 4, h: 4 }, catches: [{ fishId: "probe-fish", weight: 1, minSkillLevel: scenario === "min-skill" ? 2 : 1 }] }] };
      project.system.seasonalForage = { enabled: true, areas: [{ id: "probe-area", mapId: map.id, area: { x: 0, y: 0, w: 4, h: 4 }, dailySpawnCount: 1, maxActive: 1, despawnAfterDays: 2, entries: [{ id: "probe-entry", itemId: "probe-drop", weight: 1 }] }] };
      const session = startSession(project, 6606);
      session.lifeSkills = { "probe-skill": { xp: 99, level: 1 } };
      let x = 1, y = 1;
      if (kind === "crop") session.farmPlots = { [map.id]: { "1,1": { tilled: true, watered: false, cropId: "probe-crop", stage: 1, growthDays: 1 } } };
      if (kind === "rock" || kind === "tree") {
        const tool = kind === "rock" ? "probe-pick" : "probe-axe";
        session.inventory[tool] = 1;
        session.equippedToolItemId = tool;
        session.placeables = { [`${map.id}:1,1`]: { id: `probe-${kind}`, kind, mapId: map.id, x, y, itemId: "probe-drop" } };
      }
      if (kind === "forage") {
        assert.equal(advanceSeasonalForage(project, session, session.gameTime).ok, true);
        const target = Object.values(session.placeables).find(entry => entry.forageSpawn);
        assert.ok(target);
        x = target.x; y = target.y;
      }
      if (scenario === "capacity") session.inventory["probe-drop"] = ITEM_QUANTITY_MAX;
      if (scenario === "energy") session.energy = 0;
      const owner = structuredClone(kind === "crop" ? session.farmPlots[map.id]["1,1"] : kind === "fish" ? project.system.fishing.spots[0] : session.placeables[`${map.id}:${x},${y}`]);
      assert.ok(owner);
      const before = structuredClone(session);
      const result = kind === "fish" ? attemptFishingCatch(project, session, { mapId: map.id, x, y })
        : kind === "forage" ? collectForageAt(project, session, map.id, x, y)
        : interactWithFarmPlot(project, session, map, x, y);
      const after = structuredClone(session);
      records.push({ kind, scenario, owner, before, result, after });
      if (["invalid-reward", "capacity", "energy", "min-skill"].includes(scenario)) {
        const reason = { "invalid-reward": "xp", capacity: "inventory", energy: "energy", "min-skill": "unavailable" }[scenario];
        if (kind === "fish" || kind === "forage") assert.deepEqual(result, { ok: false, reason });
        else assert.equal(result.reason, { xp: "invalid-life-skill", inventory: "inventory-full", energy: "insufficient-energy" }[reason]);
        assert.deepEqual(after, before);
      } else {
        assert.equal(kind === "fish" || kind === "forage" ? result.ok : result.kind === "harvested", true);
        assert.equal(session.inventory["probe-drop"], 1);
        assert.equal(session.energy, before.energy - (kind === "fish" ? 3 : kind === "forage" ? 0 : 1));
        if (scenario !== "enabled") assert.deepEqual(session.lifeSkills, before.lifeSkills);
        else assert.equal(session.lifeSkills["probe-skill"].xp, 99 + (kind === "fish" ? 12 : kind === "forage" ? 1 : 10));
        if (kind !== "fish" && kind !== "crop") assert.equal(session.placeables[`${map.id}:${x},${y}`], undefined);
        if (kind === "crop") assert.equal(session.farmPlots[map.id]["1,1"].cropId, undefined);
        if (kind === "fish") assert.equal(session.collections["probe-drop"].caughtCount, 1);
      }
    }
  }
  console.log(JSON.stringify({ publicTransactions: records.length, fullStateRecords: "public-state.json", mockedAuthorities: false, nativePlayerInput: false }));
} finally {
  writeFileSync(resolve(evidence, "public-state.json"), JSON.stringify(records, null, 2) + "\n");
  await server.close();
  rmSync(resolve(evidence, "probe-cache"), { recursive: true, force: true });
  console.log(JSON.stringify({ viteClosed: true, httpListenerStarted: false }));
}
