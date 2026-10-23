#!/usr/bin/env node
// to-scenario — 재현(세션 로그 한 토막)을 **회귀 시나리오**로 굽는다.
//
// 왜: repro.mjs 는 "지금 이 버그가 재현되는가"를 답한다. 고친 뒤에도 다시 나지 않는지 보려면
// `npm run qa:runtime` 이 도는 시나리오여야 한다. 그래서 같은 op 목록·같은 기대를
// scripts/qa/runtime/<id>.scenario.mjs 로 옮긴다 — 버그가 살아 있는 동안은 그 시나리오가 실패한다.
//
// 두 가지 입력:
//   1) --session <dir> --lines A-B  ← 세션 로그에서 그 토막만. repro.mjs 와 **같은 앵커 규칙**
//      (scripts/lib/playOpsLog.mjs)으로 A 앞의 마지막 세이브에서 바로 부팅하고, 그 세이브를
//      체크포인트 세트(scripts/qa/runtime/checkpoints/<id>.json)로 함께 굽는다. 그래야
//      `--checkpoint-set <id> --checkpoint all` 이 타이틀·오프닝을 거치지 않고 그 판에서 시작한다.
//   2) --ops <file>                  ← 손으로 쓴 op 목록(예전 경로). 체크포인트는 굽지 않는다.
//
// 기대(expect)의 방향 — 여기서 조용히 틀리면 회귀가 통째로 무의미해진다:
//   repro 의 expect 는 **증상 서술**이다(`textPresent: "야생 chickadee"` = 버그가 보인다).
//   시나리오의 expect 는 **고쳐진 뒤의 행동**이어야 한다(`textAbsent: "chickadee"`).
//   그래서 --expect 는 정상 동작을 적는다. 증상 서술을 기계적으로 뒤집으려면 --symptom-expect 를
//   쓴다(글자 축만 뒤집는다 — 좌표 축은 "고쳐진 좌표"를 사람이 정해야 하므로 거부한다).
//
// 고정 대기: 런타임 게이트는 `wait` op 을 금지한다(normalizeScenario 가 던진다). 세션 로그의 시간 간격은
// **조건 대기로 바꾼다** — 간격 앞뒤의 관측(`at`)을 비교해 화면이 바뀌면 그 화면의 testid 를,
// 같은 화면에서 맵만 바뀌면 `waitForMap` 을 기다린다. 바로 앞 op 이 키 입력이면 `pressUntil` 로 접어
// 초과 입력 없이 넘긴다. 정하지 못한 간격은 버리고 stderr 에 줄 번호와 함께 남긴다.
//
// 사용:
//   node scripts/qa/play/to-scenario.mjs --session ~/salad/play/runs/main1/tasks/saesol-red__battle \
//        --lines 488-494 --symptom-expect tmp/rt/saesol.symptom.json \
//        --id rt-saesol-wild-troop-english-name [--force]
//   node scripts/qa/play/to-scenario.mjs --ops ops.json --expect expect.json --id saesol-stuck-door \
//        --game saesol-red [--fixture examples/saesol-red/project.json.gz] [--viewport 1024x768] [--force]
//
// 실행: npm run qa:runtime -- --scenario <id> --checkpoint-set <id> --checkpoint all
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOpsSlice } from "../../lib/playOpsLog.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const GAMES_PATH = join(REPO_ROOT, "scripts/qa/play/games.json");
const PLAYER_ENTRY = join(REPO_ROOT, "src/player/exportEntry.ts");
const PROJECT_GENERATOR = join(REPO_ROOT, "scripts/qa/play/generate-project.mts");
const CHECKPOINT_DIR = join(REPO_ROOT, "scripts/qa/runtime/checkpoints");
/** 체크포인트 세트에 굽는 체크포인트 id — 시나리오의 checkpointBeats 키와 같아야 한다. */
const CHECKPOINT_ID = "anchor";

function fail(message) {
  process.stderr.write(`to-scenario: ${message}\n`);
  process.exit(2);
}

