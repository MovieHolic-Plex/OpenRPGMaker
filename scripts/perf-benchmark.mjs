import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { withTsModule } from "./ontology-ts-loader.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY_POINT = resolve(REPO_ROOT, "scripts/perf-benchmark-entry.ts");

await withTsModule(ENTRY_POINT, "perf-benchmark-entry.mjs", async (bench) => {
  const result = await runBenchmark(bench);
  printReport(result);
  const evidencePath = await writeEvidence(result);
  console.log(`\nEvidence: ${relativePath(evidencePath)}`);
  if (!result.pass) process.exitCode = 1;
});

async function runBenchmark(bench) {
  const { PERF_BUDGETS: budgets, PERF_BENCHMARK_CONFIG: config } = bench;
  const editDataPipeline = measureEditDataPipeline(bench, config);
  const renderPlan = measureRenderPlan(bench, config);
  const undoMemory = measureUndoMemory(bench, config);
  const projectLoad = measureProjectLoad(bench, config);

  const checks = {
    editDataPipelineP95: editDataPipeline.p95Ms < budgets.editDataPipelineP95Ms,
    undoMapSnapshots: undoMemory.mapSnapshots.totalBytes <= budgets.undoSnapshotBytes,
    undoProjectSnapshots: undoMemory.projectSnapshots.totalBytes <= budgets.undoSnapshotBytes,
    projectLoadP95: projectLoad.p95Ms < budgets.projectLoadP95Ms,
  };

  return {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    budgets,
    config,
    measurements: {
      editDataPipeline,
      renderPlan,
      undoMemory,
      projectLoad,
    },
    checks,
    pass: Object.values(checks).every(Boolean),
  };
}

function measureEditDataPipeline(bench, config) {
  const mapSize = config.editMapSize;
  const project = createProjectWithMaps(bench, 1, mapSize);
  const mapId = project.startMapId;
  const center = Math.floor(mapSize / 2);
  const cellIndex = center * mapSize + center;
  let emittedChanges = 0;
  const unsubscribe = bench.store.subscribe((_project, change) => {
    if (change.scope === "map" && change.mapId === mapId) emittedChanges += 1;
  });
  bench.store.replace(project);

  for (let index = 0; index < config.editWarmupIterations; index += 1) {
    paintSingleCell(bench, mapId, cellIndex, center, index);
  }
  emittedChanges = 0;

  const samples = [];
  for (let index = 0; index < config.editIterations; index += 1) {
    const started = performance.now();
    paintSingleCell(bench, mapId, cellIndex, center, index);
    samples.push(performance.now() - started);
  }
  unsubscribe();

  return {
    label: "single-cell paint data pipeline (store.updateMap map clone+emit)",
    iterations: config.editIterations,
    mapSize: `${mapSize}x${mapSize}`,
    emittedChanges,
    ...summaryMs(samples),
  };
}

function paintSingleCell(bench, mapId, cellIndex, cellCoordinate, index) {
  bench.store.updateMap(mapId, (draftMap) => {
    draftMap.lowerTiles[cellIndex] = index % 2 === 0 ? 101 : 102;
  }, {
    cells: [{ x: cellCoordinate, y: cellCoordinate, layer: "lower" }],
  });
}

function measureRenderPlan(bench, config) {
  const mapId = "map_perf_render_plan";
  const change = {
    scope: "map",
    mapId,
    cells: [{ x: 64, y: 64, layer: "lower" }],
  };
  const samples = [];
  for (let index = 0; index < config.renderPlanIterations; index += 1) {
    const started = performance.now();
    const plan = bench.planEditSceneRenderForStoreChange({
      change,
      currentMapId: mapId,
      canIncrementalCells: true,
    });
    if (plan.kind !== "cells") throw new Error(`unexpected render plan: ${plan.kind}`);
    samples.push(performance.now() - started);
  }
  return {
    label: "editSceneRenderPlan diff calculation only (Phaser render excluded)",
    iterations: config.renderPlanIterations,
    budgeted: false,
    ...summaryMs(samples),
  };
}

function measureUndoMemory(bench, config) {
  const project = createProjectWithMaps(
    bench,
    config.undoProjectMapCount,
    config.undoProjectMapSize
  );
  const mapIds = Object.keys(project.maps);
  const targetMapId = project.startMapId;
  const mapSnapshots = [];
  const projectSnapshots = [];

  for (let index = 0; index < config.undoSnapshotCount; index += 1) {
    project.maps[targetMapId].lowerTiles[index] = 200 + index;
    mapSnapshots.push({
      kind: "map",
      mapId: targetMapId,
      before: structuredClone(project.maps[targetMapId]),
    });
  }

  for (let index = 0; index < config.undoSnapshotCount; index += 1) {
    const mapId = mapIds[index % mapIds.length];
    project.maps[mapId].upperTiles[index] = 300 + index;
    projectSnapshots.push({
      kind: "project",
      before: structuredClone(project),
    });
  }

  return {
    mapSnapshots: snapshotBytes(mapSnapshots),
    projectSnapshots: snapshotBytes(projectSnapshots),
  };
}

