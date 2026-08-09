// 《천공의 계단》 완주 회귀. 층 하나라도 막히면 여기서 잡힌다.
import { describe, expect, it } from "vitest";
import { createSkyStairProject } from "@/editor/content/skyStairGame";
import { SKY_STAIR_WALKTHROUGH } from "@/testing/skyStairWalkthrough";
import { runWalkthrough } from "@/testing/walkthroughRunner";

describe("천공의 계단 완주", () => {
  it("5퀘스트 + 보스 + 엔딩까지 끊기지 않는다", () => {
    const result = runWalkthrough(createSkyStairProject(), SKY_STAIR_WALKTHROUGH, { seed: 20260727 });
    const tail = result.log.slice(-14).join("\n");
    expect(
      result.ok,
      `완주 실패 @스텝 ${result.failedStepIndex} (${JSON.stringify(result.failedStep)})\n` +
        `이유: ${result.failureReason}\n최근 로그:\n${tail}`
    ).toBe(true);
    expect(result.reachedEnding, `엔딩에 도달하지 못했다\n${tail}`).toBe(true);
    expect(result.stepsRun).toBe(result.totalSteps);
  });
});
