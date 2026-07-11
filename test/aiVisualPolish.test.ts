import { describe, expect, it } from "vitest";
import {
  aiDayKey,
  formatAiDayLabel,
  parseAiDayDate,
  statusToneOf,
} from "@/editor/panels/aiChatPanelHelpers";
import { ensureDayDivider, markPriorTurns } from "@/editor/panels/aiConversationLog";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

describe("AI 상태 톤(제안 6)", () => {
  it("대기/오류/검토/진행/완료를 구분한다", () => {
    expect(statusToneOf("대기")).toBe("idle");
    expect(statusToneOf("새 대화")).toBe("idle");
    expect(statusToneOf("오류")).toBe("error");
    expect(statusToneOf("오류: 키 없음")).toBe("error");
    expect(statusToneOf("검토 대기")).toBe("review");
    expect(statusToneOf("계획 중(m3) … 12초 · 도구 3/200")).toBe("running");
    expect(statusToneOf("실행 중(flash) … 3초 · 도구 1/200")).toBe("running");
    expect(statusToneOf("중단 중…")).toBe("running");
    expect(statusToneOf("적용됨")).toBe("ok");
    expect(statusToneOf("완료")).toBe("ok");
    expect(statusToneOf("완료 — 변경 없음(린트 경고)")).toBe("ok");
  });
});

describe("AI 기록 날짜/턴 접기(제안 6)", () => {
  it("같은 날에는 구분선을 한 번만 넣고, 이전 턴을 접는다", () => {
    const restore = installFakeDom();
    try {
      const log = document.createElement("div") as unknown as FakeElement;
      const day = new Date("2026-07-11T10:00:00");
      expect(aiDayKey(day)).toBe("2026-07-11");
      expect(formatAiDayLabel(day)).toContain("2026");
      expect(parseAiDayDate("2026-07-11T12:00:00").getDate()).toBe(11);

      const first = ensureDayDivider(log as unknown as HTMLElement, day);
      const second = ensureDayDivider(log as unknown as HTMLElement, day);
      expect(first).toBeTruthy();
      expect(second).toBeNull();
      expect(findByTestId(log, "ai-day-divider")).toBeTruthy();

      const user = document.createElement("div") as unknown as FakeElement;
      user.className = "ai-chat-bubble ai-chat-user";
      user.textContent = "호수 만들어줘";
      const assistant = document.createElement("div") as unknown as FakeElement;
      assistant.className = "ai-chat-bubble ai-chat-assistant";
      assistant.textContent = "초안입니다.";
      log.append(user, assistant);

      markPriorTurns(log as unknown as HTMLElement);

      const group = findByTestId(log, "ai-turn-group");
      expect(group).toBeTruthy();
      expect(group?.className).toContain("is-collapsed");
      expect(group?.className).toContain("is-prior-turn");
      expect(findByTestId(log, "ai-turn-group-toggle")?.textContent).toContain("호수");
      // 구분선은 유지, 턴 본문은 그룹 안.
      expect(findByTestId(log, "ai-day-divider")).toBeTruthy();
      expect(findByTestId(group!, "ai-turn-group-body")?.childNodes.length).toBe(2);
    } finally {
      restore();
    }
  });
});
