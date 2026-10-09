#!/usr/bin/env node
// Hard keepalive for Vite dev on :9999.
// - Restarts on child exit
// - Health-checks HTTP and restarts if dead
// - Frees the port if a zombie holds it
// - Single-instance via lock file
// - Self-detach mode: --detach (survives parent shell death)
// Does not touch preview :9888.

import { spawn, execFileSync } from "node:child_process";
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
import http from "node:http";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";
import { isLinkedWorktree, MAIN_DEV_PORT } from "./lib/worktreeDevPort.mjs";
import { devViteCacheEnv } from "./lib/viteCacheDir.mjs";

applyLegacyEnvAliases();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.OPRN_DEV_PORT || MAIN_DEV_PORT);
// 이 스크립트는 포트를 쥔 프로세스를 죽여서(freePort) 자리를 만든다. 워크트리에서 기본값으로 돌리면
// 메인 체크아웃의 9999 서버를 죽이고 그 자리에 남의 브랜치를 앉힌다 — 명시 포트 없이는 거절한다.
if (isLinkedWorktree(ROOT) && !process.env.OPRN_DEV_PORT) {
  console.error(`[dev:keep] 이 디렉터리는 git 워크트리다. ${MAIN_DEV_PORT} 는 메인 체크아웃의 포트라 keepalive 를 거절한다 — 'npm run dev:worktree' 를 쓰거나 OPRN_DEV_PORT=<이 워크트리의 고정 포트> 를 명시하라.`);
  process.exit(2);
}
const HOST = process.env.OPRN_DEV_HOST || "0.0.0.0";
const RESTART_MS = Number(process.env.OPRN_DEV_RESTART_MS || 1500);
const HEALTH_MS = Number(process.env.OPRN_DEV_HEALTH_MS || 5000);
const HEALTH_GRACE_MS = Number(process.env.OPRN_DEV_HEALTH_GRACE_MS || 25000);
const HEALTH_FAILS = Number(process.env.OPRN_DEV_HEALTH_FAILS || 3);
const LOG_DIR = join(ROOT, "output", "dev");
const LOG_PATH = join(LOG_DIR, "dev-keepalive.log");
const OUT_PATH = join(LOG_DIR, "dev-keepalive.out.log");
const ERR_PATH = join(LOG_DIR, "dev-keepalive.err.log");
const PID_PATH = join(LOG_DIR, "dev-keepalive.pid");
const CHILD_PID_PATH = join(LOG_DIR, "dev-vite.pid");
const IS_WIN = process.platform === "win32";
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
    log(`another keepalive already running pid=${existing}; exit`);
    process.exit(0);
  }
  writePid(PID_PATH, process.pid);
}

function clearSingleton() {
  const existing = readPid(PID_PATH);
  if (existing === process.pid) {
    try {
      unlinkSync(PID_PATH);
    } catch {
      // ignore
    }
  }
}

/** Fully detach a second copy of this script so parent shell death cannot kill :9999. */
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
  const msg = `[${stamp()}] detached keepalive pid=${child.pid}\n`;
  try {
    appendFileSync(LOG_PATH, msg, "utf8");
  } catch {
    // ignore
  }
  process.stdout.write(`started detached keepalive pid=${child.pid}\n`);
  process.stdout.write(`http://127.0.0.1:${PORT}/\n`);
  process.stdout.write(`log: ${LOG_PATH}\n`);
  process.exit(0);
}

if (WANT_DETACH) {
  // If a healthy instance is already up, do nothing.
  const existing = readPid(PID_PATH);
  if (existing && pidAlive(existing)) {
    process.stdout.write(`keepalive already running pid=${existing}\n`);
    process.exit(0);
  }
  detachSelf();
}

// ---- supervised mode (detached child lands here) ----

let child = null;
let stopping = false;
let restartTimer = null;
let startCount = 0;
let startedAt = 0;
let failStreak = 0;

function clearRestart() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function scheduleRestart(reason) {
  if (stopping) return;
  clearRestart();
  log(`restart in ${RESTART_MS}ms (${reason})`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startDev();
  }, RESTART_MS);
}

function killPidTree(pid) {
  if (!pid) return;
  try {
    if (IS_WIN) {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        process.kill(pid, "SIGKILL");
      }
    }
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
}

function pidsListeningOnPort(port) {
  try {
    if (IS_WIN) {
      const out = execFileSync("netstat", ["-ano", "-p", "tcp"], {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        const m = line.match(
          new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, "i"),
        );
        if (m) pids.add(Number(m[1]));
      }
      return [...pids].filter((p) => Number.isFinite(p) && p > 0);
    }
    return [];
  } catch {
    return [];
  }
}

