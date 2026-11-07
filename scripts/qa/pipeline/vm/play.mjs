#!/usr/bin/env node
// Bounded pool of player.mjs sessions on the QA VM. Admission is gated on the container's cgroup memory,
// not on host RAM (am3685-1 reports 250 GB but the cgroup caps at 64 GiB).
//
// usage: node vm/play.mjs --jobs <jobs.json> --out <runDir> [--pool 20] [--mem-ceiling-gb 52]
//        [--events <events.jsonl> --owner <lane-or-agent-id>] [--retries 0]
// --events (opt-in) appends queued/spawn/ack/progress/done/retry/gauge rows per session, see lib/events.mjs.
// --retries N re-runs a session whose player exited non-zero, up to N more times (default 0 = old behaviour).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { createEventLog, parseStepLines } from "../lib/events.mjs";

const { values } = parseArgs({
  options: {
    jobs: { type: "string" },
    out: { type: "string" },
    pool: { type: "string", default: "20" },
    "mem-ceiling-gb": { type: "string", default: "52" },
    events: { type: "string", default: "" },
    owner: { type: "string", default: process.env.QA_OWNER ?? "" },
    retries: { type: "string", default: "0" },
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

const RETRIES = Number(values.retries);
const ev = values.events ? createEventLog(values.events, { owner: values.owner || "unowned", run: path.basename(path.resolve(values.out)) }) : null;
const attempts = new Map();
const again = [];
const gauge = () => ev?.emit("gauge", null, { active, finished, queued: todo.length - next + again.length, memGB: +(cgroupMem() / 1024 ** 3).toFixed(1) });
ev?.emit("run", null, { jobs: jobs.length, todo: todo.length, pool: POOL, retries: RETRIES });
for (const j of todo) ev?.emit("queued", j.id, { kind: j.kind, label: j.label, target: j.target ?? null, input: j.input, viewport: j.viewportName });

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
    while (active < POOL && (again.length || next < todo.length)) {
      const mem = cgroupMem();
      peakMem = Math.max(peakMem, mem);
      if (mem > CEIL && active > 0) { setTimeout(launch, 2000); return; }
      const job = again.shift() ?? todo[next++];
      const dir = path.join(values.out, "jobs", job.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
      active += 1;
      peak = Math.max(peak, active);
      const started = Date.now();
      const attempt = (attempts.get(job.id) ?? 0) + 1;
      attempts.set(job.id, attempt);
      const child = spawn(process.execPath, [path.join(HERE, "player.mjs"), path.join(dir, "job.json"), dir], { env: ev ? { ...process.env, QA_EVENTS: "1" } : process.env, stdio: ["ignore", "pipe", "pipe"] });
      ev?.emit("spawn", job.id, { attempt, pid: child.pid, active });
      let tail = "";
      let lineBuf = "";
      let acked = false;
      child.stdout.on("data", (d) => {
        tail = (tail + d).slice(-600);
        if (!ev) return;
        const { steps, rest } = parseStepLines(lineBuf + d);
        lineBuf = rest;
        for (const s of steps) {
          // The first line a session prints is its boot: the ack that the browser is up and the game answered.
          if (!acked) { acked = true; ev.emit("ack", job.id, { attempt, bootMs: s.t }); }
          if (s.seq > 0) ev.emit("progress", job.id, { attempt, seq: s.seq, t: s.t, label: s.label, screen: s.screen });
        }
      });
      child.stderr.on("data", (d) => { tail = (tail + d).slice(-600); });
      const kill = setTimeout(() => child.kill("SIGKILL"), (job.hardMs ?? 240000) + 90000);
      child.on("close", (code) => {
        clearTimeout(kill);
        active -= 1;
        if (code !== 0 && attempt <= RETRIES && !/boot refused/.test(tail)) {
          ev?.emit("retry", job.id, { attempt, code, ms: Date.now() - started, tail: tail.slice(-200) });
          again.push(job);
          launch();
          return;
        }
        finished += 1;
        // Fail fast when the build itself is refused: every remaining session would only repeat it.
        if (/boot refused/.test(tail) && finished <= 3) { ev?.emit("end", null, { aborted: "boot refused" }); console.log("PLAY ABORT boot refused: " + tail.slice(-300)); process.exit(3); }
        ev?.emit("done", job.id, { attempt, code, ms: Date.now() - started });
        gauge();
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
ev?.emit("end", null, meta);
ev?.close();
console.log("PLAY DONE " + JSON.stringify(meta));
