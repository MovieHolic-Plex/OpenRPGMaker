#!/usr/bin/env node
// Plan stage on the VM (the 20-80 MB project.json stays next to the mirror cache).
// usage: node vm/plan-run.mjs --cache <mirror dir> --slug fallen-star --version 1.37 --out <runDir> [--max-events 120] [--sample 1]
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { planCoverage, staticLint } from "../lib/plan.mjs";

/** Story levels/gear for the game, when the pipeline ships a table for it (scripts/qa/pipeline/data/<slug>.json or story-levels.json). */
function loadStory(slug) {
  const dataDir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data");
  for (const name of [`${slug}.json`, "story-levels.json"]) {
    const file = path.join(dataDir, name);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (data.game && data.game !== slug) continue;
    return data;
  }
  return null;
}

const { values } = parseArgs({
  options: {
    cache: { type: "string", default: "/root/vqa-sinkiru/mirror" },
    slug: { type: "string" },
    version: { type: "string" },
    out: { type: "string" },
    "max-events": { type: "string", default: "120" },
    "max-jobs": { type: "string", default: "0" },
    plant: { type: "string", default: "" },
    // Re-lint a planted project.json in place of the shipped one (jobs.json is left untouched).
    "lint-only": { type: "string", default: "" },
  },
});
if (values["lint-only"]) {
  const planted = JSON.parse(fs.readFileSync(values["lint-only"], "utf8"));
  const lint = staticLint(planted, { game: values.slug });
  fs.writeFileSync(path.join(values.out, "static.json"), JSON.stringify(lint, null, 1));
  console.log("LINT " + JSON.stringify({ staticFindings: lint.length }));
  process.exit(0);
}
const project = JSON.parse(fs.readFileSync(path.join(values.cache, values.slug, values.version, "project.json"), "utf8"));
fs.mkdirSync(values.out, { recursive: true });
const story = loadStory(values.slug);
let jobs = planCoverage(project, { game: values.slug, maxEvents: Number(values["max-events"]), story })
  .map((job) => ({ ...job, slug: values.slug, version: values.version, ...(values.plant ? { plant: values.plant } : {}) }));
const max = Number(values["max-jobs"]);
if (max > 0 && jobs.length > max) {
  // Keep kind diversity when capping: round-robin over kinds.
  const byKind = new Map();
  for (const job of jobs) byKind.set(job.kind, [...(byKind.get(job.kind) ?? []), job]);
  const picked = [];
  while (picked.length < max) {
    let added = false;
    for (const list of byKind.values()) if (list.length && picked.length < max) { picked.push(list.shift()); added = true; }
    if (!added) break;
  }
  jobs = picked;
}
const lint = staticLint(project, { game: values.slug });
fs.writeFileSync(path.join(values.out, "jobs.json"), JSON.stringify(jobs, null, 1));
fs.writeFileSync(path.join(values.out, "static.json"), JSON.stringify(lint, null, 1));
const count = (key) => Object.fromEntries([...new Set(jobs.map((j) => j[key]))].map((k) => [k, jobs.filter((j) => j[key] === k).length]));
const coverage = {
  maps: Object.keys(project.maps).length,
  plannedMaps: new Set(jobs.filter((j) => j.target?.mapId).map((j) => j.target.mapId)).size,
  troops: project.database.troops.length,
  plannedBattles: jobs.filter((j) => j.kind === "battle").length,
  plannedBattleTroops: new Set(jobs.filter((j) => j.kind === "battle").map((j) => j.target.troopId)).size,
  battleStates: Object.fromEntries([...new Set(jobs.filter((j) => j.kind === "battle").map((j) => j.target.state))].map((s) => [s, jobs.filter((j) => j.kind === "battle" && j.target.state === s).length])),
  checkpointLevels: [...new Set(jobs.map((j) => j.checkpoint?.party?.[0]?.level).filter((v) => typeof v === "number"))].sort((a, b) => a - b),
  storyTable: story ? { troops: Object.keys(story.byTroop ?? {}).length, source: story.source } : null,
  byKind: count("kind"), byInput: count("input"), byViewport: count("viewportName"),
  staticFindings: lint.length,
};
fs.writeFileSync(path.join(values.out, "coverage-plan.json"), JSON.stringify(coverage, null, 1));
console.log("PLAN " + JSON.stringify(coverage));
