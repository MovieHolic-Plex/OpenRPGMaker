#!/usr/bin/env node
// One command per game: plan -> play -> detect -> observe -> cluster -> review -> fix queue -> report.
// Bulk work (browsers, cheap vision model) runs on the QA VM against its local mirror; the review stage runs here
// with the Anthropic reviewer and the evidence frames pulled back.
//
//   node scripts/qa/pipeline/qa.mjs --game fallen-star --version 1.37 [--plant p1] [--tag fs-p1]
//        [--host root@am3685-1] [--pool 20] [--observe-pool 16] [--max-events 120] [--max-observe 400]
//        [--from plan|play|detect|observe|cluster|pull|review|report] [--out tmp/qa-pipeline]
//
// Env: ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN for the reviewer (same pair as the claude CLI).
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { defaultReviewerChain, readUsage, reviewerChain, usageLedger } from "./lib/models.mjs";
import { buildFixQueue, mergeReport, reviewCandidates } from "./review.mjs";
import { measurePlants } from "./lib/measure.mjs";
import { renderReport } from "./report.mjs";

const STAGES = ["plan", "play", "detect", "observe", "cluster", "pull", "review", "report"];
const { values } = parseArgs({
  options: {
    game: { type: "string" },
    version: { type: "string" },
    plant: { type: "string", default: "" },
    tag: { type: "string", default: "" },
    host: { type: "string", default: process.env.QA_HOST ?? "root@am3685-1" },
    "vm-root": { type: "string", default: "/root/qa-pipeline" },
    mirror: { type: "string", default: "/root/vqa-sinkiru/mirror" },
    pool: { type: "string", default: "40" },
    "observe-pool": { type: "string", default: "16" },
    "review-pool": { type: "string", default: "6" },
    "max-events": { type: "string", default: "120" },
    "max-jobs": { type: "string", default: "0" },
    "max-observe": { type: "string", default: "400" },
    "plant-seed": { type: "string", default: "11" },
    model: { type: "string", default: process.env.QA_REVIEW_MODEL ?? "claude-opus-5-5" },
    from: { type: "string", default: "plan" },
    out: { type: "string", default: "tmp/qa-pipeline" },
    "report-dir": { type: "string", default: "" },
    // Opt-in control-room log: play writes <run>/events.jsonl (spawn/ack/progress/done/retry per session, owner id).
    events: { type: "boolean", default: false },
    owner: { type: "string", default: process.env.QA_OWNER ?? "" },
    retries: { type: "string", default: "0" },
  },
});
if (!values.game || !values.version) throw new Error("--game and --version are required");
const TAG = values.tag || `${values.game}-${values.version}${values.plant ? "-" + values.plant : ""}`;
const VM = values["vm-root"];
const VMRUN = `${VM}/runs/${TAG}`;
const LOCAL = path.resolve(values.out, TAG);
fs.mkdirSync(LOCAL, { recursive: true });
const HERE = path.dirname(new URL(import.meta.url).pathname);
const startAt = STAGES.indexOf(values.from);
if (startAt < 0) throw new Error(`--from must be one of ${STAGES.join(", ")}`);
const timings = fs.existsSync(path.join(LOCAL, "timings.json")) ? JSON.parse(fs.readFileSync(path.join(LOCAL, "timings.json"), "utf8")) : {};
const log = (msg) => { const line = `[qa ${new Date().toISOString().slice(11, 19)}] ${msg}`; console.log(line); fs.appendFileSync(path.join(LOCAL, "run.log"), line + "\n"); };

function ssh(cmd, { capture = false } = {}) {
  const full = `export PATH=/opt/node/bin:/opt/bun/bin:$PATH; set -e; ${cmd}`;
  const r = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ServerAliveInterval=30", values.host, full], { encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"], maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`remote step failed (${r.status}): ${cmd.slice(0, 160)}\n${(r.stderr ?? "").slice(-800)}`);
  return r.stdout;
}
const node = (script, args) => ssh(`cd ${VM}/code/pipeline && node ${script} ${args}`);

