// spatialFeedback — 맵 그룹 공통 피드백 규칙의 계약 고정:
// 내부 토큰을 사용자 문구로 번역하고, 선택 전환 시 stale 오류를 지운다.
import { afterEach, describe, expect, it } from "vitest";
import {
  cardSubtitle,
  dismissSpatialFeedback,
  humanizeSpatialError,
  resetSpatialFeedbackForTest,
  spatialGalleryEmptyCopy,
  spatialSourceLabel,
  syncSpatialFeedbackSelection,
} from "@/editor/panels/spatialFeedback";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";

const card = (over: Partial<SpatialGalleryCard>): SpatialGalleryCard => ({
  id: "c1",
  name: "호수 지방",
  source: "default",
  kind: "regions",
  usage: 0,
  ...over,
});

afterEach(() => {
  geographyChromeState.previewError = null;
  geographyChromeState.deleteOpen = false;
  spaceChromeState.previewError = null;
  spaceChromeState.deleteOpen = false;
  resetSpatialFeedbackForTest();
});

describe("humanizeSpatialError", () => {
  it("translates the internal draft/preview tokens that leaked into the toolbar", () => {
    expect(humanizeSpatialError("authoring-draft-missing")).toBe("편집 중인 초안이 없습니다 — 추가·수정을 먼저 하세요");
    expect(humanizeSpatialError("authoring-preview-missing")).toBe("적용할 미리보기가 없습니다 — 미리보기를 먼저 실행하세요");
    expect(humanizeSpatialError("spatialAuthoring가 객체가 아닙니다")).toBe("이 프로젝트에는 장소 설계 문서가 없습니다");
  });

  it("keeps the path of a code:path issue while translating the code", () => {
    expect(humanizeSpatialError("missing:region/lake")).toBe("원본을 찾을 수 없습니다 (region/lake)");
  });

  it("passes through sentences and null", () => {
    expect(humanizeSpatialError("시드는 정수여야 합니다")).toBe("시드는 정수여야 합니다");
    expect(humanizeSpatialError(null)).toBeNull();
  });
});

describe("cardSubtitle", () => {
  it("suppresses a subtitle identical to the card name", () => {
    expect(cardSubtitle(card({ subtitle: "호수 지방" }))).toBeUndefined();
    expect(cardSubtitle(card({ subtitle: "장소 3곳" }))).toBe("장소 3곳");
    expect(cardSubtitle(card({}))).toBeUndefined();
  });
});

describe("spatialSourceLabel", () => {
  it("uses the same words as the source chips", () => {
    expect(spatialSourceLabel(card({}))).toBe("기본 설계");
    expect(spatialSourceLabel(card({ source: "own" }))).toBe("내 설계");
    expect(spatialSourceLabel(card({ source: "placed" }))).toBe("배치된 곳");
    expect(spatialSourceLabel(card({ source: "placed", mapUsage: true }))).toBe("맵 사용");
  });
});

describe("spatialGalleryEmptyCopy", () => {
  it("gives instances mode a placement hint and design mode a creation hint", () => {
    expect(spatialGalleryEmptyCopy("instances", "spaces").title).toBe("배치된 곳이 없습니다");
    expect(spatialGalleryEmptyCopy("design", "regions").title).toBe("내 지역 설계가 없습니다");
    expect(spatialGalleryEmptyCopy("design", "regions").body).toContain("추가");
  });
});

describe("syncSpatialFeedbackSelection", () => {
  it("clears preview errors and delete confirmations when the selection key changes", () => {
    geographyChromeState.previewError = "authoring-draft-missing";
    geographyChromeState.deleteOpen = true;
    spaceChromeState.previewError = "blocked";
    syncSpatialFeedbackSelection("regions:design:r1");
    expect(geographyChromeState.previewError).toBeNull();
    expect(geographyChromeState.deleteOpen).toBe(false);
    expect(spaceChromeState.previewError).toBeNull();
  });

  it("does not clear again while the key is unchanged", () => {
    syncSpatialFeedbackSelection("spaces:design:s1");
    spaceChromeState.previewError = "authoring-preview-missing";
    syncSpatialFeedbackSelection("spaces:design:s1");
    expect(spaceChromeState.previewError).toBe("authoring-preview-missing");
  });
});

describe("dismissSpatialFeedback", () => {
  it("clears transient error state and reports whether anything was cleared", () => {
    expect(dismissSpatialFeedback()).toBe(false);
    geographyChromeState.previewError = "clipped";
    expect(dismissSpatialFeedback()).toBe(true);
    expect(geographyChromeState.previewError).toBeNull();
    expect(dismissSpatialFeedback()).toBe(false);
  });
});
