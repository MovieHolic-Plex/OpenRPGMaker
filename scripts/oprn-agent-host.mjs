#!/usr/bin/env node
// 코딩 에이전트용 「데워 둔」 편집 호스트 — 열린 프로젝트 호스트(oprn-serve·npm start·데스크톱 팀 호스트)에 붙어
// 헤드리스 도구 실행기를 한 번만 띄워 두고, 에이전트는 짧은 동사(status·tools·schema·tool·get·put)로 부른다.
// oprn-agent-edit.mjs 와 같은 쓰기 경로(브리지 project.save + 기준 sha)지만, 부를 때마다 번들을 다시 짓지 않아
// 도구 한 번이 15~150 초 → 2~5 초가 된다(2026-11-06 agent-direct-edit Phase 2 실측). 열린 편집기는 /__oprn/events 로 바로 다시 그린다.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 9850;
const MAX_ATTEMPTS = 3;

const USAGE = `Usage:
  node scripts/oprn-agent-host.mjs serve --host <editor host url> [--port ${DEFAULT_PORT}]
  node scripts/oprn-agent-host.mjs [--port ${DEFAULT_PORT}] status
  node scripts/oprn-agent-host.mjs [--port ${DEFAULT_PORT}] tools [word]
  node scripts/oprn-agent-host.mjs [--port ${DEFAULT_PORT}] schema <tool-name>
  node scripts/oprn-agent-host.mjs [--port ${DEFAULT_PORT}] tool <tool-name> '<args-json>'|@args.json [--map <mapId>]
  node scripts/oprn-agent-host.mjs [--port ${DEFAULT_PORT}] get <project.json>
  node scripts/oprn-agent-host.mjs [--port ${DEFAULT_PORT}] put <project.json>

serve 는 한 번 띄워 둔다(127.0.0.1 만 듣는다). 나머지 동사는 그 데몬을 부른다.
tool 은 편집기 조수와 같은 실행기로 돌리고 성공한 쓰기만 저장한다. 그 사이 누가 저장했으면 다시 받아 최대 ${MAX_ATTEMPTS}번 재시도한다.
put 은 get 으로 받은 문서를 고쳐 통째로 저장한다(받은 뒤 누가 저장했으면 conflict).`;

function parseArgs(argv) {
  const out = { host: undefined, port: DEFAULT_PORT, map: undefined, rest: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host") out.host = argv[++i];
    else if (arg === "--port") out.port = Number(argv[++i]);
    else if (arg === "--map") out.map = argv[++i];
    else out.rest.push(arg);
  }
  return out;
}

async function connect(hostUrl) {
  const url = new URL(hostUrl);
  const handshake = await fetch(new URL("/__oprn/handshake", url), { cache: "no-store" });
  if (!handshake.ok) throw new Error(`호스트 연결 정보를 받지 못했습니다(${handshake.status}) — 접속 코드가 켜진 호스트는 아직 지원하지 않는다`);
  const { token } = await handshake.json();
  const headers = { "content-type": "application/json", "x-oprn-bridge-token": token, "x-oprn-session": `agent-host-${process.pid}`, "x-oprn-project": url.searchParams.get("hostProject") ?? "" };
  return async function call(channel, payload) {
    const response = await fetch(new URL("/__oprn/bridge", url), { method: "POST", headers: { ...headers, "x-oprn-channel": channel }, body: JSON.stringify({ channel, payload }) });
    if (!response.ok) throw new Error(`${channel}: HTTP ${response.status} ${await response.text()}`);
    return await response.json();
  };
}

