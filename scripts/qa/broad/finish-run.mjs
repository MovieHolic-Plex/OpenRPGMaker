#!/usr/bin/env node
// 한 실행의 관찰이 끝난 뒤 로컬에서: 군집(선택) → 증거 pull → 검토(Opus→Astra→Argon) → measure.
//   node scripts/qa/broad/finish-run.mjs --host root@am3685-1 --run /root/qa-pipeline/runs/<tag> --local tmp/qa-runs/<tag> [--plant <truth.json>]
// cluster 는 VM 의 triage.mjs 를 그대로 쓴다(정본 로직 하나). static.json 이 없으면 정적 후보는 0 이다.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    host: { type: "string", default: "root@am3685-1" },
    run: { type: "string" },
    local: { type: "string" },
    plant: { type: "string", default: "" },
    pool: { type: "string", default: "6" },
    "skip-cluster": { type: "boolean", default: false },
  },
});
if (!values.run || !values.local) throw new Error("usage: finish-run.mjs --run <vmRunDir> --local <dir>");
const LOCAL = path.resolve(values.local);
fs.mkdirSync(LOCAL, { recursive: true });
const ssh = (command) => execFileSync("ssh", ["-o", "BatchMode=yes", values.host, `export PATH=/opt/node/bin:/opt/bun/bin:$PATH; set -e; ${command}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

if (!values["skip-cluster"]) {
  console.log(ssh(`cd /root/qa-pipeline/code/pipeline && node vm/triage.mjs --run ${values.run} --phase cluster`).trim());
}
// Pull metadata + every frame a candidate points at (that is all the reviewer and the report need).
const listCmd = `cd ${values.run} && node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync("candidates.json","utf8"));const s=new Set();for(const x of c)for(const f of (x.frames||[]))s.add(f.rel||("jobs/"+f.job+"/shots/"+f.file));const base=["jobs.json","static.json","coverage-plan.json","play-meta.json","detect-meta.json","cluster-meta.json","candidates.json","deterministic.json","usage.jsonl","observations.jsonl"];for(const b of base)if(fs.existsSync(b))s.add(b);fs.writeFileSync("/tmp/pull-list.txt",[...s].join("\\n"))' && tar cf /tmp/pull.tar -T /tmp/pull-list.txt && wc -l < /tmp/pull-list.txt`;
console.log("files: " + ssh(listCmd).trim());
execFileSync("bash", ["-c", `ssh -o BatchMode=yes ${values.host} 'cat ${values.run}/../pull.tar 2>/dev/null || cat /tmp/pull.tar' | tar xf - -C ${LOCAL}`], { stdio: "inherit" });

// Local paths for the reviewer (it reads frame.file).
const candidatesFile = path.join(LOCAL, "candidates.json");
const candidates = JSON.parse(fs.readFileSync(candidatesFile, "utf8"));
for (const candidate of candidates) {
  candidate.frames = (candidate.frames ?? []).map((frame) => ({ ...frame, file: path.join(LOCAL, frame.rel ?? `jobs/${frame.job}/shots/${frame.file}`) }));
}
fs.writeFileSync(path.join(LOCAL, "candidates-local.json"), JSON.stringify(candidates, null, 1));

const reviewOut = path.join(LOCAL, "review");
const token = execFileSync("node", ["-e", "console.log(require('/home/main/.claude/settings.json').env.ANTHROPIC_AUTH_TOKEN)"], { encoding: "utf8" }).trim();
execFileSync("node", [
  path.join(import.meta.dirname, "..", "pipeline", "review.mjs"),
  "--candidates", path.join(LOCAL, "candidates-local.json"),
  "--out", reviewOut,
  "--pool", values.pool,
], {
  stdio: "inherit",
  env: { ...process.env, ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? "http://127.0.0.1:8319/cc", ANTHROPIC_AUTH_TOKEN: token },
});

if (values.plant) {
  // measurePlants needs the reviewed candidates (with target) and the run's jobs.json.
  const code = `import fs from "node:fs";
import { measurePlants } from ${JSON.stringify(path.join(import.meta.dirname, "..", "pipeline", "lib", "measure.mjs"))};
const reviewed = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(reviewOut, "reviewed.json"))}, "utf8"));
const truth = JSON.parse(fs.readFileSync(${JSON.stringify(path.resolve(values.plant))}, "utf8"));
const jobs = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(LOCAL, "jobs.json"))}, "utf8"));
const measure = measurePlants(truth, reviewed, jobs);
fs.writeFileSync(${JSON.stringify(path.join(reviewOut, "measure.json"))}, JSON.stringify(measure, null, 1));
console.log(JSON.stringify({ planted: measure.planted, caughtBefore: measure.caughtBefore, caughtAfter: measure.caughtAfter }));`;
  const measureFile = path.join(LOCAL, "measure-run.mjs");
  fs.writeFileSync(measureFile, code);
  console.log(execFileSync("node", [measureFile], { encoding: "utf8" }).trim());
}
console.log(JSON.stringify({ local: LOCAL, review: reviewOut, candidates: candidates.length }));
