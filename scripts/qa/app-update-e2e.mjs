#!/usr/bin/env node
// 앱 자동 업데이트 e2e — 실제 AppImage 0.0.1 이 로컬 가짜 업데이트 서버(generic 공급자)에서 0.0.2 를 받아
// 스스로 바꾸고 다시 켜지는지 본다. CI 잡 .github/workflows/app-update-e2e.yml 이 xvfb 아래에서 돌린다.
//
// 앱 코드는 진짜다(dist-electron 의 메인·업데이트 모듈). 렌더러만 빈 쪽으로 바꾼다 — 업데이트는 메인 프로세스 일이고,
// 렌더러까지 구우면 잡이 30분을 넘는다. 칩을 누르는 대신 OPRN_UPDATE_E2E_LOG 가 켜진 앱은 다 받으면 바로
// installAppUpdate() 를 부른다(칩과 같은 함수). 그 기록 줄로 판정한다.
//
// 윈도는 실제 업데이트를 여기서 못 한다(오너 실측 필요). 대신 NSIS 산출물의 latest.yml·sha512·blockmap 을 검사한다.
//
// 사용: OPRN_QA_FAST=1 node scripts/build-electron.mjs && xvfb-run -a node scripts/qa/app-update-e2e.mjs [--skip-windows] [--skip-linux]
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OLD = "0.0.1";
const NEW = "0.0.2";
const skipWindows = process.argv.includes("--skip-windows");
const skipLinux = process.argv.includes("--skip-linux");
const work = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), "app-update-e2e-"));
const results = [];

function pass(name, detail) { results.push({ name, ok: true, detail }); console.log(`PASS ${name}: ${detail}`); }
function fail(name, detail) { results.push({ name, ok: false, detail }); console.log(`FAIL ${name}: ${detail}`); }
const sha512 = (file) => createHash("sha512").update(readFileSync(file)).digest("base64");

/** latest*.yml 에서 필요한 키만 읽는다(js-yaml 없이 — 이 파일들은 평평한 꼴이다). */
function readChannelFile(file) {
  const text = readFileSync(file, "utf8");
  const field = (key) => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(text)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  const blockMapSize = /blockMapSize:\s*(\d+)/.exec(text)?.[1];
  return { text, version: field("version"), path: field("path"), sha512: field("sha512"), blockMapSize: blockMapSize ? Number(blockMapSize) : null };
}

function ensureStubRenderer() {
  const dist = join(ROOT, "dist");
  if (existsSync(join(dist, "index.html"))) return;
  mkdirSync(dist, { recursive: true });
  const page = "<!doctype html><meta charset=utf-8><title>update e2e</title><p>update e2e</p>";
  for (const name of ["index.html", "start-screen.html"]) writeFileSync(join(dist, name), page);
}

async function buildPackage({ version, target, publish, output }) {
  const { build, Platform, Arch } = await import("electron-builder");
  const base = (await import(join(ROOT, "scripts/electron-builder.config.mjs"))).default;
  const config = {
    ...base,
    extraMetadata: { ...base.extraMetadata, version },
    directories: { ...base.directories, output },
    ...(publish ? { publish } : {}),
  };
  const platform = target === "AppImage" ? Platform.LINUX : Platform.WINDOWS;
  await build({ projectDir: ROOT, config, publish: "never", targets: platform.createTarget(target, Arch.x64) });
  return readdirSync(output).map((name) => join(output, name));
}

/** 단일 Range 만 206 으로 준다. 다중 Range 는 200 전체로 답해 차등 받기가 전체 받기로 물러나게 한다(그것도 정상 경로). */
function startServer(root) {
  const log = [];
  const server = createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname).replace(/^\/+/, "");
    const file = join(root, name);
    log.push(`${request.method} /${name} ${request.headers.range ?? ""}`.trim());
    if (!name || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end(); return; }
    const size = statSync(file).size;
    const range = /^bytes=(\d+)-(\d*)$/.exec(String(request.headers.range ?? ""));
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      response.writeHead(206, { "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes" });
      createReadStream(file, { start, end }).pipe(response);
      return;
    }
    response.writeHead(200, { "content-length": size, "accept-ranges": "bytes" });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolveServer) => server.listen(0, "127.0.0.1", () => resolveServer({ server, log, port: server.address().port })));
}

