/**
 * 에디터 AI 의 스위치/변수 활용 능력(flag literacy) 벤치마크 CLI.
 *
 *   npx tsx scripts/flag-literacy-bench.mts list
 *   npx tsx scripts/flag-literacy-bench.mts run --model claude-sonnet-4.5 --tasks 8 --out reports/flag-literacy
 *   npx tsx scripts/flag-literacy-bench.mts report --in reports/flag-literacy/<run>
 *
 * run 은 태스크 프롬프트를 **에디터가 실제로 쓰는 AssistantSession 툴 루프**에 그대로 먹이고,
 * 세션이 누적한 draft 프로젝트를 9축으로 채점한다. 키는 env 에서만 읽고 출력·보관하지 않는다.
 *   FLAG_BENCH_BASE_URL  OpenAI 호환 baseUrl (기본: mdc-server LLM 프록시)
 *   FLAG_BENCH_API_KEY   위 엔드포인트의 키 (필수)
 */
import fs from "node:fs";
import path from "node:path";
import type { AiConfig } from "../src/ai/llmClient.ts";
import { renderFlagLiteracyReport } from "../src/benchmark/flags/report.ts";
import { runFlagSuite, type FlagRunSuite } from "../src/benchmark/flags/runner.ts";
import { FLAG_BENCH_TASKS } from "../src/benchmark/flags/tasks.ts";

const DEFAULT_BASE_URL = "http://100.73.251.77:8000/v1";
const DEFAULT_MODEL = "claude-sonnet-4.5";
const DEFAULT_OUT_DIR = path.join("reports", "flag-literacy");

function parseArgs(argv: readonly string[]): { command: string; flags: Record<string, string> } {
  const [command = "list", ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = "true";
    }
  }
  return { command, flags };
}

function requireApiKey(): string {
  const key = (process.env.FLAG_BENCH_API_KEY ?? "").trim();
  if (!key) {
    console.error("FLAG_BENCH_API_KEY 가 없습니다. OpenAI 호환 엔드포인트 키를 env 로 넣으세요(소스·보관본에 키를 쓰지 않습니다).");
    process.exit(2);
  }
  return key;
}

function configFor(model: string, maxToolCalls: number, maxTokens: number): AiConfig {
  return {
    authMode: "apiKey",
    baseUrl: (process.env.FLAG_BENCH_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    model,
    liteModel: model,
    apiKey: requireApiKey(),
    maxToolCalls,
    maxTokens,
    reasoningEffort: "low",
    agentMode: "auto",
    autoApprove: false,
  };
}

function listTasks(): void {
  console.log(`flag literacy 태스크 ${FLAG_BENCH_TASKS.length}개\n`);
  for (const task of FLAG_BENCH_TASKS) {
    console.log(`${task.id.padEnd(22)} ${task.title}`);
    console.log(`${" ".repeat(22)} ${task.summary}`);
    console.log(`${" ".repeat(22)} 축: ${task.axes.join(", ")}\n`);
  }
}

async function runBench(flags: Record<string, string>): Promise<void> {
  const model = flags.model ?? DEFAULT_MODEL;
  const taskCount = Number(flags.tasks ?? FLAG_BENCH_TASKS.length);
  const maxToolCalls = Number(flags.maxToolCalls ?? 40);
  const maxTokens = Number(flags.maxTokens ?? 8000);
  const timeoutMs = Number(flags.timeoutMs ?? 900_000);
  const concurrency = Number(flags.concurrency ?? 4);
  const maxRounds = Number(flags.rounds ?? 6);
  const outRoot = flags.out ?? DEFAULT_OUT_DIR;
  const tasks = FLAG_BENCH_TASKS.slice(0, Math.max(1, taskCount));
  const config = configFor(model, maxToolCalls, maxTokens);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(outRoot, `${stamp}_${model.replace(/[^\w.-]/g, "_")}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`[flag-bench] model=${model} tasks=${tasks.length} rounds=${maxRounds} concurrency=${concurrency} timeoutMs=${timeoutMs} out=${outDir}`);

  const suite = await runFlagSuite(tasks, {
    config,
    timeoutMs,
    concurrency,
    maxRounds,
    onProgress: (message) => console.log(message),
  });

  const resultsPath = path.join(outDir, "results.json");
  fs.writeFileSync(resultsPath, `${JSON.stringify(suite, null, 2)}\n`, "utf8");
  console.log(`[flag-bench] 결과: ${path.resolve(resultsPath)}`);
  if (flags.report === "false") return;
  writeReport(suite, outDir);
}

function writeReport(suite: FlagRunSuite, outDir: string): void {
  const html = renderFlagLiteracyReport(suite);
  const htmlPath = path.join(outDir, "flag-literacy-report.html");
  fs.writeFileSync(htmlPath, html, "utf8");
  console.log(`[flag-bench] 보고서: ${path.resolve(htmlPath)}`);
}

function reportOnly(flags: Record<string, string>): void {
  const inDir = flags.in;
  if (!inDir) {
    console.error("--in <결과 디렉터리> 가 필요합니다.");
    process.exit(2);
  }
  const resultsPath = path.join(inDir, "results.json");
  if (!fs.existsSync(resultsPath)) {
    console.error(`results.json 이 없습니다: ${resultsPath}`);
    process.exit(2);
  }
  writeReport(JSON.parse(fs.readFileSync(resultsPath, "utf8")) as FlagRunSuite, inDir);
}

const { command, flags } = parseArgs(process.argv.slice(2));
if (command === "list") listTasks();
else if (command === "run") await runBench(flags);
else if (command === "report") reportOnly(flags);
else {
  console.error(`알 수 없는 명령: ${command} (list | run | report)`);
  process.exit(2);
}
