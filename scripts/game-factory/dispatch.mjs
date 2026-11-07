#!/usr/bin/env node
// Game factory dispatcher: many different games, one owning lane id per game (g01..g30), built in parallel.
//   node scripts/game-factory/dispatch.mjs --out <runs dir> [--only g01,g02] [--limit 8] [--concurrency 8]
//        [--specs scripts/game-factory/specs.json] [--cap-min 90] [--smoke-sec 60] [--retries 1] [--no-hint] [--dry]
// Per game: spawn build-one.sh (coding agent + warm editor host, hard cap) -> save-check v2 (check.py) -> 60 s
// shipped-player smoke. "capped" (did not finish inside the cap) is its own state and never gets a checker score.
// <out>/events.jsonl rows follow scripts/qa/pipeline/lib/events.mjs (queued/spawn/ack/progress/done/retry/gauge,
// monotonic `mono`), with `owner` = the game's lane id; <out>/<id>/ holds each game; <out>/summary.json the table.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEventLog } from "../qa/pipeline/lib/events.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const OUT = resolve(opt("out", ""));
if (!opt("out")) { console.error("usage: dispatch.mjs --out <runs dir> [--only ids] [--limit n] [--concurrency 8]"); process.exit(2); }
const SPECS = JSON.parse(readFileSync(resolve(opt("specs", resolve(HERE, "specs.json"))), "utf8"));
const CONCURRENCY = Number(opt("concurrency", 8));
const MAX_GLOBAL_AGENTS = Number(opt("max-global-agents", process.env.GF_MAX_GLOBAL_AGENTS ?? 8));
const CAP_MIN = Number(opt("cap-min", SPECS.protocol?.capMin ?? 90));
const SMOKE_SEC = Number(opt("smoke-sec", 60));
const RETRIES = Number(opt("retries", 1));
const WITH_HINT = !argv.includes("--no-hint");
const CHECKER = opt("checker", process.env.GF_CHECKER ?? "/home/main/claude-viz/save-check/check.py");
const only = opt("only") ? new Set(opt("only").split(",")) : null;
let games = SPECS.games.filter((g) => !only || only.has(g.id));
if (opt("limit")) games = games.slice(0, Number(opt("limit")));
mkdirSync(OUT, { recursive: true });

const runId = `gf-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`;
const log = createEventLog(resolve(OUT, "events.jsonl"), { owner: "dispatcher", run: runId });
const emit = (type, game, extra = {}) => log.emit(type, game?.id, game ? { owner: game.id, ...extra } : extra);
emit("run", null, { games: games.map((g) => g.id), withHint: WITH_HINT, concurrency: CONCURRENCY, capMin: CAP_MIN, smokeSec: SMOKE_SEC, checker: CHECKER });
if (argv.includes("--dry")) { for (const g of games) emit("queued", g, { genre: g.genre }); log.close(); console.log(JSON.stringify(games.map((g) => g.id))); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readRun = (dir) => { try { return Object.fromEntries(readFileSync(resolve(dir, "RUN.txt"), "utf8").split(/\s+/).filter((w) => w.includes("=")).map((w) => w.split(/=(.*)/s).slice(0, 2))); } catch { return {}; } };
const lines = (file) => { try { return readFileSync(file, "utf8").split("\n").filter(Boolean).length; } catch { return 0; } };
const globalAgents = () => { try { return Number(execFileSync("bash", ["-c", "pgrep -fc '[b]uild-one.sh'"]).toString().trim()); } catch { return 0; } };
const run = (cmd, args, opts) => new Promise((done) => { const c = spawn(cmd, args, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], ...opts }); let out = ""; let err = ""; c.stdout.on("data", (d) => { out += d; }); c.stderr.on("data", (d) => { err = (err + d).slice(-4000); }); c.on("close", (code) => done({ code, out, err })); });

const results = new Map(games.map((g) => [g.id, { id: g.id, genre: g.genre, state: "queued", attempts: 0 }]));
const writeSummary = () => writeFileSync(resolve(OUT, "summary.json"), JSON.stringify({ run: runId, capMin: CAP_MIN, games: [...results.values()] }, null, 2));
for (const g of games) emit("queued", g, { genre: g.genre, theme: g.theme });

