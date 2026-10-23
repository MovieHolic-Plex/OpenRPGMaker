#!/usr/bin/env node
// qp — 출하 플레이어(player.html + export shim)를 **오래 살려 두고 짧은 명령으로 조종하는** 세션 CLI.
//
// 왜: 에이전트는 한 번에 한 동작을 보내고 결과를 읽는다. 시나리오 러너는 매번 브라우저를 새로 띄워
// 그 대화가 불가능하다. qp serve 는 브라우저·페이지·vite 서버를 켜 둔 채 localhost HTTP 로 명령을 받고,
// 모든 op 을 DIR/actions.jsonl 에 append 한다 — 세션의 행동 자체가 재생 가능한 스크립트가 된다.
//
// 사용:
//   node scripts/qa/play/qp.mjs serve --game saesol-red [--port 0] [--out DIR] [--viewport 1024x768] [--seed 1] [--headed]
//   node scripts/qa/play/qp.mjs key Enter
//   node scripts/qa/play/qp.mjs move down 3
//   node scripts/qa/play/qp.mjs shot start
//   node scripts/qa/play/qp.mjs state
//   node scripts/qa/play/qp.mjs errors
//   node scripts/qa/play/qp.mjs quit
//
// 명령은 세션 디렉터리(--out · QP_OUT · tmp/qp/last)를 찾아 그 서버에 붙는다. 실패는 한 줄 사유와 함께
// 비영점으로 끝난다. 문서: scripts/qa/play/README.md
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import {
  bootPlayPage,
  capturePageErrors,
  formatPlayState,
  launchPlayBrowser,
  prepareBoot,
  readPlayState,
  runPlayOp,
} from "../../lib/playSession.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DEFAULT_OUT_ROOT = join(REPO_ROOT, "tmp/qp");
const LAST_POINTER = join(DEFAULT_OUT_ROOT, "last");
const GAMES_PATH = join(REPO_ROOT, "scripts/qa/play/games.json");

const DIRECTIONS = new Set(["up", "down", "left", "right"]);

