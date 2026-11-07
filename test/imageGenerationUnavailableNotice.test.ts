import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import {
  IMAGE_GENERATION_UNAVAILABLE_CODE,
  imageGenerationFailureCode,
  imageGenerationUnavailableError,
  imageGenerationUnavailableInstruction,
  imageUnavailableGateNotice,
} from "@/editor/imageGenerationNotice";
import { ImageGenerationError } from "@/ai/imageGenerationClient";
import { isImageGenerationUnavailableResult, reportImageGenerationUnavailable } from "@/editor/panels/imageGenerationGate";

describe("image generation unavailable — loud failure", () => {
  it("keeps the wire code that every surface matches on", () => {
    expect(IMAGE_GENERATION_UNAVAILABLE_CODE).toBe("image-generation-unavailable");
  });

  it("returns a hard error that carries the code and the agent instruction verbatim", () => {
    const error = imageGenerationUnavailableError();
    expect(error.name).toBe("ToolError");
    expect(error.code).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
    expect(error.message).toBe(imageGenerationUnavailableInstruction());
  });

  it("materialises a gate notice of the image-unavailable kind with one reason and one fix", () => {
    const notice = imageUnavailableGateNotice();
    expect(notice.kind).toBe("image-unavailable");
    expect(notice.reasons).toHaveLength(1);
    expect(notice.nextSteps).toHaveLength(1);
  });

  it("recognises the failure result only through the code and raises the gate once", () => {
    const shown: string[] = [];
    const raised = reportImageGenerationUnavailable(
      { summary: `x ${IMAGE_GENERATION_UNAVAILABLE_CODE} y` },
      (notice) => shown.push(notice.kind),
    );
    expect(raised).toBe(true);
    expect(shown).toEqual(["image-unavailable"]);
    expect(isImageGenerationUnavailableResult({ summary: "정상 완료" })).toBe(false);
    expect(isImageGenerationUnavailableResult({ issues: [{ code: IMAGE_GENERATION_UNAVAILABLE_CODE }] })).toBe(true);
  });

  it("raises the same loud code for a credential failure, not a generic image failure", () => {
    // 자동 Google 대체를 없애면서 「자격 없음」이 새로 도달 가능해졌다 — 그 실패가 조용한 일반 실패로 남으면
    // 캔버스 띠·차단 모달이 뜨지 않는다. 일시 오류는 한 번 더 시도할 수 있으므로 구분을 유지한다.
    expect(imageGenerationFailureCode(new ImageGenerationError("ChatGPT 로그인이 필요합니다", 401))).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
    expect(imageGenerationFailureCode(new ImageGenerationError("일시 오류", 502))).toBe("image-generation-failed");
    expect(imageGenerationFailureCode(new Error("network down"))).toBe("image-generation-failed");
  });

  it("fails the real registry tool hard with that code instead of reporting success", () => {
    expect(getTool("generate_opening_image")?.mode).toBe("write");
    const result = runTool({ project: createBlankProject() }, "generate_opening_image", { prompt: "폐허가 된 성문 앞의 새벽" });
    expect(result.ok).toBe(false);
    expect(result.issues?.map((issue) => issue.code)).toContain(IMAGE_GENERATION_UNAVAILABLE_CODE);
    expect(isImageGenerationUnavailableResult(result)).toBe(true);
  });
});
