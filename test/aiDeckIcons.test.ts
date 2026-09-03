import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DECK_ICON_NAMES, deckIcon } from "@/editor/panels/aiDeckIcons";
import { installFakeDom } from "./fakeDom";

describe("aiDeckIcons — 데크 아이콘 빌더", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("아이콘은 currentColor stroke 의 svg 이고 이름을 data-icon 으로 든다", () => {
    // Break: 아이콘이 텍스트 글리프(☰·🕒)로 돌아가거나 stroke/fill 계약이 깨진다.
    const icon = deckIcon("plus");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("data-icon")).toBe("plus");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("stroke")).toBe("currentColor");
    expect(icon.getAttribute("fill")).toBe("none");
    expect(icon.getAttribute("stroke-width")).toBe("1.75");
    expect(icon.getAttribute("width")).toBe("18");
    expect(icon.getAttribute("class")).toContain("ai-deck-icon");
  });

  it("크기 옵션은 width/height 를 함께 바꾼다", () => {
    // Break: size 가 width 에만 적용되거나 무시된다.
    const icon = deckIcon("clock", { size: 15 });
    expect(icon.getAttribute("width")).toBe("15");
    expect(icon.getAttribute("height")).toBe("15");
  });

  it("모든 이름에 그림(path/circle/rect) 이 하나 이상 있다", () => {
    // Break: 사전에 이름만 있고 경로가 비어 빈 사각형이 그려진다.
    for (const name of DECK_ICON_NAMES) {
      const icon = deckIcon(name);
      expect(icon.childNodes.length, name).toBeGreaterThan(0);
    }
  });
});
