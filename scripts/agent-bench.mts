/**
 * 코딩 에이전트 벤치마크 — "이 칩셋으로 마을을 만들어라"를 모델별로 돌린다.
 *
 *   npx tsx scripts/agent-bench.mts run --models opus,sonnet,haiku [--turns 40] [--runs 1]
 *   npx tsx scripts/agent-bench.mts score --in output/agent-bench      # 제출물 재채점
 *   npx tsx scripts/agent-bench.mts report --in output/agent-bench
 *   npx tsx scripts/agent-bench.mts evidence --in output/agent-bench
 *   npx tsx scripts/agent-bench.mts baseline                           # 하네스 정본 = 1.000 확인
 *
 * town/ 트랙과의 차이: 저쪽은 하네스를 뗀 **모델 단독**을 단발 호출로 재고,
 * 이쪽은 **코딩 에이전트**(claude CLI)에게 저장소를 주고 실제로 만들게 한다.
 * 그래서 여기서는 하네스를 찾아 쓰는 것이 반칙이 아니라 실력이다.
 *
 * 격리: 모델마다 detached 워크트리를 새로 만들어 그 안에서만 돌린다(에이전트가
 * 이 워크트리나 본 리포를 건드리지 못하게). node_modules 는 정션으로 빌려 준다.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildTownGroundTruth } from "../src/benchmark/town/groundTruth.ts";
import { renderTileGridPng } from "../src/benchmark/town/inputImages.ts";
import { scoreAgentMap, scaleBaseline } from "../src/benchmark/agent/scoring.ts";
import { AGENT_SPEC_VERSION, SUBMISSION_PATH, buildAgentInstruction, parseSubmission } from "../src/benchmark/agent/spec.ts";
import { processMetrics } from "../src/benchmark/agent/claudeResult.ts";

const DEFAULT_OUT_DIR = path.join("output", "agent-bench");
const WORKTREE_ROOT = path.resolve("C:/Users/USER/.herdr/worktrees/rpg-zzu");
const NODE_MODULES_SOURCE = path.resolve("C:/Users/USER/Downloads/rpg-zzu/node_modules");
const RUN_TIMEOUT_MS = 45 * 60 * 1000;

interface RunRecord {
  readonly recordVersion: 1;
  readonly specVersion: number;
  readonly model: string;
  readonly run: number;
  readonly startedAt: string;
  readonly worktree: string;
  /** claude -p --output-format json 의 결과에서 뽑은 과정 지표. */
  readonly process: {
    readonly turns: number | null;
    readonly costUsd: number | null;
    readonly durationMs: number | null;
    readonly outputTokens: number | null;
    readonly isError: boolean;
    readonly stopReason: string | null;
    /** 별칭이 실제로 어떤 모델로 해석됐는가 — 별칭은 시간이 지나면 옮겨간다. */
    readonly resolvedModels: readonly string[];
    readonly apiErrorStatus: number | null;
    readonly resultMessage: string | null;
    readonly terminal: "completed" | "infra-error" | "budget-exhausted";
  };
  readonly submission: { readonly found: boolean; readonly reason: string | null; readonly bytes: number };
  readonly score: {
    readonly quality: number;
    readonly workMean: number;
    readonly scale: number;
    readonly detail: Record<string, number>;
  } | null;
  /** 턴 상한에 걸려 작업 중 잘렸는가 — 걸렸으면 그 실행은 "완성물"이 아니다. */
  readonly cappedTurns: boolean;
}

