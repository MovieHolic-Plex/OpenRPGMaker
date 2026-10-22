// 공방 「한 번에 만들기」 물건의 3/4 관문(object-gate) — 호스트(동반 서비스: vite dev/preview·로컬 서버·Electron)에서 돈다.
//
// 왜 호스트인가(2026-10-23): 관문 영수증의 판정자는 프로필에 묶인 `claude -p`(Sonnet 5.5 high) 다(rules.ts OBJECT_GATE_PROFILE).
// 브라우저의 사용자 AI 계정으로 같은 지시문을 부르면 다른 판정자라 영수증이 아니다. 그래서 캐릭터(char-gen)처럼 호스트가 사용자 컴퓨터의
// Claude Code 로그인으로 판정기(src/harnesses/object-gate/node/judge.mts 의 `workshop` 단계)를 그대로 띄운다. 우리 키는 없다.
//
// 입구(scripts/lib/ohMyPiHttp.mjs):
//   POST /v1/workshop/gate          { png:"data:image/png;base64,…", kind, name?, label?, chipset? } → { ok, jobId }
//   GET  /v1/workshop/gate?jobId=   → { state: running|done|failed|cancelled, result?: { final: pass|fail, verdict, reasons, … }, error? }
//   POST /v1/workshop/gate/cancel   { jobId }
// 결과 final: 영수증 PASS → pass. REFER → 새 적대 검사(같은 판정자, 새 호출) 한 번이 정한다. FAIL → fail. 임계값·표 수·판정자는 바꾸지 않는다.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const JOB_TTL_MS = 2 * 60 * 60 * 1000;
/** 관문 한 장 상한 — 판정자 11번(동시 4) + 적대 검사 1번이 보통 2~4분. 할당량 대기로 길어지면 끊고 「못 그림」으로 본다. */
const TIMEOUT_MS = 20 * 60 * 1000;
const jobs = new Map();
const now = () => Date.now();
const newId = () => `q${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function repoRoot() {
  return process.env.OPRN_REPO_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}
function workRoot() {
  return process.env.OPRN_WORKSHOP_GATE_WORK || join(homedir(), ".cache", "oprn", "workshop-gate", "work");
}
function has(name) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function killTree(child) {
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch { /* 이미 끝남 */ }
}

function lastJson(text) {
  const lines = text.trim().split("\n").reverse();
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    try { return JSON.parse(line); } catch { /* 다음 줄 */ }
  }
  return null;
}

/** bun 경로 — PATH 에 없으면(서비스로 뜬 호스트) 기본 설치 자리. */
function bunPath() {
  if (has("bun")) return "bun";
  const home = join(homedir(), ".bun", "bin", process.platform === "win32" ? "bun.exe" : "bun");
  return existsSync(home) ? home : null;
}

/** 이 컴퓨터에서 관문을 돌릴 수 없는 까닭(없으면 null). */
export function workshopGateUnavailable() {
  const judge = join(repoRoot(), "src", "harnesses", "object-gate", "node", "judge.mts");
  if (!existsSync(judge)) return "이 편집기 설치에는 그림 확인기가 없어요(편집기 저장소 체크아웃에서만 돌아요).";
  if (!bunPath()) return "그림 확인기를 돌릴 bun 이 이 컴퓨터에 없어요.";
  if (!has("claude")) return "그림 확인에 쓰는 Claude Code 가 이 컴퓨터에 없어요. 설치하고 로그인하면 물건을 알아서 넣을 수 있어요.";
  return null;
}

function prune() {
  const t = now();
  for (const [id, job] of jobs) if (job.finishedAt && t - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
}

export function startWorkshopGate(body = {}) {
  prune();
  const why = workshopGateUnavailable();
  if (why) return { ok: false, unavailable: true, error: why };
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/u.exec(String(body.png ?? ""));
  if (!match) return { ok: false, error: "png 는 data:image/png;base64 주소여야 한다" };
  const kind = String(body.kind ?? "").replace(/[^a-z_]/gu, "");
  if (!kind) return { ok: false, error: "kind 가 없다" };
  const id = newId();
  const dir = join(workRoot(), id);
  mkdirSync(dir, { recursive: true });
  const png = join(dir, "candidate.png");
  writeFileSync(png, Buffer.from(match[1], "base64"));
  const args = [join(repoRoot(), "src", "harnesses", "object-gate", "node", "judge.mts"), "workshop", "--png", png, "--kind", kind,
    "--name", String(body.name ?? "workshop object").slice(0, 80), "--label", `workshop/${String(body.label ?? body.name ?? id).slice(0, 80)}`];
  if (body.chipset) args.push("--chipset", String(body.chipset).replace(/[^A-Za-z0-9_-]/gu, ""));
  const job = { id, state: "running", startedAt: now(), finishedAt: null, result: null, error: null, child: null };
  jobs.set(id, job);
  let child;
  try {
    child = spawn(bunPath(), args, { cwd: repoRoot(), env: process.env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
  } catch (error) {
    job.state = "failed"; job.error = String(error); job.finishedAt = now();
    return { ok: true, jobId: id };
  }
  job.child = child;
  let stdout = "", stderr = "";
  child.stdout.on("data", (d) => { stdout += d; });
  child.stderr.on("data", (d) => { stderr += d; if (stderr.length > 200_000) stderr = stderr.slice(-100_000); });
  const timer = setTimeout(() => { if (job.state === "running") { job.error = "그림 확인이 너무 오래 걸려 멈췄어요."; killTree(child); } }, TIMEOUT_MS);
  child.on("close", (code) => {
    clearTimeout(timer);
    job.child = null;
    job.finishedAt = now();
    if (job.state === "cancelled") return;
    const result = lastJson(stdout);
    if (code === 0 && result?.ok) { job.state = "done"; job.result = result; return; }
    job.state = "failed";
    job.error ??= (code === 4 ? "그림 확인 모델(Claude Sonnet)을 지금 쓸 수 없어요(사용 한도·로그인)." : `그림 확인기가 멈췄어요(code ${code}): ${(stderr || stdout).trim().split("\n").slice(-2).join(" ").slice(0, 240)}`);
  });
  child.on("error", (error) => { job.error = String(error); });
  return { ok: true, jobId: id };
}

export function workshopGateStatus(jobId) {
  const job = jobs.get(String(jobId ?? ""));
  if (!job) return { ok: false, state: "missing", error: "이 확인 작업을 호스트가 모릅니다(호스트가 다시 시작됐을 수 있어요)." };
  return { ok: true, jobId: job.id, state: job.state, elapsedMs: (job.finishedAt ?? now()) - job.startedAt, result: job.result, error: job.error };
}

export function cancelWorkshopGate(jobId) {
  const job = jobs.get(String(jobId ?? ""));
  if (!job) return { ok: false };
  if (job.state === "running") {
    job.state = "cancelled";
    job.finishedAt = now();
    if (job.child) killTree(job.child);
  }
  return { ok: true };
}
