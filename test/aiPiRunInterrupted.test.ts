import { describe, expect, it } from "vitest";
import { interruptedPiRequest, PI_RUN_IN_FLIGHT } from "@/editor/panels/aiPiRunInterrupted";

describe("끝나지 못한 Pi 실행 알아보기", () => {
  it("기록 끝에 «실행 중» 표지가 남아 있으면 그 실행의 요청 글을 돌려준다", () => {
    expect(interruptedPiRequest([
      { kind: "user", text: "앞 요청" },
      { kind: "assistant", text: "끝" },
      { kind: "user", text: "작은 마을을 만들어 줘" },
      { kind: "status", text: PI_RUN_IN_FLIGHT },
    ])).toBe("작은 마을을 만들어 줘");
  });

  it("표지가 없거나 끝이 아니면(정상으로 끝난 실행) null", () => {
    expect(interruptedPiRequest([{ kind: "user", text: "요청" }, { kind: "assistant", text: "끝" }])).toBeNull();
    expect(interruptedPiRequest([{ kind: "status", text: PI_RUN_IN_FLIGHT }, { kind: "user", text: "다음" }])).toBeNull();
    expect(interruptedPiRequest([])).toBeNull();
  });
});
