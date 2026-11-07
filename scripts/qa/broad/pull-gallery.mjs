#!/usr/bin/env node
// Pick one representative settled frame per map job (and a couple per adversarial track) on the QA VM, copy only
// those images back, and write a manifest the report can read. Pulling every shot would be hundreds of MB over
// the DERP link for frames nobody opens.
//
//   node scripts/qa/broad/pull-gallery.mjs --host root@am3685-1 --run /root/qa-pipeline/runs/<tag> --out tmp/qa-gallery/<tag>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { host: { type: "string", default: "root@am3685-1" }, run: { type: "string" }, out: { type: "string" } },
});
if (!values.run || !values.out) throw new Error("usage: pull-gallery.mjs --run <vmRunDir> --out <localDir>");

const OUT = path.resolve(values.out);
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "qa-gallery-"));

// The picker runs ON the VM (its traces are there). Keep it a real file: a nested `node -e` string gets mangled by
// the remote shell's own expansion.
const PICKER = String.raw`
const fs = require("fs");
const RUN = process.argv[2];
const jobs = JSON.parse(fs.readFileSync(RUN + "/jobs.json", "utf8"));
const out = { maps: [], battles: [], adversarial: [] };
const readJsonl = (f) =>
  fs.existsSync(f)
    ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    : [];
const lit = (r) => r.file && (r.lum ?? 0) > 12 && r.settled !== false;
const trace = (job) => readJsonl(RUN + "/jobs/" + job.id + "/trace.jsonl");
for (const job of jobs.filter((j) => j.kind === "map")) {
  const rows = trace(job);
  const pick =
    rows.find((r) => lit(r) && /^walk-(up|right|down|left)$/.test(r.label ?? "")) ||
    rows.find((r) => lit(r) && r.label === "enter") ||
    rows.find((r) => lit(r));
  if (pick) out.maps.push({ job: job.id, mapId: job.target.mapId, label: job.label, seq: pick.seq, file: pick.file, lum: pick.lum, screen: pick.state?.screen ?? null });
}
for (const job of jobs.filter((j) => j.kind === "battle")) {
  const rows = trace(job);
  const pick = rows.find((r) => lit(r) && /-grid$/.test(r.label ?? "")) || rows.find((r) => lit(r) && /battle/.test(r.label ?? ""));
  if (pick) out.battles.push({ job: job.id, troopId: job.target.troopId, state: job.target.state, level: job.target.level, gearTier: job.target.gearTier, seq: pick.seq, file: pick.file, lum: pick.lum });
}
for (const job of jobs.filter((j) => j.kind === "adversarial")) {
  const picks = [];
  for (const row of trace(job)) if (lit(row) && picks.length < 2) picks.push({ seq: row.seq, file: row.file, label: row.label, lum: row.lum });
  if (picks.length) out.adversarial.push({ job: job.id, kind: job.adversarial, label: job.label, input: job.input, viewport: job.viewportName, frames: picks });
}
// Only the maps/battles/build files the report needs locally.
const wanted = [
  "jobs.json", "coverage-plan.json", "play-meta.json", "detect-meta.json", "static.json", "deterministic.json",
];
process.stdout.write(JSON.stringify({ manifest: out, wanted }));
`;
const pickerFile = path.join(TMP, "pick.cjs");
fs.writeFileSync(pickerFile, PICKER);
execFileSync("bash", ["-c", `cat ${pickerFile} | ssh -o BatchMode=yes ${values.host} 'cat > /tmp/qa-gallery-pick.cjs'`], { stdio: "inherit" });
const remoteOut = execFileSync("ssh", ["-o", "BatchMode=yes", values.host, `export PATH=/opt/node/bin:/opt/bun/bin:$PATH; node /tmp/qa-gallery-pick.cjs ${values.run}`], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const { manifest, wanted } = JSON.parse(remoteOut);
fs.writeFileSync(path.join(OUT, "gallery.json"), `${JSON.stringify(manifest, null, 1)}\n`);

const files = [
  ...wanted,
  ...manifest.maps.map((entry) => `jobs/${entry.job}/shots/${entry.file}`),
  ...manifest.battles.map((entry) => `jobs/${entry.job}/shots/${entry.file}`),
  ...manifest.adversarial.flatMap((entry) => entry.frames.map((frame) => `jobs/${entry.job}/shots/${frame.file}`)),
];
const listFile = path.join(TMP, "files.txt");
fs.writeFileSync(listFile, `${files.join("\n")}\n`);
execFileSync("bash", ["-c", `cat ${listFile} | ssh -o BatchMode=yes ${values.host} 'cat > /tmp/qa-gallery-files.txt'`], { stdio: "inherit" });
execFileSync("bash", ["-c", `ssh -o BatchMode=yes ${values.host} 'cd ${values.run} && tar cf - -T /tmp/qa-gallery-files.txt' | tar xf - -C ${OUT}`], { stdio: "inherit" });
fs.rmSync(TMP, { recursive: true, force: true });
console.log(JSON.stringify({ manifest: path.join(OUT, "gallery.json"), maps: manifest.maps.length, battles: manifest.battles.length, adversarial: manifest.adversarial.length, files: files.length }));
