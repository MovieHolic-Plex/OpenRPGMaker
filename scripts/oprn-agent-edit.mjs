#!/usr/bin/env node
// 코딩 에이전트가 「열려 있는」 프로젝트 호스트(oprn-serve·npm start·데스크톱 팀 호스트)를 직접 고치는 입구.
// 저장은 편집기와 같은 브리지 디스패처(/__oprn/bridge, 기준 sha 비교)로 가므로 정본 project.sqlite 가 한 쓰기 경로만 본다.
// 열린 편집기는 /__oprn/events 로 리비전을 받아 1초 안에 다시 그린다(openwiki/agent-direct-edit.md).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "./ontology-ts-loader.mjs";
import { buildWorldmap } from "./lib/worldmapBuild.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HEADLESS_ENTRY = resolve(REPO_ROOT, "src/headless/index.ts");

const USAGE = `Usage:
  node scripts/oprn-agent-edit.mjs --host <url> status
  node scripts/oprn-agent-edit.mjs --host <url> get [--out project.json]
  node scripts/oprn-agent-edit.mjs --host <url> tool <tool-name> '<args-json>' [--map <mapId>]
  node scripts/oprn-agent-edit.mjs --host <url> put <project.json>
  node scripts/oprn-agent-edit.mjs --list-tools

--host 는 편집기를 연 주소(예: http://127.0.0.1:9840/ 또는 ?hostProject=<id> 포함).
tool 은 편집기와 같은 실행기(runToolDefinition)로 돌리고 성공한 쓰기만 저장한다.
put 은 get 으로 받은 문서를 고쳐 통째로 저장한다. 둘 다 받은 뒤 누가 저장했으면 충돌로 거절되고 다시 받아 재시도한다.`;

function parseArgs(argv) {
  const out = { host: undefined, map: undefined, outPath: undefined, rest: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host") out.host = argv[++i];
    else if (arg === "--map") out.map = argv[++i];
    else if (arg === "--out") out.outPath = argv[++i];
    else if (arg === "--list-tools") out.rest.push("--list-tools");
    else if (arg === "-h" || arg === "--help") out.rest.push("--help");
    else out.rest.push(arg);
  }
  return out;
}

async function connect(hostUrl) {
  const url = new URL(hostUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("HTTP project host required");
  const handshake = await fetch(new URL("/__oprn/handshake", url), { cache: "no-store" });
  if (!handshake.ok) throw new Error(`호스트 연결 정보를 받지 못했습니다(${handshake.status}) — 접속 코드가 켜진 호스트는 아직 지원하지 않는다`);
  const { token } = await handshake.json();
  const headers = {
    "content-type": "application/json",
    "x-oprn-bridge-token": token,
    "x-oprn-session": `agent-${process.pid}`,
    "x-oprn-project": url.searchParams.get("hostProject") ?? "",
  };
  return async function call(channel, payload) {
    const response = await fetch(new URL("/__oprn/bridge", url), {
      method: "POST",
      headers: { ...headers, "x-oprn-channel": channel },
      body: JSON.stringify({ channel, payload }),
    });
    if (!response.ok) throw new Error(`${channel}: HTTP ${response.status} ${await response.text()}`);
    return await response.json();
  };
}

async function load(call) {
  const opened = await call("oprn:project.open", { projectDir: "host-project" });
  const row = await call("oprn:project.load", { projectDir: opened.projectDir });
  if (!row) throw new Error("호스트 프로젝트가 비어 있습니다");
  return { projectDir: opened.projectDir, serialized: row.serialized, sha256: row.sha256, revision: row.revision };
}

async function save(call, loaded, serialized) {
  const result = await call("oprn:project.save", { projectDir: loaded.projectDir, serialized, expectedSha: loaded.sha256 });
  return result;
}

const MAX_ATTEMPTS = 3;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [command, ...rest] = args.rest;
  if (!command || command === "--help") { process.stdout.write(`${USAGE}\n`); return; }
  await withTsModule(HEADLESS_ENTRY, "headless.mjs", async (module) => {
    module.setHeadlessPublicRoot(resolve(REPO_ROOT, "public"));
    module.setHeadlessWorldmapBuilder?.(buildWorldmap);
    if (command === "--list-tools") {
      process.stdout.write(`${JSON.stringify({ tools: module.listHeadlessTools() }, null, 2)}\n`);
      return;
    }
    if (!args.host) throw new Error(USAGE);
    const call = await connect(args.host);
    if (command === "status") {
      const status = await call("oprn:team.status");
      process.stdout.write(`${JSON.stringify({ revision: status.revision }, null, 2)}\n`);
      return;
    }
    if (command === "get") {
      const loaded = await load(call);
      const text = JSON.stringify(JSON.parse(loaded.serialized), null, 2);
      if (args.outPath) writeFileSync(args.outPath, text);
      else process.stdout.write(`${text}\n`);
      process.stderr.write(`revision ${loaded.revision} sha ${loaded.sha256.slice(0, 12)}\n`);
      return;
    }
    if (command === "put") {
      const [file] = rest;
      if (!file) throw new Error(USAGE);
      const next = module.loadHeadlessProject(readFileSync(file, "utf8"));
      const loaded = await load(call);
      const result = await save(call, loaded, module.serializeHeadlessProject(next));
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.kind !== "saved") process.exitCode = 2;
      return;
    }
    if (command === "tool") {
      const [toolName, rawArgs = "{}"] = rest;
      if (!toolName) throw new Error(USAGE);
      const toolArgs = JSON.parse(rawArgs);
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const loaded = await load(call);
        const project = module.normalizeHeadlessProject(module.loadHeadlessProject(loaded.serialized));
        await module.prepareHeadlessTool(toolName, toolArgs, project);
        const { result, project: next } = module.runHeadlessToolWithProject(project, toolName, toolArgs, args.map ? { currentMapId: args.map } : {});
        if (!result.ok || next === project) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          if (!result.ok) process.exitCode = 1;
          return;
        }
        const saved = await save(call, loaded, module.serializeHeadlessProject(next));
        if (saved.kind === "saved") {
          process.stdout.write(`${JSON.stringify({ ...result, saved: { revision: saved.revision, attempt } }, null, 2)}\n`);
          return;
        }
        if (saved.kind !== "conflict") throw new Error(`저장 실패: ${JSON.stringify(saved)}`);
      }
      throw new Error(`${MAX_ATTEMPTS}번 모두 다른 저장과 부딪혔습니다 — 잠시 뒤 다시 시도하세요`);
    }
    throw new Error(`알 수 없는 명령: ${command}\n${USAGE}`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
