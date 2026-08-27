// upsert_resource 의 faceset 업로드 판정 규칙(순수 함수) 단위 테스트.
// 규칙(문서화):
//   · 한 얼굴 = 정확히 48×48 → 허용.
//   · 한 변이 48의 배수인 정사각형이면서 48×48보다 크면 시트로 판단해 거부.
//     (레거시 192×192 16칸 시트, 96×96 4칸 시트가 모두 여기 걸린다.)
//   · 비정사각·비배수 이미지는 저자가 만든 낱장 아트로 보고 그대로 허용
//     (48×96 도 낱장으로 허용).
//   · 0 이하 변 길이는 유효하지 않은 이미지로 거부.
import { describe, expect, it } from "vitest";
import { decideFacesetUploadDimensions } from "@/editor/tools/resourceTools";

describe("decideFacesetUploadDimensions", () => {
  it("48×48 단일 얼굴은 허용한다", () => {
    expect(decideFacesetUploadDimensions(48, 48)).toEqual({ accept: true });
  });

  it("192×192 정사각형 48배수는 시트로 거부한다", () => {
    const result = decideFacesetUploadDimensions(192, 192);
    expect(result.accept).toBe(false);
    if (!result.accept) {
      expect(result.reason).toContain("npm run assets:slice-faces");
      expect(result.reason).toContain("48");
    }
  });

  it("96×96 정사각형 48배수도 시트로 거부한다", () => {
    expect(decideFacesetUploadDimensions(96, 96).accept).toBe(false);
  });

  it("48×96 비정사각형은 낱장 아트로 허용한다", () => {
    expect(decideFacesetUploadDimensions(48, 96)).toEqual({ accept: true });
  });

  it("그 외 일반 크기 낱장(예: 256×256 배수 아님)은 허용한다", () => {
    expect(decideFacesetUploadDimensions(256, 200)).toEqual({ accept: true });
  });

  it("0 이하 변 길이는 유효하지 않은 이미지로 거부한다", () => {
    expect(decideFacesetUploadDimensions(0, 48).accept).toBe(false);
    expect(decideFacesetUploadDimensions(48, -1).accept).toBe(false);
  });
});
