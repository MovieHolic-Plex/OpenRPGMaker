// 명세 은행(모델 없음) — 저장된 조수 게임의 «모델이 보낸 명세»만 남겨 두고, 빌더를 고칠 때마다 그 명세 전부를 지금 코드로 다시 지어 수치와 그림을 견준다.
// 왜: v2 는 모델이 명세(청사진·장소·경로 단계)만 쓰고 함수가 맵·문·출구·적·HUD·끝맺음을 짓는다. 눈가림 플레이가 짚은 결함은 거의 그 함수 쪽인데,
//     고친 것을 저장본 두세 판이나 90분짜리 Terra 판으로만 확인했다. 은행은 같은 명세로 빌더만 다시 돌린다.
//
//   bun scripts/qa/assistant-v2/specBank.mts ab --out <결과 폴더> [--base origin/main] [--only id,id] [--jobs N]
//        빌더를 고친 사람이 쓰는 한 줄: 기준 커밋의 빌더(<결과>/a)와 지금 작업 폴더의 빌더(<결과>/b)로 은행을 돌리고 대조를 찍는다.
//   bun scripts/qa/assistant-v2/specBank.mts run --out <결과 폴더> [--at <커밋>] [--only id,id] [--jobs N] [--no-render] [--no-autoplay]
//        은행의 명세마다 재생 → 재기. --at 을 주면 그 커밋의 빌더로 재생한다(/tmp 에 임시 작업 폴더를 만들고 끝나면 지운다). 재는 자는 늘 지금 폴더의 것.
//   bun scripts/qa/assistant-v2/specBank.mts --diff <결과A> <결과B>        칸마다 은행 합계의 전/후와 나빠진 게임 목록
//   bun scripts/qa/assistant-v2/specBank.mts extract <판 폴더>… [--out <은행 폴더>]   저장된 판 → 명세 파일(은행에 더한다)
//   bun scripts/qa/assistant-v2/specBank.mts measure <결과 폴더>            재생은 두고 재기만 다시(탐침을 고친 뒤)
//   bun scripts/qa/assistant-v2/specBank.mts list                           은행에 든 것
// 문서: openwiki/assistant-v2.md 「명세 은행」.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { diffReport, gameTable, METRICS, show, sumMetrics, table, type GameMetrics } from "./specBank/metrics.mts";
import type { Spec } from "./specBank/spec.mts";

const ROOT = path.resolve(import.meta.dir, "../../..");
const BANK = path.join(ROOT, "harness-data/assistant-capability/spec-bank");
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined; };
const has = (name: string): boolean => argv.includes(name);
const VALUE_FLAGS = ["--out", "--at", "--only", "--jobs", "--bank", "--base"];
const rest = argv.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(argv[i - 1] ?? ""));
const bankDir = flag("--bank") ?? BANK;

const sh = (cmd: string[], cwd = ROOT): { code: number; out: string; err: string } => { const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" }); return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }; };
const specFiles = (): string[] => fs.existsSync(bankDir) ? fs.readdirSync(bankDir).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(bankDir, f)) : [];
const readSpec = (file: string): Spec => JSON.parse(fs.readFileSync(file, "utf8")) as Spec;

/** 일 여럿을 동시에 n 개씩. */
async function pool<T>(items: readonly T[], n: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => { while (next < items.length) await work(items[next++]!); }));
}
async function spawn(cmd: string[], cwd: string, logFile: string, env: Record<string, string> = {}): Promise<number> {
  const log = fs.openSync(logFile, "a");
  try {
    const child = Bun.spawn(cmd, { cwd, stdout: log, stderr: log, env: { ...process.env, ...env } });
    // 게임 하나가 멈춰 서도 은행 전체가 기다리지 않게 — 45분이면 끊는다.
    const timer = setTimeout(() => child.kill(), 45 * 60_000);
    try { return await child.exited; } finally { clearTimeout(timer); }
  } finally { fs.closeSync(log); }
}

function loadMetrics(dir: string): GameMetrics[] {
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "metrics.json"))).sort().map((d) => JSON.parse(fs.readFileSync(path.join(dir, d, "metrics.json"), "utf8")) as GameMetrics);
}

