#!/usr/bin/env node
// repro — 세션 로그(또는 손으로 쓴 op 목록)를 **새 브라우저에서 그대로 재생**하고 증상을 판정한다.
//
// 왜: qp 세션에서 본 버그는 그 세션에만 있다. 재현이란 (1) 같은 게임을 새로 띄우고,
// (2) 같은 op 을 같은 순서로 다시 하고, (3) 증상이 다시 나타나는지 보는 것이다.
// 그래서 입력은 actions.jsonl 에서 잘라낸 op 배열이고, 판정은 증상(expect)이다.
//
// 사용:
//   node scripts/qa/play/repro.mjs --game saesol-red --ops ops.json --expect expect.json --out tmp/qp/repro-1
//   node scripts/qa/play/repro.mjs --game saesol-red --ops tmp/qp/saesol-red/actions.jsonl --lines 1-5 --expect expect.json
//   … --repeat 2      (기본 2 — 두 번 다 재현돼야 REPRODUCED)
//   … --keep-opening  (오프닝 컷신을 끄지 않는다)
//
// 출력: REPRODUCED / NOT_REPRODUCED, 근거 PNG·state JSON. 비영점 = 재현되지 않음.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOpsSlice } from "../../lib/playOpsLog.mjs";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import {
  OBSERVE_ONLY_KINDS,
  bootPlayPage,
  capturePageErrors,
  evaluatePlayExpect,
  launchPlayBrowser,
  measureStuck,
  observeForExpect,
  prepareBoot,
  readPlayState,
  runPlayOp,
} from "../../lib/playSession.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const GAMES_PATH = join(REPO_ROOT, "scripts/qa/play/games.json");