let active = 0;
const queue = [...games];
async function build(game) {
  const dir = resolve(OUT, game.id);
  const r = results.get(game.id);
  for (let attempt = 1; attempt <= 1 + RETRIES; attempt += 1) {
    if (attempt > 1) execFileSync("rm", ["-rf", dir]);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "prompt.txt"), WITH_HINT && game.hint ? `${game.prompt}\n\n(참고: 이 무대에 맞는 편집기 도구·칩셋 — ${game.hint}. ./oprn tools 로 찾아 쓰고, 다른 게임과 같은 마을 칩셋으로 대신하지 마라.)` : game.prompt);
    writeFileSync(resolve(dir, "spec.json"), JSON.stringify(game, null, 2));
    r.attempts = attempt; r.state = "building";
    emit("spawn", game, { attempt, model: process.env.GF_MODEL ?? "opencodex/gpt-6.1-terra", effort: process.env.GF_EFFORT ?? "high" });
    const started = Date.now();
    const child = spawn("bash", [resolve(HERE, "build-one.sh"), dir, resolve(dir, "prompt.txt"), `${game.id} ${game.theme}`], {
      cwd: REPO, stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, GF_CAP_MIN: String(CAP_MIN), GF_FOLLOWUP: SPECS.protocol?.followup ?? "", GF_FOLLOWUP_MIN_LEFT_SEC: String(SPECS.protocol?.followupMinLeftSec ?? 480) },
    });
    let acked = false; let lastTools = -1;
    const watch = setInterval(() => {
      if (!acked && existsSync(resolve(dir, "host-ready.json")) && existsSync(resolve(dir, "agent-1.jsonl")) && statSync(resolve(dir, "agent-1.jsonl")).size > 0) { acked = true; emit("ack", game, { attempt, sec: (Date.now() - started) / 1000 }); }
      const tools = lines(resolve(dir, "host-calls.jsonl"));
      if (acked && tools !== lastTools) { lastTools = tools; emit("progress", game, { phase: "build", hostCalls: tools, sec: Math.round((Date.now() - started) / 1000) }); }
    }, 20000);
    const code = await new Promise((done) => child.on("close", done));
    clearInterval(watch);
    const runTxt = readRun(dir);
    r.buildSec = Math.round((Date.now() - started) / 1000);
    r.agentSec = Number(runTxt.agent_sec ?? 0) || null;
    r.hostCalls = lines(resolve(dir, "host-calls.jsonl"));
    r.leftovers = Number(runTxt.leftovers ?? NaN);
    if (code === 0) { r.state = "finished"; return true; }
    if (code === 124) { r.state = "capped"; return false; }
    r.state = "failed"; r.reason = runTxt.reason ?? `exit-${code}`;
    const infra = ["prepare", "host"].includes(runTxt.reason);
    if (infra && attempt <= RETRIES) { emit("retry", game, { attempt, reason: r.reason }); continue; }
    return false;
  }
  return false;
}

async function verify(game) {
  const dir = resolve(OUT, game.id);
  const r = results.get(game.id);
  r.state = "checking";
  emit("progress", game, { phase: "check" });
  const c = await run("python3", [CHECKER, resolve(dir, "project")]);
  writeFileSync(resolve(dir, "check-v2.json"), c.out || JSON.stringify({ error: c.err.slice(-1500), code: c.code }));
  try { const j = JSON.parse(c.out); r.checker = j.summary; r.checkerPass = Object.values(j.summary).filter((v) => v === "PASS").length; r.checkerTotal = Object.keys(j.summary).length; r.maps = j.maps; }
  catch { r.checker = null; r.checkerError = c.err.slice(-300); }
  r.state = "smoking";
  emit("progress", game, { phase: "smoke", checker: r.checker ? `${r.checkerPass}/${r.checkerTotal}` : "error" });
  const s = await run(process.execPath, [resolve(HERE, "smoke.mjs"), dir, "--seconds", String(SMOKE_SEC)]);
  try { const j = JSON.parse(readFileSync(resolve(dir, "smoke", "result.json"), "utf8")); r.smoke = j.verdict; r.smokeReason = j.reason; r.smokeErrors = j.errors.length; }
  catch { r.smoke = "FAIL"; r.smokeReason = `smoke crashed (${s.code}) ${s.err.slice(-200)}`; }
  r.state = "verified";
}

async function worker(game) {
  const ok = await build(game);
  const r = results.get(game.id);
  active -= 1;
  writeSummary();
  if (ok) await verify(game);
  emit("done", game, { code: r.state === "verified" ? "finished" : r.state, buildSec: r.buildSec, agentSec: r.agentSec, attempts: r.attempts,
    checker: r.checker ? `${r.checkerPass}/${r.checkerTotal}` : null, smoke: r.smoke ?? null, reason: r.reason ?? r.smokeReason ?? null });
  writeSummary();
}

const gauge = setInterval(() => log.emit("gauge", null, { builders: active, queued: queue.length, globalAgents: globalAgents() }), 10000);
const running = [];
while (queue.length) {
  if (active >= CONCURRENCY || globalAgents() >= MAX_GLOBAL_AGENTS) { await sleep(5000); continue; }
  const game = queue.shift();
  active += 1;
  running.push(worker(game));
  await sleep(15000);
}
await Promise.all(running);
clearInterval(gauge);
log.emit("end", null, { counts: [...results.values()].reduce((a, r) => ({ ...a, [r.state]: (a[r.state] ?? 0) + 1 }), {}) });
log.close();
writeSummary();
