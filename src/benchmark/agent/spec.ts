// benchmark/agent/spec.ts
// 지시서와 제출 계약.
//
// 지시는 **생짜**다 — 크기도, 집 수도, 어떤 도구를 쓸지도 말하지 않는다. 저장소에
// build_village·stampRectHouseKit·오토타일 엔진이 있다는 사실도 알려주지 않는다.
// 그것을 찾아내는 것까지가 실력이기 때문이다.
//
// 유일하게 지정하는 것은 **제출 경로와 형식**이다. 시험지를 어디에 내라는 말은
// 풀이 방법을 알려주는 것이 아니다. 이것마저 없으면 산출물을 찾을 수 없어 채점이
// 성립하지 않는다.

import { EMPTY_CELL, TOWN_TILE_COUNT } from "@/benchmark/town/types";
import type { MapSubmission } from "./detect";

export const SUBMISSION_PATH = "output/agent-bench/submission.json";

/** 지시서 버전 — 문구를 바꾸면 올린다(옛 결과와 섞이지 않게). */
export const AGENT_SPEC_VERSION = 1;

export function buildAgentInstruction(): string {
  return [
    "이 저장소의 기본 타일셋(EasyRPG RTP Combined Town ChipSet)으로 마을 맵 하나를 만들어라.",
    "크기·구성·방법은 전부 네가 판단한다.",
    "",
    `완성된 맵을 ${SUBMISSION_PATH} 에 아래 형식으로 저장해라:`,
    '{"width": 정수, "height": 정수, "lowerTiles": [정수...], "upperTiles": [정수...]}',
    "lowerTiles·upperTiles 는 행 우선(row-major) 배열이고 길이는 width*height 여야 한다.",
    "빈 칸은 -1 이다. 이 파일 하나가 제출물이다.",
  ].join("\n");
}

export type SubmissionParse =
  | { readonly ok: true; readonly map: MapSubmission }
  | { readonly ok: false; readonly reason: string };

/**
 * 제출물 파서 — fail-closed. 관대하게 고쳐 읽지 않는다.
 * 다만 {lower,upper} 2차원 배열로 낸 것도 받아 준다(형식을 두 번 말하지 않았으므로
 * 흔한 오해이고, 좌표계가 같아 채점에 영향이 없다).
 */
export function parseSubmission(text: string): SubmissionParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: `JSON 파싱 실패: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "최상위 값이 JSON 객체가 아니다" };
  }
  const record = parsed as Record<string, unknown>;

  const flatten = (value: unknown): number[] | null => {
    if (!Array.isArray(value)) return null;
    if (value.length > 0 && Array.isArray(value[0])) {
      const out: number[] = [];
      for (const row of value) {
        if (!Array.isArray(row)) return null;
        for (const cell of row) out.push(typeof cell === "number" ? cell : Number.NaN);
      }
      return out;
    }
    return value.map((cell) => (typeof cell === "number" ? cell : Number.NaN));
  };

  const lower = flatten(record.lowerTiles ?? record.lower);
  const upper = flatten(record.upperTiles ?? record.upper);
  if (!lower) return { ok: false, reason: "lowerTiles 가 없거나 배열이 아니다" };
  if (!upper) return { ok: false, reason: "upperTiles 가 없거나 배열이 아니다" };

  // 크기는 명시값을 쓰고, 없으면 2차원 배열 형태에서 유추한다.
  let width = typeof record.width === "number" ? record.width : 0;
  let height = typeof record.height === "number" ? record.height : 0;
  const nested = Array.isArray(record.lowerTiles ?? record.lower) && Array.isArray((record.lowerTiles ?? record.lower) as unknown[])
    ? ((record.lowerTiles ?? record.lower) as unknown[])
    : [];
  if ((!width || !height) && nested.length > 0 && Array.isArray(nested[0])) {
    height = nested.length;
    width = (nested[0] as unknown[]).length;
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { ok: false, reason: `width/height 가 양의 정수가 아니다 (${width}x${height})` };
  }
  if (lower.length !== width * height) {
    return { ok: false, reason: `lowerTiles 길이 ${lower.length} ≠ width*height ${width * height}` };
  }
  if (upper.length !== width * height) {
    return { ok: false, reason: `upperTiles 길이 ${upper.length} ≠ width*height ${width * height}` };
  }
  for (const [name, layer] of [["lowerTiles", lower], ["upperTiles", upper]] as const) {
    for (let index = 0; index < layer.length; index += 1) {
      const tile = layer[index]!;
      if (!Number.isInteger(tile)) return { ok: false, reason: `${name}[${index}] 가 정수가 아니다` };
      if (tile !== EMPTY_CELL && (tile < 0 || tile >= TOWN_TILE_COUNT)) {
        return { ok: false, reason: `${name}[${index}] = ${tile} — 허용 범위는 -1 또는 0..${TOWN_TILE_COUNT - 1}` };
      }
    }
  }
  return { ok: true, map: { width, height, lower, upper } };
}