function parseArgs(argv: readonly string[]): { command: string; flags: Record<string, string> } {
  const [command = "", ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = "true";
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return { command, flags };
}

function sh(command: string, args: readonly string[], cwd?: string): { code: number; out: string } {
  const result = spawnSync(command, [...args], { cwd, encoding: "utf8", shell: false, maxBuffer: 64 * 1024 * 1024 });
  return { code: result.status ?? -1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** 모델별 detached 워크트리. 이미 있으면 지우고 새로 만든다(이전 실행이 새지 않게). */
function makeWorktree(name: string): string {
  const target = path.join(WORKTREE_ROOT, `agent-bench-${name}`);
  if (fs.existsSync(target)) {
    sh("git", ["worktree", "remove", "--force", target]);
    fs.rmSync(target, { recursive: true, force: true });
  }
  const added = sh("git", ["worktree", "add", "--detach", target, "HEAD"]);
  if (added.code !== 0) throw new Error(`워크트리 생성 실패: ${added.out.slice(0, 400)}`);
  // node_modules 정션 — 에이전트가 테스트·타입체크를 돌릴 수 있어야 한다.
  if (fs.existsSync(NODE_MODULES_SOURCE) && !fs.existsSync(path.join(target, "node_modules"))) {
    sh("cmd", ["/c", "mklink", "/J", path.join(target, "node_modules"), NODE_MODULES_SOURCE]);
  }
  return target;
}

async function commandRun(flags: Record<string, string>): Promise<number> {
  const models = (flags.models ?? flags.model ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (models.length === 0) {
    console.error("사용법: run --models opus,sonnet,haiku [--turns 40] [--runs 1] [--out dir]");
    return 2;
  }
  const turns = Number.parseInt(flags.turns ?? "40", 10);
  const runs = Number.parseInt(flags.runs ?? "1", 10);
  const outDir = flags.out ?? DEFAULT_OUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const groundTruth = buildTownGroundTruth();
  const instruction = buildAgentInstruction();

  console.log(`[지시서 v${AGENT_SPEC_VERSION}]\n${instruction}\n`);
  console.log(`모델 ${models.join(", ")} · 실행 ${runs}회 · 턴 상한 ${turns}\n`);

  for (const model of models) {
    for (let run = 1; run <= runs; run += 1) {
      const name = `${model}-${run}`;
      const startedAt = new Date().toISOString();
      console.log(`\n[run] ${name} — 워크트리 준비`);
      const worktree = makeWorktree(name);
      const began = Date.now();
      const result = sh(
        "claude",
        [
          "-p",
          "--model", model,
          "--output-format", "json",
          "--permission-mode", "bypassPermissions",
          "--max-turns", String(turns),
          instruction,
        ],
        worktree,
      );
      const elapsed = Date.now() - began;
      if (elapsed > RUN_TIMEOUT_MS) console.log("  (경고) 실행이 상한을 넘겼다");
      const metrics = processMetrics(result.out);

      const submissionFile = path.join(worktree, SUBMISSION_PATH);
      let submission: RunRecord["submission"] = { found: false, reason: "제출 파일 없음", bytes: 0 };
      let score: RunRecord["score"] = null;
      if (fs.existsSync(submissionFile)) {
        const text = fs.readFileSync(submissionFile, "utf8");
        const parsed = parseSubmission(text);
        if (parsed.ok) {
          submission = { found: true, reason: null, bytes: text.length };
          const scored = scoreAgentMap({ map: parsed.map, groundTruth });
          score = {
            quality: scored.quality,
            workMean: scored.workMean,
            scale: scored.scale,
            detail: { ...scored.detail },
          };
          // 제출물을 보관한다 — 워크트리가 사라져도 재채점·렌더가 가능해야 한다.
          fs.writeFileSync(path.join(outDir, `${name}.submission.json`), text, "utf8");
        } else {
          submission = { found: true, reason: parsed.reason, bytes: text.length };
        }
      }

      const record: RunRecord = {
        recordVersion: 1,
        specVersion: AGENT_SPEC_VERSION,
        model,
        run,
        startedAt,
        worktree,
        process: { ...metrics, durationMs: elapsed },
        submission,
        score,
        // stop_reason 이 end_turn 이 아니면 모델이 아직 일하는 중에 상한으로 끊긴 것이다.
        cappedTurns: metrics.stopReason !== null && metrics.stopReason !== "end_turn",
      };
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(record, null, 2), "utf8");
      fs.writeFileSync(path.join(outDir, `${name}.stdout.txt`), result.out, "utf8");
      printRecord(record);
    }
  }
  return 0;
}

function printRecord(record: RunRecord): void {
  const p = record.process;
  console.log(
    `  ${record.model.padEnd(8)} -> ${(p.resolvedModels ?? []).join(", ") || "?"}
` +
      `  turns=${p.turns ?? "?"} cost=$${(p.costUsd ?? 0).toFixed(2)} ` +
      `${((p.durationMs ?? 0) / 60000).toFixed(1)}min`,
  );
  if (!record.score) {
    const terminal = record.process.terminal;
    if (terminal === "infra-error") {
      console.log(`  실행 실패(인프라) — HTTP ${record.process.apiErrorStatus ?? "?"} ${record.process.resultMessage ?? ""}`);
    } else if (terminal === "budget-exhausted") {
      console.log(`  미완성(턴 예산 소진 ${record.process.turns}턴) — 제출물 없음. 예산을 올려야 비교가 성립한다`);
    } else {
      console.log(`  제출 실패(모델) — ${record.submission.reason ?? "이유 미보고"}`);
    }
    return;
  }
  const d = record.score.detail;
  console.log(
    `  quality=${record.score.quality.toFixed(3)} (일한 항목 ${record.score.workMean.toFixed(3)}) ` +
      `scale=${record.score.scale.toFixed(2)}${record.cappedTurns ? "  ⚠ 턴 상한에 걸려 잘림" : ""}`,
  );
  console.log(
    `  ${d.width}x${d.height} · 집 ${d.houses}/${d.buildings} · 문 ${d.doors} · 길 ${d.roadCells}(성분 ${d.roadComponents}) · ` +
      `울타리 ${d.fenceCells} · 나무 ${d.trees}(조각 ${d.brokenTrees}) · 타일종류 ${d.distinctTiles}`,
  );
}

function readRecords(dir: string): RunRecord[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.endsWith(".submission.json"))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as RunRecord);
}

/** 보관된 제출물을 네트워크 없이 다시 채점한다 — 채점 코드가 바뀌면 여기서 값이 갈린다. */
function commandScore(flags: Record<string, string>): number {
  const dir = flags.in ?? DEFAULT_OUT_DIR;
  const groundTruth = buildTownGroundTruth();
  let count = 0;
  for (const file of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!file.endsWith(".submission.json")) continue;
    const parsed = parseSubmission(fs.readFileSync(path.join(dir, file), "utf8"));
    if (!parsed.ok) {
      console.log(`FAIL ${file} — ${parsed.reason}`);
      continue;
    }
    const scored = scoreAgentMap({ map: parsed.map, groundTruth });
    console.log(`${file.replace(".submission.json", "").padEnd(14)} quality=${scored.quality.toFixed(3)} scale=${scored.scale.toFixed(2)}`);
    count += 1;
  }
  if (count === 0) console.log(`no submissions in ${dir}`);
  return 0;
}

