// 런타임 QA 체크포인트 — 시나리오를 타이틀부터 다시 하지 않고 단계마다 바로 시작한다.
//
// 세트 파일: scripts/qa/runtime/checkpoints/<세트>.json
//   { "set": "fallen-star",
//     "query": { "demo": "fallen-star" },      // 플레이어 URL 쿼리(데모 부팅). 생략 가능
//     "projectFixture": ".omo/fs/v1.json",     // 픽스처 JSON 으로 부팅할 때. 생략 가능
//     "viewport": { "width": 480, "height": 270 },
//     "context": { "hasTouch": true, "isMobile": true },   // 브라우저 컨텍스트 옵션(모바일 터치). 생략 가능
//     "defaultBeats": [ …비트… ],               // 체크포인트에 beats 가 없을 때
//     "checkpoints": [ { "id": "boss", "mapId": "…", "x": 3, "y": 4, "switches": {…}, "beats": [ … ] } ] }
// 체크포인트 하나의 상태 필드는 src/player/qaCheckpoint.ts 의 QaCheckpoint 와 같다.
// 체크포인트마다 새 브라우저 컨텍스트에서 돈다 — 하나가 죽어도 나머지는 계속 간다.
// 문서: openwiki/testing.md 「런타임 QA 체크포인트」.
import { existsSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runRuntimeQa } from "./runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const CHECKPOINT_DIR = join(REPO_ROOT, "scripts/qa/runtime/checkpoints");

/** 체크포인트에 비트가 없을 때: 도착을 기다렸다가 한 장 찍는다. */
export const DEFAULT_CHECKPOINT_BEATS = [
  { id: "arrive", note: "체크포인트 도착", ops: [{ kind: "hold", dir: null, ms: 1500 }], shot: true },
];

/** 체크포인트 실행 결과에 남기지 않는 키(상태 필드는 세션으로 들어가고, beats 는 시나리오가 된다). */
const NON_STATE_KEYS = new Set(["beats", "note"]);

export function checkpointSetPath(name) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`체크포인트 세트 이름은 kebab-case: ${name}`);
  return join(CHECKPOINT_DIR, `${name}.json`);
}

export async function loadCheckpointSet(name) {
  const path = checkpointSetPath(name);
  if (!existsSync(path)) throw new Error(`체크포인트 세트가 없다: ${path}`);
  const set = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(set.checkpoints)) throw new Error(`${path}: checkpoints 배열이 없다`);
  const seen = new Set();
  for (const checkpoint of set.checkpoints) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(checkpoint.id ?? "")) throw new Error(`${path}: 체크포인트 id 는 kebab-case: ${checkpoint.id}`);
    if (seen.has(checkpoint.id)) throw new Error(`${path}: 중복 체크포인트 ${checkpoint.id}`);
    seen.add(checkpoint.id);
  }
  return { ...set, path };
}

/** `all` · `a,b,c` · 접두사 `boss*` 를 받는다. 순서는 세트 파일 순서다. */
export function selectCheckpoints(set, spec) {
  if (!spec || spec === "all") return set.checkpoints;
  const wanted = spec.split(",").map((part) => part.trim()).filter(Boolean);
  const picked = set.checkpoints.filter((checkpoint) => wanted.some((want) =>
    want.endsWith("*") ? checkpoint.id.startsWith(want.slice(0, -1)) : checkpoint.id === want));
  const unknown = wanted.filter((want) => !want.endsWith("*") && !set.checkpoints.some((c) => c.id === want));
  if (unknown.length > 0) {
    throw new Error(`세트 ${set.set ?? ""} 에 없는 체크포인트: ${unknown.join(", ")} (있는 것: ${set.checkpoints.map((c) => c.id).join(", ")})`);
  }
  if (picked.length === 0) throw new Error(`체크포인트 ${spec} 에 맞는 것이 없다`);
  return picked;
}

