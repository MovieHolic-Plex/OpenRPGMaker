import assert from "node:assert/strict";
import { createServer } from "vite";

// Real product API, in-memory projects only. No store or DB persistence.
const server = await createServer({
  configFile: false,
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { runAuthorVillage, AUTHOR_VILLAGE_TOOL } = await server.ssrLoadModule("/src/editor/tools/authorVillageTool.ts");
  const { createEmptyToolProject } = await server.ssrLoadModule("/src/editor/tools/emptyProject.ts");
  const { captureHouseProtection } = await server.ssrLoadModule("/src/editor/tools/houseProtection.ts");
  const { repairTreePairsOnProject } = await server.ssrLoadModule("/src/project/lint/repairTreePairs.ts");
  const reports = [];
  for (const snow of [false, true]) {
    const ctx = { project: createEmptyToolProject(snow ? "snow smoke" : "ordinary smoke") };
    let sealed;
    const originalRun = AUTHOR_VILLAGE_TOOL.run;
    // Observe the returned producer values before the unchanged global runner hook.
    AUTHOR_VILLAGE_TOOL.run = (draft, args) => {
      const result = originalRun(draft, args);
      sealed = captureHouseProtection(draft);
      return result;
    };
    let result;
    const mapId = snow ? "map_winter_city" : "map_existing";
    try {
      result = runAuthorVillage(ctx, {
        target: { kind: "new", mapId, name: mapId, width: snow ? 100 : 50, height: snow ? 100 : 50 },
        houseCount: snow ? 20 : 4, npcCount: snow ? 50 : 6,
        countPolicy: "exact", seed: snow ? 41 : 7, interior: false,
        ...(snow ? { groundTheme: "snow", settlementLayout: "street-grid" } : {}),
      });
    } finally {
      AUTHOR_VILLAGE_TOOL.run = originalRun;
    }
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.equal(sealed.length, snow ? 20 : 4);
    assert.deepEqual(captureHouseProtection(ctx.project), sealed);
    const reloaded = JSON.parse(JSON.stringify(ctx.project));
    repairTreePairsOnProject(reloaded);
    assert.deepEqual(captureHouseProtection(reloaded), sealed);
    const map = ctx.project.maps[mapId];
    const [x, y] = snow ? [72, 42] : [28, 8];
    reports.push({ mapId, width: map.width, height: map.height, ok: result.ok,
      houses: sealed.length, protectedCells: sealed.reduce((n, h) => n + h.cells.length, 0),
      exactLayersAndStacksRetained: true, jsonReloadAndRepairRetained: true,
      formerConflict: { x, y, lower: map.lowerTiles[y * map.width + x], upper: map.upperTiles[y * map.width + x] },
      construction: result.data.construction,
    });
  }
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await server.close();
}
