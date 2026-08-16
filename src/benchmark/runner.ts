// benchmark/runner.ts
// 벤치마크 태스크 러너(todo 9): 태스크 정의 → 입력 이미지 → 프롬프트 → 전송(api/paste)
// → parseBenchmarkAnswer → 차원별 스코어러 → 결과.
//
// 설계(계획 todo 9):
//  - runTask(taskId, settings, deps) / runAll(settings, deps) — deps 로 전송 클라이언트,
//    paste 공급자, 이미지 렌더러를 주입한다(테스트는 목, UI 는 실구현).
//  - d1 = wall/floor detection 서브런 2개 → 태스크 점수 = 평균 F1(scoreD1 집계값),
//    서브런 스코어는 DetectionScore 그대로 노출.
//  - d6 = autotileGrid + autotileCount 서브런 2개 → 두 서브런 점수를 모두 노출하고
//    태스크 passed = 둘 다 통과, 태스크 점수 = 두 서브런 점수(0..1)의 평균.
//  - 모델 원문 답변(rawAnswer)은 이 메모리 결과 객체에만 존재한다 — 저장소로
//    persist 하지 않는다(계획: "never persist raw answers outside memory").
//  - 오류 계약: 전송 실패/계약 위반은 구조화된 error 를 가진 결과로 끝난다(throw 금지).
//    단 존재하지 않는 taskId 는 프로그래밍 오류므로 즉시 throw 한다(경계 fail-fast).
//
// Node 실행 계약: 모듈 top-level 에 DOM 없음. 이미지 렌더는 deps 로 주입받는다
// (기본 deps 는 브라우저 캔버스를 쓰는 inputImages — Node 테스트는 stub 을 넣는다).
import {
  BenchmarkContractError,
  parseBenchmarkAnswer,
  type BenchmarkAnswer,
  type BenchmarkTaskKind,
} from "./contract";
import { BENCHMARK_TASKS, type BenchmarkSubRunDef, type BenchmarkTaskDef } from "./tasks";
import type { BenchmarkSendError, BenchmarkSettings } from "./llmClient";
import {
  buildAutotileLMask,
  scoreAutotileCount,
  scoreAutotileGrid,
  type AutotileCountScore,
  type AutotileGridScore,
} from "./scoringAutotile";
import {
  scoreDetection,
  scoreD1,
  type DetectionScore,
} from "./scoringDetection";
import {
  scoreFence,
  scoreHouse,
  scoreTrees,
  type FenceScore,
  type HouseScore,
  type TreeScore,
} from "./scoringConstruction";
import {
  FENCE_RECT,
  HOUSE_GROUND_TRUTH,
  TREE_GROUND_TRUTH,
} from "./fixtures/construction";
import {
  AUTOTILE_GROUP_ANSWER,
  FLOOR_TILES,
  ROOF_TILES,
  TRAP_TILES,
  WALL_TILES,
  WINDOW_TILES,
} from "./groundTruth";
import {
  buildAutotileMask,
  buildFenceGrid,
  buildHouseGrid,
  buildTreeGrid,
  renderBenchmarkAtlas,
  renderGridImage,
  renderShapeImage,
  type BenchmarkGrid,
} from "./inputImages";

/** 서브런/단일 태스크의 실행 단위(하나의 모델 호출). */
interface ExecutionUnit {
  readonly id: string;
  readonly kind: BenchmarkTaskKind;
  readonly prompt: string;
  /** 이 실행 단위가 기대하는 입력 이미지 종류(tasks.ts input 키). */
  readonly input: string;
}

/** 채점에 필요한 모든 스코어 형태(차원별 스코어러 출력의 합집합). */
export type SubRunScore = DetectionScore | HouseScore | TreeScore | FenceScore | AutotileGridScore | AutotileCountScore;

export type RunnerErrorKind = BenchmarkSendError["kind"] | "contract";

export interface RunnerError {
  readonly kind: RunnerErrorKind;
  readonly message: string;
  readonly status?: number;
}

