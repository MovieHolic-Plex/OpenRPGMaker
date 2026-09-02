import { describe, expect, it } from "vitest";
import {
  formatIntentClarifyMessage,
  requestMentionsHouseLike,
  resolveIntentClarification,
} from "@/ai/intentClarify";
import { parseQuickReplies } from "@/ai/interviewPrompt";

describe("resolveIntentClarification — 집 vs 실내", () => {
  it("집만 있으면 되묻는다", () => {
    const result = resolveIntentClarification("집 하나 만들어줘");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("house-vs-interior");
    expect(result?.reason).toMatch(/표지 없음|스킬/);
  });

  it("실내 표지가 있으면 되묻지 않는다", () => {
    expect(resolveIntentClarification("연금술사의 집 이라는 실내 를 하나 만드렁줘")).toBeNull();
    expect(resolveIntentClarification("실내 맵 하나 만들어줘")).toBeNull();
  });

  it("야외/외장 표지가 있으면 되묻지 않는다", () => {
    expect(resolveIntentClarification("마을에 야외 집 한 채 지어줘")).toBeNull();
    expect(resolveIntentClarification("외장 집 만들어")).toBeNull();
  });

  it("선택지 답변·진행 지시는 되묻지 않는다", () => {
    expect(resolveIntentClarification("실내 맵으로")).toBeNull();
    expect(resolveIntentClarification("야외 집(외장)으로")).toBeNull();
    expect(resolveIntentClarification("외장 집 + 내부 둘 다")).toBeNull();
    expect(resolveIntentClarification("진행해")).toBeNull();
  });

  it("킥오프 프로토콜 문장은 되묻지 않는다", () => {
    const kickoff = [
      "현재 맵(마을)에 집을 지어주세요.",
      "- 크기: 10×10",
      "",
      "절차(준수 — 공정 순서: 벽→문/창→지붕):",
      "build_house_kit을 우선 사용",
    ].join("\n");
    expect(resolveIntentClarification(kickoff)).toBeNull();
  });

  it("formatIntentClarifyMessage는 원탭 선택지를 붙인다", () => {
    const clarify = resolveIntentClarification("건물 하나 지어줘");
    expect(clarify).not.toBeNull();
    const message = formatIntentClarifyMessage(clarify!);
    expect(parseQuickReplies(message)).toEqual([
      "실내 맵으로",
      "야외 집(외장)으로",
      "외장 집 + 내부 둘 다",
    ]);
  });

  it("수집 같은 오탐 단어만으로는 집 요청으로 보지 않는다", () => {
    expect(requestMentionsHouseLike("아이템 수집 시스템 만들어줘")).toBe(false);
  });

  // 건물 명사가 직업 이름의 일부인 요청은 사람 배치다 — 되물으면 툴이 한 번도 안 돈다.
  it("'여관 주인'·'대장간 주인'은 시공 요청이 아니다", () => {
    expect(requestMentionsHouseLike("15G에 숙박시키는 여관 주인 NPC를 배치해줘")).toBe(false);
    expect(resolveIntentClarification("빈 프로젝트에 마을 맵을 하나 만들고, 15G에 숙박시키는 여관 주인 NPC를 배치해줘.")).toBeNull();
    expect(resolveIntentClarification("대장간 주인이랑 상점 점원 배치해줘")).toBeNull();
    // 여관은 개념 꾸러미 실내 시설이라 되묻지 않는다. 오두막처럼 표지 없는 건물만 묻는다.
    expect(resolveIntentClarification("여관 하나 지어줘")).toBeNull();
    expect(resolveIntentClarification("오두막 하나 지어줘")).not.toBeNull();
  });

  // 수정 요청은 "새로 무엇을 만들까" 질문 자체가 성립하지 않는다.
  it("수정 요청은 되묻지 않는다", () => {
    for (const text of ["이 집 좀 고쳐줘", "여관 외벽 타일을 석재로 바꿔줘", "이 건물 지붕 좀 손봐줘"]) {
      expect(resolveIntentClarification(text), text).toBeNull();
    }
  });

  it("맵 크기·다수 채·NPC 마을 맥락은 야외로 보고 되묻지 않는다", () => {
    expect(resolveIntentClarification("40x40 맵에 작은 집 3채 NPC 5명 배치해줘")).toBeNull();
  });

  it("여러 야외 집과 별도 실내 방을 함께 명시하면 둘 다 요청으로 진행한다", () => {
    expect(resolveIntentClarification("시작 마을에 집 2채와 주민 2명, 실내 방 하나를 만들어줘")).toBeNull();
  });
});
