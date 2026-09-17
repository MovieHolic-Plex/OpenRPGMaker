// 2026-09-17: 「independent review image budget」 세션 테스트 2건 삭제 — reviewCurrentDraft 가 검수 모델을
// 호출하지 않으므로(결정적 lint 검사만) 검수 이미지 봉투·과대 봉투 회복은 검증할 대상이 없다.
import { describe, expect, it } from "vitest";
import { reviewEvidenceImages } from "@/ai/independentReview";

const image = (dataUrl: string, label = "render") => ({ label, dataUrl });

describe("reviewEvidenceImages", () => {
  it("ships one copy of a render captured twice", () => {
    const twice = [
      { mapId: "a", images: [image("data:image/png;base64,SAME")] },
      { mapId: "a", images: [image("data:image/png;base64,SAME")] },
    ];
    expect(reviewEvidenceImages(twice, new Set(["a"]))).toHaveLength(1);
  });

  it("keeps distinct renders of the same map", () => {
    const entries = [
      { mapId: "a", images: [image("data:image/png;base64,LEFT")] },
      { mapId: "a", images: [image("data:image/png;base64,RIGHT")] },
    ];
    expect(reviewEvidenceImages(entries, new Set(["a"]))).toHaveLength(2);
  });

  // The narrowing retry drops a map's before/after context; carrying its render anyway
  // costs the whole envelope without giving the reviewer anything to judge it against.
  it("drops renders of maps outside the reviewed set", () => {
    const entries = [
      { mapId: "changed", images: [image("data:image/png;base64,CHANGED")] },
      { mapId: "context", images: [image("data:image/png;base64,CONTEXT")] },
    ];
    const kept = reviewEvidenceImages(entries, new Set(["changed"]));
    expect(kept.map(({ dataUrl }) => dataUrl)).toEqual(["data:image/png;base64,CHANGED"]);
  });
});
