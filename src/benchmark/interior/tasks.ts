// benchmark/interior/tasks.ts
// 실내 벤치마크 태스크 스위트 — 프롬프트 · 정답 카테고리 · 채점 스킴 배선.
//
// tileSet 태스크는 아틀라스 1장을 보고 "어떤 타일이 X인가"에 답한다.
// placement 태스크는 마킹된 그리드를 보고 실제로 짓는다.
// 스킴 배정은 답변 형상에 따라 고정이다 — 태스크마다 다르게 주면 태스크 간
// 점수가 비교 불가능해진다.

import { digestOf } from "./hash";
import {
  buildCarpetPrompt,
  buildCeilingPrompt,
  buildDistractorPrompt,
  buildFloorPrompt,
  buildFurnitureSolidPrompt,
  buildHousePrompt,
  buildHouseShellWallPrompt,
  buildPropUpperPrompt,
  buildRoomPairPrompt,
  buildWallAnyPrompt,
  buildWaterPrompt,
  buildWindowPrompt,
} from "./prompts";
import type { InteriorTaskDef, ScoringSchemeId } from "./types";

const SET_SCHEMES: readonly ScoringSchemeId[] = Object.freeze([
  "setF1",
  "semantic",
  "trapPenalty",
  "rolePurity",
]);

/**
 * 역할이 아니라 **레이어**로 정의된 카테고리에는 rolePurity 를 쓰지 않는다.
 * propUpper 정답 139칸은 decoration·furniture 등 여러 역할에 걸친 집합이라
 * 다수 역할 보유단이 절반뿐이다 — 실제로 완벽한 답이 rolePurity 0.49 로
 * 긎이는 것을 스텅 스모크에서 확인했다. 상한을 받지 모하는 지표는 지표가 아니다.
 */
const LAYER_SET_SCHEMES: readonly ScoringSchemeId[] = Object.freeze([
  "setF1",
  "semantic",
  "trapPenalty",
]);

const PLACEMENT_SCHEMES: readonly ScoringSchemeId[] = Object.freeze(["gridIdentity", "structural"]);

export const INTERIOR_TASKS: readonly InteriorTaskDef[] = Object.freeze([
  Object.freeze({
    id: "t1-wall-any",
    titleKo: "벽 인식(일반)",
    kind: "tileSet" as const,
    category: "wallAny" as const,
    input: "atlas" as const,
    prompt: buildWallAnyPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t2-wall-house-shell",
    titleKo: "벽 인식(정본 주택 셸)",
    kind: "tileSet" as const,
    category: "houseShellWall" as const,
    input: "atlas" as const,
    prompt: buildHouseShellWallPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t3-floor",
    titleKo: "실내 바닥",
    kind: "tileSet" as const,
    category: "floor" as const,
    input: "atlas" as const,
    prompt: buildFloorPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t4-ceiling",
    titleKo: "천장",
    kind: "tileSet" as const,
    category: "ceiling" as const,
    input: "atlas" as const,
    prompt: buildCeilingPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t5-window",
    titleKo: "창문",
    kind: "tileSet" as const,
    category: "window" as const,
    input: "atlas" as const,
    prompt: buildWindowPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t6-furniture-solid",
    titleKo: "통행 막는 가구",
    kind: "tileSet" as const,
    category: "furnitureSolid" as const,
    input: "atlas" as const,
    prompt: buildFurnitureSolidPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t7-prop-upper",
    titleKo: "상위 레이어 소품",
    kind: "tileSet" as const,
    category: "propUpper" as const,
    input: "atlas" as const,
    prompt: buildPropUpperPrompt,
    schemes: LAYER_SET_SCHEMES,
  }),
  Object.freeze({
    id: "t8-carpet",
    titleKo: "카펫",
    kind: "tileSet" as const,
    category: "carpet" as const,
    input: "atlas" as const,
    prompt: buildCarpetPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t9-water",
    titleKo: "물",
    kind: "tileSet" as const,
    category: "water" as const,
    input: "atlas" as const,
    prompt: buildWaterPrompt,
    schemes: SET_SCHEMES,
  }),
  Object.freeze({
    id: "t10-outdoor-distractor",
    titleKo: "실외 지형 분별",
    kind: "tileSet" as const,
    category: "distractor" as const,
    input: "atlas" as const,
    prompt: buildDistractorPrompt,
    schemes: LAYER_SET_SCHEMES,
  }),
  Object.freeze({
    id: "t11-build-house",
    titleKo: "집 짓기",
    kind: "placement" as const,
    input: "houseGrid" as const,
    prompt: buildHousePrompt,
    schemes: PLACEMENT_SCHEMES,
  }),
  Object.freeze({
    id: "t12-build-two-rooms",
    titleKo: "두 방 짓기",
    kind: "placement" as const,
    input: "roomGrid" as const,
    prompt: buildRoomPairPrompt,
    schemes: PLACEMENT_SCHEMES,
  }),
]);

export function interiorTaskById(id: string): InteriorTaskDef {
  const task = INTERIOR_TASKS.find((candidate) => candidate.id === id);
  if (!task) {
    const known = INTERIOR_TASKS.map((candidate) => candidate.id).join(", ");
    throw new Error(`interior benchmark: unknown task "${id}" (known: ${known})`);
  }
  return task;
}

/**
 * 스위트 정의 자체의 내용 해시. 태스크를 추가·삭제하거나 프롬프트 문구·스킴
 * 배정을 바꾸면 값이 바뀌고, manifest 해시가 따라 바뀌어 옛 점수와의 비교가
 * 차단된다. 태스크 정의를 인자로 받아 테스트가 변형본의 해시도 계산할 수 있다.
 */
export function interiorTaskSuiteDigest(tasks: readonly InteriorTaskDef[] = INTERIOR_TASKS): string {
  return digestOf(
    tasks.map((task) => ({
      id: task.id,
      kind: task.kind,
      category: task.category ?? null,
      input: task.input,
      prompt: task.prompt(),
      schemes: [...task.schemes],
    })),
  );
}