async function stage(name, fn) {
  if (STAGES.indexOf(name) < startAt) return;
  const t0 = Date.now();
  log(`stage ${name} start`);
  await fn();
  timings[name] = Date.now() - t0;
  fs.writeFileSync(path.join(LOCAL, "timings.json"), JSON.stringify(timings, null, 1));
  log(`stage ${name} done ${(timings[name] / 1000).toFixed(0)}s`);
}

// Code sync + overlay: always, idempotent. The observer key file ships with the code dir but stays mode 600 on the VM
// (ensured here, so a re-sync never leaves it world-readable).
const KEY_FILE = `${VM}/oc-exempt.json`;
execFileSync("bash", ["-c", `tar czf - -C ${path.dirname(HERE)} pipeline | ssh -o BatchMode=yes ${values.host} 'mkdir -p ${VM}/code ${VM}/plants ${VM}/logs && tar xzf - -C ${VM}/code && ln -sfn /root/vqa-sinkiru/node_modules ${VM}/code/pipeline/node_modules && chmod 600 ${KEY_FILE} 2>/dev/null || true'`], { stdio: "inherit" });
ssh(`curl -sf 127.0.0.1:7812/health >/dev/null || (cd ${VM}/code/pipeline && setsid nohup node vm/overlay.mjs --cache ${values.mirror} --plants ${VM}/plants --port 7812 --log ${VM}/logs/overlay.jsonl > ${VM}/logs/overlay.out 2>&1 & sleep 2; curl -sf 127.0.0.1:7812/health)`);
const plantFile = `${VM}/plants/${values.game}@${values.version}~${values.plant}.json`;

