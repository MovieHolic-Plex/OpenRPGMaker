#!/usr/bin/env node
// Bounded pool of player.mjs sessions on the QA VM. Admission is gated on the container's cgroup memory,
// not on host RAM (am3685-1 reports 250 GB but the cgroup caps at 64 GiB).
//
// usage: node vm/play.mjs --jobs <jobs.json> --out <runDir> [--pool 20] [--mem-ceiling-gb 52]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    jobs: { type: "string" },
    out: { type: "string" },
    pool: { type: "string", default: "20" },
    "mem-ceiling-gb": { type: "string", default: "52" },
  },
});
const jobs = JSON.parse(fs.readFileSync(values.jobs, "utf8"));
const POOL = Number(values.pool);
const CEIL = Number(values["mem-ceiling-gb"]) * 1024 ** 3;const HERE = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(path.join(values.out, "jobs"), { recursive: true });
const progress = path.join(values.out, "play-progress.jsonl");
const done = new Set(fs.existsSync(progress) ? fs.readFileSync(progress, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
const todo = jobs.filter((j) => !done.has(j.id));

function cgroupMem() {
  try { return Number(fs.readFileSync("/sys/fs/cgroup/memory.current", "utf8")); } catch { return 0; }
}

const t0 = Date.now();
let active = 0;
let next = 0;
let finished = 0;
let peak = 0;
let peakMem = 0;
console.log(JSON.stringify({ stage: "play", jobs: jobs.length, todo: todo.length, pool: POOL }));

await new Promise((resolve) => {
  if (todo.length === 0) return resolve();
  const launch = () => {
    while (active < POOL && next < todo.length) {
      const mem = cgroupMem();
      peakMem = Math.max(peakMem, mem);
      if (mem > CEIL && active > 0) { setTimeout(launch, 2000); return; }
      const job = todo[next++];
      const dir = path.join(values.out, "jobs", job.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      active += 1;
      peak = Math.max(peak, active);
      const started = Date.now();
      const child = spawn(process.execPath, [path.join(HERE, "player.mjs"), path.join(dir, "job.json"), dir], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });      let tail = "";
      child.stdout.on("data", (d) => { tail = (tail + d).slice(-600); });
      child.stderr.on("data", (d) => { tail = (tail + d).slice(-600); });
      const kill = setTimeout(() => child.kill("SIGKILL"), (job.hardMs ?? 240000) + 90000);
      child.on("close", (code) => {
        clearTimeout(kill);
        active -= 1;
        finished += 1;
        // Fail fast when the build itself is refused: every remaining session would only repeat it.
        if (/boot refused/.test(tail) && finished <= 3) { console.log("PLAY ABORT boot refused: " + tail.slice(-300)); process.exit(3); }
        fs.appendFileSync(progress, JSON.stringify({ id: job.id, code, ms: Date.now() - started, tail: code === 0 ? undefined : tail }) + "\n");
        if (finished % 10 === 0 || finished === todo.length) console.log(JSON.stringify({ stage: "play", finished, of: todo.length, active, sec: Math.round((Date.now() - t0) / 1000), memGB: +(cgroupMem() / 1024 ** 3).toFixed(1) }));
        if (finished === todo.length) resolve(); else launch();
      });
    }
  };
  launch();
});
const meta = { stage: "play", ms: Date.now() - t0, jobs: jobs.length, ran: todo.length, peakSessions: peak, peakMemGB: +(peakMem / 1024 ** 3).toFixed(1) };
fs.writeFileSync(path.join(values.out, "play-meta.json"), JSON.stringify(meta, null, 1));
console.log("PLAY DONE " + JSON.stringify(meta));
