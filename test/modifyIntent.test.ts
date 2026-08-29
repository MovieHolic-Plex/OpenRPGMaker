import { describe, expect, it } from "vitest";
import {
  contextFooterMapId,
  forbidsNewCreation,
  hasCreateCue,
  hasModifyCue,
  requestLikelyExpectsExistingChange,
  requestLikelyModifiesExisting,
  stripContextFooter,
} from "@/ai/modifyIntent";

describe("수정 의도 판정", () => {
  it.each([
    "이 맵 좀 수정해줘",
    "남쪽 길을 넓혀줘",
    "이 침실 가구 배치를 개선해줘",
    "집 두 채 위치를 옮겨줘",
    "광장 타일을 석재로 바꿔줘",
    "담장이 엉망이야 손봐줘",
    "잘못 깔린 타일 지워줘",
  ])("수정으로 본다: %s", (text) => {
    expect(requestLikelyModifiesExisting(text)).toBe(true);
  });

  it.each([
    "마을 하나 만들어줘",
    "새 던전 맵을 생성해줘",
    "집 두 채 지어줘",
    "NPC 세 명 추가해줘",
  ])("수정이 아니다: %s", (text) => {
    expect(requestLikelyModifiesExisting(text)).toBe(false);
  });

  // 진단서에서 실측된 폴백 결함 문장 — "새로 만들지는 말고" 가 생성 표지로 세어지면
  // 플래너 폴백이 author_village(집 최소 1채 신축)를 완료 조건으로 박는다.
  it("생성 금지 표현이 붙으면 생성 표지를 취소한다", () => {
    const text = "이 마을 담장이 엉망으로 깔렸어. 새로 만들지는 말고 지금 있는 것만 손봐줘.";
    expect(forbidsNewCreation(text)).toBe(true);
    expect(hasCreateCue(text)).toBe(false);
    expect(requestLikelyModifiesExisting(text)).toBe(true);
  });

  it.each([
    "새 맵은 만들지 말고 이 맵을 고쳐줘",
    "새 맵 말고 지금 열린 맵을 수정해줘",
    "새로 만들 필요 없어 그냥 정리만 해줘",
    "맵을 추가하지 말고 기존 광장만 바꿔줘",
  ])("생성 금지 문형을 잡는다: %s", (text) => {
    expect(hasCreateCue(text)).toBe(false);
    expect(requestLikelyModifiesExisting(text)).toBe(true);
  });

  it("생성 부정어가 아닌 부정 수식은 생성 표지를 취소하지 않는다", () => {
    // "없이" 를 부정어로 넣으면 이 문장이 생성 요청이 아니게 된다.
    expect(hasCreateCue("새 맵을 벽 테두리 없이 만들어줘")).toBe(true);
    expect(requestLikelyModifiesExisting("새 맵을 벽 테두리 없이 만들어줘")).toBe(false);
  });

  it("수정과 생성이 섞이면 보수적으로 수정이 아니라고 본다", () => {
    const text = "집 하나 더 지어주고 광장 길도 고쳐줘";
    expect(hasModifyCue(text)).toBe(true);
    expect(hasCreateCue(text)).toBe(true);
    expect(requestLikelyModifiesExisting(text)).toBe(false);
  });

  it("기존 대상 변경을 기대하는 요청은 생성 금지만으로도 참", () => {
    expect(requestLikelyExpectsExistingChange("새 맵은 만들지 마")).toBe(true);
    expect(requestLikelyExpectsExistingChange("마을 하나 만들어줘")).toBe(false);
  });
});

describe("컨텍스트 footer", () => {
  const footer = "[컨텍스트] 현재 맵: 호숫가 마을 (map_town) · 사용자 선택 영역: (3,4) 10×8";

  it("footer 를 걷어낸다", () => {
    expect(stripContextFooter(`여기 좀 고쳐줘\n\n${footer}`)).toBe("여기 좀 고쳐줘");
  });

  it("footer 의 맵 이름이 의도 스캔에 섞이지 않는다", () => {
    // 맵 이름이 "호숫가 마을" 이어도 생성 표지가 켜지면 안 된다.
    expect(hasCreateCue(`여기 좀 고쳐줘\n\n${footer}`)).toBe(false);
    expect(requestLikelyModifiesExisting(`여기 좀 고쳐줘\n\n${footer}`)).toBe(true);
  });

  it("맵 id 를 파싱한다", () => {
    expect(contextFooterMapId(`고쳐줘\n\n${footer}`)).toBe("map_town");
    expect(contextFooterMapId("[컨텍스트] 현재 맵: 언덕 (map_hill)")).toBe("map_hill");
    expect(contextFooterMapId("[컨텍스트] 현재 맵: 없음")).toBeNull();
    expect(contextFooterMapId("맵 id 없는 평문")).toBeNull();
  });

  it("마지막 footer 를 쓴다", () => {
    const text = "이전\n[컨텍스트] 현재 맵: 옛 맵 (map_old)\n지금\n[컨텍스트] 현재 맵: 새 맵 (map_new)";
    expect(contextFooterMapId(text)).toBe("map_new");
  });
});
