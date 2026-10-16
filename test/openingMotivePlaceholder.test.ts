import { describe, expect, it } from "vitest";
import { briefOpeningMotive } from "@/project/defaults/defaultOpeningSequence";

// jrpg-real-1 J12: 씨앗 brief 의 자리표시 답이 오프닝 첫 글자로 떴다.
const brief = (text: string) => ({ presetId: "adventure-jrpg", answers: { experience: { question: "q", label: "l", text, source: "user" } } }) as never;

describe("briefOpeningMotive placeholder answers (J12)", () => {
  it.each(["(채팅에서 정함)", "채팅에서 정할게요", "미정", "TBD"])("drops %s", (text) => {
    expect(briefOpeningMotive(brief(text))).toBe("");
  });

  it("keeps a real motive", () => {
    expect(briefOpeningMotive(brief("잃어버린 누이를 찾으러 길을 나선다."))).toBe("잃어버린 누이를 찾으러 길을 나선다.");
  });
});
