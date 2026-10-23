#!/usr/bin/env node
// to-scenario — 재현 스크립트를 **회귀 시나리오**로 굽는다.
//
// 왜: repro.mjs 는 "지금 이 버그가 재현되는가"를 답한다. 고친 뒤에도 다시 나지 않는지 보려면
// `npm run qa:runtime` 이 도는 시나리오여야 한다. 그래서 같은 op 목록·같은 기대를
// scripts/qa/runtime/<id>.scenario.mjs 로 옮긴다 — 버그가 살아 있는 동안은 그 시나리오가 실패한다.
//
// 사용:
//   node scripts/qa/play/to-scenario.mjs --ops ops.json --expect expect.json --id saesol-stuck-door \
//        --game saesol-red [--fixture examples/saesol-red/project.json.gz] [--viewport 1024x768] [--force]
//
// 기대 어휘 제약: 시나리오 판정(evaluateExpect)은 consoleErrorMatches·textPresent·textAbsent·
// stateEquals(testidPresent/…)를 안다. `stuck` 은 **시간 창**이라 시나리오에 넣을 수 없다
// (런타임 게이트는 고정 대기를 금지한다) — 그 축은 repro 에서만 쓴다.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const GAMES_PATH = join(REPO_ROOT, "scripts/qa/play/games.json");

function fail(message) {
  process.stderr.write(`to-scenario: ${message}\n`);
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

async function loadOps(file) {
  const text = await readFile(file, "utf8");
  if (file.endsWith(".jsonl") || text.trimStart().startsWith("{\"t\"")) {
    return text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line).op).filter(Boolean);
  }
  const parsed = JSON.parse(text);
  const ops = Array.isArray(parsed) ? parsed : parsed.ops;
  if (!Array.isArray(ops)) fail(`${file}: op 배열을 찾지 못했다`);
  return ops;
}

/**
 * 재현 op → 시나리오 op.
 * 세션 명령 중에는 시나리오 어휘가 아닌 것이 있다 — 관측 전용(state·shot·errors)은 판정에 영향이 없으니
 * 버리고, 플레이 전용(waitTestid·waitBodyText·click·holdKey)은 같은 뜻의 런타임 op 로 옮긴다.
 * 옮길 수 없는 것(고정 `wait`·`reload`)은 버리고 stderr 에 남긴다 — 조용히 사라지면 재생이 달라진다.
 */
function toScenarioOp(op) {
  switch (op.kind) {
    case "state":
    case "shot":
    case "errors":
      return null;
    case "waitTestid":
      return op.state === "visible"
        ? { kind: "waitForVisible", testid: op.testid, ...(op.timeoutMs ? { timeoutMs: op.timeoutMs } : {}) }
        : { kind: "waitFor", testid: op.testid, state: op.state ?? "present", ...(op.timeoutMs ? { timeoutMs: op.timeoutMs } : {}) };
    case "waitBodyText":
      return { kind: "waitForBodyText", text: op.text, ...(op.timeoutMs ? { timeoutMs: op.timeoutMs } : {}) };
    case "click":
      return { kind: "clickCanvas", x: op.x, y: op.y };
    case "holdKey":
      // 시나리오의 key 는 holdMs 를 down↔up 사이 지연으로 넘긴다 — 같은 뜻이다.
      return { kind: "key", key: op.key, holdMs: op.ms };
    case "wait":
      process.stderr.write(`to-scenario: 고정 wait ${op.ms}ms 는 런타임 게이트가 금지한다 — 옮기지 않는다\n`);
      return null;
    case "reload":
      process.stderr.write("to-scenario: reload 는 시나리오에 없다 — 옮기지 않는다\n");
      return null;
    default:
      return op;
  }
}

/** 재현 기대 → 시나리오 expect. 이름이 다른 축만 옮긴다. */
function toScenarioExpect(expect, { note }) {
  const out = {};
  if (expect.consoleErrorMatches !== undefined) out.consoleErrorMatches = expect.consoleErrorMatches;
  if (expect.textPresent !== undefined) out.textPresent = expect.textPresent;
  if (expect.textAbsent !== undefined) out.textAbsent = expect.textAbsent;
  if (expect.testidPresent !== undefined) out.testidPresent = expect.testidPresent;
  if (expect.testidAbsent !== undefined) out.testidAbsent = expect.testidAbsent;
  for (const [key, value] of Object.entries(expect.stateEquals ?? {})) {
    // 시나리오 판정이 아는 스칼라 축. screen·dir·dialog 같은 파생값은 판정에 없으므로
    // 실패시키지 않고 버린다 — 버린 축은 stderr 에 남겨 조용히 사라지지 않게 한다.
    if (key === "mapId" || key === "x" || key === "y" || key === "gold") out[key] = value;
    else process.stderr.write(`to-scenario: stateEquals.${key} 는 시나리오 판정에 없다 — 옮기지 않는다\n`);
  }
  if (note) out.note = note;
  return out;
}

