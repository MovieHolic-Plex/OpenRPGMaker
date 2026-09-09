#!/usr/bin/env node
/* Classify a gates run against the recorded baseline PER FILE, never by totals.
 * Totals comparison is what hid the handSlot regression earlier in this work: the run
 * had fewer failures overall while a file this branch touched had newly broken.
 *
 * Usage: node scripts/qa/classify-gates.mjs <gates-output.txt>
 */
import { readFileSync } from "node:fs";

const target = process.argv[2];
if (!target) { console.error("usage: classify-gates.mjs <gates-output.txt>"); process.exit(2); }

const baseline = JSON.parse(readFileSync(".omo/gates-baseline.json", "utf8"));
const known = new Set(baseline.tests?.failedFiles ?? []);
const log = readFileSync(target, "utf8");

// vitest prints "FAIL  <path>" lines; collect the distinct files.
const failing = new Set(
  [...log.matchAll(/(?:^|\s)(?:FAIL|❯)\s+(test\/[^\s:]+\.(?:test|spec)\.[cm]?[tj]sx?)/gm)].map((m) => m[1])
);

const newlyFailing = [...failing].filter((f) => !known.has(f)).sort();
const fixed = [...known].filter((f) => !failing.has(f)).sort();

console.log(`baselineRanAt=${baseline.ranAt}`);
console.log(`baselineFailedFiles=${known.size}`);
console.log(`currentFailedFiles=${failing.size}`);
console.log(`newlyFailingFiles=${newlyFailing.length}`);
for (const f of newlyFailing) console.log(`  NEW  ${f}`);
console.log(`noLongerFailing=${fixed.length}`);

/* Only files this branch actually touched can be blamed on it. TOUCHED_FILES must be
 * provided: leaving it unset used to make every run pass regardless of new failures,
 * which is a silent false negative (independent review). Fail closed instead. */
const touchedRaw = (process.env.TOUCHED_FILES ?? "").split(/\s+/).filter(Boolean);
if (touchedRaw.length === 0) {
  console.error("TOUCHED_FILES is empty — refusing to report a verdict.");
  console.error('Pass it explicitly, e.g. TOUCHED_FILES="$(git diff --name-only <base>..HEAD -- \'test/*.test.ts\')"');
  process.exit(2);
}
// Normalise ./test/x -> test/x so a path-style mismatch cannot hide a regression.
const touched = new Set(touchedRaw.map((f) => f.replace(/^\.\//, "")));
const mine = newlyFailing.filter((f) => touched.has(f));
console.log(`newlyFailingAndTouchedByThisBranch=${mine.length}`);
for (const f of mine) console.log(`  MINE ${f}`);

// Exit non-zero only when this branch broke something. Pre-existing red stays reported,
// never absorbed into the baseline.
process.exit(mine.length ? 1 : 0);