function fail(message) {
  process.stderr.write(`repro: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) fail(`알 수 없는 인자: ${arg}`);
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

async function resolveGame(spec, { outRoot, gamesDir }) {
  const asPath = resolve(REPO_ROOT, spec);
  if (existsSync(asPath) && !existsSync(join(asPath, "project.json"))) {
    return { id: spec.replace(/\.(json|gz)$/, ""), file: asPath, entry: null };
  }
  const catalog = existsSync(GAMES_PATH) ? JSON.parse(await readFile(GAMES_PATH, "utf8")) : { games: [] };
  const entry = (catalog.games ?? []).find((game) => game.id === spec);
  if (!entry) fail(`모르는 게임: ${spec} — games.json 에 없거나 경로가 아니다`);
  const candidates = [
    gamesDir ? join(gamesDir, entry.id, "project.json") : null,
    join(outRoot, entry.id, "project.json"),
    // build-games 의 기본 산출물 자리 — 재현을 다른 --out 으로 돌려도 게임은 여기 있다.
    join(REPO_ROOT, "tmp/qp/games", entry.id, "project.json"),
    entry.file ? resolve(REPO_ROOT, entry.file) : null,
  ].filter(Boolean);
  const file = candidates.find((candidate) => existsSync(candidate));
  // `query` 게임은 제품 데모 분기로 부팅하므로 project.json 이 없어도 된다.
  if (!file && !entry.query) fail(`${spec}: 프로젝트 파일이 없다 — node scripts/qa/play/build-games.mjs 를 먼저 돌려라`);
  return { id: entry.id, file: file ?? null, entry };
}

/** 한 번의 재생. 반환값이 판정 근거다. */
const MAX_PACE_GAP_MS = 10_000;

async function replayOnce({ game, boot, ops, anchor, expect, attemptDir, viewport, seed, bootTimeoutMs, sharedPlayerUrl, pace }) {
  await mkdir(attemptDir, { recursive: true });
  const server = sharedPlayerUrl
    ? { url: sharedPlayerUrl, close: async () => undefined }
    : await startPlayerQaServer();
  const browser = await launchPlayBrowser();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = capturePageErrors(page);
  const runState = {};
  const opResults = [];
  let bootError = null;
  try {
    try {
      await bootPlayPage(page, { ...boot, viewport, seed, serverUrl: server.url, timeoutMs: bootTimeoutMs, checkpoint: anchor?.checkpoint ?? null });
    } catch (error) {
      bootError = String(error?.message ?? error);
      await page.screenshot({ path: join(attemptDir, "boot-failure.png") }).catch(() => undefined);
    }
    if (!bootError && anchor) opResults.push({ op: { kind: "anchor", line: anchor.line, save: anchor.save, at: anchor.at }, ok: true });
    let previousRecordedAt = null;
    let previousEndedAt = null;
    for (const op of ops) {
      if (bootError) break;
      if (OBSERVE_ONLY_KINDS.has(op.kind) || op.skip === true) {
        opResults.push({ op, skipped: true });
        continue;
      }
      // A session log was played by a person-paced agent: dialogue reveal, fades and encounter rolls all advance
      // in real time between its inputs. Replaying the inputs back-to-back lands them in different scene states,
      // so keep the recorded gap between inputs (capped) unless --no-pace.
      if (pace && Number.isFinite(op.recordedAt) && previousRecordedAt !== null) {
        const recordedGap = op.recordedAt - previousRecordedAt;
        const spent = Date.now() - previousEndedAt;
        const pause = Math.min(Math.max(recordedGap - spent, 0), MAX_PACE_GAP_MS);
        if (pause > 0) await page.waitForTimeout(pause);
      }
      if (Number.isFinite(op.recordedAt)) previousRecordedAt = op.recordedAt;
      const startedAt = Date.now();
      try {
        const outcome = await runPlayOp(page, op, runState);
        previousEndedAt = Date.now();
        opResults.push({ op, ok: true, ms: Date.now() - startedAt, ...(outcome?.note ? { note: outcome.note } : {}) });
      } catch (error) {
        opResults.push({ op, ok: false, ms: Date.now() - startedAt, error: String(error?.message ?? error).split("\n")[0] });
        break; // 전제가 깨진 뒤의 op 은 다른 증상을 만든다.
      }
    }
    const observed = await observeForExpect(page, { consoleErrors: pageErrors });
    const state = await readPlayState(page);
    if (expect?.stuck) {
      const stuck = await measureStuck(page, { noProgressMs: Number(expect.stuck.noProgressMs ?? 2000) });
      observed.stuck = stuck;
      opResults.push({ op: { kind: "measureStuck", noProgressMs: expect.stuck.noProgressMs }, ok: true, ...(stuck.stuck ? { note: "no progress" } : {}) });
    }
    await page.screenshot({ path: join(attemptDir, "evidence.png") }).catch(() => undefined);
    const failures = bootError ? [`boot 실패: ${bootError}`] : evaluatePlayExpect(expect, observed);
    const evidence = { attemptDir, observed: { ...observed, bodyText: `${observed.bodyText.slice(0, 2000)}…` }, state, failures, opResults, bootError };
    await writeFile(join(attemptDir, "state.json"), `${JSON.stringify({ state, observed: evidence.observed, failures, opResults, bootError }, null, 2)}\n`);
    return { reproduced: failures.length === 0, failures, evidence };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (!flags.game) fail("--game <id|path> 가 필요하다");
  if (!flags.ops) fail("--ops <file> 가 필요하다");
  if (!flags.expect) fail("--expect <file> 가 필요하다");
  const repeat = Number(flags.repeat ?? 2);
  if (!Number.isInteger(repeat) || repeat < 1) fail(`--repeat 는 1 이상: ${flags.repeat}`);
  const outDir = resolve(REPO_ROOT, String(flags.out ?? `tmp/qp/repro-${Date.now()}`));
  await mkdir(outDir, { recursive: true });
  const outRoot = flags["games-out"] ? resolve(REPO_ROOT, String(flags["games-out"])) : join(REPO_ROOT, "tmp/qp/games");
  const gamesDir = flags["games-dir"] ? resolve(REPO_ROOT, String(flags["games-dir"])) : null;
  const game = await resolveGame(String(flags.game), { outRoot, gamesDir });
  // 토막 자르기·세이브 앵커는 to-scenario.mjs 와 **같은 모듈**을 쓴다(scripts/lib/playOpsLog.mjs).
  const { ops, anchor } = await loadOpsSlice(resolve(REPO_ROOT, String(flags.ops)), {
    lines: flags.lines, anchor: flags["no-anchor"] !== true,
  });
  if (ops.length === 0) fail("op 이 0개다 — --lines 범위를 확인해라");
  if (anchor) process.stdout.write(`anchor: line ${anchor.line} save ${anchor.save} ${anchor.at ? `${anchor.at.mapId} (${anchor.at.x},${anchor.at.y})` : ""}\n`);
  const expect = JSON.parse(await readFile(resolve(REPO_ROOT, String(flags.expect)), "utf8"));
  const boot = await prepareBoot({
    projectFile: game.file, entry: game.entry, dir: outDir, keepOpening: flags["keep-opening"] === true,
  });
  // --session <dir>: replay under the session's own viewport and seed (qp.ready) — a different window size changes
  // the layout and a different seed changes encounter rolls, so a log replayed under defaults is not the same run.
  const session = flags.session
    ? JSON.parse(await readFile(join(resolve(REPO_ROOT, String(flags.session)), "qp.ready"), "utf8"))
    : null;
  const sessionViewport = session?.viewport ? `${session.viewport.width}x${session.viewport.height}` : null;
  const [width, height] = String(flags.viewport ?? sessionViewport ?? "1024x768").split("x").map(Number);
  const viewport = { width: width || 1024, height: height || 768 };
  const seed = Number(flags.seed ?? session?.seed ?? 1);
  const pace = flags["no-pace"] !== true;
  // 부하가 큰 호스트에서는 부팅이 2~3분 걸린다. 재현 실패의 원인이 «느린 부팅» 인지
  // «증상 없음» 인지 갈리도록 부팅 대기만 따로 늘릴 수 있게 둔다.
  const bootTimeoutMs = Number(flags["boot-timeout"] ?? 240_000);
  // 공유 서버: 세션 여러 개를 한 상자에서 돌릴 때 vite dev 서버를 재현마다 새로 띄우면
  // node_modules/.vite 캐시를 서로 덮어쓴다. player-server.mjs 가 띄운 서버에 붙인다.
  const sharedPlayerUrl = flags["player-url"] ? String(flags["player-url"]).replace(/\/$/, "") : null;
  if (sharedPlayerUrl && !/^http:\/\/127\.0\.0\.1:\d+$/.test(sharedPlayerUrl)) {
    fail(`--player-url 은 http://127.0.0.1:<port> 여야 한다: ${sharedPlayerUrl}`);
  }

  const attempts = [];
  for (let attempt = 1; attempt <= repeat; attempt += 1) {
    attempts.push(await replayOnce({
      game, boot, ops, anchor, expect, attemptDir: join(outDir, `run-${attempt}`), viewport, seed, bootTimeoutMs, sharedPlayerUrl, pace,
    }));
    process.stdout.write(`run ${attempt}/${repeat}: ${attempts.at(-1).reproduced ? "symptom present" : "symptom absent"}`
      + `${attempts.at(-1).failures.length ? ` — ${attempts.at(-1).failures.slice(0, 3).join(" / ")}` : ""}\n`);
  }

  const reproduced = attempts.every((attempt) => attempt.reproduced);
  const verdict = reproduced ? "REPRODUCED" : "NOT_REPRODUCED";
  const summary = {
    verdict,
    game: game.id,
    projectFile: game.file,
    ops: ops.length,
    anchor: anchor ? { line: anchor.line, save: anchor.save, at: anchor.at } : null,
    repeat,
    expect,
    attempts: attempts.map((attempt, index) => ({
      run: index + 1,
      reproduced: attempt.reproduced,
      failures: attempt.failures,
      evidence: join(outDir, `run-${index + 1}`, "evidence.png"),
      state: join(outDir, `run-${index + 1}`, "state.json"),
    })),
  };
  await writeFile(join(outDir, "REPRO.json"), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`\n${verdict}${reproduced ? "" : " (기대한 증상이 나타나지 않았다)"}\n`);
  process.stdout.write(`evidence: ${join(outDir, "run-1", "evidence.png")}\n`);
  process.stdout.write(`state:    ${join(outDir, "run-1", "state.json")}\n`);
  process.stdout.write(`report:   ${join(outDir, "REPRO.json")}\n`);
  process.exit(reproduced ? 0 : 1);
}

main().catch((error) => fail(String(error?.message ?? error)));