/** 체크포인트에서 돌릴 시나리오. 우선순위: 시나리오 checkpointBeats(fn|map) → 체크포인트 beats → 세트 defaultBeats → 기본. */
export function scenarioForCheckpoint(scenario, set, checkpoint) {
  const fromScenario = typeof scenario.checkpointBeats === "function"
    ? scenario.checkpointBeats(checkpoint)
    : scenario.checkpointBeats?.[checkpoint.id];
  const beats = fromScenario ?? checkpoint.beats ?? set.defaultBeats ?? DEFAULT_CHECKPOINT_BEATS;
  return {
    ...scenario,
    id: `${scenario.id}--${checkpoint.id}`,
    ...(set.query && !scenario.query ? { query: set.query } : {}),
    ...(set.projectFixture && !scenario.projectFixture ? { projectFixture: set.projectFixture } : {}),
    ...(set.viewport && !scenario.viewport ? { viewport: set.viewport } : {}),
    beats,
  };
}

export function checkpointBootState(checkpoint) {
  return Object.fromEntries(Object.entries(checkpoint).filter(([key]) => !NON_STATE_KEYS.has(key)));
}

/**
 * 체크포인트들을 서로 독립된 페이지에서 돌린다. parallel 개의 일꾼이 각자 브라우저 하나를 쓰고,
 * 브라우저가 죽으면 다음 체크포인트 전에 다시 띄운다.
 */
/**
 * 부하 상한: 1분 load 가 코어 수를 넘으면 일꾼을 1 로 줄인다. 실측(2026-10-21, load 200+/32코어):
 * --parallel 2 에서 렌더러가 «Target crashed» 로 죽었고 1 에서는 통과했다.
 */
export function boundParallelByLoad(requested, load = loadavg()[0], cores = availableParallelism()) {
  return load > cores ? 1 : requested;
}

const isCrash = (result) => result.failures.some((f) => /Target crashed|Target page, context or browser has been closed|Page crashed|did not become ready|Timeout \d+ms exceeded/.test(f));