function renderScenario({ id, game, fixture, viewport, ops, expect, note, sourceOps }) {
  const lines = [];
  lines.push(`// ${id} — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).`);
  lines.push(`// 버그가 살아 있는 동안 이 시나리오는 실패한다: node scripts/qa/runtime/${id}.scenario.mjs`);
  lines.push(`// 원본 op: ${sourceOps}`);
  if (note) lines.push(`// 증상: ${note}`);
  lines.push("//");
  lines.push("// 실행: npm run qa:runtime -- --scenario " + id);
  lines.push("");
  lines.push("/** @type {import(\"../../lib/runtimeQa.d.mts\").RuntimeQaScenario} */");
  lines.push("export default {");
  lines.push(`  id: ${JSON.stringify(id)},`);
  lines.push(`  projectFixture: ${JSON.stringify(fixture)},`);
  if (game) lines.push(`  // 게임: ${game} (scripts/qa/play/games.json)`);
  if (viewport) lines.push(`  viewport: ${JSON.stringify(viewport)},`);
  lines.push("  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.");
  lines.push("  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },");
  lines.push("  beats: [");
  lines.push("    {");
  lines.push(`      id: ${JSON.stringify(`${id}-repro`)},`);
  lines.push(`      note: ${JSON.stringify(note ?? "재현 스크립트 재생")},`);
  lines.push("      ops: [");
  for (const op of ops) lines.push(`        ${JSON.stringify(op)},`);
  lines.push("      ],");
  lines.push(`      expect: ${JSON.stringify(expect, null, 8).replace(/\n/g, "\n      ")},`);
  lines.push("      shot: true,");
  lines.push("    },");
  lines.push("  ],");
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (!flags.ops) fail("--ops <file> 가 필요하다");
  if (!flags.expect) fail("--expect <file> 가 필요하다");
  if (!flags.id) fail("--id <name> 이 필요하다(kebab-case)");
  const id = String(flags.id);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(`--id 는 kebab-case: ${id}`);
  const opsPath = resolve(REPO_ROOT, String(flags.ops));
  const rawOps = await loadOps(opsPath);
  if (rawOps.length === 0) fail("op 이 0개다");
  const ops = rawOps.map(toScenarioOp).filter(Boolean);
  if (ops.length === 0) fail("옮길 수 있는 op 이 없다(관측 전용·고정 wait 만 있었다)");
  const expectRaw = JSON.parse(await readFile(resolve(REPO_ROOT, String(flags.expect)), "utf8"));
  if (expectRaw.stuck) {
    fail("expect.stuck 은 시나리오로 옮길 수 없다 — 시간 창은 런타임 게이트의 고정 대기 금지 규칙과 충돌한다. repro 로만 판정해라");
  }
  const expect = toScenarioExpect(expectRaw, { note: expectRaw.note });

  let fixture = flags.fixture ? String(flags.fixture) : null;
  let game = flags.game ? String(flags.game) : null;
  if (!fixture) {
    if (!game) fail("--fixture 또는 --game 이 필요하다");
    const catalog = existsSync(GAMES_PATH) ? JSON.parse(await readFile(GAMES_PATH, "utf8")) : { games: [] };
    const entry = (catalog.games ?? []).find((row) => row.id === game);
    if (!entry) fail(`모르는 게임: ${game}`);
    // 카탈로그의 file 은 build-games 산출물(tmp)일 수 있다. 시나리오는 저장소에 커밋되므로
    // 커밋된 픽스처를 가리켜야 재현이 다른 기계에서도 돈다.
    fixture = entry.scenarioFixture ?? entry.file;
    if (!fixture) fail(`${game}: scenarioFixture 가 없다 — to-scenario --fixture 로 직접 줘라`);
    if (fixture.startsWith("tmp/")) fail(`${game} 은 생성기 게임이라 커밋된 픽스처가 없다 — --fixture 로 직접 줘라`);
  }
  const viewport = flags.viewport
    ? (([w, h]) => ({ width: Number(w), height: Number(h) }))(String(flags.viewport).split("x"))
    : null;

  const target = join(REPO_ROOT, "scripts/qa/runtime", `${id}.scenario.mjs`);
  if (existsSync(target) && flags.force !== true) fail(`${target} 이 이미 있다 — --force 로 덮어써라`);
  const text = renderScenario({
    id, game, fixture, viewport, ops, expect,
    note: expectRaw.note, sourceOps: String(flags.ops),
  });
  await writeFile(target, text);
  process.stdout.write(`scenario: ${target}\nrun: npm run qa:runtime -- --scenario ${id}\n`);
}

main().catch((error) => fail(String(error?.message ?? error)));