function commandReport(flags: Record<string, string>): number {
  const dir = flags.in ?? DEFAULT_OUT_DIR;
  const records = readRecords(dir);
  if (records.length === 0) {
    console.log(`no records in ${dir}`);
    return 0;
  }
  const header = ["model/run".padEnd(14), "quality".padStart(8), "일한항목".padStart(8), "scale".padStart(7), "houses".padStart(7), "turns".padStart(6), "cost".padStart(8), "min".padStart(6)].join(" ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const record of [...records].sort((a, b) => (b.score?.quality ?? -1) - (a.score?.quality ?? -1))) {
    const d = record.score?.detail ?? {};
    console.log(
      [
        `${record.model}-${record.run}`.padEnd(14),
        (record.score
          ? record.score.quality.toFixed(3)
          : record.process.terminal === "infra-error"
            ? "API오류"
            : record.process.terminal === "budget-exhausted"
              ? "예산소진"
              : "제출X"
        ).padStart(8),
        (record.score ? record.score.workMean.toFixed(3) : "-").padStart(8),
        (record.score ? record.score.scale.toFixed(2) : "-").padStart(7),
        String(d.houses ?? "-").padStart(7),
        String(record.process.turns ?? "-").padStart(6),
        `$${(record.process.costUsd ?? 0).toFixed(2)}`.padStart(8),
        ((record.process.durationMs ?? 0) / 60000).toFixed(1).padStart(6),
        record.cappedTurns ? " ⚠상한" : "",
      ].join(" "),
    );
  }
  // 항목별 비교 — 종합 점수만 보면 "어디서 갈렸는가"를 알 수 없다.
  const WORK_ITEMS: readonly (readonly [string, string])[] = [
    ["housesWithDoor", "집에 문"],
    ["doorsWithRoad", "문앞 길"],
    ["roadOneNetwork", "길 단일망"],
    ["doorsReachable", "문 도달"],
    ["fenceGrammar", "울타리 문법"],
    ["roadAutotileLegality", "오토타일"],
    ["doorFamilies", "문 짝"],
  ];
  const PENALTIES: readonly (readonly [string, string])[] = [
    ["layerDiscipline", "레이어"],
    ["noBanned", "밴 없음"],
    ["treesIntact", "나무 온전"],
  ];
  const scored = records.filter((record) => record.score !== null);
  if (scored.length > 0) {
    console.log("\n항목별 (× = 감점 배수)");
    const nameWidth = 14;
    const columns = ["정본", ...scored.map((record) => `${record.model}-${record.run}`)];
    console.log(["항목".padEnd(nameWidth), ...columns.map((c) => c.slice(0, 9).padStart(10))].join(""));
    for (const [key, label] of WORK_ITEMS) {
      const cells = scored.map((record) => (record.score!.detail[key] ?? 0).toFixed(2).padStart(10));
      console.log([label.padEnd(nameWidth), "1.00".padStart(10), ...cells].join(""));
    }
    for (const [key, label] of PENALTIES) {
      const cells = scored.map((record) => (record.score!.detail[key] ?? 0).toFixed(2).padStart(10));
      console.log([`× ${label}`.padEnd(nameWidth), "1.00".padStart(10), ...cells].join(""));
    }
    console.log(
      ["규모 내역".padEnd(nameWidth), "".padStart(10), ...scored.map((r) => `${r.score!.detail.width}x${r.score!.detail.height}`.padStart(10))].join(""),
    );
    console.log(
      ["실제 모델".padEnd(nameWidth), "".padStart(10), ...scored.map((r) => (r.process.resolvedModels?.[0] ?? "?").replace("claude-", "").slice(0, 9).padStart(10))].join(""),
    );
  }

  console.log("\n하네스 정본 기준선: quality 1.000 / scale 1.000 (agent-bench baseline 으로 확인)");
  return 0;
}

