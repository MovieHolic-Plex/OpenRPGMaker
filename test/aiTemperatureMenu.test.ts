import { afterEach, describe, expect, it } from "vitest";
import { createAssistantTemperatureMenuSection } from "@/editor/panels/aiTemperatureMenu";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("assistant temperature menus", () => {
  it("renders the same labeled accessible choices in header and composer menus", () => {
    // Break: header and composer menus can drift or hide their labels behind hover-only titles.
    restoreDom = installFakeDom();
    for (const variant of ["header", "composer"] as const) {
      const picked: string[] = [];
      const section = renderWithFakeDom(() => createAssistantTemperatureMenuSection({
        variant,
        current: () => "quiet-gold",
        close: () => undefined,
        onChange: (next) => picked.push(next),
      }));
      expect(section.textContent).toBe("대기 화면✦ 추천 함께 보기◫ 조수만 보기⌨ 입력창만 보기");
      for (const [id, label] of [
        ["quiet-gold", "추천 함께 보기"],
        ["ink-only", "조수만 보기"],
        ["map-first", "입력창만 보기"],
      ] as const) {
        const prefix = variant === "header" ? "ai-temperature" : "ai-command-temperature";
        const button = findByTestId(section, `${prefix}-${id}`);
        expect(button?.getAttribute("aria-label")).toBe(label);
        expect(button?.getAttribute("title")).toBe(label);
        expect(button?.getAttribute("role")).toBe("menuitemradio");
      }
      const prefix = variant === "header" ? "ai-temperature" : "ai-command-temperature";
      findByTestId(section, `${prefix}-map-first`)?.click();
      expect(picked).toEqual(["map-first"]);
    }
  });
});