function fail(message) {
  process.stderr.write(`qp: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        index += 1;
      }
    } else positional.push(arg);
  }
  return { positional, flags };
}

function parseViewport(text) {
  const match = /^(\d+)x(\d+)$/.exec(String(text ?? ""));
  if (!match) fail(`--viewport 는 WxH: ${text}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function readCatalog() {
  if (!existsSync(GAMES_PATH)) return { games: [] };
  return JSON.parse(await readFile(GAMES_PATH, "utf8"));
}

/** --game 은 게임 id 이거나 프로젝트 파일 경로다. */
async function resolveGame(spec, { outRoot }) {
  if (!spec) fail("--game <id|path> 가 필요하다");
  const asPath = resolve(REPO_ROOT, spec);
  if (existsSync(asPath) && !existsSync(join(asPath, "project.json"))) {
    return { id: basename(spec).replace(/\.(json|gz)$/, ""), file: asPath, entry: null };
  }
  const catalog = await readCatalog();
  const entry = (catalog.games ?? []).find((game) => game.id === spec);
  if (!entry) fail(`모르는 게임: ${spec} — scripts/qa/play/games.json 을 보거나 경로를 줘라`);
  const candidates = [
    join(outRoot, entry.id, "project.json"),
    // build-games 의 기본 산출물 자리 — 세션을 다른 --out 으로 띄워도 게임은 여기 있다.
    join(REPO_ROOT, "tmp/qp/games", entry.id, "project.json"),
    entry.file ? resolve(REPO_ROOT, entry.file) : null,
  ].filter(Boolean);
  const file = candidates.find((candidate) => existsSync(candidate));
  // `query` 게임은 제품 데모 분기로 부팅하므로 project.json 이 없어도 된다(build-games 를 건너뛰고 바로 플레이).
  if (!file && !entry.query) {
    fail(`${spec}: 프로젝트 파일이 없다 — 먼저 node scripts/qa/play/build-games.mjs 를 돌려라 (본 것: ${candidates.join(", ")})`);
  }
  return { id: entry.id, file: file ?? null, entry };
}

function sessionDirFor(flags, gameId) {
  const explicit = flags.out ?? process.env.QP_OUT;
  if (explicit) return resolve(REPO_ROOT, String(explicit));
  return join(DEFAULT_OUT_ROOT, gameId);
}

async function readReady(dir) {
  const path = join(dir, "qp.ready");
  if (!existsSync(path)) fail(`세션이 없다: ${path} — 먼저 qp serve 를 띄워라`);
  return JSON.parse(await readFile(path, "utf8"));
}

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "shot";
}

// ─────────────────────────────── serve (데몬) ───────────────────────────────

async function serve(flags) {
  const outRoot = flags.out ? resolve(REPO_ROOT, String(flags.out)) : DEFAULT_OUT_ROOT;
  const game = await resolveGame(flags.game, { outRoot });
  const dir = sessionDirFor(flags, game.id);
  await mkdir(join(dir, "shots"), { recursive: true });
  const actionsPath = join(dir, "actions.jsonl");
  await writeFile(actionsPath, "");
  const viewport = parseViewport(flags.viewport ?? "1024x768");
  const seed = Number(flags.seed ?? 1);

  const boot = await prepareBoot({
    projectFile: game.file, entry: game.entry, dir, keepOpening: flags["keep-opening"] === true,
  });
  const playerServer = await startPlayerQaServer(flags.port ? { port: Number(flags.port) } : {});
  const browser = await launchPlayBrowser({ headless: flags.headed !== true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = capturePageErrors(page);

  let closing = false;
  const shutdown = async (reason) => {
    if (closing) return;
    closing = true;
    process.stderr.write(`qp: shutting down (${reason})\n`);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await playerServer.close().catch(() => undefined);
    process.exit(0);
  };

  try {
    await bootPlayPage(page, { ...boot, viewport, seed, serverUrl: playerServer.url });
  } catch (error) {
    await page.screenshot({ path: join(dir, "boot-failure.png") }).catch(() => undefined);
    await writeFile(join(dir, "boot-failure.json"), JSON.stringify({
      game: game.id, projectFile: game.file, message: String(error?.message ?? error), errors: pageErrors,
    }, null, 2));
    await shutdown("boot failed");
    throw error;
  }

  const runState = {};
  let queue = Promise.resolve();
  const record = async (entry) => {
    await appendFile(actionsPath, `${JSON.stringify(entry)}\n`);
  };

  /** 명령 하나를 실행한다. 모든 반환은 {ok, text} — 클라이언트가 그대로 출력한다. */
  const execute = async (name, args) => {
    const runOp = async (op, { command = name } = {}) => {
      const startedAt = Date.now();
      try {
        const outcome = await runPlayOp(page, op, runState);
        const entry = { t: new Date().toISOString(), command, op, ok: true, ms: Date.now() - startedAt };
        if (outcome?.note) entry.note = outcome.note;
        await record(entry);
        return outcome?.note ? `${name}: ${outcome.note}` : `${name}: ok`;
      } catch (error) {
        const message = String(error?.message ?? error).split("\n")[0];
        await record({ t: new Date().toISOString(), command, op, ok: false, ms: Date.now() - startedAt, error: message });
        throw new Error(message);
      }
    };

    switch (name) {
      case "action": {
        return { text: await runOp({ kind: "action" }) };
      }
      case "face": {
        if (!DIRECTIONS.has(args[0])) throw new Error("face <up|down|left|right>");
        return { text: await runOp({ kind: "face", dir: args[0] }) };
      }
      case "key": {
        if (!args[0]) throw new Error("key <k>");
        return { text: await runOp({ kind: "key", key: args[0] }) };
      }
      case "hold": {
        if (!args[0]) throw new Error("hold <k> <ms>");
        const ms = Number(args[1] ?? 500);
        if (DIRECTIONS.has(args[0])) return { text: await runOp({ kind: "hold", dir: args[0], ms }) };
        return { text: await runOp({ kind: "holdKey", key: args[0], ms }) };
      }
      case "move": {
        const dir = args[0];
        if (!DIRECTIONS.has(dir)) throw new Error(`move <up|down|left|right> [n]: ${dir}`);
        const steps = Number(args[1] ?? 1);
        return { text: await runOp({ kind: "move", dir, steps }) };
      }
      case "click": {
        const x = Number(args[0]);
        const y = Number(args[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("click <x> <y>");
        return { text: await runOp({ kind: "click", x, y }) };
      }
      case "clickTestid": {
        if (!args[0]) throw new Error("clickTestid <id>");
        return { text: await runOp({ kind: "pointerClick", testid: args[0] }) };
      }
      case "wait": {
        const ms = Number(args[0] ?? 500);
        if (!Number.isFinite(ms)) throw new Error("wait <ms>");
        return { text: await runOp({ kind: "wait", ms }) };
      }
      case "waitText": {
        if (!args[0]) throw new Error("waitText <text> [timeoutMs]");
        const timeoutMs = args[1] ? Number(args[1]) : undefined;
        return { text: await runOp({ kind: "waitBodyText", text: args[0], timeoutMs }) };
      }
      case "waitTestid": {
        if (!args[0]) throw new Error("waitTestid <id> [present|absent|visible] [timeoutMs]");
        const state = args[1] && !Number.isFinite(Number(args[1])) ? args[1] : "present";
        const timeoutMs = args.find((arg, index) => index > 0 && Number.isFinite(Number(arg)));
        return { text: await runOp({ kind: "waitTestid", testid: args[0], state, timeoutMs: timeoutMs ? Number(timeoutMs) : undefined }) };
      }
      case "teleport": {
        const [mapId, x, y] = args;
        if (!mapId || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) throw new Error("teleport <mapId> <x> <y>");
        await runOp({ kind: "teleport", mapId, x: Number(x), y: Number(y) });
        // 도착까지 기다린다 — teleport 는 다른 맵이면 transferTo(비동기)를 탄다.
        await runOp({ kind: "waitForPosition", mapId, x: Number(x), y: Number(y), timeoutMs: 30_000 }, { command: "waitForPosition" });
        return { text: `teleport: ${mapId} (${x},${y})` };
      }
      case "seed": {
        const seedValue = Number(args[0]);
        if (!Number.isFinite(seedValue)) throw new Error("seed <n>");
        return { text: await runOp({ kind: "seed", seed: seedValue }) };
      }
      case "resize": {
        const width = Number(args[0]);
        const height = Number(args[1]);
        if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("resize <W> <H>");
        await page.setViewportSize({ width, height });
        await record({ t: new Date().toISOString(), command: name, op: { kind: "resize", width, height }, ok: true });
        return { text: `resize: ${width}x${height}` };
      }
      case "reset": {
        return { text: await runOp({ kind: "reload" }) };
      }
      case "shot": {
        const file = join(dir, "shots", `${sanitize(args[0] ?? "shot")}.png`);
        await page.screenshot({ path: file });
        await record({ t: new Date().toISOString(), command: name, op: { kind: "shot", name: args[0] ?? "shot" }, ok: true, observe: true });
        return { text: file };
      }
      case "state": {
        const state = await readPlayState(page);
        await record({ t: new Date().toISOString(), command: name, op: { kind: "state" }, ok: true, observe: true });
        return { text: formatPlayState(state), data: state };
      }
      case "errors": {
        const drained = pageErrors.splice(0, pageErrors.length);
        await record({ t: new Date().toISOString(), command: name, op: { kind: "errors" }, ok: true, observe: true });
        if (drained.length === 0) return { text: "errors: none" };
        return { text: `errors: ${drained.length}\n${drained.map((line) => `  ${line}`).join("\n")}` };
      }
      case "save":
      case "load": {
        throw new Error(
          `${name}: 저장/불러오기는 주소 가능한 UI 가 없다 — 메인 메뉴(ESC)에서 저장 칸을 골라야 한다.`
          + ` 메뉴 행에는 testid 가 없어 키 입력 순서로만 닿는다(README 「런타임이 노출하지 않는 것」).`,
        );
      }
      case "health": {
        return { text: `session=${dir} game=${game.id} project=${game.file}`, data: { dir, game: game.id, project: game.file } };
      }
      case "quit": {
        setImmediate(() => void shutdown("quit"));
        return { text: "quit: shutting down" };
      }
      default:
        throw new Error(`알 수 없는 명령: ${name}`);
    }
  };

  const control = createServer((request, response) => {
    const send = (status, payload) => {
      const body = JSON.stringify(payload);
      response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
      response.end(body);
    };
    if (request.method === "GET" && request.url === "/health") {
      send(200, { ok: true, game: game.id, dir, pid: process.pid });
      return;
    }
    if (request.method !== "POST" || request.url !== "/cmd") {
      send(404, { ok: false, error: "POST /cmd 만 받는다" });
      return;
    }
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        send(400, { ok: false, error: "JSON 본문이 아니다" });
        return;
      }
      // 명령은 직렬화한다 — 브라우저 조작이 겹치면 op 순서가 뒤집힌다.
      queue = queue.then(async () => {
        try {
          const result = await execute(payload.name, payload.args ?? []);
          send(200, { ok: true, text: result.text, data: result.data });
        } catch (error) {
          send(200, { ok: false, error: String(error?.message ?? error) });
        }
      }).catch((error) => send(500, { ok: false, error: String(error?.message ?? error) }));
    });
  });

  const controlPort = await new Promise((resolvePort, reject) => {
    control.once("error", reject);
    control.listen(Number(flags["control-port"] ?? 0), "127.0.0.1", () => resolvePort(control.address().port));
  });

  const ready = {
    game: game.id,
    projectFile: game.file,
    dir,
    pid: process.pid,
    port: controlPort,
    playerUrl: playerServer.url,
    viewport,
    seed,
    startedAt: new Date().toISOString(),
  };
  await writeFile(join(dir, "qp.ready"), `${JSON.stringify(ready, null, 2)}\n`);
  await mkdir(DEFAULT_OUT_ROOT, { recursive: true });
  await writeFile(LAST_POINTER, `${dir}\n`);
  process.stdout.write(
    `ready: game=${game.id} control=http://127.0.0.1:${controlPort} session=${dir}\n`
    + `  player=${playerServer.url}/player.html project=${game.file}\n`
    + `  next: node scripts/qa/play/qp.mjs state --out ${dir}\n`,
  );

  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void shutdown(signal));
  process.on("exit", () => control.close());
}

// ─────────────────────────────── 클라이언트 ───────────────────────────────

async function sendCommand(dir, name, args) {
  const ready = await readReady(dir);
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${ready.port}/cmd`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, args }),
    });
  } catch (error) {
    fail(`세션 서버에 붙지 못했다 (${ready.port}): ${String(error?.message ?? error)} — qp serve 가 살아 있는지 확인해라`);
  }
  const payload = await response.json();
  if (!payload.ok) fail(payload.error ?? "명령 실패");
  process.stdout.write(`${payload.text}\n`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [subcommand, ...args] = positional;
  if (!subcommand || subcommand === "--help" || subcommand === "help") {
    process.stdout.write(
      "qp — 출하 플레이어 세션 CLI\n"
      + "  serve --game <id|path> [--port P] [--out DIR] [--viewport WxH] [--seed N] [--headed] [--keep-opening]\n"
      + "  key <k> | action | face <dir> | hold <k> <ms> | move <up|down|left|right> [n] | click <x> <y> | clickTestid <id>\n"
      + "  wait <ms> | waitText <text> [timeoutMs] | waitTestid <id> [present|absent|visible] [timeoutMs]\n"
      + "  shot <name> | state | errors | teleport <mapId> <x> <y> | seed <n> | resize <W> <H> | reset | quit\n",
    );
    return;
  }
  if (subcommand === "serve") {
    await serve(flags);
    return;
  }
  const dir = flags.out
    ? resolve(REPO_ROOT, String(flags.out))
    : process.env.QP_OUT
      ? resolve(REPO_ROOT, process.env.QP_OUT)
      : existsSync(LAST_POINTER)
        ? (await readFile(LAST_POINTER, "utf8")).trim()
        : fail("세션 디렉터리를 모른다 — --out DIR 또는 QP_OUT, 또는 먼저 qp serve");
  await sendCommand(dir, subcommand, args);
}

main().catch((error) => fail(String(error?.message ?? error)));
