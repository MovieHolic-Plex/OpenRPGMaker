// spatialFeedback.ts — 맵 그룹 공통 피드백: 내부 오류 토큰의 사용자 문구화,
// 선택·탭 전환 시 stale 오류 정리, 빈 갤러리 카피, 통일된 출처 라벨.
//
// chrome 상태 모듈들(object/place/space/geography)은 서로를 모르고, shell 도
// 도메인 chrome 을 모른 채 조립한다. 그래서 "선택이 바뀌면 지난 오류를 지운다" 같은
// 교차 규칙을 둘 곳이 없었다 — 이 모듈이 그 자리다.

import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringMode, SpatialShellTab } from "@/editor/panels/spatialAuthoringSession";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { objectChromeState } from "@/editor/panels/spatialObjectChromeState";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";

/** 내부 토큰 → 사용자 문구. 모르는 문자열은 그대로 통과시킨다(이미 문장인 경우가 많다). */
const ERROR_TEXT: Readonly<Record<string, string>> = {
  "authoring-draft-missing": "편집 중인 초안이 없습니다 — 추가·수정을 먼저 하세요",
  "authoring-preview-missing": "적용할 미리보기가 없습니다 — 미리보기를 먼저 실행하세요",
  "authoring-controller-unavailable": "이 환경에서는 장소 편집을 사용할 수 없습니다",
  "authoring-session-lineage": "이전 편집과 이어지지 않습니다 — 다시 시도하세요",
  "build-proposal-pending": "적용되지 않은 시공 미리보기가 있습니다 — 먼저 적용하세요",
  "build-seed-integer-required": "시드는 정수여야 합니다",
  "build-map-selection-entry-required": "시공할 맵·영역·진입점을 먼저 채우세요",
  "manual-build-kind-unsupported": "이 대상은 이 시공 방식을 지원하지 않습니다",
  "Draft belongs to another controller": "다른 편집기에서 만든 초안입니다",
  "Preview belongs to another controller": "다른 편집기에서 만든 미리보기입니다",
  "Preview has already been accepted": "이미 적용된 미리보기입니다",
  "Project changed since draft creation": "초안을 만든 뒤 프로젝트가 바뀌었습니다 — 다시 편집하세요",
  "Project changed since preview": "미리보기를 만든 뒤 프로젝트가 바뀌었습니다 — 미리보기를 다시 실행하세요",
  "spatialAuthoring가 객체가 아닙니다": "이 프로젝트에는 장소 설계 문서가 없습니다",
  clipped: "지형 범위를 벗어났습니다",
  diagonal: "대각선 경로는 지원하지 않습니다",
  endpoint: "경로의 끝점이 올바르지 않습니다",
  "unknown-child": "없는 자식을 가리킵니다",
  material: "지형 재질이 올바르지 않습니다",
  level: "층 값이 올바르지 않습니다",
  port: "포트가 올바르지 않습니다",
  missing: "원본을 찾을 수 없습니다",
  raster: "그림을 그릴 수 없습니다",
  kind: "대상 종류가 맞지 않습니다",
};

/**
 * previewError 상태값이나 컨트롤러 오류를 화면 문구로 바꾼다.
 * `code:path` 형태(컴파일·배치 이슈)는 코드 부분만 번역하고 경로는 보존한다.
 */
export function humanizeSpatialError(text: string | null): string | null {
  if (!text) return null;
  const exact = ERROR_TEXT[text];
  if (exact) return exact;
  const colon = text.indexOf(":");
  if (colon > 0) {
    const head = ERROR_TEXT[text.slice(0, colon)];
    if (head) return `${head} (${text.slice(colon + 1)})`;
  }
  return text;
}

/** 인스펙터·카드 공통 출처 라벨 — 칩(모두/기본 설계/내 설계)과 같은 말을 쓴다. */
export function spatialSourceLabel(card: SpatialGalleryCard): string {
  if (card.mapUsage) return "맵 사용";
  if (card.compatibility === "room-rule") return "호환 방 규칙";
  if (card.compatibility === "house-shape") return "건물 외형 · 호환 도안";
  switch (card.source) {
    case "default": return card.kind === "objects" ? "공용 오브젝트" : "기본 설계";
    case "own": return card.kind === "objects" ? "내 오브젝트" : "내 설계";
    case "placed": return "배치된 곳";
    default: {
      const exhaustive: never = card.source;
      return exhaustive;
    }
  }
}

/** 카드가 같은 이름의 부제를 들고 있을 때만 쓴다 — 이중 출력 방지. */
export function cardSubtitle(card: SpatialGalleryCard): string | undefined {
  return card.subtitle && card.subtitle !== card.name ? card.subtitle : undefined;
}

export function spatialGalleryEmptyCopy(mode: SpatialAuthoringMode, tab: SpatialShellTab): { title: string; body: string } {
  if (mode === "instances") {
    return {
      title: "배치된 곳이 없습니다",
      body: "설계를 「시공」으로 실제 맵에 배치하면 여기에 나타납니다.",
    };
  }
  const thing = tab === "tiles" ? "타일셋" : tab === "objects" ? "오브젝트" : tab === "spaces" ? "장소"
    : tab === "places" ? "장소" : tab === "regions" ? "지역" : "세계";
  if (tab === "regions") {
    return {
      title: "조건에 맞는 지역이 없습니다",
      body: "참고 사례는 「기본 설계」에 있습니다. 「추가」로 빈 지역을 만들거나, 마을 설계서로 정주지 지역을 만드세요.",
    };
  }
  return {
    title: `내 ${thing} 설계가 없습니다`,
    body: "「추가」로 새로 만들거나, 기본 설계를 복제해 시작하세요.",
  };
}

let lastFeedbackKey = "";

/**
 * 탭·모드·선택이 바뀌면 지난 화면의 오류 배너와 삭제 확인을 걷어낸다.
 * 렌더마다 호출해도 된다 — 키가 같으면 아무것도 안 한다.
 */
export function syncSpatialFeedbackSelection(key: string): void {
  if (key === lastFeedbackKey) return;
  lastFeedbackKey = key;
  for (const state of [objectChromeState, placeChromeState, spaceChromeState, geographyChromeState]) {
    state.previewError = null;
    state.deleteOpen = false;
  }
}

/** Escape 첫 단계: 떠 있는 오류 문구만 지운다. 지운 게 있으면 true. */
export function dismissSpatialFeedback(): boolean {
  let cleared = false;
  for (const state of [objectChromeState, placeChromeState, spaceChromeState, geographyChromeState]) {
    if (state.previewError !== null || state.deleteOpen) cleared = true;
    state.previewError = null;
    state.deleteOpen = false;
  }
  return cleared;
}

/** 테스트용 — 다음 선택 키가 같아도 다시 지우게 한다. */
export function resetSpatialFeedbackForTest(): void {
  lastFeedbackKey = "";
}
