/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginGameExport, endGameExport, resetGameExportForTest } from "@/editor/panels/gameExportNotice";
import { resetToastsForTest } from "@/util/toast";

afterEach(() => {
  resetGameExportForTest();
  resetToastsForTest();
  document.body.replaceChildren();
  vi.useRealTimers();
});

function toastTexts(): string[] {
  return [...document.querySelectorAll(".toast")].map((node) => node.textContent ?? "");
}

describe("game export notice", () => {
  it("keeps the progress toast up past the default two seconds", () => {
    vi.useFakeTimers();
    expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
    const notice = document.querySelector<HTMLElement>('[data-testid="toast"]');
    expect(notice?.textContent).toContain("게임 번들을 만드는 중...");
    expect(notice?.classList.contains("show")).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(notice?.classList.contains("show")).toBe(true);
  });

  it("refuses a second export while the first is still running", () => {
    expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
    expect(beginGameExport("실행형 HTML 을 만드는 중...")).toBe(false);
    const texts = toastTexts();
    expect(texts.some((text) => text.includes("게임 번들을 만드는 중"))).toBe(true);
    expect(texts.some((text) => text.includes("이미 게임을 내보내는 중"))).toBe(true);
    expect(texts.some((text) => text.includes("실행형 HTML"))).toBe(false);
  });

  it("replaces progress with an error that stays past the default four seconds", () => {
    vi.useFakeTimers();
    beginGameExport("게임 번들을 만드는 중...");
    endGameExport("게임 내보내기 실패: manifest", "error");
    const notice = document.querySelector<HTMLElement>('[data-testid="toast"]');
    expect(notice?.textContent).toContain("게임 내보내기 실패: manifest");
    expect(notice?.classList.contains("error")).toBe(true);
    expect(toastTexts().some((text) => text.includes("게임 번들을 만드는 중"))).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(notice?.classList.contains("show")).toBe(true);
    vi.advanceTimersByTime(16_000);
    expect(notice?.classList.contains("show")).toBe(false);
  });

  it("allows another export after the first finishes", () => {
    expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
    endGameExport("게임 내보내기 완료: 맵 1개, 에셋 2개", "ok");
    expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
  });
});
