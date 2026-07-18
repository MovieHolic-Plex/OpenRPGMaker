#!/usr/bin/env node
// Outer supervisor: keeps scripts/dev-keepalive.mjs (supervised mode) forever.
// Launch with --detach so it survives shell/agent death.
// Does not touch preview :9888.

import { spawn } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOG_DIR = join(ROOT, "output", "dev");
const LOG_PATH = join(LOG_DIR, "dev-supervisor.log");
const OUT_PATH = join(LOG_DIR, "dev-supervisor.out.log");
const ERR_PATH = join(LOG_DIR, "dev-supervisor.err.log");
const PID_PATH = join(LOG_DIR, "dev-supervisor.pid");
const KEEP_SCRIPT = join(ROOT, "scripts", "dev-keepalive.mjs");
const RESTART_MS = Number(process.env.RPGZZU_SUP_RESTART_MS || 2000);
const WANT_DETACH = process.argv.includes("--detach");

mkdirSync(LOG_DIR, { recursive: true });

function stamp() {
  return new Date().toISOString();
}

function log(line) {
  const msg = `[${stamp()}] ${line}\n`;
  try {
    appendFileSync(LOG_PATH, msg, "utf8");
  } catch {
    // ignore
  }
  try {
    process.stdout.write(msg);
  } catch {
    // ignore
  }
}

function writePid(path, pid) {
  try {
    writeFileSync(path, String(pid), "utf8");
  } catch {
    // ignore
  }
}

function readPid(path) {
  try {
    if (!existsSync(path)) return null;
    const n = Number(String(readFileSync(path, "utf8")).trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function claimSingleton() {
  const existing = readPid(PID_PATH);
  if (existing && existing !== process.pid && pidAlive(existing)) {
    process.stdout.write(`supervisor already running pid=${existing}\n`);
    process.exit(0);
  }
  writePid(PID_PATH, process.pid);
}

function detachSelf() {
  const outFd = openSync(OUT_PATH, "a");
  const errFd = openSync(ERR_PATH, "a");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", outFd, errFd],
    env: { ...process.env },
    windowsHide: true,
  });
  child.unref();
  try {
    closeSync(outFd);
    closeSync(errFd);
  } catch {
    // ignore
  }
  process.stdout.write(`started detached supervisor pid=${child.pid}\n`);
  process.stdout.write(`http://127.0.0.1:9999/\n`);
  process.stdout.write(`log: ${LOG_PATH}\n`);
  process.exit(0);
}

if (WANT_DETACH) {
  const existing = readPid(PID_PATH);
  if (existing && pidAlive(existing)) {
    process.stdout.write(`supervisor already running pid=${existing}\n`);
    process.exit(0);
  }
  detachSelf();
}

// ---- supervised mode ----
let child = null;
let stopping = false;
let startCount = 0;

function startKeepalive() {
  if (stopping || child) return;
  startCount += 1;
  log(`start keepalive #${startCount}`);
  child = spawn(process.execPath, [KEEP_SCRIPT], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const pid = child.pid;
  log(`keepalive pid=${pid}`);

  const pipe = (stream) => {
    stream?.on("data", (buf) => {
      try {
        appendFileSync(LOG_PATH, buf);
      } catch {
        // ignore
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on("exit", (code, signal) => {
    log(`keepalive exit pid=${pid} code=${code} signal=${signal ?? "-"}`);
    child = null;
    if (stopping) return;
    setTimeout(() => startKeepalive(), RESTART_MS);
  });
  child.on("error", (err) => {
    log(`keepalive spawn error: ${err?.message || err}`);
    child = null;
    if (stopping) return;
    setTimeout(() => startKeepalive(), RESTART_MS);
  });
}

function stop(reason) {
  if (stopping) return;
  stopping = true;
  log(`supervisor stopping (${reason})`);
  if (child?.pid) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  try {
    if (readPid(PID_PATH) === process.pid) unlinkSync(PID_PATH);
  } catch {
    // ignore
  }
  setTimeout(() => process.exit(0), 200);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGHUP", () => log("ignored SIGHUP"));
process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${err?.stack || err}`);
});

setInterval(() => {
  writePid(PID_PATH, process.pid);
  if (!stopping && !child) {
    log("supervisor watchdog: no keepalive → start");
    startKeepalive();
  }
}, 10000);

claimSingleton();
log(`supervisor ready pid=${process.pid}`);
startKeepalive();
