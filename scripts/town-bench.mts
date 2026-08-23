/**
 * combined_town 칩셋 LLM 타일 배치 벤치마크 CLI (9문항 트랙).
 *
 *   node --import tsx scripts/town-bench.mts run --models a,b --repeats 3
 *   node --import tsx scripts/town-bench.mts replay --in output/town-bench
 *   node --import tsx scripts/town-bench.mts report --in output/town-bench
 *   node --import tsx scripts/town-bench.mts evidence --in output/town-bench
 *   node --import tsx scripts/town-bench.mts demo
 *
 * run      실제 모델을 호출해 보관본(JSON)을 남긴다. 키는 .env.local 에서 읽고
 *          절대 출력하지 않으며 보관본에도 쓰지 않는다.
 * replay   보관본의 원문을 네트워크 없이 다시 채점하고, 직렬화 바이트가 원본과
 *          같은지 검사한다. 다르면 종료 코드 1 — 이것이 재현성 게이트다.
 * report   보관본들로 9축 리더보드를 출력한다.
 * evidence 보관본의 답을 실제 칩셋으로 합성해 PNG + HTML 증거 시트를 굽는다.
 * demo     API 없이 정본 답변으로 파이프라인 전체를 돌린다(배선 점검·증거 시트 예시).
 */
import fs from "node:fs";
import path from "node:path";
import { buildTownEvidence } from "../src/benchmark/town/evidence.ts";
import { buildTownGroundTruth } from "../src/benchmark/town/groundTruth.ts";
import { parseTownRecord, serializeTownRecord } from "../src/benchmark/town/manifest.ts";
import {
  formatTownLeaderboard,
  replayTownArchive,
  runTownBenchmark,
  type SendResult,
} from "../src/benchmark/town/runner.ts";
import { townTaskById } from "../src/benchmark/town/tasks.ts";
import {
  EMPTY_CELL,
  TOWN_AXIS_ORDER,
  TOWN_AXIS_TITLE,
  TOWN_DETERMINISTIC_PARAMS,
  type TownRunRecord,
} from "../src/benchmark/town/types.ts";

const GATEWAY_URL = "https://cpenrouter.space/v1/chat/completions";
const DEFAULT_OUT_DIR = path.join("output", "town-bench");
const REQUEST_TIMEOUT_MS = 180_000;

const JSON_ONLY_SYSTEM_PROMPT =
  "Return exactly one JSON object answering the task. Do not include markdown, prose, code fences, or hidden reasoning. Numbers must be JSON integers.";

