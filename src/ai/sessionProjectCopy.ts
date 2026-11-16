// 조수 세션이 쥐는 프로젝트 사본(기준·초안·검수 기준·적용 대기)과 «글자까지 같은가» 비교용 글.
//
// 왜(2026-11-16 실측, bun · 빈 새 프로젝트 7,090만 자 중 번들 타일셋 정의 49개 6,750만 자 = 95.2%):
// 세션은 사본을 `structuredClone(project)` 로 뜨고 정체를 `JSON.stringify(project)` 로 비교했다. 제목 한 줄을 바꾸는 턴 하나
// (취소된 턴 뒤의 턴)에 통째 복제 21번 · 20.5s, 통째 직렬화 15번 · 10.0s, 그리고 복제본의 타일셋이 늘 새 객체라 내용 요약 기억·
// 왕복 검사 기억이 맞지 않아 문서 전체 요약 16번 · 33.6s, 되읽기 5번 · 2.8s — 합쳐 77s 가운데 67s 였다.
// 스토어는 타일셋·업로드 자산 항목을 객체째 공유한다(projectClone 머리말: 그 항목은 제자리에서 고치지 않는다). 세션 경계에서만
// 그 공유가 끊겨, 적용된 초안이 스토어로 돌아가면 스토어의 타일셋까지 모두 새 객체가 됐다.
//
// 여기서는 스토어가 들고 있는 항목만 객체째 공유한다. 스토어 밖 프로젝트(영역 작업의 작업본·평가·시험 픽스처)는 그 계약이 없으므로
// 예전처럼 통째로 복제하고 통째로 직렬화한다. 결과 값은 어느 쪽이든 같다: 사본의 JSON 값·키 순서는 `structuredClone` 과,
// 글은 `JSON.stringify` 와 글자까지 같다(test/sessionProjectCopy.test.ts).
import { transferDetachedDraftMemory } from "@/editor/detachedDraftMemory";
import { projectJsonChunks, sameJsonChunks } from "@/project/io/sharedDictionaryJson";
import { cloneProjectSharingStoreOwnedEntries, trustStoreOwnedEntries } from "@/project/projectClone";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

function storeOwnsSettledEntriesOf(project: Project): boolean {
  // 스토어를 부분 흉내로 갈아 끼운 시험에는 이 메서드가 없다 — 그때는 공유하지 않는다(예전 동작).
  return typeof store.ownsSettledEntriesOf === "function" && store.ownsSettledEntriesOf(project);
}

/** `structuredClone(project)` 와 값이 같은 세션 사본. 스토어가 들고 있는 타일셋·업로드 자산 항목은 객체째 공유한다. */
export function sessionProjectCopy(project: Project): Project {
  if (storeOwnsSettledEntriesOf(project)) trustStoreOwnedEntries(project);
  return cloneProjectSharingStoreOwnedEntries(project);
}

/** `cloneDetachedDraft(project)` 와 값이 같은 세션 초안 사본(편집기 전용 기억도 함께 옮긴다). */
export function sessionDraftCopy(project: Project): Project {
  const clone = sessionProjectCopy(project);
  transferDetachedDraftMemory(project, clone);
  return clone;
}

/**
 * `JSON.stringify(project)` 끼리의 `===` 를 대신하는 정체. 글을 한 덩어리로 만들지 않고 조각으로 쥔다(projectJsonChunks).
 * 세션 안에서 같은지 비교하는 데만 쓴다 — 비교는 반드시 `sameSessionProjectJson` 으로 한다(객체끼리 `===` 는 정체 비교가 아니다).
 */
export class SessionProjectJson {
  private readonly chunks: readonly string[];
  constructor(project: Project) {
    this.chunks = projectJsonChunks(project);
  }
  /** `JSON.stringify(이 프로젝트) === JSON.stringify(저 프로젝트)` 와 같은 판정. */
  equals(other: SessionProjectJson): boolean {
    return sameJsonChunks(this.chunks, other.chunks);
  }
  /** `JSON.stringify(project)` 와 글자까지 같은 글(시험·진단용 — 턴 경로에서는 만들지 않는다). */
  text(): string {
    return this.chunks.join("");
  }
}

/** `JSON.stringify(project)` 와 같은 내용을 가리키는 정체. */
export function sessionProjectJson(project: Project): SessionProjectJson {
  return new SessionProjectJson(project);
}

/** 예전의 `a === b`(둘 다 `JSON.stringify(project)` 글이거나 null) 와 같은 판정. null 은 null 과만 같다. */
export function sameSessionProjectJson(a: SessionProjectJson | null, b: SessionProjectJson | null): boolean {
  return a === null || b === null ? a === b : a.equals(b);
}
