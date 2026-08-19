import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

function makeLog(): {
  readonly log: HTMLElement;
  readonly host: ReturnType<typeof createConversationLogHost>;
} {
  const log = document.createElement("div");
  const host = createConversationLogHost({
    log,
    revealVolatileZone: () => undefined,
    removeStartScreen: () => undefined,
  });
  return { log, host };
}

describe("conversation log command rows", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("records a user+assistant turn as two command rows and zero chat bubbles", () => {
    // Break: appendConversationBubble still assigns ai-chat-bubble / ai-chat-user.
    const { log, host } = makeLog();

    host.renderConversationEntry({ kind: "user", text: "호수 만들어줘" });
    host.renderConversationEntry({ kind: "assistant", text: "초안입니다." });

    expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(2);
    expect(log.querySelectorAll(".ai-chat-user")).toHaveLength(0);
    expect(log.querySelectorAll(".ai-chat-assistant")).toHaveLength(0);
    expect(findByTestId(log as unknown as FakeElement, "ai-command-row-user")?.textContent).toContain("호수 만들어줘");
    expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toContain("초안입니다.");
  });

  it("prefixes each human-log row with @>", () => {
    // Break: the row is emitted without an @> prefix node.
    const { log, host } = makeLog();

    host.appendBubble("user", "길 깔아줘");
    host.appendBubble("system", "오류: 키 없음");

    const prefixes = log.querySelectorAll(".ai-command-prefix");
    expect(prefixes).toHaveLength(2);
    expect(prefixes[0]?.textContent).toBe("@>");
    expect(prefixes[1]?.textContent).toBe("@>");
  });

  it("streams tokens into the last command row in place", () => {
    // Break: each stream token creates another ai-command-row instead of mutating the last body.
    const { log, host } = makeLog();

    const streamed = host.appendBubble("assistant", "");
    streamed.textContent = `${streamed.textContent ?? ""}헬`;
    streamed.textContent = `${streamed.textContent ?? ""}로`;

    expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
    expect(streamed.textContent).toBe("헬로");
    expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toBe("헬로");
  });

  it("keeps markdown rendering inside the command row", () => {
    // Break: assistant markdown is rendered as a sibling bubble, not inside the row.
    const { log, host } = makeLog();

    host.appendBubble("assistant", "**초안**입니다");

    const row = log.querySelector("[data-testid=ai-command-row]");
    expect(row?.querySelector(".md")).toBeTruthy();
    expect(row?.querySelector("strong")?.textContent).toBe("초안");
  });

  it("attaches tool activity to the last command row instead of a bubble", () => {
    // Break: appendToolLine still wraps the group in ai-chat-bubble.
    const { log, host } = makeLog();

    host.appendBubble("user", "길 깔아줘");
    host.appendToolLine("paint_road", { ok: true, summary: "길을 그렸습니다" });

    const activity = findByTestId(log as unknown as FakeElement, "ai-tool-activity");
    const row = log.querySelector("[data-testid=ai-command-row]");
    expect(activity).toBeTruthy();
    expect(activity?.className).not.toContain("ai-chat-bubble");
    expect(row?.contains(activity as unknown as Node)).toBe(true);
  });

  it("attaches a tile grid to the last command row instead of a bubble", () => {
    // Break: appendTileGrid still wraps the grid in ai-chat-bubble.
    const { log, host } = makeLog();

    host.appendBubble("assistant", "격자");
    host.appendTileGrid({
      tilesetId: DEFAULT_TILESET_ID,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      lower: [[0]],
      upper: [[-1]],
    });

    const grid = findByTestId(log as unknown as FakeElement, "ai-bubble-tile-grid");
    const row = log.querySelector("[data-testid=ai-command-row]");
    expect(grid).toBeTruthy();
    expect(grid?.className).not.toContain("ai-chat-bubble");
    expect(row?.contains(grid as unknown as Node)).toBe(true);
  });
});
