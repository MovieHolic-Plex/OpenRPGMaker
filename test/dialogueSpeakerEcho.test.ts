import { describe, expect, it } from "vitest";
import { stripSpeakerEcho } from "@/project/dialogueSpeakerEcho";

describe("stripSpeakerEcho — 이름표와 같은 이름이 본문 앞에 또 붙은 줄", () => {
  it("「이름: 따옴표 본문」 은 이름과 바깥 따옴표를 걷는다", () => {
    expect(stripSpeakerEcho('한지훈: "반가워!"', "한지훈")).toBe("반가워!");
    expect(stripSpeakerEcho("서연：“오랜만이야.”", "서연")).toBe("오랜만이야.");
  });
  it("[이름] 머리표 줄도 걷는다", () => {
    expect(stripSpeakerEcho("[서연]\n안녕", "서연")).toBe("안녕");
  });
  it("여러 줄 본문은 이름만 걷고 따옴표는 그대로 둔다", () => {
    expect(stripSpeakerEcho('서연: "…오랜만이야."\n두번째 줄', "서연")).toBe('"…오랜만이야."\n두번째 줄');
  });
  it("이름표가 「서연 (소꿉친구 반장)」 이고 본문이 「서연: …」 이어도 걷는다(줄임 이름)", () => {
    expect(stripSpeakerEcho('서연: "아, 왔구나!"', "서연 (소꿉친구 반장)")).toBe("아, 왔구나!");
    expect(stripSpeakerEcho("도윤: 어서 오세요", "바리스타 선배 도윤")).toBe("어서 오세요");
  });
  it("이름이 다르거나 본문 속에 있으면 건드리지 않는다", () => {
    expect(stripSpeakerEcho("서연이: 안녕", "서연")).toBe("서연이: 안녕");
    expect(stripSpeakerEcho("그는 서연: 이라 불렀다", "서연")).toBe("그는 서연: 이라 불렀다");
    expect(stripSpeakerEcho("한지훈: 안녕", "서연")).toBe("한지훈: 안녕");
  });
  it("이름만 있던 본문은 비우지 않는다", () => {
    expect(stripSpeakerEcho("서연:", "서연")).toBe("서연:");
  });
  it("화자가 없으면 그대로다", () => {
    expect(stripSpeakerEcho("안녕", undefined)).toBe("안녕");
  });
});
