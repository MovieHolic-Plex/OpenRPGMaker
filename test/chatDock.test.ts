import { describe, expect, it } from "vitest";
import {
  chatDockHint,
  cycleChatDock,
  DEFAULT_CHAT_DOCK,
  isOverlayChatDock,
  nextChatDockActionLabel,
  parseChatDock,
} from "@/editor/chatDock";

describe("chatDock", () => {
  it("empty or unknown storage falls back to glass", () => {
    expect(DEFAULT_CHAT_DOCK).toBe("glass");
    expect(parseChatDock(undefined)).toBe("glass");
    expect(parseChatDock("docked")).toBe("glass");
    expect(parseChatDock(null)).toBe("glass");
  });

  it("keeps stored float and side", () => {
    expect(parseChatDock("float")).toBe("float");
    expect(parseChatDock("side")).toBe("side");
    expect(parseChatDock("glass")).toBe("glass");
  });

  it("cycles glass → side → float → glass", () => {
    expect(cycleChatDock("glass")).toBe("side");
    expect(cycleChatDock("side")).toBe("float");
    expect(cycleChatDock("float")).toBe("glass");
  });

  it("treats float and glass as overlay docks", () => {
    expect(isOverlayChatDock("float")).toBe(true);
    expect(isOverlayChatDock("glass")).toBe(true);
    expect(isOverlayChatDock("side")).toBe(false);
  });

  it("names the next dock for the toggle", () => {
    expect(nextChatDockActionLabel("glass")).toBe("옆에 붙이기");
    expect(nextChatDockActionLabel("side")).toBe("아래 바로");
    expect(nextChatDockActionLabel("float")).toBe("왼쪽 유리");
    expect(chatDockHint("glass")).toContain("왼쪽 유리");
  });
});