/** 제출물을 실제 칩셋으로 합성해 PNG 로 굽는다 — 감독이 눈으로 검수할 유일한 경로. */
async function commandEvidence(flags: Record<string, string>): Promise<number> {
  const dir = flags.in ?? DEFAULT_OUT_DIR;
  const outDir = flags.out ?? path.join(dir, "evidence");
  fs.mkdirSync(outDir, { recursive: true });
  const groundTruth = buildTownGroundTruth();
  const reference = groundTruth.placements.villageGrid;
  fs.writeFileSync(
    path.join(outDir, "baseline-harness.png"),
    await renderTileGridPng({
      width: reference.width,
      height: reference.height,
      lower: reference.lower,
      upper: reference.upper,
    }),
  );
  let count = 1;
  const cards: string[] = [];
  const records = readRecords(dir);
  for (const file of (fs.existsSync(dir) ? fs.readdirSync(dir) : []).sort()) {
    if (!file.endsWith(".submission.json")) continue;
    const parsed = parseSubmission(fs.readFileSync(path.join(dir, file), "utf8"));
    if (!parsed.ok) continue;
    const name = file.replace(".submission.json", "");
    fs.writeFileSync(path.join(outDir, `${name}.png`), await renderTileGridPng(parsed.map));
    count += 1;
    const record = records.find((entry) => `${entry.model}-${entry.run}` === name);
    cards.push(evidenceCard(name, `${name}.png`, record));
  }
  // 제출물이 없는 실행도 카드로 남긴다 — 왜 없는지가 결과의 일부다.
  for (const record of records) {
    if (record.score !== null) continue;
    cards.push(evidenceCard(`${record.model}-${record.run}`, null, record));
  }
  fs.writeFileSync(path.join(outDir, "index.html"), evidenceHtml(cards, records), "utf8");
  console.log(`${count} shots -> ${outDir}`);
  console.log(`open ${path.join(outDir, "index.html")}`);
  return 0;
}

