// 모델 없는 게임 검사기 CLI.
//
//   bun scripts/qa-game/check.mts qa-runs/<id>            # <id>/project.json → <id>/check.json + check.txt
//   bun scripts/qa-game/check.mts --project game.json     # 임의의 프로젝트 JSON
//   옵션: --out <dir>  --no-autoplay  --budget-ms 60000  --brief <brief.json|text>  --quiet
//         --raw  로더를 거치지 않은 원본 JSON 을 검사한다(생성기가 쓴 그대로 — 로더 정규화가 가린 결함까지)
//   기본은 로더를 거친 프로젝트(런타임이 보는 모양)를 검사하고, 로더가 고친 명령은 load-normalized 경고로 낸다.
//
// 종료 코드: 막힘(blocker) 이 있으면 1, 없으면 0, 읽기 실패 2.

import fs from "node:fs";
import path from "node:path";
import { loadHeadlessProject } from "../../src/headless/index.ts";
import { formatGameCheckSummary, runGameCheck } from "../../src/qa/gameCheck/index.ts";
import type { Project } from "../../src/project/types.ts";

let ARGV: readonly string[] = process.argv.slice(2);
function arg(name: string): string | undefined {
  const index = ARGV.indexOf(`--${name}`);
  return index >= 0 ? ARGV[index + 1] : undefined;
}
const flag = (name: string) => ARGV.includes(`--${name}`);

/** 로더를 거친 프로젝트(런타임이 보는 모양)와 원본 JSON(생성기가 쓴 모양)을 함께 읽는다. */
export function loadProjectFile(file: string): { project: Project; raw: unknown; loadError?: string } {
  const text = fs.readFileSync(file, "utf8");
  const raw = JSON.parse(text) as unknown;
  try {
    return { project: loadHeadlessProject(text), raw };
  } catch (error) {
    // 로더가 거부하는 저장본도 검사는 해야 한다 — 거부 이유를 먼저 알리고 원본 그대로 본다.
    const loadError = error instanceof Error ? error.message : String(error);
    console.error(`[qa-game] 로더가 프로젝트를 거부했습니다(원본 JSON 으로 검사): ${loadError}`);
    return { project: raw as Project, raw, loadError };
  }
}

function briefText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!fs.existsSync(value)) return value;
  const raw = JSON.parse(fs.readFileSync(value, "utf8")) as { brief?: { summary?: string; answers?: Record<string, { text?: string }> }; summary?: string };
  const brief = raw.brief ?? raw;
  return [brief.summary ?? "", ...Object.values((brief as { answers?: Record<string, { text?: string }> }).answers ?? {}).map((a) => a?.text ?? "")].join("\n");
}

export function checkMain(argv: readonly string[] = process.argv.slice(2)): number {
  ARGV = argv;
  const positional = argv.find((value, index) => !value.startsWith("--") && !(index > 0 && argv[index - 1]!.startsWith("--")));
  const projectFile = arg("project") ?? (positional ? path.join(positional, "project.json") : undefined);
  if (!projectFile || !fs.existsSync(projectFile)) {
    console.error("사용법: bun scripts/qa-game/check.mts qa-runs/<id>  또는  --project <file.json>");
    return 2;
  }
  const outDir = arg("out") ?? (positional ?? path.dirname(projectFile));
  const started = Date.now();
  const loaded = loadProjectFile(projectFile);
  const project = flag("raw") ? (loaded.raw as Project) : loaded.project;
  const loadedMs = Date.now() - started;
  const report = runGameCheck(project, {
    ...(flag("raw") || loaded.loadError ? {} : { rawProject: loaded.raw }),
    skipAutoPlay: flag("no-autoplay"),
    ...(arg("budget-ms") ? { autoPlayBudgetMs: Number(arg("budget-ms")) } : {}),
    ...(briefText(arg("brief")) ? { briefText: briefText(arg("brief"))! } : {}),
  });
  fs.mkdirSync(outDir, { recursive: true });
  const summary = formatGameCheckSummary(report);
  fs.writeFileSync(path.join(outDir, "check.json"), JSON.stringify({ ...report, loadMs: loadedMs, source: projectFile, mode: flag("raw") ? "raw" : "loaded", ...(loaded.loadError ? { loadError: loaded.loadError } : {}) }, null, 2));
  fs.writeFileSync(path.join(outDir, "check.txt"), `${summary}\n`);
  if (!flag("quiet")) console.log(summary);
  console.log(`\n[qa-game] check.json → ${path.join(outDir, "check.json")} (읽기 ${loadedMs}ms, 검사 ${report.ms}ms)`);
  return report.counts.blocker > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(checkMain());