export interface BenchmarkSubRunResult {
  readonly id: string;
  readonly kind: BenchmarkTaskKind;
  readonly prompt: string;
  readonly rawAnswer: string;
  /** 계약 파싱 성공 시의 정규화된 답변. 오류면 null. */
  readonly parsed: BenchmarkAnswer | null;
  /** 채점 결과. 파싱/전송 오류면 null(가짜 0점 플레이스홀더를 만들지 않는다). */
  readonly score: SubRunScore | null;
  readonly passed: boolean;
  readonly error?: RunnerError;
}

export interface BenchmarkTaskResult {
  readonly taskId: string;
  readonly kind: BenchmarkTaskKind;
  /** 태스크 대표 프롬프트(번들은 첫 서브런 프롬프트). */
  readonly prompt: string;
  /** 모델 원문(번들이면 서브런 원문들을 결합한 JSON — UI 표시/디버그 전용, 비persist). */
  readonly rawAnswer: string;
  readonly parsed: BenchmarkAnswer | null;
  /** 태스크 레벨 스코어(0..1 스칼라): d1/d6 = 서브런 평균, 단일 = 스칼라 접은 값. 오류면 null. */
  readonly score: number | null;
  /** 태스크 레벨 상세 스코어(d1 = scoreD1 집계 DetectionScore, 단일 태스크 = 서브런 스코어 객체). */
  readonly scoreDetail: DetectionScore | SubRunScore | null;
  readonly passed: boolean;
  /** 번들(d1/d6)의 서브런 결과. 단일 태스크는 undefined. */
  readonly subRuns?: readonly BenchmarkSubRunResult[];
  readonly error?: RunnerError;
}

/** 러너 주입 의존성 — 테스트는 목, 브라우저 UI 는 실구현. */
export interface BenchmarkRunnerDeps {
  /** 전송 계층(일반적으로 createBenchmarkLlmClient(settings) 결과). */
  readonly client: {
    send(request: { prompt: string; imageDataUrls: readonly string[] }): Promise<
      { ok: true; text: string } | { ok: false; error: BenchmarkSendError }
    >;
  };
  /** paste 모드에서 붙여넣은 답변 공급자(테스트/UI 주입). */
  readonly pasteAnswerProvider?: (request: { prompt: string }) => Promise<string>;
  /** 입력 이미지 렌더러(브라우저: inputImages 실구현 / Node 테스트: stub). */
  readonly renderAtlas: () => Promise<string>;
  /** 입력 키(houseGrid/treeGrid/fenceGrid/autotileShape)별 그리드 이미지 렌더러. */
  readonly renderGrid: (input: string) => Promise<string>;
  readonly renderShape: () => string;
}

/** 태스크별 올바른 그리드를 만든다(tasks.ts input 키 → inputImages 그리드 생성자). */
function gridForInput(input: string): BenchmarkGrid {
  switch (input) {
    case "houseGrid":
      return buildHouseGrid();
    case "treeGrid":
      return buildTreeGrid();
    case "fenceGrid":
      return buildFenceGrid();
    case "autotileShape":
      // d6a 는 마킹 없는 빈 8x6 그리드(= buildTreeGrid 차원) + L-path shape 이미지를 쓴다.
      return buildTreeGrid();
    default:
      throw new Error(`benchmark runner: grid 렌더에 알 수 없는 입력 키 ${input}`);
  }
}

/** 브라우저 기본 deps — tasks.ts 입력 키별로 올바른 그리드/마스크를 렌더한다. */
export function defaultRunnerDeps(
  pasteAnswerProvider?: BenchmarkRunnerDeps["pasteAnswerProvider"],
): Omit<BenchmarkRunnerDeps, "client"> {
  return {
    pasteAnswerProvider,
    renderAtlas: () => renderBenchmarkAtlas(),
    renderGrid: (input: string) => renderGridImage(gridForInput(input)),
    renderShape: () => renderShapeImage(buildAutotileMask()),
  };
}

// ── 입력 이미지 해석(tasks.ts input 키 → data URL 목록) ─────────────────