function warn(message) {
  process.stderr.write(`to-scenario: ${message}\n`);
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

/**
 * 화면 → 그 화면이 실제로 떠 있다는 증거(testid). 필드는 testid 가 없어 「전투가 닫힘」으로 표현한다
 * (`field-hud` 는 전투 화면에도 남아 있어 필드의 증거가 못 된다 — 실측).
 */
function conditionForScreen(nextScreen, previousScreen) {
  switch (nextScreen) {
    case "battle": return { kind: "waitFor", testid: "battle-scene", state: "present" };
    case "title": return { kind: "waitFor", testid: "title-screen", state: "present" };
    case "ending": return { kind: "waitFor", testid: "ending-screen", state: "present" };
    case "field":
      return previousScreen === "battle" ? { kind: "waitFor", testid: "battle-scene", state: "absent" } : null;
    default: return null;
  }
}

/** 세션 로그 메타데이터는 시나리오 op 에 싣지 않는다. */
function stripSessionMeta(op) {
  const { recordedAt, line, ...rest } = op;
  return rest;
}

/**
 * 재현 op → 시나리오 op. 간격(`wait`)은 아직 gap 표식으로 남긴다 — 앞뒤 관측을 봐야 조건을 정할 수 있다.
 * 세션 명령 중 시나리오 어휘가 아닌 것은 옮기지 않고 stderr 에 남긴다.
 */
function toScenarioOp(op, report) {
  switch (op.kind) {
    case "state":
    case "shot":
    case "text":
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
      return { gap: true };
    case "reload":
      report.dropped.push({ line: op.line, reason: "reload 는 시나리오에 없다(앵커가 있으면 토막 안에 오지 않는다)" });
      return null;
    case "resize":
      report.dropped.push({ line: op.line, reason: "resize 는 시나리오 어휘가 아니다 — 뷰포트는 시나리오 필드로 고정한다" });
      return null;
    default:
      return stripSessionMeta(op);
  }
}

/**
 * 간격(gap)을 조건 대기로 바꾼다. 판정 근거는 **로그의 관측**(`row.at`):
 *  - 간격 앞 관측과 뒤 관측에서 화면이 바뀐다 → 그 화면이 뜨는 조건을 기다린다.
 *  - 같은 화면인데 맵만 바뀐다(문·transfer) → `waitForMap`. 도착 좌표는 버그일 수 있으므로 좌표를 기다리지 않는다.
 *  - 그 밖(같은 화면·같은 맵) → 버린다. 이동 op 은 이미 타일 변화를 기다리고, 대사 출력 같은 시간 경과는
 *    다음 조건 대기가 흡수한다. 버린 사실은 전부 stderr 에 남긴다.
 */
function resolveGaps(steps, rowByLine, report) {
  const observationBefore = (line) => {
    for (let probe = line - 1; probe >= line - 60; probe -= 1) {
      const row = rowByLine.get(probe);
      if (row?.at) return { line: probe, at: row.at };
    }
    return null;
  };
  const observationAfter = (line) => {
    for (let probe = line + 1; probe <= line + 60; probe += 1) {
      const row = rowByLine.get(probe);
      if (row?.at) return { line: probe, at: row.at };
    }
    return null;
  };

  const resolved = [];
  for (const step of steps) {
    if (!step.gap) {
      resolved.push(step);
      continue;
    }
    const line = step.line;
    const before = observationBefore(line);
    const after = observationAfter(line);
    const previousScreen = before?.at?.screen ?? null;
    const nextScreen = after?.at?.screen ?? null;
    const previousMap = before?.at?.mapId ?? null;
    const nextMap = after?.at?.mapId ?? null;
    let condition = nextScreen && nextScreen !== previousScreen ? conditionForScreen(nextScreen, previousScreen) : null;
    if (!condition && nextMap && nextMap !== previousMap) condition = { kind: "waitForMap", mapId: nextMap };
    const transition = `${previousScreen ?? "?"}/${previousMap ?? "-"} → ${nextScreen ?? "?"}/${nextMap ?? "-"}`;
    if (!condition) {
      report.droppedGaps.push({ line, reason: `${transition} — 기다릴 조건을 로그에서 정하지 못했다(간격 ${rowByLine.get(line)?.op?.ms ?? "?"}ms)` });
      continue;
    }
    const previous = resolved.at(-1);
    if (condition.kind !== "waitForMap" && previous?.kind === "key" && previous.key && (previous.times ?? 1) === 1) {
      // 키 입력 + 간격 = "이 입력을 넣고 다음 화면이 뜰 때까지". 조건이 설 때까지만 누른다(초과 입력 없음).
      resolved[resolved.length - 1] = { ...condition, kind: "pressUntil", key: previous.key, maxPresses: 8 };
      report.paced.push({ line, from: transition, to: `pressUntil ${previous.key} → ${condition.testid} ${condition.state}` });
    } else {
      resolved.push({ ...condition });
      report.paced.push({
        line,
        from: transition,
        to: condition.kind === "waitForMap" ? `waitForMap ${condition.mapId}` : `${condition.kind} ${condition.testid} ${condition.state}`,
      });
    }
  }
  return resolved;
}

/** 재현 기대 → 시나리오 expect. 이름이 다른 축만 옮긴다. */
function toScenarioExpect(expect, { note }) {
  const out = {};
  if (expect.consoleErrorMatches !== undefined) out.consoleErrorMatches = expect.consoleErrorMatches;
  if (expect.textPresent !== undefined) out.textPresent = expect.textPresent;
  if (expect.textAbsent !== undefined) out.textAbsent = expect.textAbsent;
  if (expect.testidPresent !== undefined) out.testidPresent = expect.testidPresent;
  if (expect.testidAbsent !== undefined) out.testidAbsent = expect.testidAbsent;
  // 페이지 안 단언은 그대로 옮긴다(함수 소스 문자열 — 고정 축으로 표현할 수 없는 불변식).
  if (expect.pageAssertions !== undefined) out.pageAssertions = expect.pageAssertions;
  for (const [key, value] of Object.entries(expect.stateEquals ?? {})) {
    // 시나리오 판정이 아는 스칼라 축. screen·dir·dialog 같은 파생값은 판정에 없으므로
    // 실패시키지 않고 버린다 — 버린 축은 stderr 에 남겨 조용히 사라지지 않게 한다.
    if (key === "mapId" || key === "x" || key === "y" || key === "gold") out[key] = value;
    else warn(`stateEquals.${key} 는 시나리오 판정에 없다 — 옮기지 않는다`);
  }
  if (note) out.note = note;
  return out;
}

/**
 * 증상 서술을 **고쳐진 뒤의 기대**로 뒤집는다. 글자 축만 뒤집는다 — 좌표 축은 "고쳐진 좌표"를
 * 사람이 알아야 하므로 여기서 추측하지 않고 거부한다.
 */
function invertSymptomExpect(expect) {
  const out = {};
  const textPresent = [];
  const textAbsent = [];
  const push = (target, value) => {
    if (Array.isArray(value)) target.push(...value);
    else if (typeof value === "string") target.push(value);
  };
  push(textAbsent, expect.textPresent);
  push(textPresent, expect.textAbsent);
  if (textPresent.length > 0) out.textPresent = textPresent.length === 1 ? textPresent[0] : textPresent;
  if (textAbsent.length > 0) out.textAbsent = textAbsent.length === 1 ? textAbsent[0] : textAbsent;
  if (expect.stateEquals !== undefined) {
    fail("--symptom-expect 로는 stateEquals 를 뒤집을 수 없다 — 고쳐진 좌표·맵을 --expect 로 직접 적어라"
      + ` (증상: ${JSON.stringify(expect.stateEquals)})`);
  }
  if (expect.consoleErrorMatches !== undefined) {
    warn("consoleErrorMatches 는 뒤집지 않는다 — 시나리오 게이트는 콘솔 오류가 하나라도 있으면 실패한다");
  }
  for (const key of ["testidPresent", "testidAbsent", "stuck", "note"]) {
    if (expect[key] !== undefined && key !== "note") fail(`--symptom-expect 로는 ${key} 를 뒤집을 수 없다 — --expect 로 직접 적어라`);
  }
  if (expect.note) out.note = expect.note;
  return out;
}

/**
 * exportEntry.ts 가 이 게임을 `?demo=<id>` 로 띄우는가. 두 자리를 본다 — 별칭(`rawDemoParam === "fallen-star" ?
 * "chrono-bell" : …`)과 분기 조건(`demoParam === "chrono-bell" || …`). fallen-star 처럼 별칭으로 들어가는
 * 게임은 분기 목록에 자기 id 가 없으므로 별칭 줄까지 봐야 한다(추측하지 않고 소스를 읽는다).
 */
async function demoBranchFor(gameId) {
  if (!existsSync(PLAYER_ENTRY)) return null;
  const source = await readFile(PLAYER_ENTRY, "utf8");
  const quoted = JSON.stringify(gameId);
  const lines = source.split("\n");
  const aliasLine = lines.find((line) => line.includes("const demoParam =")) ?? "";
  const branchLine = lines.find((line) => line.includes("if (demoParam ===")) ?? "";
  return aliasLine.includes(`rawDemoParam === ${quoted}`) || branchLine.includes(`demoParam === ${quoted}`)
    ? gameId
    : null;
}

/** generate-project.mts 의 빌더 표에 이 게임이 있는가. */
async function generatorFor(gameId) {
  if (!existsSync(PROJECT_GENERATOR)) return null;
  const source = await readFile(PROJECT_GENERATOR, "utf8");
  const escaped = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["']${escaped}["']\\s*:`).test(source) ? gameId : null;
}

/**
 * 커밋된 시나리오가 가리킬 프로젝트 재료를 고른다 — 어느 기계에서도 돌아야 하므로 tmp 산출물은 못 쓴다.
 *   1. --fixture
 *   2. games.json scenarioFixture (커밋된 픽스처)
 *   3. 생성기 실행 시점 생성 `projectGenerator` (scripts/qa/play/generate-project.mts)
 *   4. 플레이어의 데모 분기 `player.html?demo=<id>` (src/player/exportEntry.ts)
 *
 * 생성기가 데모 분기보다 앞인 이유: 생성기는 빌더를 **Node** 에서 돌리는데(build-games 와 같은 길),
 * 데모 분기는 같은 빌더를 **브라우저**에서 돌린다. 빌더가 브라우저에 없는 것을 만지면 데모 부팅이
 * 통째로 죽는다(실측 2026-10-23: chronoBell.ts 의 `process.env.MARCH_DEBUG` → `process is not defined`).
 * 부팅 실패는 버그 판정 실패와 구분되지 않으므로, 실제로 돌아가는 쪽을 기본으로 둔다.
 */
async function resolveProjectSource({ flags, gameId, entry }) {
  if (flags.fixture) {
    const fixture = String(flags.fixture);
    if (fixture.startsWith("tmp/")) fail(`${fixture}: tmp 산출물은 커밋된 시나리오가 가리킬 수 없다 — 커밋할 픽스처를 줘라`);
    return { fixture, reason: `--fixture ${fixture}` };
  }
  if (entry?.scenarioFixture) return { fixture: entry.scenarioFixture, reason: `games.json scenarioFixture` };
  if (entry?.file && !entry.file.startsWith("tmp/")) return { fixture: entry.file, reason: "games.json file" };
  if (!gameId) fail("--fixture 또는 --game 이 필요하다");
  const generator = await generatorFor(gameId);
  if (generator) return { generator: { game: generator }, reason: `projectGenerator (scripts/qa/play/generate-project.mts: ${generator})` };
  const demo = await demoBranchFor(gameId);
  if (demo) return { query: { demo }, reason: `player.html?demo=${demo} (src/player/exportEntry.ts)` };
  fail(`${gameId}: 커밋된 픽스처도, 생성기 빌더도, 플레이어 데모 분기도 없다 — --fixture 로 직접 줘라`);
}

function renderScenario({ id, game, source, viewport, checkpointSet, ops, expect, note, sourceOps, pacingNotes }) {
  const beatLines = [
    "[",
    "  {",
    `    id: ${JSON.stringify(`${id}-repro`)},`,
    `    note: ${JSON.stringify(note ?? "재현 스크립트 재생")},`,
    "    ops: [",
    ...ops.map((op) => `      ${JSON.stringify(op)},`),
    "    ],",
    `    expect: ${JSON.stringify(expect, null, 2).replace(/\n/g, "\n    ")},`,
    "    shot: true,",
    "  },",
    "];",
  ];
  const lines = [];
  lines.push(`// ${id} — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).`);
  lines.push("// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).");
  lines.push(`// 원본 op: ${sourceOps}`);
  if (note) lines.push(`// 증상: ${note}`);
  for (const pacing of pacingNotes) lines.push(`// 페이싱: ${pacing}`);
  lines.push("//");
  lines.push(`// 실행: npm run qa:runtime -- --scenario ${id} --checkpoint-set ${id} --checkpoint all`);
  lines.push("");
  lines.push("const beats =");
  lines.push(...beatLines);
  lines.push("");
  lines.push("/** @type {import(\"../../lib/runtimeQa.d.mts\").RuntimeQaScenario} */");
  lines.push("export default {");
  lines.push(`  id: ${JSON.stringify(id)},`);
  if (source.fixture) lines.push(`  projectFixture: ${JSON.stringify(source.fixture)},`);
  if (source.query) lines.push(`  query: ${JSON.stringify(source.query)},`);
  if (source.generator) lines.push(`  projectGenerator: ${JSON.stringify(source.generator)},`);
  if (checkpointSet) lines.push(`  checkpointSet: ${JSON.stringify(checkpointSet)},`);
  if (game) lines.push(`  // 게임: ${game} (scripts/qa/play/games.json)`);
  if (viewport) lines.push(`  viewport: ${JSON.stringify(viewport)},`);
  lines.push("  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.");
  lines.push("  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },");
  lines.push("  beats,");
  if (checkpointSet) {
    // 체크포인트 실행기는 시나리오의 `beats` 를 쓰지 않는다(우선순위: checkpointBeats → 체크포인트 beats
    // → 세트 defaultBeats). 이걸 빼면 체크포인트 모드는 기본 「도착 샷」 비트만 돌려 기대를 아예 판정하지
    // 않는다 — 버그가 살아 있어도 통과하는 조용한 거짓 통과(실측).
    lines.push(`  checkpointBeats: { ${CHECKPOINT_ID}: beats },`);
  }
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (!flags.id) fail("--id <name> 이 필요하다(kebab-case)");
  const id = String(flags.id);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(`--id 는 kebab-case: ${id}`);
  const sessionMode = Boolean(flags.session);
  if (!sessionMode && !flags.ops) fail("--session <dir> --lines A-B 또는 --ops <file> 이 필요하다");
  if (sessionMode && !flags.lines) fail("--session 에는 --lines A-B 가 필요하다(앵커·토막의 기준)");
  if (!flags.expect && !flags["symptom-expect"]) fail("--expect <회귀 기대> 또는 --symptom-expect <증상 서술> 이 필요하다");

  // ── 기대 ────────────────────────────────────────────────────────────────────
  let expectRaw;
  let note;
  if (flags.expect) {
    expectRaw = JSON.parse(await readFile(resolve(REPO_ROOT, String(flags.expect)), "utf8"));
    note = expectRaw.note;
    if (expectRaw.stuck) {
      fail("expect.stuck 은 시나리오로 옮길 수 없다 — 시간 창은 런타임 게이트의 고정 대기 금지 규칙과 충돌한다. repro 로만 판정해라");
    }
    expectRaw = toScenarioExpect(expectRaw, { note });
  } else {
    const symptom = JSON.parse(await readFile(resolve(REPO_ROOT, String(flags["symptom-expect"])), "utf8"));
    expectRaw = invertSymptomExpect(symptom);
    note = symptom.note;
    if (Object.keys(expectRaw).filter((key) => key !== "note").length === 0) fail("증상 서술에 뒤집을 글자 축이 없다 — --expect 로 직접 적어라");
  }
  const expect = expectRaw;

  // ── op 토막 ────────────────────────────────────────────────────────────────
  const report = { dropped: [], paced: [], droppedGaps: [] };
  const opsPath = sessionMode
    ? join(resolve(REPO_ROOT, String(flags.session)), "actions.jsonl")
    : resolve(REPO_ROOT, String(flags.ops));
  if (!existsSync(opsPath)) fail(`로그가 없다: ${opsPath}`);
  let session = null;
  if (sessionMode) {
    const readyPath = join(resolve(REPO_ROOT, String(flags.session)), "qp.ready");
    if (!existsSync(readyPath)) fail(`qp.ready 가 없다: ${readyPath} — qp serve 로 만든 세션 폴더를 줘라`);
    session = JSON.parse(await readFile(readyPath, "utf8"));
  }
  const slice = await loadOpsSlice(opsPath, { lines: flags.lines, anchor: true });
  if (sessionMode && !slice.anchor) {
    fail(`${opsPath}: ${flags.lines} 앞에 리로드 경계를 넘지 않는 세이브가 없다 — 체크포인트로 부팅할 수 없다. `
      + "토막을 세이브 뒤에서 시작하거나 --ops 로 직접 줘라");
  }
  const rowByLine = new Map((slice.rows ?? []).map((row, index) => [index + 1, row]));
  const steps = [];
  for (const op of slice.ops) {
    const converted = toScenarioOp(op, report);
    if (!converted) continue;
    steps.push(converted.gap ? { gap: true, line: op.line } : { ...converted, line: op.line });
  }
  const ops = resolveGaps(steps, rowByLine, report).map(({ line, ...op }) => op);
  if (ops.length === 0) fail("옮길 수 있는 op 이 없다(관측 전용·고정 wait 만 있었다)");
  // --until <key>:<testid>[:<삽입 위치>] — 재생이 그 상태에 실제로 도달했는지를 조건으로 고정한다.
  // 로그의 관측 행은 화면 글자를 남기지 않으므로(observe 전용), "이 창이 떠야 한다"를 로그에서
  // 유도할 수 없는 경우가 있다(실측: 대상 선택 창). 고정 대기 대신 같은 키를 조건이 설 때까지만
  // 누른다(pressUntil — 매 입력 뒤 조건을 확인해 초과 입력이 없다).
  //
  // 삽입 위치가 필요한 이유: 기록된 세션은 이미 그 창 안에서 화살표를 눌렀다. 재생에서 같은 화살표를
  // 창이 열리기 **전에** 보내면 커맨드 커서만 움직이고 판정 지점(창 안의 커서)에 도달하지 못한다 —
  // 그러면 증상 없이 통과한다(실측 2026-10-23). 1-based 위치, 기본은 맨 끝.
  if (flags.until) {
    const parts = String(flags.until).split(":");
    if (parts.length < 2) fail(`--until 은 <key>:<testid>[:<삽입 위치>] 형식: ${flags.until}`);
    const [key, testid, atRaw] = parts;
    const insertAt = atRaw === undefined ? ops.length : Number(atRaw) - 1;
    if (!Number.isInteger(insertAt) || insertAt < 0 || insertAt > ops.length) {
      fail(`--until 삽입 위치는 1..${ops.length + 1}: ${atRaw}`);
    }
    ops.splice(insertAt, 0, { kind: "pressUntil", key, testid, state: "present", maxPresses: 12 });
    report.paced.push({ line: null, from: `--until @${insertAt + 1}`, to: `pressUntil ${key} → ${testid} present` });
  }
  // --wait-visible <testid[,testid…]> — 마지막 op 뒤에 "그 노드가 실제로 보인다"를 조건으로 고정한다.
  // 페이드로 들어오는 창(상태 메뉴 180ms)은 키 입력 직후 alpha 가 아직 0 이라, 그대로 단정하면
  // 화면에 없는 글자를 읽어 판정이 흔들린다(고정 sleep 대신 waitForVisible).
  for (const testid of String(flags["wait-visible"] ?? "").split(",").map((value) => value.trim()).filter(Boolean)) {
    ops.push({ kind: "waitForVisible", testid });
    report.paced.push({ line: null, from: "--wait-visible", to: `waitForVisible ${testid}` });
  }

  // ── 프로젝트 재료 ──────────────────────────────────────────────────────────
  const gameId = flags.game ? String(flags.game) : session?.game ?? null;
  const catalog = existsSync(GAMES_PATH) ? JSON.parse(await readFile(GAMES_PATH, "utf8")) : { games: [] };
  const entry = gameId ? (catalog.games ?? []).find((row) => row.id === gameId) : null;
  if (gameId && !entry && !flags.fixture) fail(`모르는 게임: ${gameId} — games.json 에 없거나 --fixture 가 필요하다`);
  const source = await resolveProjectSource({ flags, gameId, entry });

  // ── 뷰포트 ────────────────────────────────────────────────────────────────
  const sessionViewport = session?.viewport ? `${session.viewport.width}x${session.viewport.height}` : null;
  const viewportSpec = flags.viewport ?? sessionViewport ?? null;
  const viewport = viewportSpec
    ? (([w, h]) => ({ width: Number(w), height: Number(h) }))(String(viewportSpec).split("x"))
    : null;

  // ── 시나리오 ──────────────────────────────────────────────────────────────
  const target = join(REPO_ROOT, "scripts/qa/runtime", `${id}.scenario.mjs`);
  if (existsSync(target) && flags.force !== true) fail(`${target} 이 이미 있다 — --force 로 덮어써라`);
  await writeFile(target, renderScenario({
    id, game: gameId, source, viewport,
    checkpointSet: sessionMode ? id : null,
    ops, expect, note,
    sourceOps: sessionMode ? `${opsPath} ${flags.lines}` : String(flags.ops),
    pacingNotes: [
      ...report.paced.map((row) => (row.line === null ? `${row.from} → ${row.to}` : `line ${row.line} ${row.from} → ${row.to}`)),
      ...report.droppedGaps.map((row) => `line ${row.line} 간격 버림 — ${row.reason}`),
    ],
  }));
  process.stdout.write(`scenario: ${target}\n`);

  // ── 체크포인트 세트 ────────────────────────────────────────────────────────
  if (sessionMode) {
    await mkdir(CHECKPOINT_DIR, { recursive: true });
    const setPath = join(CHECKPOINT_DIR, `${id}.json`);
    const set = {
      set: id,
      ...(source.query ? { query: source.query } : {}),
      ...(source.fixture ? { projectFixture: source.fixture } : {}),
      ...(source.generator ? { projectGenerator: source.generator } : {}),
      ...(viewport ? { viewport } : {}),
      checkpoints: [{
        id: CHECKPOINT_ID,
        label: `세션 로그 line ${slice.anchor.line} 저장`,
        note: `${opsPath} 의 ${slice.anchor.save} 에서 부팅한다(리로드 경계를 넘지 않는 마지막 세이브). `
          + `기록 시점: ${slice.anchor.at ? `${slice.anchor.at.screen ?? "?"} ${slice.anchor.at.mapId ?? "-"} (${slice.anchor.at.x},${slice.anchor.at.y})` : "관측 없음"}.`,
        snapshot: slice.anchor.checkpoint.snapshot,
      }],
    };
    await writeFile(setPath, `${JSON.stringify(set, null, 1)}\n`);
    const snapshotBytes = Buffer.byteLength(JSON.stringify(slice.anchor.checkpoint.snapshot));
    process.stdout.write(`checkpoint set: ${setPath} (1 checkpoint, snapshot ${snapshotBytes} bytes)\n`);
    process.stdout.write(`anchor: line ${slice.anchor.line} save ${slice.anchor.save}`
      + `${slice.anchor.at ? ` ${slice.anchor.at.mapId} (${slice.anchor.at.x},${slice.anchor.at.y})` : ""}\n`);
  }
  process.stdout.write(`project: ${source.reason}\n`);
  for (const row of report.paced) process.stdout.write(`paced: line ${row.line} ${row.from} → ${row.to}\n`);
  for (const row of report.dropped) warn(`line ${row.line} 버림 — ${row.reason}`);
  for (const row of report.droppedGaps) warn(`line ${row.line} 간격 버림 — ${row.reason}`);
  process.stdout.write(`run: npm run qa:runtime -- --scenario ${id}`
    + `${sessionMode ? ` --checkpoint-set ${id} --checkpoint all` : ""}\n`);
}

main().catch((error) => fail(String(error?.message ?? error)));
