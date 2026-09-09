#!/usr/bin/env node
/* Task 20 coverage audit. The plan requires this to FAIL when any audited row lacks
 * evidence or a referenced artifact is missing — not to pin prose. So it checks
 * machine-consumed facts only: every id in the fixture map is attributed, every
 * attributed artifact glob resolves to a file on disk, and declared limits are explicit.
 *
 * Run: node scripts/qa/audit-life-coverage.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const E = ".omo/evidence/life-full-20260906";
const rows = JSON.parse(readFileSync(`${E}/18/rows.json`, "utf8"));
const mapSrc = readFileSync("test/fixtures/life-full/lifeFullCoverageMap.ts", "utf8");

const failures = [];

// 1) The fixture map is the source of truth for which ids exist.
const declared = [...new Set([...mapSrc.matchAll(/\b(L0|[CRLWASK][0-9]+):/g)].map((m) => m[1]))];
const findings = [...new Set([...mapSrc.matchAll(/\b(F[0-9]{2}):/g)].map((m) => m[1]))];
if (declared.length !== 51) failures.push(`expected 51 rows in the fixture map, found ${declared.length}`);
if (findings.length !== 13) failures.push(`expected F01..F13, found ${findings.length}`);

for (const id of declared) {
  const row = rows.rows[id];
  if (!row) { failures.push(`row ${id} is not attributed in rows.json`); continue; }
  if (!row.liveEvidence) failures.push(`row ${id} has no liveEvidence`);
  if (!row.failurePathModuleTests) failures.push(`row ${id} has no failure-path coverage`);
}
for (const id of findings) {
  if (!rows.findings[id]) failures.push(`finding ${id} is not attributed`);
}
for (const id of Object.keys(rows.rows)) {
  if (!declared.includes(id)) failures.push(`row ${id} is attributed but absent from the fixture map`);
}

// 2) Every referenced artifact must exist. A missing evidence file fails the audit.
const globs = new Set();
for (const row of [...Object.values(rows.rows), ...Object.values(rows.findings)]) {
  if (row.artifacts) globs.add(row.artifacts);
}
/* Expand brace groups FIRST, then split on commas. Splitting first tore
 * "a/{x,y}.png" apart — my own parser bug, caught by this audit on its first run. */
const expand = (spec) => {
  const braced = spec.match(/^([^{]*)\{([^}]+)\}(.*)$/);
  if (!braced) return spec.split(",").map((s) => s.trim()).filter(Boolean);
  return braced[2].split(",").map((mid) => `${braced[1]}${mid.trim()}${braced[3]}`);
};

for (const glob of globs) {
  const candidates = expand(glob).flatMap((c) => c.split(",").map((s) => s.trim()).filter(Boolean));
  for (const candidate of candidates) {
    const full = candidate.startsWith(".omo/") ? candidate : join(E, candidate);
    if (full.includes("*")) {
      const dir = dirname(full);
      // Match on the literal fragments around the wildcards.
      const fragments = full.slice(dir.length + 1).split("*").filter((f) => f && f !== "-" && f !== ".");
      const hit = existsSync(dir) && readdirSync(dir).some((f) => fragments.every((frag) => f.includes(frag)));
      if (!hit) failures.push(`no artifact matches ${full}`);
    } else if (!existsSync(full)) {
      failures.push(`missing artifact ${full}`);
    }
  }
}

// 3) Limits must stay declared, so a future edit cannot quietly claim full coverage.
if (!Array.isArray(rows.honestLimits) || rows.honestLimits.length === 0) {
  failures.push("rows.json must keep an explicit honestLimits list");
}

if (failures.length) {
  console.error(`coverage audit FAILED (${failures.length})`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`coverage audit ok — ${declared.length} rows, ${findings.length} findings, ${globs.size} artifact groups verified`);
