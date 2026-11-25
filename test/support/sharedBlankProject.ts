import { createBlankProject } from "@/project/defaults";
import { cloneProjectSharingStoreOwnedEntries, trustStoreOwnedEntries } from "@/project/projectClone";
import type { Project } from "@/project/types";

/**
 * `createBlankProject()` 와 값이 같은 새 프로젝트 — 번들 타일셋 정의(7,770만 자 중 95%)만 파일 안에서 한 번 만들어 객체째 공유한다.
 *
 * 왜(2026-11-24 실측, 조수 세션 시험 한 건): 케이스마다 `createBlankProject()` 로 정의 49개를 새로 만들면(약 3s) 세션이 그 사본을 뜨고
 * (`sessionProjectCopy`) 내용 요약·왕복 검사를 문서 전체에 다시 돌렸다 — 새 객체라 요약 기억이 하나도 맞지 않는다. 세션 생성 14s ·
 * 턴 30~40s 가 대부분 그 일이었다. 스토어 프로젝트는 이 항목을 «제자리에서 고치지 않는다» 는 계약으로 이미 공유한다
 * (projectClone.ts 머리말). 여기서는 그 계약을 시험 프로젝트에 같은 방식으로 건다: 첫 호출이 원본을 만들어 항목에 표지를 붙이고,
 * 이후 호출은 항목 밖의 가지(맵·DB·시스템…)만 새로 복제한다(42ms). 값·키 순서는 `structuredClone(createBlankProject())` 와 같다.
 *
 * 쓰는 시험은 반환된 프로젝트의 `tilesets[id]` 안쪽을 제자리에서 고치지 않는다(사전에 키를 더하고 빼는 것, 맵·DB 를 고치는 것은 된다).
 * 어기면 다음 케이스까지 번지므로 항목을 얼려 둔다(약 0.8s, 파일당 한 번) — 제자리 수정은 조용히 번지지 않고 TypeError 로 바로 드러난다.
 * 타일셋 정의를 직접 고치는 시험은 `createBlankProject()` 를 그대로 쓴다.
 */
let shared: Project | null = null;

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
}

export function createSharedTilesetBlankProject(): Project {
  if (!shared) {
    shared = createBlankProject();
    for (const tileset of Object.values(shared.tilesets)) deepFreeze(tileset);
    trustStoreOwnedEntries(shared);
  }
  return cloneProjectSharingStoreOwnedEntries(shared);
}
