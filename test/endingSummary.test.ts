// J36: 엔딩 카드 요약은 내레이션 — 에필로그의 말한 사람이 「이름: 대사」 대본 머리말로 새지 않는다.
import { describe, expect, it } from "vitest";
import { endingSummaryText, splitScriptSpeaker } from "@/project/endingSummary";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import { createBlankProject } from "@/project/defaults";

const TOY_SHOP_EPILOGUE = [
  { kind: "letterbox", show: true },
  { kind: "say", speaker: "노장인 제페토", text: "루카스의 씩씩한 태엽 병정도… 모두 자네에게 마지막 인사를 건넸구나." },
  { kind: "say", speaker: "노장인 제페토", text: "우리 가슴속에 감긴 추억의 태엽은 영원히 멈추지 않을 걸세." },
  { kind: "say", context: "narration", text: "철컥— 제페토 할아버지는 가게의 문을 조용히 닫았습니다." },
];

describe("엔딩 카드 요약", () => {
  it("말한 사람의 줄은 이름 머리말 없이 「」 인용으로, 연이은 말은 한 인용으로 묶는다", () => {
    const text = endingSummaryText(TOY_SHOP_EPILOGUE);
    expect(text).not.toContain("제페토:");
    expect(text.split("\n")).toEqual([
      "「루카스의 씩씩한 태엽 병정도… 모두 자네에게 마지막 인사를 건넸구나. 우리 가슴속에 감긴 추억의 태엽은 영원히 멈추지 않을 걸세.」",
      "철컥— 제페토 할아버지는 가게의 문을 조용히 닫았습니다.",
    ]);
  });

  it("말한 사람이 둘 이상이면 인용 끝에 출처를 붙이고, 본문에 직접 쓴 「이름:」도 뗀다", () => {
    const text = endingSummaryText([
      { kind: "say", speaker: "미아", text: "고마워." },
      { kind: "say", text: "레온: 「또 만나자.」" },
    ]);
    expect(text.split("\n")).toEqual(["「고마워.」 — 미아", "「또 만나자.」 — 레온"]);
  });

  it("시각·문장 속 쌍점은 화자로 보지 않는다", () => {
    expect(splitScriptSpeaker("오전 10: 30 종이 울렸다").speaker).toBeUndefined();
    expect(splitScriptSpeaker("그날 밤, 마을 사람들은 모두 광장에 모여 이렇게 말했다: 고마워").speaker).toBeUndefined();
  });

  it("끝맺음 검사가 본문에 「이름:」을 쓴 에필로그를 짚는다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    after.endings = [{ id: "ending_a", name: "끝", conditions: [], priority: 0, epilogue: [{ kind: "say", text: "노장인 제페토: 잘 가게." }] }];
    expect(gameContentProblems(before, after, "엔딩 고쳐 줘").some((p) => p.includes("에필로그 대사 본문이 「이름:」"))).toBe(true);
    after.endings = [{ id: "ending_a", name: "끝", conditions: [], priority: 0, epilogue: [{ kind: "say", speaker: "노장인 제페토", text: "잘 가게." }] }];
    expect(gameContentProblems(before, after, "엔딩 고쳐 줘").some((p) => p.includes("에필로그 대사 본문이 「이름:」"))).toBe(false);
  });
});
