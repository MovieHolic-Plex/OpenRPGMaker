// benchmark/interior/runner.ts
// 실내 벤치마크 러너 — 태스크 실행 · 채점 · 보관 · 재생.
//
// DOM 을 쓰지 않고 process.argv 도 읽지 않는다(전송은 주입, CLI 는 별도).
// 전송 실패와 계약 위반은 절대 throw 하지 않고 error 가 채워진 시도 기록으로
// 끝난다 — 모델이 산문을 뱉은 것도 유효한 벤치마크 결과이지, 러너의 버그가 아니다.
// 그리고 그런 시도는 0점으로 세지 않는다(0점과 "채점 불가"는 다른 사실이다).

import { parseInteriorAnswer } from "./contract";
import { buildInteriorGroundTruth } from "./groundTruth";
import { interiorImageDigests, renderInteriorImagePng, type InteriorImageKey } from "./inputImages";
import { buildRunManifest, summarizeAttempts, hashRequestBody } from "./manifest";
import { INTERIOR_PROMPT_VERSION } from "./prompts";
import { scorePlacementAnswer } from "./scoringStructure";
import { scoreTileSetAnswer } from "./scoringSets";
import { INTERIOR_TASKS, interiorTaskSuiteDigest } from "./tasks";
import {
  DEFAULT_SCHEME_WEIGHTS,
  DETERMINISTIC_PARAMS,
  PASS_THRESHOLD,
  type AttemptRecord,
  type InteriorAnswer,
  type InteriorGroundTruth,
  type InteriorTaskDef,
  type ModelParams,
  type PlacementAnswer,
  type RunRecord,
  type ScoredAnswer,
  type TaskRecord,
  type TileSetAnswer,
} from "./types";

export type SendResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: { readonly kind: string; readonly message: string } };