async function serve(args) {
  if (!args.host) throw new Error(USAGE);
  const started = Date.now();
  const { buildTsModule } = await import(pathToFileURL(resolve(REPO_ROOT, "scripts/ontology-ts-loader.mjs")).href);
  const { buildWorldmap } = await import(pathToFileURL(resolve(REPO_ROOT, "scripts/lib/worldmapBuild.mjs")).href);
  const bundle = join(mkdtempSync(join(tmpdir(), "oprn-agent-host-")), "headless.mjs");
  await buildTsModule(resolve(REPO_ROOT, "src/headless/index.ts"), bundle);
  // 번들은 한 번만 짓는다 — esbuild 서비스를 남겨 두면 데몬이 사는 내내 메모리를 잡는다.
  await (await import("esbuild")).stop?.();
  const H = await import(pathToFileURL(bundle).href);
  H.setHeadlessPublicRoot(resolve(REPO_ROOT, "public"));
  H.setHeadlessWorldmapBuilder?.(buildWorldmap);
  const tools = H.listHeadlessTools();
  const call = await connect(args.host);
  const opened = await call("oprn:project.open", { projectDir: "host-project" });

  // 저장된 리비전이 마지막으로 읽거나 쓴 것과 같으면 다시 풀지 않는다.
  let warm = null;
  async function current() {
    const status = await call("oprn:team.status");
    if (warm && warm.revision === status.revision) return warm;
    const row = await call("oprn:project.load", { projectDir: opened.projectDir });
    if (!row) throw new Error("호스트 프로젝트가 비어 있습니다");
    warm = { revision: row.revision, sha256: row.sha256, project: H.normalizeHeadlessProject(H.loadHeadlessProject(row.serialized)) };
    return warm;
  }
  async function saveProject(next) {
    const base = await current();
    const saved = await call("oprn:project.save", { projectDir: opened.projectDir, serialized: H.serializeHeadlessProject(next), expectedSha: base.sha256 });
    // 저장소가 문서를 고쳐 썼으면(미디어 분리) serialized 를 돌려준다 — 그때는 next 를 믿지 않고 다시 읽는다.
    if (saved.kind === "saved") warm = saved.serialized ? null : { revision: saved.revision, sha256: saved.sha256, project: next };
    return saved;
  }
  async function runTool(name, toolArgs, mapId) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const base = await current();
      const project = structuredClone(base.project);
      await H.prepareHeadlessTool(name, toolArgs, project);
      const { result, project: next } = H.runHeadlessToolWithProject(project, name, toolArgs, mapId ? { currentMapId: mapId } : {});
      if (!result.ok || isDeepStrictEqual(next, base.project)) return result;
      const saved = await saveProject(next);
      if (saved.kind === "saved") return { ...result, saved: { revision: saved.revision, attempt } };
      if (saved.kind !== "conflict") return { ...result, ok: false, saveError: saved };
      warm = null;
    }
    return { ok: false, summary: `${MAX_ATTEMPTS}번 모두 다른 저장과 부딪혔습니다 — 잠시 뒤 다시 시도하세요` };
  }

  // 요청은 하나씩 처리한다 — 같은 기준본 위에서 두 도구가 겹쳐 저장하지 않게.
  let queue = Promise.resolve();
  const serial = (fn) => { const next = queue.then(fn, fn); queue = next.catch(() => {}); return next; };
  const readBody = (req) => new Promise((done, fail) => { let s = ""; req.on("data", (c) => { s += c; }); req.on("end", () => { try { done(s ? JSON.parse(s) : {}); } catch (e) { fail(e); } }); });
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let payload;
    try {
      const input = req.method === "POST" ? await readBody(req) : {};
      payload = await serial(async () => {
        switch (url.pathname) {
          case "/status": return { revision: (await call("oprn:team.status")).revision, tools: tools.length };
          case "/tools": return tools.map((t) => ({ name: t.name, mode: t.mode, description: String(t.description).split("\n")[0].slice(0, 220) }));
          case "/schema": return tools.find((t) => t.name === url.searchParams.get("name")) ?? { ok: false, error: "unknown tool" };
          case "/get": { const w = await current(); writeFileSync(resolve(input.file), JSON.stringify(JSON.parse(H.serializeHeadlessProject(w.project)), null, 1)); return { file: input.file, revision: w.revision }; }
          case "/put": return await saveProject(H.normalizeHeadlessProject(H.loadHeadlessProject(readFileSync(resolve(input.file), "utf8"))));
          case "/tool": return { name: input.name, ...(await runTool(input.name, input.args ?? {}, input.map)) };
          default: return { ok: false, error: `unknown path ${url.pathname}` };
        }
      });
    } catch (error) {
      payload = { ok: false, error: String(error instanceof Error ? error.message : error).slice(0, 2000) };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });
  server.listen(args.port, "127.0.0.1", () => {
    process.stdout.write(`${JSON.stringify({ ready: true, port: args.port, tools: tools.length, warmupSec: (Date.now() - started) / 1000 })}\n`);
  });
}

async function client(args) {
  const [verb, ...rest] = args.rest;
  const base = `http://127.0.0.1:${args.port}`;
  const post = async (path, body) => (await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  let out;
  if (verb === "status") out = await (await fetch(`${base}/status`)).json();
  else if (verb === "tools") {
    const word = (rest[0] ?? "").toLowerCase();
    const list = await (await fetch(`${base}/tools`)).json();
    process.stdout.write(`${list.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(word)).map((t) => `${t.name} [${t.mode}] ${t.description}`).join("\n")}\n`);
    return;
  } else if (verb === "schema") out = await (await fetch(`${base}/schema?name=${encodeURIComponent(rest[0] ?? "")}`)).json();
  else if (verb === "tool") {
    const [name, raw = "{}"] = rest;
    if (!name) throw new Error(USAGE);
    const toolArgs = JSON.parse(raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw);
    out = await post("/tool", { name, args: toolArgs, ...(args.map ? { map: args.map } : {}) });
  } else if (verb === "get" || verb === "put") {
    if (!rest[0]) throw new Error(USAGE);
    out = await post(`/${verb}`, { file: resolve(rest[0]) });
  } else {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
  if (out?.ok === false || (verb === "put" && out?.kind !== "saved")) process.exitCode = 1;
}

const args = parseArgs(process.argv.slice(2));
(args.rest[0] === "serve" ? serve(args) : client(args)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