function readEvents(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

/** 기록 파일이 바뀔 때마다 조건을 다시 본다(정해진 간격으로 자지 않는다). 상한은 timeoutMs. */
async function waitForEvents(file, done, timeoutMs) {
  const { watch } = await import("node:fs");
  return new Promise((resolveWait) => {
    const dir = dirname(file);
    let settled = false;
    const finish = (value) => { if (settled) return; settled = true; watcher.close(); clearTimeout(timer); resolveWait(value); };
    const check = () => { const events = readEvents(file); if (done(events)) finish(events); };
    const watcher = watch(dir, () => check());
    const timer = setTimeout(() => finish(readEvents(file)), timeoutMs);
    check();
  });
}

function killPid(pid) {
  try { process.kill(pid, "SIGTERM"); } catch { /* 이미 끝났다 */ }
}

async function linuxUpdate() {
  ensureStubRenderer();
  mkdirSync(join(work, "feed"), { recursive: true });
  const feed = await startServer(join(work, "feed"));
  const publish = { provider: "generic", url: `http://127.0.0.1:${feed.port}/` };
  const oldFiles = await buildPackage({ version: OLD, target: "AppImage", publish, output: join(work, "out-old") });
  const newFiles = await buildPackage({ version: NEW, target: "AppImage", publish, output: join(work, "out-new") });
  const oldImage = oldFiles.find((file) => file.endsWith(".AppImage"));
  const newImage = newFiles.find((file) => file.endsWith(".AppImage"));
  const channel = newFiles.find((file) => file.endsWith("latest-linux.yml"));
  if (!oldImage || !newImage || !channel) throw new Error(`산출물이 모자란다: ${[...oldFiles, ...newFiles].join(", ")}`);

  const info = readChannelFile(channel);
  if (info.version === NEW && info.path === `OPRN.Studio-${NEW}.AppImage` && info.sha512 === sha512(newImage) && info.blockMapSize > 0) {
    pass("linux-channel-file", `latest-linux.yml path=${info.path} sha512 일치 blockMapSize=${info.blockMapSize}`);
  } else {
    fail("linux-channel-file", info.text);
  }
  for (const file of newFiles) if (statSync(file).isFile()) copyFileSync(file, join(work, "feed", file.split("/").pop()));

  await clickScenario({ oldImage, info });
  await quitScenario({ oldImage, info });
  feed.server.close();
  writeFileSync(join(work, "server.log"), feed.log.join("\n"));
  console.log(`서버 요청:\n  ${feed.log.slice(0, 40).join("\n  ")}`);
  if (feed.log.some((line) => line.startsWith("GET /latest-linux.yml"))) pass("linux-feed-fetched", "앱이 latest-linux.yml 을 받았다");
  else fail("linux-feed-fetched", "latest-linux.yml 요청 없음");
}

/** 판이 없는 이름(README 고정 이름처럼)으로 0.0.1 을 둔다 → 같은 자리에서 바뀌어야 한다. 시나리오마다 설정 폴더를 따로 쓴다. */
function launch(name, image, action) {
  const dir = join(work, name);
  mkdirSync(dir, { recursive: true });
  const installed = join(dir, "OPRN.Studio-linux.AppImage");
  if (image) copyFileSync(image, installed);
  const log = join(dir, "events.jsonl");
  const env = {
    ...process.env,
    OPRN_UPDATE_E2E_LOG: log,
    OPRN_UPDATE_E2E_ACTION: action,
    XDG_CONFIG_HOME: join(dir, "config"),
    XDG_CACHE_HOME: join(dir, "cache"),
    ELECTRON_ENABLE_LOGGING: "1",
  };
  const child = spawn(installed, ["--no-sandbox"], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const output = { text: "" };
  child.stdout.on("data", (chunk) => { output.text += chunk; });
  child.stderr.on("data", (chunk) => { output.text += chunk; });
  const exited = new Promise((resolveExit) => child.once("exit", (code, signal) => resolveExit({ code, signal })));
  return { dir, installed, log, child, output, exited };
}

function stop(run, events) {
  for (const event of events) if (event.pid) killPid(event.pid);
  try { process.kill(-run.child.pid, "SIGTERM"); } catch { /* 이미 끝났다 */ }
}

function inOrder(order, expect) {
  return expect.every((step, index) => order.indexOf(step) >= 0 && (index === 0 || order.indexOf(step) > order.indexOf(expect[index - 1])));
}

/** 칩 「다시 시작」: 다 받으면 바로 설치하고 새 판이 스스로 켜져야 한다. */
async function clickScenario({ oldImage, info }) {
  const run = launch("app-click", oldImage, "install");
  const events = await waitForEvents(run.log, (list) => list.some((event) => event.event === "start" && event.version === NEW), 360_000);
  stop(run, events);
  writeFileSync(join(run.dir, "app-output.log"), run.output.text);
  const order = events.map((event) => `${event.event}@${event.version}`);
  console.log(`[칩] 기록: ${order.join(" → ")}`);
  if (inOrder(order, [`start@${OLD}`, `downloaded@${OLD}`, `install@${OLD}`, `start@${NEW}`])) pass("linux-click-restart", order.join(" → "));
  else fail("linux-click-restart", `${order.join(" → ") || "(기록 없음)"}\n앱 출력 끝:\n${run.output.text.slice(-4000)}`);
  if (existsSync(run.installed) && sha512(run.installed) === info.sha512) pass("linux-click-file-replaced", "같은 자리 파일이 0.0.2 와 같은 sha512");
  else fail("linux-click-file-replaced", "sha512 가 latest-linux.yml 과 다르다");
}

/** 칩을 안 누르고 끔: 끌 때 설치하고 정상 종료해야 하며, 다음에 켜면 새 판이다. */
async function quitScenario({ oldImage, info }) {
  const run = launch("app-quit", oldImage, "quit");
  const quit = await Promise.race([run.exited.then((value) => ({ exited: true, ...value })), new Promise((resolveWait) => setTimeout(() => resolveWait({ exited: false }), 360_000))]);
  const events = readEvents(run.log);
  stop(run, events);
  writeFileSync(join(run.dir, "app-output.log"), run.output.text);
  const order = events.map((event) => `${event.event}@${event.version}`);
  console.log(`[끌 때] 기록: ${order.join(" → ")} · 종료 ${JSON.stringify(quit)}`);
  if (quit.exited && inOrder(order, [`start@${OLD}`, `downloaded@${OLD}`])) pass("linux-quit-exits", `끄기가 막히지 않았다 (${order.join(" → ")})`);
  else fail("linux-quit-exits", `${JSON.stringify(quit)} ${order.join(" → ")}\n앱 출력 끝:\n${run.output.text.slice(-3000)}`);
  if (existsSync(run.installed) && sha512(run.installed) === info.sha512) pass("linux-quit-file-replaced", "끌 때 같은 자리 파일이 0.0.2 로 바뀌었다");
  else { fail("linux-quit-file-replaced", "끈 뒤에도 0.0.2 가 아니다"); return; }
  const again = launch("app-quit", null, "none");
  const next = await waitForEvents(again.log, (list) => list.some((event) => event.event === "start" && event.version === NEW), 120_000);
  stop(again, next);
  if (next.some((event) => event.event === "start" && event.version === NEW)) pass("linux-quit-next-launch", "다시 켜니 0.0.2");
  else fail("linux-quit-next-launch", `다시 켠 기록: ${next.map((event) => `${event.event}@${event.version}`).join(" → ")}`);
}

async function windowsArtifacts() {
  ensureStubRenderer();
  // 릴리스 워크플로와 같다: NSIS 언인스톨러 꺼내기가 부르는 wine 을 순수 JS 대체로 잡는다.
  process.env.PATH = `${join(ROOT, "scripts/nsis-wine-shim")}:${process.env.PATH ?? ""}`;
  process.env.USE_SYSTEM_WINE = "true";
  const files = await buildPackage({ version: NEW, target: "nsis", publish: null, output: join(work, "out-win") });
  const setup = files.find((file) => /OPRN\.Studio-Setup-.*\.exe$/.test(file));
  const channel = files.find((file) => file.endsWith("latest.yml"));
  const blockmap = files.find((file) => file.endsWith(".exe.blockmap"));
  if (!setup || !channel || !blockmap) { fail("windows-artifacts", `산출물: ${files.map((file) => file.split("/").pop()).join(", ")}`); return; }
  const info = readChannelFile(channel);
  const name = setup.split("/").pop();
  if (info.version === NEW && info.path === name && info.sha512 === sha512(setup)) pass("windows-latest-yml", `path=${info.path} sha512 일치 size=${statSync(setup).size}`);
  else fail("windows-latest-yml", info.text);
  const parsed = JSON.parse(gunzipSync(readFileSync(blockmap)).toString("utf8"));
  const blocks = (parsed.files ?? []).reduce((sum, file) => sum + (file.sizes?.length ?? 0), 0);
  if (blockmap.endsWith(`${name}.blockmap`) && blocks > 0) pass("windows-blockmap", `${blockmap.split("/").pop()} 블록 ${blocks}개`);
  else fail("windows-blockmap", JSON.stringify(parsed).slice(0, 400));
}

try {
  if (!skipLinux) await linuxUpdate();
  if (!skipWindows) await windowsArtifacts();
} catch (error) {
  fail("run", error instanceof Error ? error.stack ?? error.message : String(error));
}
writeFileSync(join(work, "results.json"), JSON.stringify(results, null, 2));
console.log(`작업 폴더: ${work}`);
const failed = results.filter((result) => !result.ok);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## 앱 자동 업데이트 e2e\n\n${results.map((result) => `- ${result.ok ? "PASS" : "FAIL"} **${result.name}**: ${String(result.detail).split("\n")[0]}`).join("\n")}\n\n윈도 실제 업데이트는 오너 실측 필요(여기서는 산출물만 검사).\n`, { flag: "a" });
}
if (process.env.APP_UPDATE_E2E_KEEP !== "1" && failed.length === 0) rmSync(work, { recursive: true, force: true });
process.exit(failed.length === 0 ? 0 : 1);
