// benchmark/interior/manifest.ts
// 재현성 척추 — 내용 해시 매니페스트 + 실행 기록 직렬화/역직렬화.
//
// LLM API 는 비트 단위로 재현되지 않는다. 그래서 재현성을 모델에서 물려받지 않고
// 여기서 제조한다:
//   L1 실험 고정  buildRunManifest 가 프롬프트·정답·이미지 바이트·채점 코드·
//                 샘플링 파라미터를 한 해시로 묶는다. manifestHash 가 같아야만
//                 두 점수를 비교할 수 있다.
//   L2 보관 후 재생 RunRecord 가 모델 원문 바이트를 그대로 담는다. 그 원문을
//                 오프라인에서 다시 채점하면 반드시 같은 점수가 나와야 한다.
//   L3 분산 측정  summarizeAttempts 가 반복 실행의 평균/표준편차를 낸다.

import { canonicalJson, digestOf } from "./hash";
import type { ModelParams, RunManifest, RunRecord, SchemeWeights } from "./types";

/** 채점 코드 버전 — 스코어러의 계산이 바뀌면 올린다. */
export const SCORING_VERSION = 1;

export class InteriorArchiveError extends Error {
  readonly field: string;

  constructor(field: string, detail: string) {
    super(`Interior benchmark archive rejected at ${field}: ${detail}`);
    this.name = "InteriorArchiveError";
    this.field = field;
  }
}

export function buildRunManifest(input: {
  readonly promptVersion: number;
  readonly groundTruthDigest: string;
  readonly imageDigests: Readonly<Record<string, string>>;
  readonly taskSuiteDigest: string;
  readonly weights: SchemeWeights;
  readonly params: Omit<ModelParams, "model">;
}): RunManifest {
  const body = {
    manifestVersion: 1 as const,
    promptVersion: input.promptVersion,
    groundTruthDigest: input.groundTruthDigest,
    imageDigests: { ...input.imageDigests },
    taskSuiteDigest: input.taskSuiteDigest,
    scoringVersion: SCORING_VERSION,
    weights: { ...input.weights },
    params: { ...input.params },
  };
  return Object.freeze({ ...body, manifestHash: digestOf(body) });
}

/** 요청 본문 해시 — 같은 매니페스트가 정말 같은 바이트를 보냈는지의 증거. */
export function hashRequestBody(body: unknown): string {
  return digestOf(body);
}

/** 기록 직렬화. 키 정렬 + 공백 없음이라 같은 기록은 항상 같은 바이트가 된다. */
export function serializeRunRecord(record: RunRecord): string {
  return canonicalJson(record);
}

/**
 * 기록 역직렬화 — fail-closed. 버전이 다르거나 필수 필드가 없으면 어긋난 필드를
 * 지목하며 거부한다. 망가진 보관본을 조용히 고쳐 읽으면 재현성 주장 자체가 거짓이 된다.
 */
export function parseRunRecord(text: string): RunRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new InteriorArchiveError("archive", `not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed)) throw new InteriorArchiveError("archive", "top-level value must be a JSON object");
  if (parsed.recordVersion !== 1) {
    throw new InteriorArchiveError("recordVersion", `expected 1, got ${JSON.stringify(parsed.recordVersion)}`);
  }
  if (typeof parsed.model !== "string" || parsed.model.length === 0) {
    throw new InteriorArchiveError("model", "must be a non-empty string");
  }
  if (typeof parsed.startedAt !== "string") throw new InteriorArchiveError("startedAt", "must be an ISO string");
  if (typeof parsed.overallComposite !== "number" || !Number.isFinite(parsed.overallComposite)) {
    throw new InteriorArchiveError("overallComposite", "must be a finite number");
  }
  const manifest = parsed.manifest;
  if (!isRecord(manifest)) throw new InteriorArchiveError("manifest", "must be an object");
  if (manifest.manifestVersion !== 1) {
    throw new InteriorArchiveError("manifest.manifestVersion", `expected 1, got ${JSON.stringify(manifest.manifestVersion)}`);
  }
  if (typeof manifest.manifestHash !== "string" || manifest.manifestHash.length !== 64) {
    throw new InteriorArchiveError("manifest.manifestHash", "must be a 64-character sha256 hex string");
  }
  if (!Array.isArray(parsed.tasks)) throw new InteriorArchiveError("tasks", "must be an array");
  for (let index = 0; index < parsed.tasks.length; index += 1) {
    const task = parsed.tasks[index];
    if (!isRecord(task)) throw new InteriorArchiveError(`tasks[${index}]`, "must be an object");
    if (typeof task.taskId !== "string") throw new InteriorArchiveError(`tasks[${index}].taskId`, "must be a string");
    if (!Array.isArray(task.attempts)) throw new InteriorArchiveError(`tasks[${index}].attempts`, "must be an array");
    for (let a = 0; a < task.attempts.length; a += 1) {
      const attempt = task.attempts[a];
      if (!isRecord(attempt)) throw new InteriorArchiveError(`tasks[${index}].attempts[${a}]`, "must be an object");
      if (typeof attempt.rawAnswer !== "string") {
        throw new InteriorArchiveError(`tasks[${index}].attempts[${a}].rawAnswer`, "must be a string");
      }
    }
  }
  return parsed as unknown as RunRecord;
}

/** 반복 실행 요약 — 모집단 표준편차(표본 아님: 우리가 가진 것이 전수다). */
export function summarizeAttempts(
  composites: readonly number[],
  passThreshold: number,
): { mean: number | null; stdDev: number | null; passAtK: number } {
  if (composites.length === 0) return { mean: null, stdDev: null, passAtK: 0 };
  const mean = composites.reduce((sum, value) => sum + value, 0) / composites.length;
  const variance = composites.reduce((sum, value) => sum + (value - mean) ** 2, 0) / composites.length;
  const passAtK = composites.some((value) => value >= passThreshold) ? 1 : 0;
  return { mean, stdDev: Math.sqrt(variance), passAtK };
}

/** 두 실행이 비교 가능한가 — 매니페스트 해시가 같을 때만. */
export function manifestsComparable(a: RunManifest, b: RunManifest): boolean {
  return a.manifestHash === b.manifestHash;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
