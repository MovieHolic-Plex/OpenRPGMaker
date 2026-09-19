import { describe, expect, it } from "vitest";
import { readCssFamily } from "./cssFamily";

describe("ai-deck width transition contracts", () => {
  const css = readCssFamily(
    "src/styles/database/index.css",
    "src/styles/database/tabs-b-assistant-panel/18-assistant-deck.css",
  );

  it("disables width transition while resizing at open-deck specificity", () => {
    expect(css).toContain(
      ".ai-chat-panel.chat-dock-float.is-resizing:not(.is-studio):not(.is-history-open):not(.is-collapsed) .ai-deck",
    );
    const idx = css.indexOf(
      ".ai-chat-panel.chat-dock-float.is-resizing:not(.is-studio):not(.is-history-open):not(.is-collapsed) .ai-deck",
    );
    expect(css.slice(idx, idx + 180)).toContain("transition: none");
  });

  it("matches open-deck specificity for prefers-reduced-motion transition:none", () => {
    const media = css.indexOf("prefers-reduced-motion: reduce");
    expect(media).toBeGreaterThan(-1);
    const block = css.slice(media, media + 400);
    expect(block).toContain(
      ".ai-chat-panel.chat-dock-float:not(.is-studio):not(.is-history-open):not(.is-collapsed) .ai-deck",
    );
    expect(block).toContain("transition: none");
  });
});
