// benchmark/town/runner.ts
// 마을 벤치마크 러너 — 태스크 실행 · 채점 · 보관 · 재생 · 9축 집계.
//
// DOM 을 쓰지 않고 process.argv 도 읽지 않는다(전송은 주입, CLI 는 별도).
// 전송 실패와 계약 위반은 절대 throw 하지 않고 error 가 채워진 시도 기록으로
// 끝난다 — 모델이 산문을 뱉은 것도 유효한 벤치마크 결과이지, 러너의 버그가 아니다.
// 그리고 그런 시도는 0점으로 세지 않는다(0점과 "채점 불가"는 다른 사실이다).
//
// 2번(재현성) 축만 다른 축과 계산 방식이 다르다: 태스크마다 반복 답변끼리의
// 일치율을 재고 그 평균을 축 점수로 쓴다. 모델 실력이 아니라 "같은 질문에 같은
// 답을 내는가"이며, 그것이 나머지 8축을 믿을 수 있는지의 전제다.

import { parseTownAnswer } from "./contract";
import { buildTownGroundTruth } from "./groundTruth";
import { renderTownImagePng } from "./inputImages";
import { townImageDigests } from "./inputImages";
import { buildTownRunManifest, hashRequestBody, summarizeAttempts } from "./manifest";
import { TOWN_PROMPT_VERSION } from "./prompts";
import { scoreTownAutotile } from "./scoringGrid";
import { scoreTownProbe } from "./scoringSets";
import { scoreTownPlacement } from "./scoringStructure";
import { TOWN_TASKS, townTaskSuiteDigest } from "./tasks";
import {
  PASS_THRESHOLD,
  TOWN_AXIS_ORDER,
  TOWN_DETERMINISTIC_PARAMS,
  type AxisScore,
  type ScoredTownAnswer,
  type TownAnswer,
  type TownAttemptRecord,
  type TownAxisId,
  type TownGroundTruth,
  type TownImageKey,
  type TownModelParams,
  type TownRunRecord,
  type TownTaskDef,
  type TownTaskRecord,
} from "./types";

export type SendResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: { readonly kind: string; readonly message: string } };

export interface SendRequest {
  readonly prompt: string;
  readonly imagePng: Uint8Array;
  readonly params: TownModelParams;
  readonly requestBody: unknown;
}

export interface RunInput {
  readonly model: string;
  readonly repeats: number;
  readonly taskIds?: readonly string[];
  readonly send: (request: SendRequest) => Promise<SendResult>;
  /** 기록의 startedAt — 주입 가능해야 테스트가 시간에 흔들리지 않는다. */
  readonly startedAt?: string;
}

function selectedTasks(taskIds?: readonly string[]): readonly TownTaskDef[] {
  if (!taskIds || taskIds.length === 0) return TOWN_TASKS;
  return TOWN_TASKS.filter((task) => taskIds.includes(task.id));
}

/** 태스크 하나의 답변을 채점한다. 형상이 태스크 종류와 어긋나면 계약 오류로 본다. */
function scoreAnswer(task: TownTaskDef, answer: TownAnswer, groundTruth: TownGroundTruth): ScoredTownAnswer {
  const axes: AxisScore[] = [];
  if (task.kind === "tileSet") {
    if (!("tileIds" in answer)) throw new Error(`${task.id}: tileSet 태스크인데 tileIds 가 없다`);
    if (!task.probe) throw new Error(`${task.id}: tileSet 태스크에 probe 가 없다`);
    axes.push(scoreTownProbe({ answer, probe: groundTruth[task.probe], axis: task.axis }));
  } else if (task.axis === "autotile") {
    if (!("grid" in answer)) throw new Error(`${task.id}: 오토타일 태스크인데 grid 가 없다`);
    axes.push(scoreTownAutotile({ answer, reference: groundTruth.autotile }));
  } else {
    if (!task.placement) throw new Error(`${task.id}: 배치 태스크에 placement 가 없다`);
    axes.push(scoreTownPlacement({ answer, reference: groundTruth.placements[task.placement], groundTruth }));
  }
  const scores = axes.map((axis) => axis.score);
  return Object.freeze({
    axes: Object.freeze(axes),
    mean: scores.length === 0 ? 0 : scores.reduce((sum, value) => sum + value, 0) / scores.length,
  });
}