export async function runCheckpoints({ scenario, set, checkpoints, parallel = 2, launchBrowser, serverUrl, outRoot }) {
  await rm(outRoot, { recursive: true, force: true });
  await mkdir(outRoot, { recursive: true });
  const effectiveParallel = boundParallelByLoad(parallel);
  if (effectiveParallel !== parallel) console.log(JSON.stringify({ parallelBoundedByLoad: { requested: parallel, using: effectiveParallel, load1m: loadavg()[0] } }));
  parallel = effectiveParallel;
  const queue = checkpoints.map((checkpoint, index) => ({ checkpoint, index }));
  const results = new Array(checkpoints.length);
  const worker = async () => {
    let browser = null;
    try {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        const { checkpoint, index } = job;
        const outDir = join(outRoot, checkpoint.id);
        const startedAt = Date.now();
        let context = null;
        try {
          if (!browser?.isConnected()) browser = await launchBrowser();
          const checkpointScenario = scenarioForCheckpoint(scenario, set, checkpoint);
          // QA_RECORD_VIDEO=<폴더> — 체크포인트마다 <폴더>/<체크포인트 id>/ 에 webm 하나. 컨텍스트를 닫아야 파일로 끝난다.
          const videoDir = process.env.QA_RECORD_VIDEO;
          const size = checkpointScenario.viewport;
          // 시나리오 deviceScaleFactor — 소수 배율 화면(Windows 125%·150%)의 도트 정렬을 잴 때.
          const dsf = checkpointScenario.deviceScaleFactor ? { deviceScaleFactor: checkpointScenario.deviceScaleFactor } : {};
          // 세트 context — 브라우저 컨텍스트 옵션(예: 모바일 { "hasTouch": true, "isMobile": true }). 터치 탭 op(tap)이 이것을 쓴다.
          const extra = set.context ?? {};
          context = await browser.newContext(videoDir
            ? { ...extra, ...dsf, ...(size ? { viewport: size } : {}), recordVideo: { dir: resolve(REPO_ROOT, videoDir, checkpoint.id), ...(size ? { size } : {}) } }
            : { ...extra, ...dsf, ...(size ? { viewport: size } : {}) });
          const page = await context.newPage();
          // 영상 시작 시각 — actors.jsonl 의 t(ms) 와 빼면 영상 안 위치(초)가 된다. 움직임 구간을 잘라 낼 때 쓴다.
          if (videoDir) {
            const dir = resolve(REPO_ROOT, videoDir, checkpoint.id);
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, "start.json"), JSON.stringify({ startedAt: Date.now() }));
          }
          const report = await runRuntimeQa(page, checkpointScenario, {
            serverUrl,
            outDir,
            checkpoint: checkpointBootState(checkpoint),
          });
          const failed = report.beats.filter((beat) => beat.failures.length > 0);
          results[index] = {
            id: checkpoint.id,
            label: checkpoint.label ?? "",
            ok: failed.length === 0 && report.errors.length === 0,
            bootMs: report.timing?.bootMs ?? null,
            totalMs: Date.now() - startedAt,
            shots: report.beats.filter((beat) => beat.shot).map((beat) => `${checkpoint.id}/${beat.shot}`),
            failures: [...failed.flatMap((beat) => beat.failures.map((f) => `${beat.id}: ${f}`)), ...report.errors],
            capturedCheckpoints: report.capturedCheckpoints ?? [],
          };
        } catch (error) {
          results[index] = {
            id: checkpoint.id,
            label: checkpoint.label ?? "",
            ok: false,
            bootMs: null,
            totalMs: Date.now() - startedAt,
            shots: [],
            failures: [`실행 중단: ${String(error?.message ?? error).split("\n")[0]}`],
            capturedCheckpoints: [],
          };
        } finally {
          await context?.close().catch(() => {});
        }
        const r = results[index];
        console.log(JSON.stringify({ checkpoint: r.id, ok: r.ok, bootMs: r.bootMs, totalMs: r.totalMs }));
      }
    } finally {
      await browser?.close().catch(() => {});
    }
  };
  const workers = Math.max(1, Math.min(parallel, checkpoints.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  // 렌더러가 죽은 체크포인트는 혼자 한 번 더 돌린다(내용 실패는 다시 돌리지 않는다).
  const crashed = results.map((r, index) => ({ r, index })).filter(({ r }) => !r.ok && isCrash(r));
  if (crashed.length > 0) {
    console.log(JSON.stringify({ retryCrashed: crashed.map(({ r }) => r.id) }));
    for (const { index } of crashed) queue.push({ checkpoint: checkpoints[index], index });
    await worker();
    for (const { index } of crashed) results[index].retried = true;
  }
  await writeFile(join(outRoot, "checkpoints.json"), `${JSON.stringify({ scenario: scenario.id, set: set.set, results }, null, 2)}\n`);
  await writeFile(join(outRoot, "SUMMARY.md"), renderCheckpointSummary(scenario.id, set, results));
  return results;
}

export function renderCheckpointSummary(scenarioId, set, results) {
  const passed = results.filter((r) => r.ok).length;
  const lines = [
    `# ${scenarioId} · 체크포인트 세트 ${set.set ?? ""}`,
    "",
    `${passed}/${results.length} 통과. 체크포인트마다 하위 폴더에 자기 SUMMARY.md 가 있다.`,
    "",
    "| 체크포인트 | 결과 | 부팅 ms | 전체 ms | 샷 |",
    "|---|---|---|---|---|",
    ...results.map((r) => `| ${r.id}${r.label ? ` (${r.label})` : ""} | ${r.ok ? "통과" : "실패"} | ${r.bootMs ?? "-"} | ${r.totalMs} | ${r.shots.join(" ")} |`),
    "",
  ];
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    lines.push("## 즉시 확인", "");
    for (const r of failed) lines.push(`- ${r.id}: ${r.failures.slice(0, 3).join(" / ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** captureCheckpoint op 로 받은 실제 저장을 세트 파일에 넣는다. 같은 id 는 snapshot 만 바꾸고 선언 필드는 둔다. */
export async function saveCapturedCheckpoints(setName, captured) {
  if (captured.length === 0) return 0;
  const path = checkpointSetPath(setName);
  const set = existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : { set: setName, checkpoints: [] };
  for (const entry of captured) {
    const existing = set.checkpoints.find((checkpoint) => checkpoint.id === entry.id);
    if (existing) existing.snapshot = entry.snapshot;
    else set.checkpoints.push(entry);
  }
  await mkdir(CHECKPOINT_DIR, { recursive: true });
  await writeFile(path, `${JSON.stringify(set, null, 2)}\n`);
  return captured.length;
}

export function resolveOutRoot(out, scenarioId) {
  return out ? resolve(REPO_ROOT, out) : join(REPO_ROOT, "verify-shots/runtime-qa", `${scenarioId}--checkpoints`);
}