/** 결과 폴더의 요약(bank.json · bank.txt) — 게임마다 표 하나, 은행 합계 표 하나. */
function summarize(out: string, meta: Record<string, unknown>): void {
  const games = loadMetrics(out);
  const total = sumMetrics(games);
  const wholeGames = games.filter((g) => g.kind !== "place"), places = games.filter((g) => g.kind === "place");
  const gameTotal = sumMetrics(wholeGames), placeTotal = sumMetrics(places);
  const replays = games.map((g) => { const f = path.join(out, g.id, "replay.json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) as { id: string; ms: number; calls: { total: number; played: number; sameOutcome: number; writes: number; writesSame: number; needsOutside: string[]; unresolvedIds: string[]; okToFail: string[]; renamed?: string[]; resent?: string[] }; turns: { forced: number; error?: string }[]; salts: { recorded: number; kept: number }; pictures: string[] } : undefined; });
  const keys = METRICS.filter((d) => total[d.key] !== undefined);
  const text = [
    `명세 은행 — ${String(meta.head ?? "")}${meta.at ? ` (빌더 ${String(meta.at)})` : ""} · 게임 ${games.length} · ${String(meta.wallSec ?? "?")}초`,
    "",
    "## 은행 합계",
    table([["칸", `합계(${games.length})`, `게임 하나(${wholeGames.length})`, `장소 하나(${places.length})`], ...keys.map((d) => [d.label, show(total[d.key]), show(gameTotal[d.key]), show(placeTotal[d.key])])]),
    "",
    "## 그대로 못 되살린 호출",
    ...replays.filter(Boolean).map((r) => `${r!.id}: 재생 ${r!.calls.played}/${r!.calls.total} · 그때와 다른 결과 ${r!.calls.played - r!.calls.sameOutcome} · 못 찾은 id ${r!.calls.unresolvedIds.length} · 모델·그림이 있어야 하는 호출 ${r!.calls.needsOutside.length} · 판정자가 다시 연 자리(대본을 이어 붙임) ${r!.turns.reduce((n, t) => n + t.forced, 0)}${r!.calls.renamed?.length ? ` · 이름이 바뀐 도구 ${r!.calls.renamed.length}` : ""}${r!.calls.resent?.length ? ` · 지금 규칙이 돌려보내 다시 보낸 청사진 ${r!.calls.resent.join(", ")}` : ""}${r!.turns.some((t) => t.error) ? " · 예외로 멈춤" : ""}`),
    "",
    ...games.flatMap((g) => [`## ${g.id}`, gameTable(g), ...(g.probeErrors.length ? [`탐침 오류: ${g.probeErrors.join(" | ")}`] : []), `그림: ${path.join(out, g.id, "maps")}/`, ""]),
    "(수치는 그림을 보지 않은 것이다 — 화면 미검증)",
  ].join("\n");
  fs.writeFileSync(path.join(out, "bank.txt"), `${text}\n`);
  fs.writeFileSync(path.join(out, "bank.json"), JSON.stringify({ ...meta, games: games.map((g) => g.id), total, perGame: Object.fromEntries(games.map((g) => [g.id, g.values])), replay: Object.fromEntries(replays.filter(Boolean).map((r) => [r!.id, { ms: r!.ms, calls: { ...r!.calls, okToFail: r!.calls.okToFail.length }, forced: r!.turns.reduce((n, t) => n + t.forced, 0), salts: r!.salts, pictures: r!.pictures.length }])) }, null, 1));
}

async function measureAll(out: string, ids: readonly string[], jobs: number): Promise<void> {
  await pool(ids.filter((id) => fs.existsSync(path.join(out, id, "project.json"))), jobs, async (id) => {
    const code = await spawn(["bun", path.join(ROOT, "scripts/qa/assistant-v2/specBank/measureGame.mts"), path.join(out, id), ...(has("--no-autoplay") ? ["--no-autoplay"] : [])], ROOT, path.join(out, id, "measure.log"));
    if (code !== 0) console.log(`  ${id}: 재기 실패(exit ${code}) — ${path.join(out, id, "measure.log")}`);
  });
}

async function run(): Promise<void> {
  const out = path.resolve(flag("--out") ?? "");
  if (!flag("--out")) { console.error("run --out <결과 폴더> 가 필요하다"); process.exit(2); }
  const only = flag("--only")?.split(",").filter(Boolean);
  // 호출이 많은 게임부터 — 긴 것이 먼저 시작해야 전체 시간이 가장 긴 게임 하나의 시간에 가깝다.
  const size = (f: string) => readSpec(f).turns.reduce((n, t) => n + t.calls.length, 0);
  const files = specFiles().filter((f) => !only || only.includes(path.basename(f, ".json"))).sort((a, b) => size(b) - size(a));
  if (!files.length) { console.error(`은행(${bankDir})에 명세가 없다`); process.exit(2); }
  // 재생 하나가 3~4GB 를 쓴다. 기본은 코어 셋에 하나(32코어 → 10개).
  const jobs = Number(flag("--jobs") ?? Math.max(1, Math.floor(os.cpus().length / 3)));
  const started = Date.now();
  fs.mkdirSync(out, { recursive: true });
  const head = sh(["git", "rev-parse", "--short=10", "HEAD"]).out.trim();
  // --at <커밋>: 그 커밋의 빌더로 재생한다. 임시 작업 폴더를 /tmp 에 만들고(패키지는 이 폴더의 것을 잇는다) 이 재생기를 복사해 넣는다.
  const at = flag("--at");
  let cwd = ROOT, atSha = "", worktree = "";
  if (at) {
    atSha = sh(["git", "rev-parse", "--short=10", at]).out.trim();
    if (!atSha) { console.error(`커밋을 못 찾음: ${at}`); process.exit(2); }
    worktree = path.join(os.tmpdir(), `spec-bank-${atSha}-${process.pid}`);
    const add = sh(["git", "worktree", "add", "--detach", worktree, atSha]);
    if (add.code !== 0) { console.error(`임시 작업 폴더를 못 만듦: ${add.err.slice(-300)}`); process.exit(2); }
    fs.symlinkSync(fs.realpathSync(path.join(ROOT, "node_modules")), path.join(worktree, "node_modules"));
    fs.cpSync(path.join(ROOT, "scripts/qa/assistant-v2/specBank"), path.join(worktree, "scripts/qa/assistant-v2/specBank"), { recursive: true });
    cwd = worktree;
  }
  console.log(`명세 은행: 게임 ${files.length} · 동시에 ${jobs} · 빌더 ${atSha || head}${at ? ` (${at})` : ""} · 결과 ${out}`);
  try {
    await pool(files, jobs, async (file) => {
      const id = path.basename(file, ".json");
      const dir = path.join(out, id);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const t0 = Date.now();
      const code = await spawn(["bun", path.join(cwd, "scripts/qa/assistant-v2/specBank/replayGame.mts"), file, dir, ...(has("--no-render") ? ["--no-render"] : [])], cwd, path.join(dir, "replay.log"), { SPEC_BANK_HEAD: atSha || head });
      const line = fs.existsSync(path.join(dir, "replay.log")) ? fs.readFileSync(path.join(dir, "replay.log"), "utf8").trim().split("\n").filter((l) => l.startsWith(`${id}:`)).at(-1) : "";
      console.log(`  ${line || `${id}: 재생 실패(exit ${code}) — ${path.join(dir, "replay.log")}`} [${Math.round((Date.now() - t0) / 1000)}초]`);
    });
  } finally {
    if (worktree) { sh(["git", "worktree", "remove", "--force", worktree]); fs.rmSync(worktree, { recursive: true, force: true }); sh(["git", "worktree", "prune"]); }
  }
  const replaySec = Math.round((Date.now() - started) / 1000);
  // 재기는 재생보다 가볍다(탐침 하나씩, 1GB 안팎) — 두 배로 띄운다.
  await measureAll(out, files.map((f) => path.basename(f, ".json")), jobs * 2);
  const wallSec = Math.round((Date.now() - started) / 1000);
  summarize(out, { head, ...(at ? { at: atSha, atRef: at } : {}), jobs, replaySec, wallSec, finishedAt: new Date().toISOString() });
  console.log(`\n${fs.readFileSync(path.join(out, "bank.txt"), "utf8").split("\n## 그대로 못 되살린")[0]}`);
  console.log(`끝 — 재생 ${replaySec}초 · 전체 ${wallSec}초 · 표 ${path.join(out, "bank.txt")} · 그림 ${out}/<게임>/maps/`);
}

function diff(): number {
  const [a, b] = argv.slice(argv.indexOf("--diff") + 1);
  if (!a || !b) { console.error("--diff <결과A> <결과B>"); return 2; }
  const name = (dir: string) => { const f = path.join(dir, "bank.json"); const meta = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) as { at?: string; head?: string } : {}; return `${path.basename(path.resolve(dir))}@${meta.at ?? meta.head ?? "?"}`; };
  const report = diffReport(loadMetrics(a), loadMetrics(b), name(a), name(b));
  console.log(report.text);
  return 0;
}

function list(): void {
  const rows = specFiles().map((f) => { const s = readSpec(f); const calls = s.turns.reduce((n, t) => n + t.calls.length, 0); return [s.id, s.kind, s.reference.final?.blueprint?.setting ?? "-", s.source.head, String(s.turns.length), String(calls), String(Object.keys(s.salts).length), s.request.slice(0, 40)]; });
  console.log(table([["id", "갈래", "세계", "지은 커밋", "턴", "호출", "소금", "요청"], ...rows]));
  console.log(`\n${rows.length}개 · ${bankDir}`);
}

/** 전/후를 한 번에: 기준 커밋(기본 origin/main)의 빌더와 지금 작업 폴더의 빌더로 은행을 차례로 돌리고 대조를 찍는다. */
async function ab(): Promise<number> {
  const out = path.resolve(flag("--out") ?? "");
  if (!flag("--out")) { console.error("ab --out <결과 폴더> [--base origin/main] 가 필요하다"); return 2; }
  const base = flag("--base") ?? "origin/main";
  const pass = [...(flag("--only") ? ["--only", flag("--only")!] : []), ...(flag("--jobs") ? ["--jobs", flag("--jobs")!] : []), ...(has("--no-render") ? ["--no-render"] : []), ...(has("--no-autoplay") ? ["--no-autoplay"] : []), ...(flag("--bank") ? ["--bank", flag("--bank")!] : [])];
  const self = path.join(ROOT, "scripts/qa/assistant-v2/specBank.mts");
  for (const args of [["run", "--at", base, "--out", path.join(out, "a"), ...pass], ["run", "--out", path.join(out, "b"), ...pass]]) {
    const code = Bun.spawnSync(["bun", self, ...args], { cwd: ROOT, stdout: "inherit", stderr: "inherit" }).exitCode;
    if (code !== 0) return code;
  }
  return Bun.spawnSync(["bun", self, "--diff", path.join(out, "a"), path.join(out, "b")], { cwd: ROOT, stdout: "inherit", stderr: "inherit" }).exitCode;
}

const command = has("--diff") ? "diff" : rest[0];
if (command === "diff") process.exit(diff());
else if (command === "run") await run();
else if (command === "ab") process.exit(await ab());
else if (command === "list") list();
else if (command === "measure") {
  const out = path.resolve(rest[1] ?? "");
  const ids = fs.readdirSync(out).filter((d) => fs.existsSync(path.join(out, d, "project.json")));
  await measureAll(out, ids, Number(flag("--jobs") ?? 4));
  const prior = fs.existsSync(path.join(out, "bank.json")) ? JSON.parse(fs.readFileSync(path.join(out, "bank.json"), "utf8")) as Record<string, unknown> : {};
  summarize(out, { head: prior.head, ...(prior.at ? { at: prior.at } : {}), wallSec: prior.wallSec, jobs: prior.jobs, replaySec: prior.replaySec, remeasuredAt: new Date().toISOString() });
  console.log(fs.readFileSync(path.join(out, "bank.txt"), "utf8").split("\n## 그대로 못 되살린")[0]);
} else if (command === "extract") {
  const code = Bun.spawnSync(["bun", path.join(ROOT, "scripts/qa/assistant-v2/specBank/extract.mts"), ...rest.slice(1), "--out", flag("--out") ?? bankDir], { cwd: ROOT, stdout: "inherit", stderr: "inherit" }).exitCode;
  process.exit(code);
} else {
  console.log("usage: specBank.mts ab --out <dir> [--base origin/main] | run --out <dir> [--at <commit>] [--only id,…] [--jobs N] | --diff <A> <B> | extract <run-dir>… | measure <dir> | list");
  process.exit(2);
}