async function renderInputImages(
  unit: ExecutionUnit,
  deps: BenchmarkRunnerDeps,
): Promise<readonly string[]> {
  // 실행 단위별 기대 입력(계획 todo 9):
  //  - atlas       : d1/d2/d4/d6b — 타일셋 전체 아틀라스 1장
  //  - grid 계열   : d3(houseGrid)/d5(treeGrid)/d7(fenceGrid) — 그리드 이미지 1장
  //  - autotileShape(d6a) — 그리드 이미지 + L-path 마킹 shape 이미지 2장
  switch (unit.input) {
    case "atlas":
      return [await deps.renderAtlas()];
    case "autotileShape": {
      // d6a: 모델이 경로 칸 위에 타일을 놓을 빈 그리드 + L-path 마킹 이미지.
      // buildTreeGrid() 는 8x6 빈 그리드(마킹 없음)로 딱 이 용도에 부합한다.
      const grid = await deps.renderGrid("autotileShape");
      return [grid, deps.renderShape()];
    }
    case "houseGrid":
    case "treeGrid":
    case "fenceGrid":
      return [await deps.renderGrid(unit.input)];
    default:
      throw new Error(`benchmark runner: 알 수 없는 입력 키 ${unit.input} (unit ${unit.id})`);
  }
}

// ── 태스크 정의 → 실행 단위 ─────────────────────────────────────────────

function executionUnits(task: BenchmarkTaskDef): readonly ExecutionUnit[] {
  if (task.subRuns) {
    return task.subRuns.map((subRun: BenchmarkSubRunDef) => ({
      id: `${task.id}:${subRun.id}`,
      kind: subRun.kind,
      prompt: subRun.prompt(),
      input: subRun.input,
    }));
  }
  return [{ id: task.id, kind: task.kind, prompt: task.prompt(), input: task.input }];
}

function findTask(taskId: string): BenchmarkTaskDef {
  const task = BENCHMARK_TASKS.find((candidate) => candidate.id === taskId);
  if (!task) {
    const known = BENCHMARK_TASKS.map((candidate) => candidate.id).join(", ");
    throw new Error(`benchmark runner: 알 수 없는 taskId "${taskId}" (알려진 태스크: ${known})`);
  }
  return task;
}

// ── 채점 디스패치 ───────────────────────────────────────────────────────

/** 서브런 id(또는 단일 태스크 id) → detection 진실 세트. */
function detectionTruth(unitId: string): ReadonlySet<number> {
  if (unitId.endsWith("d1:wall")) return WALL_TILES;
  if (unitId.endsWith("d1:floor")) return FLOOR_TILES;
  if (unitId === "d2") return ROOF_TILES;
  if (unitId === "d4") return WINDOW_TILES;
  throw new Error(`benchmark runner: detection 진실 없음 (${unitId})`);
}

/** 0..1 스칼라 점수로 접는 규칙 — d6 결합과 전체 평균에 쓴다. */
function scalarScore(score: SubRunScore): number {
  if ("f1" in score) return score.f1;
  if ("score" in score && typeof score.score === "number") return score.score;
  if ("exactMatch" in score) return score.exactMatch;
  if ("cellAccuracy" in score) return score.cellAccuracy;
  return score.passed ? 1 : 0;
}

function scoreAnswer(unitId: string, kind: BenchmarkTaskKind, answer: BenchmarkAnswer): SubRunScore {
  switch (kind) {
    case "detection": {
      if (!("tileIds" in answer)) throw contractShapeError(unitId, "tileIds");
      return scoreDetection({ predicted: answer.tileIds, truth: [...detectionTruth(unitId)], traps: [...TRAP_TILES] });
    }
    case "construction": {
      if (!("lower" in answer) || !("upper" in answer)) throw contractShapeError(unitId, "lower/upper");
      const grid = { lower: answer.lower, upper: answer.upper };
      if (unitId === "d3") return scoreHouse(grid, HOUSE_GROUND_TRUTH);
      if (unitId === "d5") return scoreTrees(grid, TREE_GROUND_TRUTH);
      if (unitId === "d7") return scoreFence(grid, FENCE_RECT);
      throw new Error(`benchmark runner: construction 채점 대상 없음 (${unitId})`);
    }
    case "autotileGrid": {
      if (!("grid" in answer)) throw contractShapeError(unitId, "grid");
      return scoreAutotileGrid(answer.grid, buildAutotileLMask());
    }
    case "autotileCount": {
      if (!("count" in answer) || !("types" in answer)) throw contractShapeError(unitId, "count/types");
      return scoreAutotileCount(answer, AUTOTILE_GROUP_ANSWER.map((entry) => entry.name));
    }
  }
}

