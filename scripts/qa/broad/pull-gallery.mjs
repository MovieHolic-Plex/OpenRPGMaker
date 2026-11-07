#!/usr/bin/env node
// Pick one representative settled frame per map job (and a couple per adversarial track) on the QA VM, copy only
// those images back, and write a manifest the report can read. Pulling every shot would be hundreds of MB over
// the DERP link for frames nobody opens.
//
//   node scripts/qa/broad/pull-gallery.mjs --host root@am3685-1 --run /root/qa-pipeline/runs/<tag> --out tmp/qa-gallery/<tag>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { host: { type: "string", default: "root@am3685-1" }, run: { type: "string" }, out: { type: "string" } },
});
if (!values.run || !values.out) throw new Error("usage: pull-gallery.mjs --run <vmRunDir> --out <localDir>");

const OUT = path.resolve(values.out);
fs.mkdirSync(OUT, { recursive: true });

/** Runs node on the VM and returns stdout. */
function vmNode(code) {
  const script = `export PATH=/opt/node/bin:/opt/bun/bin:$PATH; node -e ${JSON.stringify(code)}`;
  return execFileSync("ssh", ["-o", "BatchMode=yes", values.host, script], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const plan = `
const fs = require("fs");
const RUN = ${JSON.stringify(values.run)};
const jobs = JSON.parse(fs.readFileSync(RUN + "/jobs.json", "utf8"));
const out = { maps: [], battles: [], adversarial: [] };
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const lit = (r) => r.file && (r.lum ?? 0) > 12 && r.settled !== false;
for (const job of jobs.filter((j) => j.kind === "map")) {
  const rows = readJsonl(\`\${RUN}/jobs/\${job.id}/trace.jsonl\`);
  const pick = rows.find((r) => lit(r) && /^walk-(up|right|down|left)$/.test(r.label ?? "")) || rows.find((r) => lit(r) && r.label === "enter") || rows.find((r) => lit(r));
  if (pick) out.maps.push({ job: job.id, mapId: job.target.mapId, label: job.label, seq: pick.seq, file: pick.file, lum: pick.lum, screen: pick.state?.screen ?? null });
}
for (const job of jobs.filter((j) => j.kind === "battle")) {
  const rows = readJsonl(\`\${RUN}/jobs/\${job.id}/trace.jsonl\`);
  // The command grid is the frame that proves the fight actually started.
  const pick = rows.find((r) => lit(r) && /-grid$/.test(r.label ?? "")) || rows.find((r) => lit(r) && /battle/.test(r.label ?? ""));
  if (pick) out.battles.push({ job: job.id, troopId: job.target.troopId, state: job.target.state, level: job.target.level, gearTier: job.target.gearTier, seq: pick.seq, file: pick.file, lum: pick.lum });
}
for (const job of jobs.filter((j) => j.kind === "adversarial")) {
  const rows = readJsonl(\`\${RUN}/jobs/\${job.id}/trace.jsonl\`);
  const picks = [];
  for (const row of rows) if (lit(row) && picks.length < 2) picks.push({ seq: row.seq, file: row.file, label: row.label, lum: row.lum });
  if (picks.length) out.adversarial.push({ job: job.id, kind: job.adversarial, label: job.label, input: job.input, viewport: job.viewportName, frames: picks });
}
console.log(JSON.stringify(out));
`;
const manifest = JSON.parse(vmNode(plan));
fs.writeFileSync(path.join(OUT, "gallery.json"), `${JSON.stringify(manifest, null, 1)}\n`);

const wanted = [
  ...manifest.maps.map((entry) => ({ job: entry.job, file: entry.file, dir: "maps" })),
  ...manifest.battles.map((entry) => ({ job: entry.job, file: entry.file, dir: "battles" })),
  ...manifest.adversarial.flatMap((entry) => entry.frames.map((frame) => ({ job: entry.job, file: frame.file, dir: "adversarial" }))),
];
const list = wanted.map((entry) => `jobs/${entry.job}/shots/${entry.file}`).join("\n");
fs.writeFileSync(path.join(OUT, "files.txt"), `${list}\n`);
// Write the list on the VM, then stream exactly those files back.execFileSync("bash", ["-c", `cat ${path.join(OUT, "files.txt")} | ssh -o BatchMode=yes ${values.host} 'cat > /tmp/gallery-files.txt'`], { stdio: "inherit" });
execFileSync("bash", ["-c", `ssh -o BatchMode=yes ${values.host} 'cd ${values.run} && tar cf - -T /tmp/gallery-files.txt' | tar xf - -C ${OUT}`], { stdio: "inherit" });
console.log(JSON.stringify({ manifest: path.join(OUT, "gallery.json"), maps: manifest.maps.length, battles: manifest.battles.length, adversarial: manifest.adversarial.length, files: wanted.length }));
