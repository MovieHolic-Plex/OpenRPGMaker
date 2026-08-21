/**
 * 실내 칩셋 LLM 타일 배치 벤치마크 CLI.
 *
 *   node --import tsx scripts/interior-bench.mts run --models a,b --repeats 2
 *   node --import tsx scripts/interior-bench.mts replay --in output/interior-bench
 *   node --import tsx scripts/interior-bench.mts report --in output/interior-bench
 *
 * run    실제 모델을 호출해 보관본(JSON)을 남긴다. 키는 .env.local 에서 읽고
 *        절대 출력하지 않으며 보관본에도 쓰지 않는다.
 * replay 보관본의 원문을 네트워크 없이 다시 채점하고, 직렬화 바이트가 원본과
 *        같은지 검사한다. 다르면 종료 코드 1 — 이것이 재현성 게이트다.
 * report 보관본들로 리더보드를 출력한다.
 */
import fs from "node:fs";
import path from "node:path";
import { formatLeaderboard, replayInteriorArchive, runInteriorBenchmark, type SendResult } from "../src/benchmark/interior/runner.ts";
import { parseRunRecord, serializeRunRecord } from "../src/benchmark/interior/manifest.ts";
import { DETERMINISTIC_PARAMS, type RunRecord } from "../src/benchmark/interior/types.ts";

const GATEWAY_URL = "https://cpenrouter.space/v1/chat/completions";
const DEFAULT_OUT_DIR = path.join("output", "interior-bench");
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
      temperature: DETERMINISTIC_PARAMS.temperature,
      top_p: DETERMINISTIC_PARAMS.topP,
      max_tokens: DETERMINISTIC_PARAMS.maxTokens,
      seed: DETERMINISTIC_PARAMS.seed,
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

function readArchives(dir: string): { file: string; record: RunRecord; text: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const text = fs.readFileSync(file, "utf8");
      return { file, record: parseRunRecord(text), text };
    });
}

async function commandRun(flags: Record<string, string>): Promise<number> {
  const models = (flags.models ?? flags.model ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (models.length === 0) {
    console.error("사용법: run --models <id[,id...]> [--repeats N] [--tasks id,id] [--out dir]");
    return 2;
  }
  const repeats = Number.parseInt(flags.repeats ?? "1", 10);
  if (!Number.isInteger(repeats) || repeats < 1) {
    console.error(`--repeats 는 1 이상의 정수여야 합니다 (받은 값: ${flags.repeats})`);
    return 2;
  }
  const taskIds = flags.tasks ? flags.tasks.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  const outDir = flags.out ?? DEFAULT_OUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const apiKey = readGatewayKey();

  for (const model of models) {
    console.log(`\n[run] ${model} (repeats=${repeats})`);
    const record = await runInteriorBenchmark({
      model,
      repeats,
      taskIds,
      send: createGatewaySend(model, apiKey),
    });
    const file = path.join(outDir, `${modelSlug(model)}.json`);
    fs.writeFileSync(file, serializeRunRecord(record), "utf8");
    for (const task of record.tasks) {
      const mean = task.compositeMean === null ? "  n/a" : task.compositeMean.toFixed(3);
      const sd = task.compositeStdDev === null ? " n/a" : task.compositeStdDev.toFixed(3);
      const errors = task.attempts.filter((a) => a.error !== null).length;
      console.log(`  ${task.taskId.padEnd(24)} mean=${mean} sd=${sd} pass@k=${task.passAtK} errors=${errors}/${task.attempts.length}`);
    }
    console.log(`  overall=${record.overallComposite.toFixed(3)} -> ${file}`);
  }
  return 0;
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
    const replayed = serializeRunRecord(replayInteriorArchive(record));
    // 보관본이 정규 직렬화로 쓰였으므로 원문과 바이트가 같아야 한다.
    const expected = serializeRunRecord(record);
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
  console.log(formatLeaderboard(archives.map((entry) => entry.record)));
  console.log("\nper-task composite mean");
  for (const { record } of archives) {
    console.log(`\n${record.model}`);
    for (const task of record.tasks) {
      const mean = task.compositeMean === null ? "n/a" : task.compositeMean.toFixed(3);
      console.log(`  ${task.taskId.padEnd(24)} ${mean}`);
    }
  }
  return 0;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  let code = 0;
  switch (command) {
    case "run":
      code = await commandRun(flags);
      break;
    case "replay":
      code = commandReplay(flags);
      break;
    case "report":
      code = commandReport(flags);
      break;
    default:
      console.error("사용법: interior-bench <run|replay|report> [flags]");
      code = 2;
  }
  process.exitCode = code;
}

await main();
