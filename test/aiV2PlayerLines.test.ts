// 플레이어가 읽는 글은 플레이어에게 쓴 칸과 화면에 뜨는 이름으로만 짓는다 — 설계 칸(action · needs · gives · feeling)은 나가지 않는다.
// 왜(2026-11-12 증기의 심장): 목표 줄 «공업지구로 가려면 어떻게 할지 선택한다(파업 노동자 편 / 공장주 편)», 오프닝 자막 «…오르텐 할멈을 찾아가라는»,
// 잠김 대사 «자동인형 정지가 있어야 할 것 같다», 보상 줄 «『자동인형 정지』를 알아냈다».
import { describe, expect, it } from "vitest";
import { lockedHint, stepGoal, wordlessLine } from "@/ai/v2/story/playerLines";
import { captionLines } from "@/editor/tools/blueprintOpening";
import { normalizeStepText } from "@/project/gameBlueprint";

const step = (kind: "talk" | "find" | "battle" | "puzzle" | "choice" | undefined, event: string, who?: string, place = "황동 광장") =>
  ({ ...(kind ? { kind } : {}), event, ...(who ? { who } : {}), place, action: "공업지구로 가려면 어떻게 할지 선택한다(파업 노동자 편 / 공장주 편)", gives: "공업지구 통행증", feeling: "갈등과 긴장" });

describe("stepGoal — 「현재 목표」 줄", () => {
  it("모델이 쓴 goal 이 있으면 그 글이다(끝 마침표만 뗀다)", () => {
    expect(stepGoal({ ...step("choice", "선장 바르가", "선장 바르가"), text: { goal: "선장 바르가에게 건너갈 길을 구하자." } })).toBe("선장 바르가에게 건너갈 길을 구하자");
  });

  it("goal 이 없으면 단계 종류와 이름으로 짓는다 — action 은 쓰지 않는다", () => {
    expect(stepGoal(step("talk", "오르텐 할멈", "오르텐 할멈"))).toBe("오르텐 할멈에게 말을 걸자");
    expect(stepGoal(step("choice", "선장 바르가", "선장 바르가"))).toBe("선장 바르가와 이야기하고 마음을 정하자");
    expect(stepGoal(step("battle", "폭주 자동인형", "폭주 자동인형"))).toBe("폭주 자동인형을 쓰러뜨리자");
    expect(stepGoal(step("puzzle", "압력 밸브"))).toBe("압력 밸브의 번호를 맞히자");
    expect(stepGoal(step("find", "감시탑 일지"))).toBe("감시탑 일지를 살펴보자");
    // 종류를 적지 않은 옛 청사진: 이벤트 이름의 행동 낱말은 뗀다.
    expect(stepGoal(step(undefined, "책상 조사"))).toBe("책상을 살펴보자");
    for (const kind of ["talk", "find", "battle", "puzzle", "choice", undefined] as const) expect(stepGoal(step(kind, "선장 바르가", "선장 바르가"))).not.toContain("선택한다");
  });
});

describe("lockedHint — 잠긴 단계의 안내", () => {
  it("앞 단계의 사람·물건을 이름으로 가리킨다 — 다른 맵이면 그 맵 이름을 붙인다", () => {
    expect(lockedHint(step("talk", "오르텐 할멈", "오르텐 할멈", "오르텐의 공방"), "운하 부두")).toBe("먼저 오르텐의 공방의 「오르텐 할멈」에게 말을 걸어 보자.");
    expect(lockedHint(step("battle", "폭주 자동인형", "폭주 자동인형", "대심장 기관실"), "대심장 기관실")).toBe("먼저 「폭주 자동인형」을 쓰러뜨려야 한다.");
    expect(lockedHint(step("find", "감시탑 일지", undefined, "굴뚝 공업지구"), "지하 보일러실")).toBe("먼저 굴뚝 공업지구의 「감시탑 일지」를 살펴보자.");
  });

  it("깃발 이름(gives)을 말하지 않는다", () => {
    for (const kind of ["talk", "find", "battle", "puzzle", "choice"] as const) expect(lockedHint(step(kind, "선장 바르가", "선장 바르가"), "굴뚝 공업지구")).not.toContain("통행증");
  });
});

describe("wordlessLine — 대사를 받지 못한 사람 단계", () => {
  it("이름으로만 지은 서술 한 줄이다", () => {
    expect(wordlessLine(step("talk", "오르텐 할멈", "오르텐 할멈"))).toBe("(오르텐 할멈과 이야기를 나누었다.)");
    expect(wordlessLine(step("battle", "폭주 자동인형", "폭주 자동인형"))).toBe("(폭주 자동인형이 앞을 막아선다.)");
  });
});

describe("captionLines — 오프닝 자막", () => {
  it("긴 안내 문장을 자르지 않고 구절 단위로 나눈다(말줄임 없음)", () => {
    const lines = captionLines("밤마다 멈추지 않는 도시의 대심장을 세우기 위해, 사람들의 단서를 모아 기관실의 폭주 기계를 멈춰라.");
    expect(lines).toEqual(["밤마다 멈추지 않는 도시의 대심장을 세우기 위해,", "사람들의 단서를 모아 기관실의 폭주 기계를 멈춰라."]);
    expect(lines.join("")).not.toContain("…");
  });

  it("쉼표 없는 긴 문장은 어절 사이에서 나누고 낱말을 잃지 않는다", () => {
    const text = "아주 오래전 잠든 태양의 피라미드 깊은 곳에 묻힌 별의 조각을 찾아 마을로 돌아가는 길을 스스로 열어야 한다";
    const lines = captionLines(text);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(Array.from(line).length).toBeLessThanOrEqual(46);
    expect(lines.join(" ")).toBe(text);
  });

  it("긴 구절은 고르게 나눈다 — 끝에 낱말 한두 개만 남기지 않는다", () => {
    expect(captionLines("벽돌 거리의 경보를 조사하고 공방과 선착장의 단서를 따라 중앙 기관실에서 폭주 기관을 멈추자."))
      .toEqual(["벽돌 거리의 경보를 조사하고 공방과 선착장의 단서를 따라", "중앙 기관실에서 폭주 기관을 멈추자."]);
  });

  it("짧은 문장은 그대로 한 줄, 숫자·정답이 든 문장은 싣지 않는다", () => {
    expect(captionLines("촌장과 이야기하고 샘을 되살리자.")).toEqual(["촌장과 이야기하고 샘을 되살리자."]);
    expect(captionLines("금고 번호 4729 를 찾아라. 밤의 저택을 빠져나가자.")).toEqual(["밤의 저택을 빠져나가자."]);
    expect(captionLines(undefined)).toEqual([]);
  });
});

describe("단계 글에 남기는 goal · item", () => {
  it("빈 값은 버리고 길이를 자른다", () => {
    expect(normalizeStepText({ goal: "  공방의 오르텐 할멈을 찾아가자 ", item: " 황동 렌치 " })).toEqual({ goal: "공방의 오르텐 할멈을 찾아가자", item: "황동 렌치" });
    expect(normalizeStepText({ goal: " ", item: "" })).toBeUndefined();
  });
});
