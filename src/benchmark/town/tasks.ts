// benchmark/town/tasks.ts
// 태스크 스위트 — 11개 태스크가 9축 중 8축을 채운다(2번 재현성은 파생).
//
// 축 하나에 태스크가 둘인 경우(3·4·5번)는 "선행 프로브 + 실제 배치" 쌍이다.
// 프로브만 잘하고 배치를 못하는 모델과 그 반대를 구분하려면 둘을 따로 물어야
// 하고, 축 점수는 두 태스크의 평균이 된다(runner.ts).
//
// 순서는 감독의 문항 번호 순이다 — 리포트를 문항표와 나란히 읽을 수 있게.

import { digestOf } from "../interior/hash";
import {
  buildAframeRoofPrompt,
  buildAutotilePrompt,
  buildDoorPrompt,
  buildFencePrompt,
  buildHouseShellPrompt,
  buildLayerProbePrompt,
  buildPassabilityProbePrompt,
  buildRoadPrompt,
  buildTreePlacementPrompt,
  buildVillagePrompt,
  buildWallProbePrompt,
} from "./prompts";
import type { TownTaskDef } from "./types";

export const TOWN_TASKS: readonly TownTaskDef[] = Object.freeze([
  Object.freeze({
    id: "t1-autotile-path",
    titleKo: "오토타일 배치",
    kind: "grid" as const,
    input: "autotileShape" as const,
    prompt: buildAutotilePrompt,
    axis: "autotile" as const,
  }),
  Object.freeze({
    id: "t2-layer-probe",
    titleKo: "레이어 판정(프로브)",
    kind: "tileSet" as const,
    input: "layerProbe" as const,
    prompt: buildLayerProbePrompt,
    axis: "layer" as const,
    probe: "layer" as const,
  }),
  Object.freeze({
    id: "t3-tree-layers",
    titleKo: "나무 상·하위 분리",
    kind: "layered" as const,
    input: "treeGrid" as const,
    prompt: buildTreePlacementPrompt,
    axis: "layer" as const,
    placement: "treeGrid" as const,
  }),
  Object.freeze({
    id: "t4-passability-probe",
    titleKo: "통행 판정(프로브)",
    kind: "tileSet" as const,
    input: "passabilityProbe" as const,
    prompt: buildPassabilityProbePrompt,
    axis: "road" as const,
    probe: "passability" as const,
  }),
  Object.freeze({
    id: "t5-road-network",
    titleKo: "길 연결 시공",
    kind: "grid" as const,
    input: "roadGrid" as const,
    prompt: buildRoadPrompt,
    axis: "road" as const,
    placement: "roadGrid" as const,
  }),
  Object.freeze({
    id: "t6-wall-probe",
    titleKo: "벽면 판정(프로브)",
    kind: "tileSet" as const,
    input: "wallProbe" as const,
    prompt: buildWallProbePrompt,
    axis: "wallOutline" as const,
    probe: "wall" as const,
  }),
  Object.freeze({
    id: "t7-house-shell",
    titleKo: "벽 외곽 시공",
    kind: "layered" as const,
    input: "wallGrid" as const,
    prompt: buildHouseShellPrompt,
    axis: "wallOutline" as const,
    placement: "wallGrid" as const,
  }),
  Object.freeze({
    id: "t8-aframe-roof",
    titleKo: "지붕 대각 시공",
    kind: "layered" as const,
    input: "aframeGrid" as const,
    prompt: buildAframeRoofPrompt,
    axis: "roofDiagonal" as const,
    placement: "aframeGrid" as const,
  }),
  Object.freeze({
    id: "t9-door",
    titleKo: "문 설치",
    kind: "grid" as const,
    input: "doorGrid" as const,
    prompt: buildDoorPrompt,
    axis: "door" as const,
    placement: "doorGrid" as const,
  }),
  Object.freeze({
    id: "t10-fence-ends",
    titleKo: "울타리 끝 마감",
    kind: "grid" as const,
    input: "fenceGrid" as const,
    prompt: buildFencePrompt,
    axis: "fenceEnd" as const,
    placement: "fenceGrid" as const,
  }),
  Object.freeze({
    id: "t11-village",
    titleKo: "마을 구현",
    kind: "layered" as const,
    input: "villageGrid" as const,
    prompt: buildVillagePrompt,
    axis: "village" as const,
    placement: "villageGrid" as const,
  }),
]);

export function townTaskById(id: string): TownTaskDef {
  const task = TOWN_TASKS.find((candidate) => candidate.id === id);
  if (!task) {
    const known = TOWN_TASKS.map((candidate) => candidate.id).join(", ");
    throw new Error(`town benchmark: unknown task "${id}" (known: ${known})`);
  }
  return task;
}

/**
 * 스위트 정의 자체의 내용 해시. 태스크를 추가·삭제하거나 프롬프트 문구·팔레트가
 * 바뀌면 값이 바뀌고, manifest 해시가 따라 바뀌어 옛 점수와의 비교가 차단된다.
 */
export function townTaskSuiteDigest(tasks: readonly TownTaskDef[] = TOWN_TASKS): string {
  return digestOf(
    tasks.map((task) => ({
      id: task.id,
      kind: task.kind,
      axis: task.axis,
      input: task.input,
      probe: task.probe ?? null,
      placement: task.placement ?? null,
      prompt: task.prompt(),
    })),
  );
}