function freePort(port) {
  const holders = pidsListeningOnPort(port).filter((p) => p !== process.pid);
  for (const pid of holders) {
    log(`freeing port ${port}: kill pid=${pid}`);
    killPidTree(pid);
  }
}

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: PORT, path: "/", timeout: 2500 },
      (res) => {
        res.resume();
        resolve(Boolean(res.statusCode && res.statusCode < 500));
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function tickHealth() {
  if (stopping || !child) return;
  if (Date.now() - startedAt < HEALTH_GRACE_MS) return;

  const ok = await healthCheck();
  if (ok) {
    failStreak = 0;
    return;
  }

  failStreak += 1;
  log(`health fail #${failStreak} (port ${PORT})`);
  if (failStreak < HEALTH_FAILS) return;

  failStreak = 0;
  log("health hard-fail → kill + restart");
  const pid = child?.pid;
  child = null;
  if (pid) killPidTree(pid);
  freePort(PORT);
  scheduleRestart("health-fail");
}

function resolveViteLaunch() {
  const viteJs = join(ROOT, "node_modules", "vite", "bin", "vite.js");
  if (existsSync(viteJs)) {
    return {
      cmd: process.execPath,
      args: [
        viteJs,
        "--configLoader",
        "runner",
        "--host",
        HOST,
        "--port",
        String(PORT),
        "--strictPort",
      ],
      shell: false,
    };
  }
  // last resort
  return {
    cmd: IS_WIN ? "npx.cmd" : "npx",
    args: [
      "--yes",
      "vite",
      "--configLoader",
      "runner",
      "--host",
      HOST,
      "--port",
      String(PORT),
      "--strictPort",
    ],
    shell: IS_WIN,
  };
}

function startDev() {
  if (stopping || child) return;

  freePort(PORT);

  startCount += 1;
  startedAt = Date.now();
  failStreak = 0;

  const launch = resolveViteLaunch();
  log(`start #${startCount}: ${launch.cmd} ${launch.args.join(" ")}`);

  child = spawn(launch.cmd, launch.args, {
    cwd: ROOT,
    env: {
      ...process.env,
      // 공유 node_modules 면 vite 캐시를 체크아웃 안으로 뗀다(lib/viteCacheDir.mjs).
      ...devViteCacheEnv(ROOT),
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      CI: "1",
      BROWSER: "none",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: launch.shell,
  });

  const pid = child.pid;
  log(`spawned vite pid=${pid}`);
  if (pid) writePid(CHILD_PID_PATH, pid);

  const pipe = (stream) => {
    stream?.on("data", (buf) => {
      try {
        appendFileSync(LOG_PATH, buf);
      } catch {
        // ignore
      }
      try {
        process.stdout.write(buf);
      } catch {
        // ignore
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on("error", (err) => {
    log(`spawn error: ${err?.message || err}`);
    child = null;
    scheduleRestart("spawn-error");
  });

  child.on("exit", (code, signal) => {
    log(`vite exit pid=${pid} code=${code} signal=${signal ?? "-"}`);
    child = null;
    try {
      if (readPid(CHILD_PID_PATH) === pid) unlinkSync(CHILD_PID_PATH);
    } catch {
      // ignore
    }
    if (stopping) return;
    scheduleRestart(`exit code=${code} signal=${signal ?? "-"}`);
  });
}

function stop(reason) {
  if (stopping) return;
  stopping = true;
  clearRestart();
  log(`stopping (${reason})`);
  const pid = child?.pid;
  child = null;
  if (pid) killPidTree(pid);
  clearSingleton();
  setTimeout(() => process.exit(0), 200);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGHUP", () => log("ignored SIGHUP"));
process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${err?.stack || err}`);
  if (!child && !stopping) scheduleRestart("uncaughtException");
});
process.on("unhandledRejection", (err) => {
  log(`unhandledRejection: ${err?.stack || err}`);
});

// Keep event loop alive + recover if child vanished without exit event
setInterval(() => {
  writePid(PID_PATH, process.pid);
  if (!stopping && !child && !restartTimer) {
    log("watchdog: no child → start");
    startDev();
  }
}, 10000);

setInterval(() => {
  tickHealth().catch((err) => log(`health error: ${err?.message || err}`));
}, HEALTH_MS);

claimSingleton();
log(`dev-keepalive ready → http://127.0.0.1:${PORT}/ pid=${process.pid}`);
startDev();
