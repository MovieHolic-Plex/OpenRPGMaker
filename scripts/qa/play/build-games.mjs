#!/usr/bin/env node
// build-games — 카탈로그(scripts/qa/play/games.json)의 모든 게임을 플레이어가 읽는 project.json 으로
// 물질화하고, 각각 **부팅 스모크**(타이틀 → 새 게임 → 필드)를 돌린다.
//
// 왜: 에이전트가 "이 게임 플레이해 봐"를 하려면 먼저 그 게임이 실제로 필드에 도달하는지 알아야 한다.
// 도달하지 못하는 게임을 카탈로그에 playable:true 로 두면 이후 모든 재현이 가짜 실패로 시작한다.
//
// 사용:
//   node scripts/qa/play/build-games.mjs --out tmp/qp/games [--only id,id] [--no-smoke] [--timeout 180000]
//
// 산출물:
//   <out>/<id>/project.json      플레이어 서버가 읽는 파일
//   <out>/<id>/title.png         타이틀 화면
//   <out>/<id>/field.png         새 게임 직후 필드(도달한 경우)
//   <out>/<id>/state.json        부팅 스모크 결과(playable·reason·mapId·x·y·errors)
//   <out>/SUMMARY.md             게임 표(에이전트가 먼저 읽는 파일)
//   <out>/catalog.json           이 실행에서 확인한 playable 값을 담은 카탈로그 사본
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import {
  bootPlayPage,
  capturePageErrors,
  enterFieldFromTitle,
  launchPlayBrowser,
  prepareBoot,
  readPlayState,
} from "../../lib/playSession.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const CATALOG_PATH = join(REPO_ROOT, "scripts/qa/play/games.json");
const GENERATOR = join(REPO_ROOT, "scripts/qa/play/generate-project.mts");
const CSS_STUB = join(REPO_ROOT, "tiledata/jp-city/refs/css-stub.mjs");

