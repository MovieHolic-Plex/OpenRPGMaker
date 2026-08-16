// benchmark/tasks.ts
// 벤치마크 7개 차원(d1..d7) 태스크 정의(todo 3).
//
// 참조 규약:
//  - input    : 입력 이미지 렌더러 참조(문자열 키) — todo 4 inputImages.ts가 해석
//               (이 모듈은 todo-4 코드를 import하지 않는다).
//  - prompt   : prompts.ts의 고정 프롬프트 빌더 함수 참조.
//  - groundTruth : groundTruth.ts(또는 todo 7 fixtures) 참조(문자열 키).
//  - scorer   : scoring*.ts 참조(문자열 키) — todo 6-8에서 구현.
// 번들 구조: d1 = wall/floor 두 detection 서브런, d6 = autotileGrid + autotileCount
// 서브런. d1/d6의 태스크 레벨 prompt/kind는 대표값이고, 실제 실행은 서브런 단위다.
import type { BenchmarkTaskKind } from "./contract";
import {
  buildD1FloorPrompt,
  buildD1Prompt,
  buildD1WallPrompt,
  buildD2RoofPrompt,
  buildD3HousePrompt,
  buildD4WindowPrompt,
  buildD5TreePrompt,
  buildD6aAutotileGridPrompt,
  buildD6bAutotileCountPrompt,
  buildD7FencePrompt,
} from "./prompts";

/** 단일 실행 단위(한 번의 모델 호출 + 하나의 출력 형상 + 하나의 스코어러). */
export interface BenchmarkSubRunDef {
  readonly id: string;
  readonly titleKo: string;
  readonly kind: BenchmarkTaskKind;
  readonly input: string;
  readonly prompt: () => string;
  readonly groundTruth: string;
  readonly scorer: string;
}

/** 7개 벤치마크 차원 중 하나. d1/d6은 subRuns로 세부 실행을 번들한다. */
export interface BenchmarkTaskDef {
  readonly id: string;
  readonly titleKo: string;
  readonly kind: BenchmarkTaskKind;
  readonly input: string;
  readonly prompt: () => string;
  readonly groundTruth: string;
  readonly scorer: string;
  readonly subRuns?: readonly BenchmarkSubRunDef[];
}

export const BENCHMARK_TASKS: readonly BenchmarkTaskDef[] = Object.freeze([
  Object.freeze({
    id: "d1",
    titleKo: "벽/바닥 감지",
    kind: "detection" as BenchmarkTaskKind,
    input: "atlas",
    prompt: buildD1Prompt,
    groundTruth: "WALL_TILES+FLOOR_TILES",
    scorer: "scoreDetection",
    subRuns: Object.freeze([
      Object.freeze({
        id: "wall",
        titleKo: "벽",
        kind: "detection" as BenchmarkTaskKind,
        input: "atlas",
        prompt: buildD1WallPrompt,
        groundTruth: "WALL_TILES",
        scorer: "scoreDetection",
      }),
      Object.freeze({
        id: "floor",
        titleKo: "바닥",
        kind: "detection" as BenchmarkTaskKind,
        input: "atlas",
        prompt: buildD1FloorPrompt,
        groundTruth: "FLOOR_TILES",
        scorer: "scoreDetection",
      }),
    ]),
  }),
  Object.freeze({
    id: "d2",
    titleKo: "지붕 감지",
    kind: "detection" as BenchmarkTaskKind,
    input: "atlas",
    prompt: buildD2RoofPrompt,
    groundTruth: "ROOF_TILES",
    scorer: "scoreDetection",
  }),
  Object.freeze({
    id: "d3",
    titleKo: "지붕+벽 조합",
    kind: "construction" as BenchmarkTaskKind,
    input: "houseGrid",
    prompt: buildD3HousePrompt,
    groundTruth: "construction:house",
    scorer: "scoreConstruction",
  }),
  Object.freeze({
    id: "d4",
    titleKo: "창문 찾기",
    kind: "detection" as BenchmarkTaskKind,
    input: "atlas",
    prompt: buildD4WindowPrompt,
    groundTruth: "WINDOW_TILES",
    scorer: "scoreDetection",
  }),
  Object.freeze({
    id: "d5",
    titleKo: "나무 하위+상위 레이어 조합",
    kind: "construction" as BenchmarkTaskKind,
    input: "treeGrid",
    prompt: buildD5TreePrompt,
    groundTruth: "construction:trees",
    scorer: "scoreConstruction",
  }),
  Object.freeze({
    id: "d6",
    titleKo: "오토타일 구현 + 종류 세기",
    kind: "autotileGrid" as BenchmarkTaskKind,
    input: "autotileShape",
    prompt: buildD6aAutotileGridPrompt,
    groundTruth: "autotile:dirtRoad",
    scorer: "scoreAutotileGrid",
    subRuns: Object.freeze([
      Object.freeze({
        id: "autotileGrid",
        titleKo: "오토타일 구현",
        kind: "autotileGrid" as BenchmarkTaskKind,
        input: "autotileShape",
        prompt: buildD6aAutotileGridPrompt,
        groundTruth: "autotile:dirtRoad",
        scorer: "scoreAutotileGrid",
      }),
      Object.freeze({
        id: "autotileCount",
        titleKo: "종류 세기",
        kind: "autotileCount" as BenchmarkTaskKind,
        input: "atlas",
        prompt: buildD6bAutotileCountPrompt,
        groundTruth: "AUTOTILE_GROUP_ANSWER",
        scorer: "scoreAutotileCount",
      }),
    ]),
  }),
  Object.freeze({
    id: "d7",
    titleKo: "울타리 정확한 구현",
    kind: "construction" as BenchmarkTaskKind,
    input: "fenceGrid",
    prompt: buildD7FencePrompt,
    groundTruth: "construction:fence",
    scorer: "scoreConstruction",
  }),
]);
