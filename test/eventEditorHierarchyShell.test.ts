import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readEventSurfaceCss } from "./helpers/eventSurfaceCss";

// PIN-RED: event-editor hierarchy chrome contract (after.html).
//
// These assertions describe the target "hierarchy" shell rendered by content.ts +
// event-editor.(hierarchy|balanced).css, and fail against the current balanced
// baseline. Implementation flips this file to green. The required shell testids
// (event-editor-modal, event-page-tab-*, event-storyboard) are kept.

// 2026-09-11 Task 13: balanced.css 는 구성 요소 버킷(shell/pages/footer …)으로 흩어졌다 → 이벤트 표면 전체를 읽는다.
const css = readEventSurfaceCss();
const contentSource = readFileSync(
  new URL("../src/editor/panels/eventEditor/content.ts", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../src/editor/panels/eventEditor/modal.ts", import.meta.url),
  "utf8",
);
const pagePropsSource = readFileSync(
  new URL("../src/editor/panels/eventEditor/pageProps.ts", import.meta.url),
  "utf8",
);
const storyboardSource = readFileSync(
  new URL("../src/editor/panels/eventEditor/storyboardView.ts", import.meta.url),
  "utf8",
);

describe("event editor hierarchy chrome contract", () => {
  it("collapses the identity band into the titlebar (no 89px identity row)", () => {
    expect(css).not.toContain("--balanced-identity-height: 89px");
  });

  it("shrinks the titlebar to 48px", () => {
    expect(css).toMatch(/--(?:hierarchy|balanced)-header-height:\s*48px/);
  });

  it("shrinks the page tab strip to 40px", () => {
    expect(css).toMatch(/--(?:hierarchy|balanced)-pages-height:\s*40px/);
  });

  it("shrinks the footer to 40px", () => {
    expect(css).toMatch(/--(?:hierarchy|balanced)-footer-height:\s*40px/);
  });

  it("drops the numbered left-rail '1. 언제 나타날까요?' affordance", () => {
    expect(pagePropsSource).not.toContain("1. 언제 나타날까요?");
  });

  it("shows the event name in the titlebar via the event-editor-name testid", () => {
    expect(modalSource).toContain("event-editor-name");
  });

  it("keeps the required shell testids", () => {
    const combined = modalSource + pagePropsSource + storyboardSource;
    expect(combined).toContain("event-editor-modal");
    expect(combined).toContain("evt-page-segment");
    expect(combined).toContain("event-storyboard");
  });
});