export interface SendRequest {
  readonly prompt: string;
  readonly imagePng: Uint8Array;
  readonly params: ModelParams;
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

function selectedTasks(taskIds?: readonly string[]): readonly InteriorTaskDef[] {
  if (!taskIds || taskIds.length === 0) return INTERIOR_TASKS;
  return INTERIOR_TASKS.filter((task) => taskIds.includes(task.id));
}

/** 태스크 하나의 답변을 채점한다. 형상이 태스크 종류와 어긋나면 계약 오류로 본다. */
function scoreAnswer(
  task: InteriorTaskDef,
  answer: InteriorAnswer,
  groundTruth: InteriorGroundTruth,
): ScoredAnswer {
  if (task.kind === "tileSet") {
    if (!("tileIds" in answer)) throw new Error(`${task.id}: tileSet 태스크인데 tileIds 가 없다`);
    if (!task.category) throw new Error(`${task.id}: tileSet 태스크에 category 가 없다`);
    return scoreTileSetAnswer({
      answer: answer as TileSetAnswer,
      truth: groundTruth.categories[task.category],
      schemes: task.schemes,
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
  }
  if (!("lower" in answer)) throw new Error(`${task.id}: placement 태스크인데 lower/upper 가 없다`);
  const house = groundTruth.houses[task.input];
  if (!house) throw new Error(`${task.id}: 입력 키 ${task.input} 에 대응하는 정본 플랜이 없다`);
  return scorePlacementAnswer({
    answer: answer as PlacementAnswer,
    house,
    groundTruth,
    schemes: task.schemes,
    weights: DEFAULT_SCHEME_WEIGHTS,
  });
}

/** 원문 하나를 파싱·채점해 시도 기록으로 만든다(절대 throw 하지 않는다). */
function scoreRawAnswer(
  task: InteriorTaskDef,
  groundTruth: InteriorGroundTruth,
  attempt: number,
  requestHash: string,
  rawAnswer: string,
): AttemptRecord {
  try {
    const parsed = parseInteriorAnswer(rawAnswer, task.kind);
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
        kind: error instanceof Error && error.name === "InteriorContractError" ? "contract" : "scoring",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function buildTaskRecord(task: InteriorTaskDef, attempts: readonly AttemptRecord[]): TaskRecord {
  const composites = attempts
    .filter((entry) => entry.scored !== null)
    .map((entry) => entry.scored!.composite);
  const summary = summarizeAttempts(composites, PASS_THRESHOLD);
  return {
    taskId: task.id,
    kind: task.kind,
    attempts,
    compositeMean: summary.mean,
    compositeStdDev: summary.stdDev,
    passAtK: summary.passAtK,
  };
}

function overallComposite(tasks: readonly TaskRecord[]): number {
  const means = tasks.map((task) => task.compositeMean).filter((mean): mean is number => mean !== null);
  if (means.length === 0) return 0;
  return means.reduce((sum, mean) => sum + mean, 0) / means.length;
}

export async function runInteriorBenchmark(input: RunInput): Promise<RunRecord> {
  const groundTruth = buildInteriorGroundTruth();
  const manifest = buildRunManifest({
    promptVersion: INTERIOR_PROMPT_VERSION,
    groundTruthDigest: groundTruth.digest,
    imageDigests: await interiorImageDigests(),
    taskSuiteDigest: interiorTaskSuiteDigest(),
    weights: DEFAULT_SCHEME_WEIGHTS,
    params: DETERMINISTIC_PARAMS,
  });
  const params: ModelParams = { model: input.model, ...DETERMINISTIC_PARAMS };

  // 이미지는 태스크마다 다시 그리지 않고 키별로 한 번만 렌더한다(결정적이고 비싸다).
  const imageCache = new Map<string, Uint8Array>();
  const imageFor = async (key: string): Promise<Uint8Array> => {
    const cached = imageCache.get(key);
    if (cached) return cached;
    const png = await renderInteriorImagePng(key as InteriorImageKey);
    imageCache.set(key, png);
    return png;
  };

  const tasks: TaskRecord[] = [];
  // 순차 실행 — 동시성을 넣으면 순서가 흔들려 결정성이 깨진다.
  for (const task of selectedTasks(input.taskIds)) {
    const prompt = task.prompt();
    const imagePng = await imageFor(task.input);
    const attempts: AttemptRecord[] = [];
    for (let attempt = 1; attempt <= input.repeats; attempt += 1) {
      const requestBody = {
        model: input.model,
        taskId: task.id,
        prompt,
        imageDigest: manifest.imageDigests[task.input],
        params: DETERMINISTIC_PARAMS,
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

  return {
    recordVersion: 1,
    manifest,
    model: input.model,
    startedAt: input.startedAt ?? new Date().toISOString(),
    tasks,
    overallComposite: overallComposite(tasks),
  };
}

/**
 * 보관된 원문을 네트워크 없이 다시 채점한다. 이것이 이 벤치마크가 실제로 보증할
 * 수 있는 재현성이다 — 같은 보관본을 다시 채점하면 같은 바이트가 나와야 한다.
 * 정답 테이블이나 채점 코드가 바뀌었다면 여기서 값이 갈리고, 그것이 정확히
 * 우리가 알고 싶은 신호다.
 */
export function replayInteriorArchive(record: RunRecord): RunRecord {
  const groundTruth = buildInteriorGroundTruth();
  const tasks: TaskRecord[] = [];
  for (const archived of record.tasks) {
    const task = INTERIOR_TASKS.find((candidate) => candidate.id === archived.taskId);
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
  return { ...record, tasks, overallComposite: overallComposite(tasks) };
}

/** 모델별 종합 점수와 스킴별 평균 표. */
export function formatLeaderboard(records: readonly RunRecord[]): string {
  const schemeIds = Object.keys(DEFAULT_SCHEME_WEIGHTS);
  const rows = [...records]
    .sort((a, b) => b.overallComposite - a.overallComposite)
    .map((record) => {
      const perScheme = new Map<string, number[]>();
      for (const task of record.tasks) {
        for (const attempt of task.attempts) {
          for (const entry of attempt.scored?.schemes ?? []) {
            const list = perScheme.get(entry.scheme) ?? [];
            list.push(entry.score);
            perScheme.set(entry.scheme, list);
          }
        }
      }
      const cells = schemeIds.map((id) => {
        const values = perScheme.get(id) ?? [];
        if (values.length === 0) return "  -  ";
        return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3);
      });
      return [record.model.padEnd(34), record.overallComposite.toFixed(3).padStart(7), ...cells.map((c) => c.padStart(7))].join(" ");
    });
  const header = ["model".padEnd(34), "overall".padStart(7), ...schemeIds.map((id) => id.padStart(7))].join(" ");
  return [header, "-".repeat(header.length), ...rows].join("\n");
}
