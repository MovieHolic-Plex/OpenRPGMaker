/** @vitest-environment happy-dom */
// 조건 12행을 다 켜 놓고도 "그래서 이 페이지가 언제 보이지?"는 저작자가 머릿속에서
// 조립해야 했다. 켜진 조건을 한 문장으로 되읽어 주는 계약을 고정한다.
//
// 문법 메모: 각 조각은 **명사구**로 끝난다. 그래야 프레임의 "…일 때 보입니다"가
// 어떤 조각 뒤에서도 자연스럽다(켜짐 → 켜짐일 때, 낮 → 낮일 때, 100 이상 → 100 이상일 때).
// 동사 어간으로 만들면 "있" + "을 때"는 되지만 "낮이" + "을 때"가 깨진다.
import { beforeEach, describe, expect, it } from "vitest";
import { pageConditionSentence } from "@/editor/panels/eventEditor/pageConditionSentence";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPageCondition } from "@/project/types";

describe("페이지 조건 문장", () => {
  beforeEach(() => {
    const project = createBlankProject();
    project.switches[0]!.name = "마을 축제 시작";
    project.variables[0]!.name = "명성";
    store.replace(project);
  });

  it("조건이 없으면 항상 보인다고 말한다", () => {
    expect(pageConditionSentence([]).text).toBe("이 페이지는 조건 없이 항상 보입니다.");
  });

  it("스위치 하나를 사람 문장으로 되읽는다", () => {
    const conditions: EventPageCondition[] = [
      { kind: "switch", switchId: store.getCurrent().switches[0]!.id, value: true },
    ];
    expect(pageConditionSentence(conditions).text).toBe(
      "이 페이지는 「마을 축제 시작」 켜짐일 때 보입니다.",
    );
  });

  it("여러 조건을 쉼표로 잇고 모두 참이어야 함을 밝힌다", () => {
    const project = store.getCurrent();
    const conditions: EventPageCondition[] = [
      { kind: "switch", switchId: project.switches[0]!.id, value: false },
      { kind: "variable", variableId: project.variables[0]!.id, op: ">=", value: 100 },
      { kind: "timePhase", phase: "day" },
    ];
    const sentence = pageConditionSentence(conditions);
    expect(sentence.text).toBe(
      "이 페이지는 「마을 축제 시작」 꺼짐, 「명성」 100 이상, 시간대 낮이 모두 맞을 때 보입니다.",
    );
  });

  it("이름 없는 레코드는 번호로 부른다", () => {
    const project = store.getCurrent();
    project.switches[3]!.name = "";
    store.replace(project);
    const conditions: EventPageCondition[] = [
      { kind: "switch", switchId: project.switches[3]!.id, value: true },
    ];
    expect(pageConditionSentence(conditions).text).toContain("0004");
  });

  it("값 조각을 따로 표시해 UI 가 강조할 수 있게 한다", () => {
    const conditions: EventPageCondition[] = [
      { kind: "switch", switchId: store.getCurrent().switches[0]!.id, value: true },
    ];
    const parts = pageConditionSentence(conditions).parts;
    expect(parts.some((part) => part.kind === "value" && part.text.includes("마을 축제 시작"))).toBe(true);
    expect(parts.map((part) => part.text).join("")).toBe(pageConditionSentence(conditions).text);
  });

  // 16종 전부가 문장을 만들어야 한다 — 하나라도 빠지면 그 조건을 켠 저작자에게
  // 문장이 거짓말을 한다(있는 조건을 없는 것처럼 읽힘).
  const everyKind: readonly EventPageCondition[] = [
    { kind: "switch", switchId: "sw_0001", value: true },
    { kind: "variable", variableId: "var_0001", op: "<=", value: 3 },
    { kind: "selfSwitch", key: "A", value: true },
    { kind: "actor", actorId: "act_0001", present: true },
    { kind: "item", itemId: "item_0001", present: false },
    { kind: "gold", op: ">=", amount: 500 },
    { kind: "timer", timerId: "timer1", seconds: 90 },
    { kind: "timePhase", phase: "night" },
    { kind: "season", season: "winter" },
    { kind: "npcActivity", activity: "work" },
    { kind: "friendshipAtLeast", npcKey: "촌장", value: 50 },
    { kind: "battleResult", result: "victory" },
    { kind: "run", query: "active", value: true },
    { kind: "all", conditions: [] },
    { kind: "any", conditions: [] },
    { kind: "not", condition: { kind: "switch", switchId: "sw_0001", value: true } },
  ];

  for (const condition of everyKind) {
    it(`${condition.kind} 조건도 빈 조각 없이 문장이 된다`, () => {
      const sentence = pageConditionSentence([condition]);
      expect(sentence.text.startsWith("이 페이지는 ")).toBe(true);
      expect(sentence.text.endsWith("일 때 보입니다.")).toBe(true);
      // 프레임만 남고 알맹이가 비면 안 된다.
      const inner = sentence.text.slice("이 페이지는 ".length, -"일 때 보입니다.".length);
      expect(inner.trim().length).toBeGreaterThan(0);
      expect(inner).not.toContain("undefined");
      expect(inner).not.toMatch(/\brun\b/);
    });
  }

  it("탐험 조회를 한국어 절로 되읽고 내부 토큰을 드러내지 않는다", () => {
    expect(pageConditionSentence([{ kind: "run", query: "active", value: true }]).text).toBe(
      "이 페이지는 탐험 중일 때 보입니다.",
    );
    expect(pageConditionSentence([{ kind: "run", query: "active", value: false }]).text).toBe(
      "이 페이지는 탐험 중이 아님일 때 보입니다.",
    );
    expect(pageConditionSentence([{ kind: "run", query: "floor", op: ">=", value: 3 }]).text).toBe(
      "이 페이지는 탐험 층 3 이상일 때 보입니다.",
    );
    expect(pageConditionSentence([{ kind: "run", query: "flag", flag: "door", value: true }]).text).toBe(
      "이 페이지는 탐험 기억 「door」 켜짐일 때 보입니다.",
    );
    expect(pageConditionSentence([{ kind: "run", query: "result", result: "completed" }]).text).toBe(
      "이 페이지는 탐험 결과 완료일 때 보입니다.",
    );
    expect(pageConditionSentence([{ kind: "run", query: "result", result: "failed" }]).text).toBe(
      "이 페이지는 탐험 결과 실패일 때 보입니다.",
    );
    expect(pageConditionSentence([{ kind: "run", query: "result", result: "abandoned" }]).text).toBe(
      "이 페이지는 탐험 결과 포기일 때 보입니다.",
    );
  });

  it("아이템 부재는 보유 안 함으로 말한다", () => {
    const itemId = store.getCurrent().database.items[0]!.id;
    expect(pageConditionSentence([{ kind: "item", itemId, present: false }]).text).toContain("보유 안 함");
  });
});
