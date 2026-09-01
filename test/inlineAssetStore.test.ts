import {
  hasInlineAssets,
  inlineAssetUrl,
  registerInlineAssets,
  withInlineAsset,
} from "@/assets/inlineAssetStore";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { afterEach, describe, expect, it } from "vitest";

const DATA_URL = "data:image/png;base64,AA==";

afterEach(() => registerInlineAssets(null));

describe("inline asset store", () => {
  // 표가 없을 때 아무 것도 바뀌지 않아야 한다. 웹 서버 배포는 이 경로로 돈다.
  it("표가 없으면 경로를 그대로 둔다", () => {
    // Given
    const path = "assets/a.png";

    // When
    const kept = withInlineAsset(path);

    // Then
    expect(hasInlineAssets()).toBe(false);
    expect(kept).toBe(path);
    expect(inlineAssetUrl(path)).toBeNull();
  });

  it("앞의 슬래시 유무와 무관하게 같은 항목을 찾는다", () => {
    // Given
    registerInlineAssets({ "assets/a.png": DATA_URL });

    // When
    const found = ["assets/a.png", "/assets/a.png", "./assets/a.png"].map(withInlineAsset);

    // Then
    expect(found).toEqual([DATA_URL, DATA_URL, DATA_URL]);
  });

  it("이미 data URL 이거나 외부 주소면 건드리지 않는다", () => {
    // Given
    registerInlineAssets({ "assets/a.png": DATA_URL });

    // When
    const passthrough = [DATA_URL, "https://cdn.example.com/a.png"].map(withInlineAsset);

    // Then
    expect(passthrough).toEqual([DATA_URL, "https://cdn.example.com/a.png"]);
  });

  it("표에 없는 경로는 원본을 남긴다", () => {
    // Given
    registerInlineAssets({ "assets/a.png": DATA_URL });

    // When
    const kept = withInlineAsset("assets/b.png");

    // Then
    expect(kept).toBe("assets/b.png");
  });

  // 리소스 id → URL 을 만드는 곳이 곧 인라인 교체 지점이다. 여기가 끊기면 소비처 13곳이 전부
  // 원본 경로로 요청해 file:// 에서 통째로 깨진다.
  it("리소스 해석 결과가 인라인 표를 거친다", () => {
    // Given
    const before = resolveAssetResourceUrl("easyrpg-sound-decision1");
    expect(before?.startsWith("/")).toBe(true);
    registerInlineAssets({ [before!.slice(1)]: "data:audio/wav;base64,BB==" });

    // When
    const after = resolveAssetResourceUrl("easyrpg-sound-decision1");

    // Then
    expect(after).toBe("data:audio/wav;base64,BB==");
  });
});
