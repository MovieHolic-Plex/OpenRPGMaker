// upsert_resource 의 faceset 업로드 판정 규칙(순수 함수) 단위 테스트.
// 규칙(문서화):
//   · 한 얼굴 = 48×48 → 허용.
//   · 48 배수 정사각 시트(192×192 16칸, 96×96 4칸)도 허용한다 — 등록 지점이
//     planFacesetSheetSplit 으로 낱장으로 쪼개므로 거부할 이유가 없다.
//   · 비정사각·비배수 이미지는 저자가 만든 낱장 아트로 보고 그대로 허용.
//   · 0 이하 변 길이는 유효하지 않은 이미지로 거부.
import { describe, expect, it } from "vitest";
import { decideFacesetUploadDimensions } from "@/editor/tools/resourceTools";

describe("decideFacesetUploadDimensions", () => {
  it("48×48 단일 얼굴은 허용한다", () => {
    expect(decideFacesetUploadDimensions(48, 48)).toEqual({ accept: true });
  });

  it("192×192 16칸 시트는 허용한다 — 등록 지점이 낱장으로 쪼갠다", () => {
    expect(decideFacesetUploadDimensions(192, 192)).toEqual({ accept: true });
  });

  it("96×96 4칸 시트도 허용한다", () => {
    expect(decideFacesetUploadDimensions(96, 96)).toEqual({ accept: true });
  });

  it("48×96 비정사각형은 낱장 아트로 허용한다", () => {
    expect(decideFacesetUploadDimensions(48, 96)).toEqual({ accept: true });
  });

  it("그 외 일반 크기 낱장(예: 256×200)은 허용한다", () => {
    expect(decideFacesetUploadDimensions(256, 200)).toEqual({ accept: true });
  });

  it("0 이하 변 길이는 유효하지 않은 이미지로 거부한다", () => {
    expect(decideFacesetUploadDimensions(0, 48).accept).toBe(false);
    expect(decideFacesetUploadDimensions(48, -1).accept).toBe(false);
  });

  it("터미널 스크립트를 시키는 안내는 더 이상 없다", () => {
    const results = [
      decideFacesetUploadDimensions(192, 192),
      decideFacesetUploadDimensions(0, 48),
    ];
    for (const result of results) {
      if (!result.accept) expect(result.reason).not.toContain("assets:slice-faces");
    }
  });
});