function parseArgs(argv: readonly string[]): { command: string; flags: Record<string, string> } {
  const [command = "", ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = "true";
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { command, flags };
}

/** .env.local 에서 키를 읽는다. 값은 어디에도 출력하지 않는다. */
function readGatewayKey(): string {
  const envPath = ".env.local";
  if (!fs.existsSync(envPath)) {
    throw new Error(`${envPath} 이 없습니다 — CPENROUTER_API_KEY 를 설정하세요.`);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    if (trimmed.slice(0, index).trim() !== "CPENROUTER_API_KEY") continue;
    const value = trimmed.slice(index + 1).trim();
    if (value) return value;
  }
  throw new Error(".env.local 에 CPENROUTER_API_KEY 가 없습니다.");
}

function modelSlug(model: string): string {
  return model.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function toDataUrl(png: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

function createGatewaySend(model: string, apiKey: string) {
  return async (request: { prompt: string; imagePng: Uint8Array }): Promise<SendResult> => {
    const body = {
      model,
      messages: [
        { role: "system", content: JSON_ONLY_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: request.prompt },
            { type: "image_url", image_url: { url: toDataUrl(request.imagePng) } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: TOWN_DETERMINISTIC_PARAMS.temperature,
      top_p: TOWN_DETERMINISTIC_PARAMS.topP,
      max_tokens: TOWN_DETERMINISTIC_PARAMS.maxTokens,
      seed: TOWN_DETERMINISTIC_PARAMS.seed,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = (await response.text().catch(() => "")).slice(0, 300);
        return { ok: false, error: { kind: "http", message: `HTTP ${response.status} ${text}` } };
      }
      const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string") return { ok: true, text: content };
      if (Array.isArray(content)) {
        const joined = content
          .map((part) =>
            part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string"
              ? (part as { text: string }).text
              : "",
          )
          .filter(Boolean)
          .join("\n");
        if (joined) return { ok: true, text: joined };
      }
      return { ok: false, error: { kind: "response", message: "빈 content" } };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        error: { kind: aborted ? "timeout" : "network", message: error instanceof Error ? error.message : String(error) },
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * 정본 답변을 그대로 돌려주는 가짜 전송 — API 없이 러너·채점·보관·재생·증거를
 * 전부 통과시킨다. 만점이 나오지 않으면 배선이나 채점기가 틀린 것이다.
 */
function createReferenceSend() {
  const groundTruth = buildTownGroundTruth();
  const gridLayer: Record<string, "lower" | "upper"> = { roadGrid: "lower", doorGrid: "lower", fenceGrid: "upper" };
  const rows = (flat: readonly number[], width: number): number[][] => {
    const out: number[][] = [];
    for (let y = 0; y * width < flat.length; y += 1) out.push([...flat.slice(y * width, (y + 1) * width)]);
    return out;
  };
  return async (request: { requestBody: unknown }): Promise<SendResult> => {
    const taskId = (request.requestBody as { taskId: string }).taskId;
    const task = townTaskById(taskId);
    if (task.kind === "tileSet") {
      const probe = groundTruth[task.probe!];
      return { ok: true, text: JSON.stringify({ tileIds: [...probe.positives].sort((a, b) => a - b) }) };
    }
    if (task.axis === "autotile") {
      const reference = groundTruth.autotile;
      const grid = Array.from({ length: reference.height }, () => new Array<number>(reference.width).fill(EMPTY_CELL));
      for (const cell of reference.cells) grid[cell.y]![cell.x] = cell.tile;
      return { ok: true, text: JSON.stringify({ grid }) };
    }
    const reference = groundTruth.placements[task.placement!];
    const layer = gridLayer[reference.key];
    if (layer) {
      return { ok: true, text: JSON.stringify({ grid: rows(layer === "lower" ? reference.lower : reference.upper, reference.width) }) };
    }
    return {
      ok: true,
      text: JSON.stringify({ lower: rows(reference.lower, reference.width), upper: rows(reference.upper, reference.width) }),
    };
  };
}

function readArchives(dir: string): { file: string; record: TownRunRecord; text: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const text = fs.readFileSync(file, "utf8");
      return { file, record: parseTownRecord(text), text };
    });
}

function printRecord(record: TownRunRecord): void {
  for (const task of record.tasks) {
    const mean = task.meanScore === null ? "  n/a" : task.meanScore.toFixed(3);
    const sd = task.stdDev === null ? " n/a" : task.stdDev.toFixed(3);
    const stability = task.stability === null ? " n/a" : task.stability.toFixed(3);
    const errors = task.attempts.filter((attempt) => attempt.error !== null).length;
    console.log(
      `  ${task.taskId.padEnd(20)} ${task.axis.padEnd(15)} mean=${mean} sd=${sd} stab=${stability} ` +
        `pass@k=${task.passAtK} errors=${errors}/${task.attempts.length}`,
    );
  }
  console.log("  ── 9축 ──");
  for (const [index, axis] of TOWN_AXIS_ORDER.entries()) {
    const value = record.axisScores[axis];
    console.log(`  ${String(index + 1).padStart(2)}. ${TOWN_AXIS_TITLE[axis].padEnd(20)} ${value === null ? "n/a" : value.toFixed(3)}`);
  }
  console.log(`  overall=${record.overall.toFixed(3)}`);
}

async function commandRun(flags: Record<string, string>): Promise<number> {
  const models = (flags.models ?? flags.model ?? "").split(",").map((model) => model.trim()).filter(Boolean);
  if (models.length === 0) {
    console.error("사용법: run --models <id[,id...]> [--repeats N] [--tasks id,id] [--out dir]");
    return 2;
  }
  const repeats = Number.parseInt(flags.repeats ?? "3", 10);
  if (!Number.isInteger(repeats) || repeats < 1) {
    console.error(`--repeats 는 1 이상의 정수여야 합니다 (받은 값: ${flags.repeats})`);
    return 2;
  }
  const taskIds = flags.tasks ? flags.tasks.split(",").map((task) => task.trim()).filter(Boolean) : undefined;
  const outDir = flags.out ?? DEFAULT_OUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const apiKey = readGatewayKey();

  for (const model of models) {
    console.log(`\n[run] ${model} (repeats=${repeats})`);
    const record = await runTownBenchmark({ model, repeats, taskIds, send: createGatewaySend(model, apiKey) });
    const file = path.join(outDir, `${modelSlug(model)}.json`);
    fs.writeFileSync(file, serializeTownRecord(record), "utf8");
    printRecord(record);
    console.log(`  -> ${file}`);
  }
  return 0;
}

async function commandDemo(flags: Record<string, string>): Promise<number> {
  const outDir = flags.out ?? path.join(DEFAULT_OUT_DIR, "demo");
  fs.mkdirSync(outDir, { recursive: true });
  console.log("[demo] 정본 답변으로 파이프라인 전체를 돌립니다 (API 미사용)");
  const record = await runTownBenchmark({
    model: "reference-answers",
    repeats: Number.parseInt(flags.repeats ?? "2", 10),
    send: createReferenceSend(),
    startedAt: "1970-01-01T00:00:00.000Z",
  });
  const file = path.join(outDir, "reference-answers.json");
  fs.writeFileSync(file, serializeTownRecord(record), "utf8");
  printRecord(record);
  const perfect = TOWN_AXIS_ORDER.every((axis) => (record.axisScores[axis] ?? 0) > 0.9999);
  console.log(`  -> ${file}`);
  console.log(perfect ? "PASS 정본이 9축 전부 만점" : "FAIL 정본이 만점이 아니다 — 채점기나 배선이 틀렸다");
  return perfect ? 0 : 1;
}

function commandReplay(flags: Record<string, string>): number {
  const dir = flags.in ?? DEFAULT_OUT_DIR;
  const archives = readArchives(dir);
  if (archives.length === 0) {
    console.log(`no archives found in ${dir}`);
    return 0;
  }
  let failures = 0;
  for (const { file, record, text } of archives) {
    const replayed = serializeTownRecord(replayTownArchive(record));
    // 보관본이 정규 직렬화로 쓰였으므로 원문과 바이트가 같아야 한다.
    const expected = serializeTownRecord(record);
    const stored = text === expected;
    const identical = replayed === expected;
    if (identical && stored) {
      console.log(`PASS ${path.basename(file)} — replay byte-identical (${replayed.length} bytes)`);
      continue;
    }
    failures += 1;
    console.log(`FAIL ${path.basename(file)} — storedCanonical=${stored} replayIdentical=${identical}`);
    if (!identical) {
      const at = firstDifference(expected, replayed);
      console.log(`     first divergence at offset ${at}: expected ${JSON.stringify(expected.slice(at, at + 80))}`);
      console.log(`                                        replay   ${JSON.stringify(replayed.slice(at, at + 80))}`);
    }
  }
  return failures === 0 ? 0 : 1;
}

function firstDifference(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; i += 1) if (a[i] !== b[i]) return i;
  return max;
}

function commandReport(flags: Record<string, string>): number {
  const dir = flags.in ?? DEFAULT_OUT_DIR;
  const archives = readArchives(dir);
  if (archives.length === 0) {
    console.log(`no archives found in ${dir}`);
    return 0;
  }
  console.log(formatTownLeaderboard(archives.map((entry) => entry.record)));
  for (const { record } of archives) {
    console.log(`\n${record.model}`);
    printRecord(record);
  }
  return 0;
}

async function commandEvidence(flags: Record<string, string>): Promise<number> {
  const dir = flags.in ?? DEFAULT_OUT_DIR;
  const archives = readArchives(dir);
  if (archives.length === 0) {
    console.log(`no archives found in ${dir}`);
    return 0;
  }
  const outDir = flags.out ?? path.join(dir, "evidence");
  fs.mkdirSync(outDir, { recursive: true });
  const { shots, html } = await buildTownEvidence(archives.map((entry) => entry.record));
  for (const shot of shots) fs.writeFileSync(path.join(outDir, shot.name), shot.png);
  const indexFile = path.join(outDir, "index.html");
  fs.writeFileSync(indexFile, html, "utf8");
  console.log(`${shots.length} shots -> ${outDir}`);
  console.log(`open ${indexFile}`);
  return 0;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  let code = 0;
  switch (command) {
    case "run":
      code = await commandRun(flags);
      break;
    case "demo":
      code = await commandDemo(flags);
      break;
    case "replay":
      code = commandReplay(flags);
      break;
    case "report":
      code = commandReport(flags);
      break;
    case "evidence":
      code = await commandEvidence(flags);
      break;
    default:
      console.error("사용법: town-bench <run|demo|replay|report|evidence> [flags]");
      code = 2;
  }
  process.exitCode = code;
}

await main();
