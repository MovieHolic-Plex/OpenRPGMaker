import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const out = ".omo/evidence/life-full-20260906/10/date-fix";
const sourceHash = () => createHash("sha256").update(readFileSync("src/project/seasonalForage.ts")).digest("hex");
const sourceBefore = sourceHash();
const related = ["lifeFieldInteraction", "p2LifeRuntime", "p2HostileAudit", "seasonalForage", "lifeSkillDisabledHarvest", "toolActionAuthoringParity", "p0ToolCapability", "farmingRuntime", "cropRegrowthContract", "playSceneFarmFeedback", "playScenePlaceableOverlay", "p2SpatialPlayIntegration", "lifeQaObservability", "actionDebounceFootprint", "npcActionFacing", "sceneTestRunner", "makerClockIntegration"].map(name => `test/${name}.test.ts`);
const checks = [
  ["focused", 300, "npm", ["test", "--", "test/lifeFieldInteraction.test.ts"]],
  ["related", 300, "npm", ["test", "--", ...related]],
  ["public", 300, "node", [`${out}/green-public/forage-date.mjs`]],
  ["native", 300, "node", [`${out}/player.mjs`]],
  ["typecheck", 300, "npm", ["run", "typecheck:app"]],
  ["build", 600, "npm", ["run", "build"]],
];
const rows = [];
for (const [name, budget, command, args] of checks) {
  const argv = ["--timeout", "900", "/tmp/rpg-zzu-life-full-qa-01a0727b.lock", "timeout", `${budget}s`, command, ...args];
  const started = new Date().toISOString();
  const result = spawnSync("flock", argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const raw = (result.stdout ?? "") + (result.stderr ?? "");
  writeFileSync(`${out}/${name}.txt.gz`, gzipSync(raw));
  const row = { name, command: ["flock", ...argv], cwd: process.cwd(), started, ended: new Date().toISOString(), exit: result.status, signal: result.signal,
    error: result.error?.message, rawSha256: createHash("sha256").update(raw).digest("hex") };
  rows.push(row); console.log(JSON.stringify(row)); console.log(raw.slice(-2200));
  writeFileSync(`${out}/execution.json`, JSON.stringify({ sourceBefore, sourceAfter: sourceHash(), rows }, null, 2) + "\n");
  if (sourceHash() !== sourceBefore) throw new Error("Source changed during verification");
  // Retain the wider suite's known failures verbatim, without treating exit1 as green.
  if (result.status !== 0 && !(name === "related" && result.status === 1)) process.exit(result.status ?? 1);
}