const EVIDENCE_ITEMS: readonly (readonly [string, string, boolean])[] = [
  ["housesWithDoor", "집에 문", false],
  ["doorsWithRoad", "문앞 길", false],
  ["roadOneNetwork", "길 단일망", false],
  ["doorsReachable", "문 도달", false],
  ["fenceGrammar", "울타리 문법", false],
  ["roadAutotileLegality", "오토타일 합법성", false],
  ["doorFamilies", "문 짝", false],
  ["layerDiscipline", "레이어 규율", true],
  ["noBanned", "금지 타일 없음", true],
  ["treesIntact", "나무 온전", true],
];

function evidenceCard(name: string, png: string | null, record: RunRecord | undefined): string {
  const score = record?.score ?? null;
  const process = record?.process;
  const terminal = process?.terminal ?? "completed";
  const banner =
    terminal === "infra-error"
      ? `<div class="bad">인프라 실패 — HTTP ${process?.apiErrorStatus ?? "?"}. 점수가 아니다(재시도 대상)</div>`
      : terminal === "budget-exhausted"
        ? `<div class="warn">턴 예산 소진 (${process?.turns ?? "?"}턴) — 미완성물이다</div>`
        : "";
  const items = score
    ? EVIDENCE_ITEMS.map(([key, label, isPenalty]) => {
        const value = score.detail[key] ?? 0;
        const cls = value >= 0.999 ? "ok" : value >= 0.7 ? "mid" : "low";
        return `<tr><td>${isPenalty ? "× " : ""}${esc(label)}</td><td class="n ${cls}">${value.toFixed(2)}</td></tr>`;
      }).join("")
    : "";
  const d = score?.detail ?? {};
  return `<section class="card">
    <h2>${esc(name)} <small>${esc((process?.resolvedModels ?? []).join(", ") || "?")}</small></h2>
    ${banner}
    <div class="nums">
      <span><b>${score ? score.quality.toFixed(3) : "—"}</b>quality</span>
      <span><b>${score ? score.workMean.toFixed(3) : "—"}</b>일한 항목</span>
      <span><b>${score ? score.scale.toFixed(2) : "—"}</b>규모</span>
      <span><b>${process?.turns ?? "—"}</b>턴</span>
      <span><b>$${(process?.costUsd ?? 0).toFixed(2)}</b>비용</span>
      <span><b>${((process?.durationMs ?? 0) / 60000).toFixed(1)}</b>분</span>
    </div>
    ${png ? `<img src="${png}" alt="">` : `<div class="none">제출물 없음</div>`}
    ${score ? `<p class="facts">${d.width}×${d.height} · 집 ${d.houses}/${d.buildings} · 문 ${d.doors} · 길 ${d.roadCells}(성분 ${d.roadComponents}) · 울타리 ${d.fenceCells} · 나무 ${d.trees}(조각 ${d.brokenTrees}) · 타일 ${d.distinctTiles}종</p>` : ""}
    ${items ? `<table class="items">${items}</table>` : ""}
  </section>`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function evidenceHtml(cards: readonly string[], records: readonly RunRecord[]): string {
  const budgets = [...new Set(records.map((r) => r.process.turns ?? 0))];
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>코딩 에이전트 벤치마크 — 증거 시트</title>
<style>
 :root{color-scheme:dark}
 body{background:#0e1014;color:#e8ebf0;font:14px/1.6 -apple-system,"Segoe UI","Malgun Gothic",system-ui,sans-serif;margin:0;padding:28px 32px 80px}
 h1{font-size:22px;margin:0 0 6px}
 p.lede{color:#9aa3b0;margin:0 0 26px;max-width:90ch}
 .grid{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}
 .card{background:#191d24;border:1px solid #272c35;border-radius:12px;padding:16px 18px;max-width:min(760px,96vw)}
 .card h2{font-size:16px;margin:0 0 10px}
 .card h2 small{color:#6b7480;font-weight:400;font-size:11px;margin-left:6px}
 .nums{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 12px}
 .nums span{display:flex;flex-direction:column;font-size:11px;color:#9aa3b0}
 .nums b{font-size:19px;color:#e8ebf0;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
 .card img{display:block;image-rendering:pixelated;border:1px solid #272c35;border-radius:6px;max-width:100%;height:auto;background:#0a0c10}
 .none{width:280px;height:160px;border:1px dashed #3a3f4b;border-radius:6px;color:#6b7480;display:flex;align-items:center;justify-content:center}
 .facts{color:#9aa3b0;font-size:12px;margin:8px 0 0}
 table.items{border-collapse:collapse;margin:12px 0 0;font-size:12px}
 table.items td{border-bottom:1px solid #23272f;padding:3px 10px 3px 0}
 td.n{font-variant-numeric:tabular-nums;text-align:right}
 td.ok{color:#5ddba0} td.mid{color:#ffb454} td.low{color:#ff6b6b}
 .bad{background:#ff6b6b18;border-left:3px solid #ff6b6b;color:#ffcbcb;padding:8px 12px;border-radius:0 6px 6px 0;margin:0 0 12px;font-size:12.5px}
 .warn{background:#ffb45418;border-left:3px solid #ffb454;color:#ffe2bb;padding:8px 12px;border-radius:0 6px 6px 0;margin:0 0 12px;font-size:12.5px}
</style></head><body>
<h1>코딩 에이전트 벤치마크 — 증거 시트</h1>
<p class="lede">같은 생짜 지시("이 칩셋으로 마을을 만들어라")를 모델만 바꿔 <code>claude -p</code> 로 돌린 결과다.
크기·집 수·도구 이름을 알려주지 않았다. <b>quality</b> 는 감사 통과율(이대로 납품 가능한가),
<b>일한 항목</b> 은 감점을 곱하기 전 평균, <b>규모</b> 는 하네스가 만든 정본 마을 대비다.
턴 예산: ${budgets.join(", ")}턴 사용.</p>
<div class="grid">
<section class="card"><h2>기준선 — 하네스가 만든 마을 <small>build_village 계열 엔진</small></h2>
  <div class="nums"><span><b>1.000</b>quality</span><span><b>1.000</b>일한 항목</span><span><b>1.00</b>규모</span></div>
  <img src="baseline-harness.png" alt="">
  <p class="facts">이 그림이 1.000 의 정의다. 에이전트가 저장소의 하네스를 찾아 쓰면 여기에 수렴한다.</p>
</section>
${cards.join("\n")}
</div>
</body></html>
`;
}

/** 하네스 정본이 quality/scale 1.000 인지 — 채점기 배선 점검. */
function commandBaseline(): number {
  const groundTruth = buildTownGroundTruth();
  const reference = groundTruth.placements.villageGrid;
  const scored = scoreAgentMap({
    map: { width: reference.width, height: reference.height, lower: reference.lower, upper: reference.upper },
    groundTruth,
  });
  const baseline = scaleBaseline(groundTruth);
  console.log(`기준선(정본 마을): 집 ${baseline.houses} · 면적 ${baseline.area} · 길 ${baseline.roadCells}`);
  console.log(`quality=${scored.quality.toFixed(3)} scale=${scored.scale.toFixed(3)}`);
  const ok = scored.quality > 0.9999 && Math.abs(scored.scale - 1) < 0.0001;
  console.log(ok ? "PASS 하네스 정본이 1.000 / 1.000" : "FAIL 채점기나 기준선이 틀렸다");
  return ok ? 0 : 1;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  let code = 0;
  switch (command) {
    case "run":
      code = await commandRun(flags);
      break;
    case "score":
      code = commandScore(flags);
      break;
    case "report":
      code = commandReport(flags);
      break;
    case "evidence":
      code = await commandEvidence(flags);
      break;
    case "baseline":
      code = commandBaseline();
      break;
    default:
      console.error("사용법: agent-bench <run|score|report|evidence|baseline> [flags]");
      code = 2;
  }
  process.exitCode = code;
}

await main();
