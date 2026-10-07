import { afterEach, describe, expect, it } from "vitest";
import { resolveReferenceImageDataUrl, setSharedReferenceImageReader } from "@/project/bundledReferenceImages";

// 조수 워커(Bun)는 상대 주소 fetch 를 못 한다 — 공용 참고 이미지는 등록한 읽기 함수로 바로 푼다(2026-10-08).
describe("shared reference image reader", () => {
  afterEach(() => setSharedReferenceImageReader(null));
  it("resolves a shared-content image address without fetch", async () => {
    setSharedReferenceImageReader(src => src.endsWith(".png") ? { mime: "image/png", bytes: new Uint8Array([1, 2, 3]) } : null);
    await expect(resolveReferenceImageDataUrl("/__oprn/shared-content/image/s1-2-3.png")).resolves.toBe("data:image/png;base64,AQID");
  });
});
