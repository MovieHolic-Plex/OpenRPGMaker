// Round-by-round table for the 버들항 assistant runs: the round-3 columns plus the city-form measures (src/editor/tools/cityForm.ts).
// Older rounds had no city-form measure, so every map.json is measured again here with the same ruler (kit stamps found from the cells).
//   bun scripts/qa/beodeul-compare-rounds.mts r3 r4   → verify-shots/beodeul-assistant-<last>/compare.json + stdout table
import fs from "node:fs";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { analyzeCityForm } from "../../src/editor/tools/cityForm.ts";
import { emptinessOf } from "../content/lib/beodeul-metrics.ts";

const rounds = process.argv.slice(2);
const project: any = createBlankProject(); ensureBundledTilesets(project);
const ts = project.tilesets.beodeul_city;
const rows: Record<string, unknown>[] = [];
for (const round of rounds) for (const label of ["fresh", "existing"]) {
  const dir = `verify-shots/beodeul-assistant-${round}/${label}`;
  if (!fs.existsSync(`${dir}/summary.json`)) continue;
  const s = JSON.parse(fs.readFileSync(`${dir}/summary.json`, "utf8"));
  const m = JSON.parse(fs.readFileSync(`${dir}/map.json`, "utf8"));
  const map = { ...m, tilesetId: "beodeul_city", events: [] };
  const cf = analyzeCityForm(project, map);
  const e = emptinessOf(map, ts);
  const met = s.metrics; const by = s.byTool ?? {};
  rows.push({
    round, label, min: +(s.ms / 60000).toFixed(1), timedOut: s.ms >= 2_990_000, turns: s.stats?.turns, calls: s.toolCalls, failed: s.failed,
    stamp: by.stamp_object ?? 0, fill: by.fill_region ?? 0, readRefs: (by.read_tileset_reference ?? 0) + (by.list_tileset_references ?? 0),
    checkCityForm: by.check_city_form ?? 0, inputTokens: s.stats?.usage?.input, inputPerTurn: s.stats?.turns ? Math.round((s.stats.usage.input ?? 0) / s.stats.turns) : null,
    blocks: cf.blocks.count, blockIds: cf.blocks.distinct, blockNeighbourRepeats: cf.blocks.neighbourRepeats.length, blockOverused: cf.blocks.overused.length,
    openShare: e.open.share, over40: e.open.over40, worst: e.open.worst,
    sameShare: met.originality?.sameShare, doors: met.doors, streetReach: met.streetReach?.reached,
    deadEnds: cf.deadEnds.length, longStraight: cf.lines.longStraight.length, longestStraight: cf.lines.longestLen,
    canalBends: cf.canal.bends, canalStraightShare: cf.canal.straightShare, canalStraight: cf.canal.straight,
    nodes: cf.nodes.length, landmarks: cf.landmarks.length, isolatedLines: cf.graph.isolated.length, meanDepth: cf.graph.meanDepth, bentStreetCells: cf.bentStreetCells, spacingCv: cf.spacing.cv,
    reload: s.reloadEqual, projectId: s.projectId, projectDir: s.projectDir,
  });
}
const out = `verify-shots/beodeul-assistant-${rounds[rounds.length - 1]}/compare.json`;
fs.writeFileSync(out, JSON.stringify(rows, null, 1));
console.table(rows.map(({ projectId: _p, projectDir: _d, ...r }) => r));
console.log("→", out);
