import { describe, expect, it } from "vitest";
import { estimateTextEm, fitTitleSubtitle, fitTitleText, TITLE_STAGE_WIDTH } from "@/player/titleTextFit";

describe("titleTextFit (jrpg-real-1 J05)", () => {
  it("keeps a short title at its base size on one line", () => {
    const fit = fitTitleText("버들항", { left: 20, basePx: 24, letterSpacingEm: 0.02 });
    expect(fit).toMatchObject({ fontPx: 24, lines: 1 });
  });

  it("shrinks or wraps a long title so its estimated width fits", () => {
    const text = "아르카디아 연대기: 버들나루와 고대 봉인";
    const fit = fitTitleText(text, { left: 20, basePx: 24, letterSpacingEm: 0.02 });
    const em = estimateTextEm(text, 0.02);
    expect(fit.fontPx * em).toBeLessThanOrEqual(fit.availablePx * fit.lines + 1);
    expect(fit.availablePx).toBeLessThanOrEqual(TITLE_STAGE_WIDTH);
  });

  it("fits a wide English subtitle inside the stage", () => {
    const fit = fitTitleSubtitle("A Chronicle Of Two Worlds And The Ashen Stone", { left: 20, basePx: 7, baseSpacingEm: 0.3 });
    expect(fit.lines).toBeGreaterThanOrEqual(1);
    expect(fit.letterSpacingEm).toBeLessThanOrEqual(0.3);
  });
});