function contractShapeError(unitId: string, expected: string): Error {
  return new Error(`benchmark runner: ${unitId} 답변 형상 불일치 — ${expected} 필드가 없음(계약 파서와 스코어러가 어긋남)`);
}

function toRunnerError(error: unknown): RunnerError {
  if (error instanceof BenchmarkContractError) {
    return { kind: "contract", message: error.message };
  }
  return { kind: "network", message: error instanceof Error ? error.message : String(error) };
}

// ── 서브런 실행 ─────────────────────────────────────────────────────────

async function runUnit(
  unit: ExecutionUnit,
  settings: BenchmarkSettings,
  deps: BenchmarkRunnerDeps,
): Promise<BenchmarkSubRunResult> {
  const base: Omit<BenchmarkSubRunResult, "parsed" | "score" | "passed" | "error"> = {
    id: unit.id,
    kind: unit.kind,
    prompt: unit.prompt,
    rawAnswer: "",
  };

  const answer = await obtainRawAnswer(unit, settings, deps);
  if (!answer.ok) {
    return { ...base, parsed: null, score: null, passed: false, error: answer.error };
  }

  try {
    const parsed = parseBenchmarkAnswer(answer.text, unit.kind);
    const score = scoreAnswer(unit.id, unit.kind, parsed);
    return { ...base, rawAnswer: answer.text, parsed, score, passed: score.passed };
  } catch (error) {
    return {
      ...base,
      rawAnswer: answer.text,
      parsed: null,
      score: null,
      passed: false,
      error: toRunnerError(error),
    };
  }
}

/**
 * 실행 단위 하나의 모델 원문을 얻는다(계획 todo 9: "API call or paste-mode
 * (deps.pasteAnswerProvider)"). paste 모드는 클라이언트를 거치지 않고 주입된
 * 공급자에서 직접 받는다 — 실제 클라이언트(createBenchmarkLlmClient)의 paste
 * 경로와 동일 계약이지만 러너 입장에서는 deps 가 진실의 원천이다.
 * 두 경로 모두 오류를 throw 하지 않는다.
 */
async function obtainRawAnswer(
  unit: ExecutionUnit,
  settings: BenchmarkSettings,
  deps: BenchmarkRunnerDeps,
): Promise<{ ok: true; text: string } | { ok: false; error: BenchmarkSendError }> {
  if (settings.mode === "paste") {
    const provider = deps.pasteAnswerProvider;
    if (!provider) {
      return {
        ok: false,
        error: {
          kind: "config",
          message: "paste 모드에는 붙여넣은 답변 공급자(deps.pasteAnswerProvider)가 필요합니다.",
        },
      };
    }
    try {
      return { ok: true, text: await provider({ prompt: unit.prompt }) };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "config", message: `붙여넣은 답변을 읽지 못했습니다: ${String(error)}` },
      };
    }
  }
  const imageDataUrls = await renderInputImages(unit, deps);
  return deps.client.send({ prompt: unit.prompt, imageDataUrls });
}

// ── 공개 API ────────────────────────────────────────────────────────────

export async function runTask(
  taskId: string,
  settings: BenchmarkSettings,
  deps: BenchmarkRunnerDeps,
): Promise<BenchmarkTaskResult> {
  const task = findTask(taskId);
  const units = executionUnits(task);

  const subResults: BenchmarkSubRunResult[] = [];
  for (const unit of units) {
    const result = await runUnit(unit, settings, deps);
    subResults.push(result);
    // 전송 오류(네트워크/HTTP/타임아웃/config)는 같은 조건으로 다음 서브런도
    // 실패할 것이므로 즉시 중단한다. 계약 위반(prose)은 다른 프롬프트에서
    // 회복할 수 있으므로 계속 진행한다.
    if (result.error && result.error.kind !== "contract") {
      return bundleResult(task, subResults);
    }
  }
  return bundleResult(task, subResults);
}

