import { describe, expect, it } from "vitest";
import {
  isReadOnlyToolNoise,
  phaseStatusText,
  shouldShowStatusInChat,
} from "@/editor/panels/aiChatPanelHelpers";
import { formatAiRunningStatus, renderToolActivityEntry } from "@/editor/panels/aiChatRenderers";
import { installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

describe("AI 채팅 lean UI 정책", () => {
  it("단계 라벨에 모델 코드를 넣지 않는다", () => {
    expect(phaseStatusText("plan")).toBe("계획 중");
    expect(phaseStatusText("execute")).toBe("실행 중");
    expect(phaseStatusText("review")).toBe("검수 중");
  });

  it("진행 상태줄은 짧고 분모 상한을 숨긴다", () => {
    expect(formatAiRunningStatus(0, 12_000, 0, 200, "계획 중")).toBe("계획 중… 12초");
    expect(formatAiRunningStatus(0, 12_000, 4, 200, "실행 중")).toBe("실행 중… 12초 · 도구 4");
  });

  it("status 말풍선은 재시도·오류 신호만 허용한다", () => {
    expect(shouldShowStatusInChat("연결 끊김 — 재시도 중(1/2)")).toBe(true);
    expect(shouldShowStatusInChat("요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.")).toBe(true);
    expect(shouldShowStatusInChat("변경 없는 종료를 감지해 실행 계획을 다시 요청합니다.")).toBe(false);
    expect(shouldShowStatusInChat("zero-change-rekick")).toBe(false);
  });

  it("조회성 툴 성공은 목록 노이즈로 분류한다", () => {
    expect(isReadOnlyToolNoise("get_map_region")).toBe(true);
    expect(isReadOnlyToolNoise("list_resources")).toBe(true);
    expect(isReadOnlyToolNoise("show_tiles")).toBe(true);
    expect(isReadOnlyToolNoise("paint_road")).toBe(false);
    expect(isReadOnlyToolNoise("build_house_kit")).toBe(false);
  });

  it("성공 툴 항목은 JSON 상세 없이 한 줄이다", () => {
    const restore = installFakeDom();
    try {
      const node = renderWithFakeDom(() =>
        renderToolActivityEntry(
          "paint_road",
          { ok: true, summary: "길 12칸" },
          { args: { mapId: "m1" }, index: 1 }
        )
      ) as FakeElement;
      expect(node.tagName).toBe("DIV");
      expect(node.textContent).toContain("paint_road");
      expect(node.querySelector?.("pre")).toBeFalsy();
    } finally {
      restore();
    }
  });
});
