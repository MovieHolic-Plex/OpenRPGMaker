#!/usr/bin/env node
// Supabase Content Gate: scans committed fixture/demo JSON for remotePersistenceEnabled=false
// without a .supabase-waiver marker. Enforces the AGENTS.md hard rule that authored content
// must be saved to Supabase, not just committed as local fixtures.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = [
  join(ROOT, "test", "fixtures", "projects"),
  join(ROOT, "src", "project", "defaults", "fixtures"),
];

let violations = 0;

function scanJson(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      scanJson(full);
      continue;
    }
    if (!entry.endsWith(".json")) continue;

    const rel = full.replace(ROOT + "/", "").replace(/\\/g, "/");
    const content = readFileSync(full, "utf-8");

    // Check for remotePersistenceEnabled: false
    if (/remotePersistenceEnabled["']?\s*[:=]\s*(false|0|"false")/i.test(content)) {
      // Check for waiver file
      const waiverPath = full + ".supabase-waiver";
      if (existsSync(waiverPath)) continue;

      console.error(`FAIL: ${rel} has remotePersistenceEnabled=false without a .supabase-waiver file.`);
      console.error(`  AGENTS.md hard rule: authored content must be saved to Supabase, not just committed as fixtures.`);
      console.error(`  If this is a legitimate unit-test fixture (not a demo/game), create ${rel}.supabase-waiver with a reason.`);
      violations++;
    }
  }
}

for (const dir of SCAN_DIRS) {
  scanJson(dir);
}

if (violations > 0) {
  console.error(`\n${violations} file(s) violate the Supabase content gate.`);
  process.exit(1);
}

console.log("Supabase content gate: no violations found.");
process.exit(0);