/** 원문 하나를 파싱·채점해 시도 기록으로 만든다(절대 throw 하지 않는다). */
function scoreRawAnswer(
  task: TownTaskDef,
  groundTruth: TownGroundTruth,
  attempt: number,
  requestHash: string,
  rawAnswer: string,
): TownAttemptRecord {
  try {
    const parsed = parseTownAnswer(rawAnswer, task.kind);
    const scored = scoreAnswer(task, parsed, groundTruth);
    return { attempt, requestHash, rawAnswer, parsed, scored, error: null };
  } catch (error) {
    return {
      attempt,
      requestHash,
      rawAnswer,
      parsed: null,
      scored: null,
      error: {
        kind: error instanceof Error && error.name === "TownContractError" ? "contract" : "scoring",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// ── 재현성(2번 축) ────────────────────────────────────────────────────────

function tileSetAgreement(a: readonly number[], b: readonly number[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const id of left) if (right.has(id)) intersection += 1;
  return intersection / union.size;
}

function gridAgreement(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number {
  const height = Math.max(a.length, b.length);
  const width = Math.max(a[0]?.length ?? 0, b[0]?.length ?? 0);
  if (height === 0 || width === 0) return 1;
  let same = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((a[y]?.[x] ?? null) === (b[y]?.[x] ?? null)) same += 1;
    }
  }
  return same / (width * height);
}

/** 같은 요청에 대한 두 답변의 일치도. 형상이 다른 답끼리는 0 이다. */
function answerAgreement(a: TownAnswer, b: TownAnswer): number {
  if ("tileIds" in a && "tileIds" in b) return tileSetAgreement(a.tileIds, b.tileIds);
  if ("grid" in a && "grid" in b) return gridAgreement(a.grid, b.grid);
  if ("lower" in a && "lower" in b) {
    return (gridAgreement(a.lower, b.lower) + gridAgreement(a.upper, b.upper)) / 2;
  }
  return 0;
}

/** 반복 답변들의 쌍별 일치도 평균. 파싱된 답이 둘 미만이면 null(측정 불가). */
function stabilityOf(attempts: readonly TownAttemptRecord[]): number | null {
  const parsed = attempts.map((attempt) => attempt.parsed).filter((answer): answer is TownAnswer => answer !== null);
  if (parsed.length < 2) return null;
  const pairs: number[] = [];
  for (let i = 0; i < parsed.length; i += 1) {
    for (let j = i + 1; j < parsed.length; j += 1) pairs.push(answerAgreement(parsed[i]!, parsed[j]!));
  }
  return pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
}

// ── 집계 ──────────────────────────────────────────────────────────────────

function buildTaskRecord(task: TownTaskDef, attempts: readonly TownAttemptRecord[]): TownTaskRecord {
  const scores = attempts.filter((entry) => entry.scored !== null).map((entry) => entry.scored!.mean);
  const summary = summarizeAttempts(scores, PASS_THRESHOLD);
  return {
    taskId: task.id,
    kind: task.kind,
    axis: task.axis,
    attempts,
    meanScore: summary.mean,
    stdDev: summary.stdDev,
    passAtK: summary.passAtK,
    stability: stabilityOf(attempts),
  };
}

/**
 * 9축 집계. 8축은 그 축에 속한 태스크들의 평균이고, 2번 재현성은 전 태스크의
 * 답변 일치율 평균이다. 채점된 태스크가 없는 축은 0 이 아니라 null 이다 —
 * "0점"과 "측정 안 됨"을 같은 칸에 쓰면 리더보드가 거짓말을 한다.
 */
export function aggregateAxisScores(tasks: readonly TownTaskRecord[]): Record<TownAxisId, number | null> {
  const scores: Record<string, number | null> = {};
  for (const axis of TOWN_AXIS_ORDER) {
    if (axis === "reproducibility") {
      const values = tasks.map((task) => task.stability).filter((value): value is number => value !== null);
      scores[axis] = values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
      continue;
    }
    const values = tasks
      .filter((task) => task.axis === axis)
      .map((task) => task.meanScore)
      .filter((value): value is number => value !== null);
    scores[axis] = values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return scores as Record<TownAxisId, number | null>;
}

function overallOf(axisScores: Record<TownAxisId, number | null>): number {
  const values = Object.values(axisScores).filter((value): value is number => value !== null);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ── 실행 ──────────────────────────────────────────────────────────────────

export async function runTownBenchmark(input: RunInput): Promise<TownRunRecord> {
  const groundTruth = buildTownGroundTruth();
  const manifest = buildTownRunManifest({
    promptVersion: TOWN_PROMPT_VERSION,
    groundTruthDigest: groundTruth.digest,
    imageDigests: await townImageDigests(),
    taskSuiteDigest: townTaskSuiteDigest(),
    params: TOWN_DETERMINISTIC_PARAMS,
  });
  const params: TownModelParams = { model: input.model, ...TOWN_DETERMINISTIC_PARAMS };

  // 이미지는 태스크마다 다시 그리지 않고 키별로 한 번만 렌더한다(결정적이고 비싸다).
  const imageCache = new Map<TownImageKey, Uint8Array>();
  const imageFor = async (key: TownImageKey): Promise<Uint8Array> => {
    const cached = imageCache.get(key);
    if (cached) return cached;
    const png = await renderTownImagePng(key);
    imageCache.set(key, png);
    return png;
  };

  const tasks: TownTaskRecord[] = [];
  // 순차 실행 — 동시성을 넣으면 순서가 흔들려 결정성이 깨진다.
  for (const task of selectedTasks(input.taskIds)) {
    const prompt = task.prompt();
    const imagePng = await imageFor(task.input);
    const attempts: TownAttemptRecord[] = [];
    for (let attempt = 1; attempt <= input.repeats; attempt += 1) {
      const requestBody = {
        model: input.model,
        taskId: task.id,
        prompt,
        imageDigest: manifest.imageDigests[task.input],
        params: TOWN_DETERMINISTIC_PARAMS,
      };
      const requestHash = hashRequestBody(requestBody);
      const result = await input.send({ prompt, imagePng, params, requestBody });
      if (!result.ok) {
        attempts.push({ attempt, requestHash, rawAnswer: "", parsed: null, scored: null, error: result.error });
        continue;
      }
      attempts.push(scoreRawAnswer(task, groundTruth, attempt, requestHash, result.text));
    }
    tasks.push(buildTaskRecord(task, attempts));
  }

  const axisScores = aggregateAxisScores(tasks);
  return {
    recordVersion: 1,
    manifest,
    model: input.model,
    startedAt: input.startedAt ?? new Date().toISOString(),
    tasks,
    axisScores,
    overall: overallOf(axisScores),
  };
}

/**
 * 보관된 원문을 네트워크 없이 다시 채점한다. 이것이 이 벤치마크가 실제로 보증할
 * 수 있는 재현성이다 — 같은 보관본을 다시 채점하면 같은 바이트가 나와야 한다.
 * 정답 테이블이나 채점 코드가 바뀌었다면 여기서 값이 갈리고, 그것이 정확히
 * 우리가 알고 싶은 신호다.
 */
export function replayTownArchive(record: TownRunRecord): TownRunRecord {
  const groundTruth = buildTownGroundTruth();
  const tasks: TownTaskRecord[] = [];
  for (const archived of record.tasks) {
    const task = TOWN_TASKS.find((candidate) => candidate.id === archived.taskId);
    if (!task) {
      // 스위트에서 사라진 태스크는 보관본 그대로 보존한다(임의로 버리지 않는다).
      tasks.push(archived);
      continue;
    }
    const attempts = archived.attempts.map((attempt) => {
      if (attempt.error !== null && attempt.rawAnswer === "") return attempt; // 전송 실패는 재생할 원문이 없다
      return scoreRawAnswer(task, groundTruth, attempt.attempt, attempt.requestHash, attempt.rawAnswer);
    });
    tasks.push(buildTaskRecord(task, attempts));
  }
  const axisScores = aggregateAxisScores(tasks);
  return { ...record, tasks, axisScores, overall: overallOf(axisScores) };
}

/** 모델별 9축 표 — 감독의 문항 번호 순으로 읽는다. */
export function formatTownLeaderboard(records: readonly TownRunRecord[]): string {
  const header = ["model".padEnd(30), "overall".padStart(8), ...TOWN_AXIS_ORDER.map((axis) => axis.slice(0, 8).padStart(9))].join(" ");
  const rows = [...records]
    .sort((a, b) => b.overall - a.overall)
    .map((record) => {
      const cells = TOWN_AXIS_ORDER.map((axis) => {
        const value = record.axisScores[axis];
        return (value === null ? "-" : value.toFixed(3)).padStart(9);
      });
      return [record.model.padEnd(30), record.overall.toFixed(3).padStart(8), ...cells].join(" ");
    });
  return [header, "-".repeat(header.length), ...rows].join("\n");
}