function bundleResult(
  task: BenchmarkTaskDef,
  subResults: readonly BenchmarkSubRunResult[],
): BenchmarkTaskResult {
  const first = subResults[0];
  const prompt = first?.prompt ?? task.prompt();
  const rawAnswer =
    subResults.length === 1
      ? (first?.rawAnswer ?? "")
      : JSON.stringify(Object.fromEntries(subResults.map((run) => [run.id, run.rawAnswer])));
  const parsed = subResults.length === 1 ? (first?.parsed ?? null) : null;

  if (task.subRuns) {
    // 번들 태스크: 태스크 점수 = 서브런 스칼라 점수의 평균(계획: "task-level score for
    // d1 = mean of sub-runs", d6 = mean). d1 은 차원 집계(scoreD1 — FP/FN 합산 등
    // 을 포함한 DetectionScore)를 scoreDetail 로 함께 노출한다.
    const scored = subResults.filter((run) => run.error === undefined);
    const anyBlockingError = subResults.some((run) => run.error !== undefined);
    if (!anyBlockingError && scored.length === subResults.length) {
      const mean = scored.reduce(
        (sum, run) => sum + scalarScore(run.score as SubRunScore),
        0,
      ) / scored.length;
      const d1Aggregate =
        task.id === "d1"
          ? scoreD1({
              walls: subResults.find((run) => run.id === "d1:wall")!.score as DetectionScore,
              floors: subResults.find((run) => run.id === "d1:floor")!.score as DetectionScore,
            })
          : null;
      return {
        taskId: task.id,
        kind: task.kind,
        prompt,
        rawAnswer,
        parsed,
        score: mean,
        scoreDetail: d1Aggregate,
        passed: subResults.every((run) => run.passed),
        subRuns: subResults,
      };
    }
    // 서브런 중 하나라도 오류 → 태스크 오류(가장 앞선 오류 원인 노출).
    const failedRun = subResults.find((run) => run.error !== undefined);
    return {
      taskId: task.id,
      kind: task.kind,
      prompt,
      rawAnswer,
      parsed,
      score: null,
      scoreDetail: null,
      passed: false,
      subRuns: subResults,
      error: failedRun?.error,
    };
  }

  // 단일 실행 태스크 — 결과 1개가 전부다. 태스크 점수는 스칼라로 접는다.
  const single = subResults[0];
  return {
    taskId: task.id,
    kind: task.kind,
    prompt,
    rawAnswer: single?.rawAnswer ?? "",
    parsed: single?.parsed ?? null,
    score: single?.error ? null : single?.score ? scalarScore(single.score) : null,
    scoreDetail: single?.score ?? null,
    passed: single?.passed ?? false,
    error: single?.error,
  };
}

/** 7개 태스크를 정의 순서대로 순차 실행한다(동시성 없음 — 결정적이고 예측 가능한 실행). */
export async function runAll(
  settings: BenchmarkSettings,
  deps: BenchmarkRunnerDeps,
): Promise<readonly BenchmarkTaskResult[]> {
  const results: BenchmarkTaskResult[] = [];
  for (const task of BENCHMARK_TASKS) {
    results.push(await runTask(task.id, settings, deps));
  }
  return results;
}

  /** 전체 요약: overall score = 7개 태스크 스칼라 평균, passed = 모두 통과(계획 고정). */
export function summarizeRun(results: readonly BenchmarkTaskResult[]): {
  readonly overallScore: number;
  readonly passed: boolean;
} {
  if (results.length === 0) return { overallScore: 0, passed: false };
  const sum = results.reduce((total, result) => {
    if (typeof result.score === "number") return total + result.score;
    return total;
  }, 0);
  return { overallScore: sum / results.length, passed: results.every((result) => result.passed) };
}