await stage("plan", async () => {
  node("vm/plan-run.mjs", `--cache ${values.mirror} --slug ${values.game} --version ${values.version} --out ${VMRUN} --max-events ${values["max-events"]} --max-jobs ${values["max-jobs"]} ${values.plant ? "--plant " + values.plant : ""}`);
  if (values.plant) {
    node("vm/plant.mjs", `--cache ${values.mirror} --slug ${values.game} --version ${values.version} --plant ${values.plant} --out ${VM}/plants --jobs ${VMRUN}/jobs.json --seed ${values["plant-seed"]}`);
    node("vm/plan-run.mjs", `--slug ${values.game} --version ${values.version} --out ${VMRUN} --lint-only ${plantFile}`);
  }
});
await stage("play", async () => node("vm/play.mjs", `--jobs ${VMRUN}/jobs.json --out ${VMRUN} --pool ${values.pool} --retries ${Number(values.retries)}${values.events ? ` --events ${VMRUN}/events.jsonl --owner ${JSON.stringify(values.owner || "unowned")}` : ""}`));
await stage("detect", async () => node("vm/triage.mjs", `--run ${VMRUN} --phase detect --max-observe ${values["max-observe"]}`));
await stage("observe", async () => node("vm/observe.mjs", `--frames ${VMRUN}/observe-frames.json --run ${VMRUN} --out ${VMRUN}/observations.jsonl --pool ${values["observe-pool"]}`));await stage("cluster", async () => node("vm/triage.mjs", `--run ${VMRUN} --phase cluster`));
await stage("pull", async () => {
  // Only the files the reviewer and the report need: metadata + every evidence frame of every candidate.
  const list = `${VMRUN}/pull.txt`;
  ssh(`cd ${VMRUN} && node -e 'const c=require("./candidates.json");const s=new Set();for(const x of c)for(const f of x.frames)s.add(f.rel);console.log([...s].join("\\n"))' > ${list} && for f in events.jsonl jobs.json static.json coverage-plan.json play-meta.json detect-meta.json cluster-meta.json candidates.json deterministic.json usage.jsonl; do [ -f $f ] && echo $f >> ${list}; done; ${values.plant ? `cp ${plantFile.replace(/\.json$/, ".truth.json")} ${VMRUN}/plant-truth.json && echo plant-truth.json >> ${list};` : ""} true`);
  execFileSync("bash", ["-c", `ssh -o BatchMode=yes ${values.host} 'cd ${VMRUN} && tar cf - -T pull.txt' | tar xf - -C ${LOCAL}`], { stdio: "inherit" });
});
await stage("review", async () => {
  const usage = usageLedger(path.join(LOCAL, "review-usage.jsonl"));
  const chain = reviewerChain(defaultReviewerChain(), { log: usage, stage: "review" });
  log(`reviewer chain ${chain.chain.join(" -> ")}`);
  const candidates = JSON.parse(fs.readFileSync(path.join(LOCAL, "candidates.json"), "utf8"));
  for (const c of candidates) c.frames = c.frames.map((f) => ({ ...f, file: path.join(LOCAL, f.rel) }));
  const cacheFile = path.join(LOCAL, "review.jsonl");
  const cached = new Map(fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.verdict).map((r) => [r.id, r]) : []);
  await reviewCandidates(candidates.filter((c) => !cached.has(c.id)), { client: chain, poolSize: Number(values["review-pool"]), onRow: (row) => { fs.appendFileSync(cacheFile, JSON.stringify(row) + "\n"); if (row.verdict) cached.set(row.id, row); } });
  const reviewed = candidates.map((c) => ({ ...c, review: cached.get(c.id) ?? { verdict: null, error: "no verdict" } }));
  const kept = reviewed.filter((c) => c.review.verdict === "real");
  const merged = await mergeReport(kept, { client: chain });
  const final = { game: values.game, version: values.version, plant: values.plant || null, model: values.model, reviewerChain: chain.chain, reviewerAnsweredBy: chain.answeredBy(), reviewedAt: new Date().toISOString(), candidates: candidates.length,
    verdictCounts: Object.fromEntries(["real", "misread", "transition", "by_design", "not_visible", "environment", "null"].map((v) => [v, reviewed.filter((c) => String(c.review.verdict) === v).length])),
    groups: merged.groups, mergeError: merged.mergeError ?? null };
  fs.writeFileSync(path.join(LOCAL, "reviewed.json"), JSON.stringify(reviewed, null, 1));
  fs.writeFileSync(path.join(LOCAL, "final.json"), JSON.stringify(final, null, 1));
  fs.writeFileSync(path.join(LOCAL, "fix-queue.json"), JSON.stringify(buildFixQueue(final, new Map(reviewed.map((c) => [c.id, c]))), null, 1));
  log(`review verdicts ${JSON.stringify(final.verdictCounts)} groups ${final.groups.length}`);
});
await stage("report", async () => {
  const reviewed = JSON.parse(fs.readFileSync(path.join(LOCAL, "reviewed.json"), "utf8"));
  const truthFile = path.join(LOCAL, "plant-truth.json");
  const measure = fs.existsSync(truthFile) ? measurePlants(JSON.parse(fs.readFileSync(truthFile, "utf8")), reviewed, JSON.parse(fs.readFileSync(path.join(LOCAL, "jobs.json"), "utf8"))) : null;
  if (measure) fs.writeFileSync(path.join(LOCAL, "measure.json"), JSON.stringify(measure, null, 1));
  const usage = { ...readUsage(path.join(LOCAL, "usage.jsonl")), ...readUsage(path.join(LOCAL, "review-usage.jsonl")) };
  const summary = {
    tag: TAG, game: values.game, version: values.version, plant: values.plant || null, timings, usage,
    coverage: JSON.parse(fs.readFileSync(path.join(LOCAL, "coverage-plan.json"), "utf8")),
    play: JSON.parse(fs.readFileSync(path.join(LOCAL, "play-meta.json"), "utf8")),
    detect: JSON.parse(fs.readFileSync(path.join(LOCAL, "detect-meta.json"), "utf8")),
    cluster: JSON.parse(fs.readFileSync(path.join(LOCAL, "cluster-meta.json"), "utf8")),
    final: JSON.parse(fs.readFileSync(path.join(LOCAL, "final.json"), "utf8")),
    measure,
  };
  fs.writeFileSync(path.join(LOCAL, "summary.json"), JSON.stringify(summary, null, 1));
  if (values["report-dir"]) renderReport([LOCAL], { outDir: values["report-dir"], name: TAG });
  log(`summary ${path.join(LOCAL, "summary.json")}`);
});
log("PIPELINE DONE " + TAG);