function measureProjectLoad(bench, config) {
  const project = createProjectWithMaps(
    bench,
    config.projectLoadMapCount,
    config.projectLoadMapSize
  );
  const serialized = bench.serialize(project);
  const samples = [];
  for (let index = 0; index < config.projectLoadIterations; index += 1) {
    const started = performance.now();
    const loaded = bench.deserialize(serialized);
    if (Object.keys(loaded.maps).length !== config.projectLoadMapCount) {
      throw new Error("project load benchmark returned an unexpected map count");
    }
    samples.push(performance.now() - started);
  }
  return {
    label: "deserialize+validate project JSON",
    iterations: config.projectLoadIterations,
    maps: config.projectLoadMapCount,
    mapSize: `${config.projectLoadMapSize}x${config.projectLoadMapSize}`,
    serializedBytes: byteLength(serialized),
    ...summaryMs(samples),
  };
}

function createProjectWithMaps(bench, mapCount, mapSize) {
  const project = bench.createBlankProject();
  const maps = [];
  for (let index = 0; index < mapCount; index += 1) {
    const map = bench.createBlankMap(`Perf Map ${index + 1}`, mapSize, mapSize);
    map.id = `perf_map_${mapSize}_${index + 1}`;
    map.name = `Perf Map ${index + 1}`;
    fillMapPattern(map, index);
    maps.push(map);
  }
  const startMap = maps[0];
  if (!startMap) throw new Error("benchmark project needs at least one map");
  project.maps = Object.fromEntries(maps.map((map) => [map.id, map]));
  project.mapConnections = [];
  project.villageInfoDocuments = [];
  project.quests = [];
  project.testPresets = [];
  project.mapTree = {
    mapId: startMap.id,
    children: maps.slice(1).map((map) => ({ mapId: map.id, children: [] })),
  };
  project.startMapId = startMap.id;
  project.startPos = { x: Math.floor(mapSize / 2), y: Math.floor(mapSize / 2) };
  project.meta = {
    ...project.meta,
    title: `Perf ${mapCount}x${mapSize}`,
  };
  return project;
}

function fillMapPattern(map, salt) {
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    map.lowerTiles[index] = (index + salt) % 7 === 0 ? 101 : 1;
    map.upperTiles[index] = (index + salt) % 23 === 0 ? 201 : -1;
  }
}

function snapshotBytes(snapshots) {
  const entries = snapshots.map((snapshot) => byteLength(JSON.stringify(snapshot.before)));
  return {
    count: snapshots.length,
    totalBytes: entries.reduce((sum, value) => sum + value, 0),
    averageBytes: Math.round(entries.reduce((sum, value) => sum + value, 0) / Math.max(1, entries.length)),
    maxBytes: Math.max(...entries),
  };
}

function summaryMs(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: roundMs(sorted[sorted.length - 1] ?? 0),
  };
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return roundMs(sorted[index]);
}

function roundMs(value) {
  return Math.round(value * 1000) / 1000;
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

async function writeEvidence(result) {
  const evidenceDir = resolve(REPO_ROOT, "evidence/perf");
  await mkdir(evidenceDir, { recursive: true });
  const evidencePath = resolve(evidenceDir, `${result.generatedAt}.json`);
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return evidencePath;
}

function printReport(result) {
  const { budgets, measurements, checks } = result;
  console.log("OPRN performance benchmark");
  console.log(`Generated: ${result.generatedAt}`);
  console.log("");
  printTable([
    ["Metric", "p50", "p95", "max", "Budget", "Result"],
    [
      "Data pipeline paint",
      ms(measurements.editDataPipeline.p50Ms),
      ms(measurements.editDataPipeline.p95Ms),
      ms(measurements.editDataPipeline.maxMs),
      `< ${budgets.editDataPipelineP95Ms} ms p95`,
      passFail(checks.editDataPipelineP95),
    ],
    [
      "Render diff plan",
      ms(measurements.renderPlan.p50Ms),
      ms(measurements.renderPlan.p95Ms),
      ms(measurements.renderPlan.maxMs),
      "informational",
      "INFO",
    ],
    [
      "Project load",
      ms(measurements.projectLoad.p50Ms),
      ms(measurements.projectLoad.p95Ms),
      ms(measurements.projectLoad.maxMs),
      `< ${budgets.projectLoadP95Ms} ms p95`,
      passFail(checks.projectLoadP95),
    ],
  ]);
  console.log("");
  printTable([
    ["Undo snapshot set", "Count", "Total", "Average", "Max", "Budget", "Result"],
    memoryRow("Map-kind", measurements.undoMemory.mapSnapshots, budgets.undoSnapshotBytes, checks.undoMapSnapshots),
    memoryRow("Project-kind", measurements.undoMemory.projectSnapshots, budgets.undoSnapshotBytes, checks.undoProjectSnapshots),
  ]);
}

function memoryRow(label, measurement, budgetBytes, pass) {
  return [
    label,
    String(measurement.count),
    bytes(measurement.totalBytes),
    bytes(measurement.averageBytes),
    bytes(measurement.maxBytes),
    `<= ${bytes(budgetBytes)}`,
    passFail(pass),
  ];
}

function printTable(rows) {
  const widths = rows[0].map((_cell, column) => Math.max(...rows.map((row) => String(row[column]).length)));
  for (const row of rows) {
    console.log(row.map((cell, column) => String(cell).padEnd(widths[column])).join(" | "));
  }
}

function passFail(value) {
  return value ? "PASS" : "FAIL";
}

function ms(value) {
  return `${value.toFixed(3)} ms`;
}

function bytes(value) {
  const mib = value / (1024 * 1024);
  return `${mib.toFixed(2)} MiB`;
}

function relativePath(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}
