#!/usr/bin/env node
// LOC Gate: blocks new src/ files over 1000 lines (hard ceiling).
// Existing violations are grandfathered in the allowlist below.
// New files over 500 lines get a warning.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const HARD_CEILING = 1000;
const WARN_THRESHOLD = 500;

const ALLOWLIST = new Set([
  "src/editor/content/largeRiverMarketVillageBuild.ts",
  "src/editor/interiorRoomPipeline.ts",
  "src/editor/panels/aiChatPanel.ts",
  "src/ai/assistantSession.ts",
  "src/editor/panels/eventEditor/commandBodyM2Page3.ts",
  "src/editor/tools/eventTools.ts",
  "src/testing/sceneTestRunner.ts",
  "src/project/defaults/defaultDatabaseItemRecords.ts",
  "src/editor/panels/eventEditor/commandBodyDatabase.ts",
  "src/editor/tools/village/builder.ts",
  "src/editor/panels/eventEditor/commandBodyCommerce.ts",
  "src/editor/EditScene.ts",
  "src/editor/panels/eventEditor/commandBodyAdvanced.ts",
  "src/battle/runtime.ts",
  "src/editor/tools/mapTools.ts",
  "src/editor/panels/eventEditor/commandBodyPage3Native.ts",
  "src/editor/tools/villageSession.ts",
  "src/editor/panels/eventEditor/commandPreview.ts",
  "src/editor/panels/eventEditor/commandBodyM2Actor.ts",
  "src/editor/panels/eventEditor/commandSummary.ts",
  "src/project/defaults/chipsetMapping.ts",
  "src/editor/tools/dbTools.ts",
  "src/editor/houseInteriors.ts",
]);

function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkDir(full, files);
    } else if (extname(full) === ".ts" || extname(full) === ".tsx") {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walkDir(SRC_DIR);
let violations = 0;
let warnings = 0;

for (const file of allFiles) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n").length;

  if (lines > HARD_CEILING && !ALLOWLIST.has(rel)) {
    console.error(`FAIL: ${rel} has ${lines} lines (ceiling: ${HARD_CEILING}). Split this file or add to allowlist with justification.`);
    violations++;
  } else if (lines > WARN_THRESHOLD && !ALLOWLIST.has(rel)) {
    console.warn(`WARN: ${rel} has ${lines} lines (threshold: ${WARN_THRESHOLD}). Consider splitting.`);
    warnings++;
  }
}

if (violations > 0) {
  console.error(`\n${violations} file(s) exceed the ${HARD_CEILING}-line ceiling and are not in the allowlist.`);
  process.exit(1);
}

console.log(`LOC gate: ${allFiles.length} files checked, ${violations} violations, ${warnings} warnings, ${ALLOWLIST.size} allowlisted.`);
process.exit(0);
