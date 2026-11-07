import { describe, expect, it } from "vitest";
import {
  IMAGE_GENERATION_UNAVAILABLE_CODE,
  IMAGE_GENERATION_UNAVAILABLE_NOTICE,
  imageGenerationUnavailableError,
  imageGenerationUnavailableInstruction,
  imageUnavailableGateNotice,
} from "@/editor/imageGenerationNotice";
import { isImageGenerationUnavailableResult, reportImageGenerationUnavailable } from "@/editor/panels/imageGenerationGate";

describe("image generation unavailable — loud failure", () => {
  it("keeps one shipped sentence that names what is blocked and the one-step fix", () => {
    expect(IMAGE_GENERATION_UNAVAILABLE_NOTICE).toContain("그림");
    expect(IMAGE_GENERATION_UNAVAILABLE_NOTICE).toContain("연결");
    expect(IMAGE_GENERATION_UNAVAILABLE_NOTICE.length).toBeGreaterThan(30);
    expect(imageUnavailableGateNotice().reasons).toContain(IMAGE_GENERATION_UNAVAILABLE_NOTICE);
  });

  it("returns a hard error carrying the shared code and tells the agent to report it", () => {
    const error = imageGenerationUnavailableError();
    expect(error.code).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
    expect(error.message).toContain("보고에 이 사실을 적어라");
    expect(imageGenerationUnavailableInstruction()).toContain(IMAGE_GENERATION_UNAVAILABLE_NOTICE);
  });

  it("recognises the failure result and raises the notice through the shared gate", () => {
    const shown: string[] = [];
    const raised = reportImageGenerationUnavailable(
      { summary: `x ${IMAGE_GENERATION_UNAVAILABLE_CODE} y` },
      (notice) => shown.push(notice.kind),
    );
    expect(raised).toBe(true);
    expect(shown).toEqual(["image-unavailable"]);
    expect(isImageGenerationUnavailableResult({ summary: "정상 완료" })).toBe(false);
  });
});
