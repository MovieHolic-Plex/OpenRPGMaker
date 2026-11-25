import { describe, expect, it } from "vitest";
import { hasBatchim, withJosa } from "@/util/josa";

describe("josa", () => {
  it("picks the josa from the final Hangul syllable's batchim", () => {
    expect(withJosa("슬라임", "을/를")).toBe("슬라임을");
    expect(withJosa("라르베아", "을/를")).toBe("라르베아를");
    expect(withJosa("고블린", "이/가")).toBe("고블린이");
    expect(withJosa("주인공", "은/는")).toBe("주인공은");
  });

  it("reads a trailing digit as its Korean pronunciation", () => {
    // 전투 HUD 가 동명 적을 "슬라임 1" / "슬라임 2" 로 번호 붙이므로 숫자 독음 받침을 따라야 한다.
    expect(withJosa("슬라임 1", "을/를")).toBe("슬라임 1을"); // 일
    expect(withJosa("슬라임 2", "을/를")).toBe("슬라임 2를"); // 이
    expect(withJosa("고블린 3", "이/가")).toBe("고블린 3이"); // 삼
    expect(withJosa("고블린 4", "이/가")).toBe("고블린 4가"); // 사
    expect(withJosa("드래곤 5", "은/는")).toBe("드래곤 5는"); // 오
    expect(withJosa("드래곤 9", "을/를")).toBe("드래곤 9를"); // 구
  });

  it("treats other non-Hangul endings as having batchim", () => {
    expect(hasBatchim("Slime")).toBe(true);
    expect(withJosa("Slime", "을/를")).toBe("Slime을");
  });
});