function fail(message) {
  process.stderr.write(`build-games: ${message}\n`);
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

function run(command, args, { timeoutMs = 900_000 } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveRun({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** 카탈로그 한 줄을 project.json 으로 만든다. 실패는 사유 문자열로 돌려준다. */
async function materialize(game, outRoot) {
  const dir = join(outRoot, game.id);
  await mkdir(dir, { recursive: true });
  const target = join(dir, "project.json");
  if (game.kind === "fixture") {
    const source = resolve(REPO_ROOT, game.file);
    if (!existsSync(source)) return { ok: false, reason: `픽스처 없음: ${game.file}` };
    const bytes = await readFile(source);
    const json = source.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
    await writeFile(target, json);
    return { ok: true, file: target, bytes: json.length };
  }
  if (game.kind === "generator") {
    const result = await run("npx", ["--no-install", "tsx", "--import", CSS_STUB, GENERATOR, game.id, dir], {
      timeoutMs: Number(game.buildTimeoutMs ?? 900_000),
    });
    if (result.code !== 0) {
      return { ok: false, reason: `생성기 실패(exit ${result.code}): ${result.stderr.trim().split("\n").slice(-3).join(" | ")}` };
    }
    if (!existsSync(target)) return { ok: false, reason: "생성기가 project.json 을 쓰지 않았다" };
    return { ok: true, file: target, bytes: (await readFile(target)).length, generatorOutput: result.stdout.trim().split("\n").at(-1) };
  }
  if (game.kind === "manual") {
    // 정본 저장소(SQLite)에서만 만들 수 있는 게임 — 저장소 사본을 쓰지 않는다(하드 룰: 정본 편집 금지).
    return { ok: false, reason: game.reason ?? "정본 저장소가 필요하다" };
  }
  return { ok: false, reason: `알 수 없는 kind: ${game.kind}` };
}

/** 부팅 스모크: 타이틀 → Enter → 필드. 오프닝은 systemPatch 로 끈다(카탈로그가 정한다). */
async function smoke(game, projectPath, outRoot, timeoutMs) {
  const dir = join(outRoot, game.id);
  const boot = await prepareBoot({ projectFile: projectPath, entry: game, dir });
  const viewport = game.viewport ?? { width: 1024, height: 768 };
  const server = await startPlayerQaServer();
  const browser = await launchPlayBrowser();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = capturePageErrors(page);
  const result = {
    id: game.id,
    title: game.title,
    startMapId: game.startMap ?? null,
    expectedStartMap: game.startMap ?? null,
    playable: false,
    reason: null,
    screen: null,
    mapId: null,
    x: null,
    y: null,
    errors: [],
  };
  try {
    try {
      await bootPlayPage(page, { ...boot, viewport, seed: 1, serverUrl: server.url, timeoutMs });
    } catch (error) {
      result.reason = `타이틀 미도달: ${String(error?.message ?? error).split("\n")[0]}`;
      await page.screenshot({ path: join(dir, "boot-failure.png") }).catch(() => undefined);
      result.errors = errors.slice(0, 10);
      return result;
    }
    await page.screenshot({ path: join(dir, "title.png") });
    const title = await readPlayState(page);
    result.titleText = title.testids.includes("title-screen") ? "title-screen" : null;
    const entered = await enterFieldFromTitle(page, timeoutMs);
    if (!entered) {
      const state = await readPlayState(page);
      result.reason = `새 게임이 필드에 도달하지 않았다(screen=${state.screen})`;
      await page.screenshot({ path: join(dir, "no-field.png") }).catch(() => undefined);
      result.errors = errors.slice(0, 10);
      return result;
    }
    const state = await readPlayState(page);
    await page.screenshot({ path: join(dir, "field.png") });
    result.screen = state.screen;
    result.mapId = state.mapId;
    result.x = state.x;
    result.y = state.y;
    result.partySize = state.party.length;
    result.errors = errors.slice(0, 10);
    if (state.screen !== "field") {
      result.reason = `필드가 아니고 ${state.screen} 화면이다`;
      return result;
    }
    if (game.startMap && state.mapId !== game.startMap) {
      result.reason = `시작 맵이 ${game.startMap} 가 아니라 ${state.mapId} 다`;
      return result;
    }
    result.playable = true;
    return result;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

function renderSummary(rows, outRoot) {
  const playable = rows.filter((row) => row.playable);
  const lines = [
    "# 플레이 가능한 게임 — build-games 결과",
    "",
    `- 플레이 가능: **${playable.length}/${rows.length}**`,
    `- 산출물: \`${outRoot}\``,
    "",
    "| id | 제목 | 플레이 가능 | 시작 맵 | 비고 |",
    "|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.id} | ${row.title ?? "—"} | ${row.playable ? "예" : "아니오"} | ${row.mapId ?? row.startMapId ?? "—"} | ${row.playable ? "부팅 스모크 통과" : row.reason ?? "—"} |`);
  }
  lines.push("", "## 쓰는 법", "", "```bash", "node scripts/qa/play/qp.mjs serve --game <id>", "```");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const outRoot = resolve(REPO_ROOT, String(flags.out ?? "tmp/qp/games"));
  await mkdir(outRoot, { recursive: true });
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const only = flags.only ? String(flags.only).split(",").map((id) => id.trim()).filter(Boolean) : null;
  const games = (catalog.games ?? []).filter((game) => !only || only.includes(game.id));
  if (games.length === 0) fail("카탈로그가 비었다");
  const timeoutMs = Number(flags.timeout ?? 180_000);

  const rows = [];
  for (const game of games) {
    process.stdout.write(`\n[${game.id}] materialize…\n`);
    const built = await materialize(game, outRoot);
    const row = { id: game.id, title: game.title, startMapId: game.startMap, playable: false, reason: null };
    if (!built.ok) {
      row.reason = built.reason;
      row.playable = false;
      await writeFile(join(outRoot, game.id, "state.json"), `${JSON.stringify(row, null, 2)}\n`);
      process.stdout.write(`  → playable:false — ${row.reason}\n`);
      rows.push(row);
      continue;
    }
    process.stdout.write(`  project.json ${(built.bytes / 1024 / 1024).toFixed(1)}MB\n`);
    if (flags["no-smoke"]) {
      row.reason = "스모크 생략(--no-smoke)";
      rows.push(row);
      continue;
    }
    const result = await smoke(game, built.file, outRoot, timeoutMs);
    await writeFile(join(outRoot, game.id, "state.json"), `${JSON.stringify(result, null, 2)}\n`);
    row.title = result.title ?? row.title;
    row.playable = result.playable;
    row.reason = result.reason;
    row.mapId = result.mapId;
    row.x = result.x;
    row.y = result.y;
    process.stdout.write(`  → ${result.playable ? "playable" : `playable:false — ${result.reason}`}`
      + `${result.mapId ? ` (${result.mapId} ${result.x},${result.y})` : ""}\n`);
    rows.push(row);
  }

  const playableCount = rows.filter((row) => row.playable).length;
  await writeFile(join(outRoot, "SUMMARY.md"), renderSummary(rows, outRoot));
  const merged = {
    ...catalog,
    games: (catalog.games ?? []).map((game) => {
      const row = rows.find((entry) => entry.id === game.id);
      return row ? { ...game, playable: row.playable, reason: row.reason ?? game.reason } : game;
    }),
  };
  await writeFile(join(outRoot, "catalog.json"), `${JSON.stringify(merged, null, 2)}\n`);
  // 카탈로그 정본에 **확인한** playable 을 적어 둔다. 다음 에이전트가 build-games 를 돌리지 않고도
  // 어떤 게임이 필드에 도달하는지 알 수 있어야 한다. 확인 못 한 게임은 건드리지 않는다 —
  // 이번 실행에 없는 게임은 같은 out 디렉터리의 **이전 스모크 결과**(state.json)가 있으면 그것을 쓴다
  // (전체 재실행 없이 한 게임만 다시 돌렸을 때 카탈로그가 반쪽이 되지 않게).
  if (flags["no-update-catalog"] !== true) {
    const checked = [];
    for (const game of catalog.games ?? []) {
      const row = rows.find((entry) => entry.id === game.id);
      if (row) {
        if (row.reason === "스모크 생략(--no-smoke)") checked.push(game);
        else checked.push({ ...game, playable: row.playable, reason: row.reason ?? game.reason });
        continue;
      }
      const previous = join(outRoot, game.id, "state.json");
      if (!existsSync(previous)) {
        checked.push(game);
        continue;
      }
      try {
        const state = JSON.parse(await readFile(previous, "utf8"));
        if (typeof state.playable !== "boolean") checked.push(game);
        else checked.push({ ...game, playable: state.playable, reason: state.reason ?? game.reason });
      } catch {
        checked.push(game);
      }
    }
    await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, games: checked }, null, 2)}\n`);
  }
  process.stdout.write(`\n플레이 가능: ${playableCount}/${rows.length}\n리포트: ${join(outRoot, "SUMMARY.md")}\n`);
  // --no-smoke confirms nothing, so success there means "every game materialized", not "some game is playable".
  const materialized = rows.filter((row) => row.reason === "스모크 생략(--no-smoke)").length;
  if (flags["no-smoke"]) process.exit(materialized === rows.length ? 0 : 1);
  process.exit(playableCount > 0 ? 0 : 1);
}

main().catch((error) => fail(String(error?.message ?? error)));
