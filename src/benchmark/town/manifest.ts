// benchmark/town/manifest.ts
// 재현성 척추 — 내용 해시 매니페스트 + 실행 기록 직렬화/역직렬화.
//
// LLM API 는 비트 단위로 재현되지 않는다. 그래서 재현성을 모델에서 물려받지 않고
// 여기서 제조한다:
//   L1 실험 고정  buildTownRunManifest 가 프롬프트·정답·이미지 바이트·채점 코드·
//                 샘플링 파라미터를 한 해시로 묶는다. manifestHash 가 같아야만
//                 두 점수를 비교할 수 있다.
//   L2 보관 후 재생 TownRunRecord 가 모델 원문 바이트를 그대로 담는다. 그 원문을
//                 오프라인에서 다시 채점하면 반드시 같은 바이트가 나와야 한다.
//   L3 분산 측정  summarizeAttempts 가 반복 실행의 평균/표준편차를 낸다.
//
// 해시 원시 함수는 ../interior/hash.ts 를 재사용한다(두 번째 sha256 금지).

import { canonicalJson, digestOf } from "../interior/hash";
import type { TownModelParams, TownRunManifest, TownRunRecord } from "./types";

/** 채점 코드 버전 — 스코어러의 계산이 바뀌면 올린다. */
export const TOWN_SCORING_VERSION = 1;

export class TownArchiveError extends Error {
  readonly field: string;

  constructor(field: string, detail: string) {
    super(`Town benchmark archive rejected at ${field}: ${detail}`);
    this.name = "TownArchiveError";
    this.field = field;
  }
}

export function buildTownRunManifest(input: {
  readonly promptVersion: number;
  readonly groundTruthDigest: string;
  readonly imageDigests: Readonly<Record<string, string>>;
  readonly taskSuiteDigest: string;
  readonly params: Omit<TownModelParams, "model">;
}): TownRunManifest {
  const body = {
    manifestVersion: 1 as const,
    promptVersion: input.promptVersion,
    groundTruthDigest: input.groundTruthDigest,
    imageDigests: { ...input.imageDigests },
    taskSuiteDigest: input.taskSuiteDigest,
    scoringVersion: TOWN_SCORING_VERSION,
    params: { ...input.params },
  };
  return Object.freeze({ ...body, manifestHash: digestOf(body) });
}

/** 요청 본문 해시 — 같은 매니페스트가 정말 같은 바이트를 보냈는지의 증거. */
export function hashRequestBody(body: unknown): string {
  return digestOf(body);
}

/** 기록 직렬화. 키 정렬 + 공백 없음이라 같은 기록은 항상 같은 바이트가 된다. */
export function serializeTownRecord(record: TownRunRecord): string {
  return canonicalJson(record);
}

/**
 * 기록 역직렬화 — fail-closed. 버전이 다르거나 필수 필드가 없으면 어긋난 필드를
 * 지목하며 거부한다. 망가진 보관본을 조용히 고쳐 읽으면 재현성 주장 자체가 거짓이 된다.
 */
export function parseTownRecord(text: string): TownRunRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new TownArchiveError("archive", `not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed)) throw new TownArchiveError("archive", "top-level value must be a JSON object");
  if (parsed.recordVersion !== 1) {
    throw new TownArchiveError("recordVersion", `expected 1, got ${JSON.stringify(parsed.recordVersion)}`);
  }
  if (typeof parsed.model !== "string" || parsed.model.length === 0) {
    throw new TownArchiveError("model", "must be a non-empty string");
  }
  if (typeof parsed.startedAt !== "string") throw new TownArchiveError("startedAt", "must be an ISO string");
  if (typeof parsed.overall !== "number" || !Number.isFinite(parsed.overall)) {
    throw new TownArchiveError("overall", "must be a finite number");
  }
  const manifest = parsed.manifest;
  if (!isRecord(manifest)) throw new TownArchiveError("manifest", "must be an object");
  if (manifest.manifestVersion !== 1) {
    throw new TownArchiveError("manifest.manifestVersion", `expected 1, got ${JSON.stringify(manifest.manifestVersion)}`);
  }
  if (typeof manifest.manifestHash !== "string" || manifest.manifestHash.length !== 64) {
    throw new TownArchiveError("manifest.manifestHash", "must be a 64-character sha256 hex string");
  }
  if (!Array.isArray(parsed.tasks)) throw new TownArchiveError("tasks", "must be an array");
  for (let index = 0; index < parsed.tasks.length; index += 1) {
    const task = parsed.tasks[index];
    if (!isRecord(task)) throw new TownArchiveError(`tasks[${index}]`, "must be an object");
    if (typeof task.taskId !== "string") throw new TownArchiveError(`tasks[${index}].taskId`, "must be a string");
    if (!Array.isArray(task.attempts)) throw new TownArchiveError(`tasks[${index}].attempts`, "must be an array");
    for (let a = 0; a < task.attempts.length; a += 1) {
      const attempt = task.attempts[a];
      if (!isRecord(attempt)) throw new TownArchiveError(`tasks[${index}].attempts[${a}]`, "must be an object");
      if (typeof attempt.rawAnswer !== "string") {
        throw new TownArchiveError(`tasks[${index}].attempts[${a}].rawAnswer`, "must be a string");
      }
    }
  }
  return parsed as unknown as TownRunRecord;
}

/** 반복 실행 요약 — 모집단 표준편차(표본 아님: 우리가 가진 것이 전수다). */
export function summarizeAttempts(
  scores: readonly number[],
  passThreshold: number,
): { mean: number | null; stdDev: number | null; passAtK: number } {
  if (scores.length === 0) return { mean: null, stdDev: null, passAtK: 0 };
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const variance = scores.reduce((sum, value) => sum + (value - average) ** 2, 0) / scores.length;
  return {
    mean: average,
    stdDev: Math.sqrt(variance),
    passAtK: scores.some((value) => value >= passThreshold) ? 1 : 0,
  };
}

/** 두 실행이 비교 가능한가 — 매니페스트 해시가 같을 때만. */
export function manifestsComparable(a: TownRunManifest, b: TownRunManifest): boolean {
  return a.manifestHash === b.manifestHash;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
