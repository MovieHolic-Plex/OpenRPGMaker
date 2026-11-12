// 편집기의 명령 모양 거절은 event_command_assist 를 권하는데 조수 v2 에는 그 도구가 없다 —
// 2026-11-12 Haiku 깔기 prison: patch_event_page 거절 글대로 불렀다가 «there is no tool named "event_command_assist"» 를 받고 항목을 막았다.
// v2 가 모델에게 싣는 사본(loop/failureText.ts)은 v2 에 있는 길(get_event · add_event)을 이른다.
import { describe, expect, it } from "vitest";
import { englishToolMessage } from "@/ai/v2/loop/failureText";
import { LOW_LEVEL_COMMAND_SHAPE_HINT } from "@/editor/tools/commandArgs";

describe("명령 모양 거절의 v2 사본", () => {
  const cases = [
    `커맨드 형식 오류:\n- ev_pit_1.ev_pit_1_p.commands[0].kind: 기대 형식 string, 실제 타입 undefined\n${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
    `커맨드 형식 오류: command ev_foe1.ev_foe1_fight.commands[0]: 알 수 없는 kind: battle — did you mean: tacticsBattle, battleProcessing, wait? (full list and shapes: event_command_assist). ${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
    `커맨드 형식 오류: ev_cart_b.ev_cart_b_p.commands[0].options가 배열이 아닙니다.. ${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
    `커맨드 형식 오류: ev_cart_b.ev_cart_b_p.commands[1].options[0].text가 문자열이 아닙니다.. ${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
  ];

  it("v2 에 없는 도구를 이르지 않고, 지금 명령을 읽는 길과 예시를 준다", () => {
    for (const message of cases) {
      const en = englishToolMessage(message);
      expect(en).not.toContain("event_command_assist");
      expect(en.startsWith("Command shape error: ")).toBe(true);
      expect(en).toContain("get_event(");
      expect(en).toContain("add_event");
      expect(en).toContain('{"commands":[{"kind":"text"');
    }
  });

  it("무엇이 틀렸는지는 영어로 남긴다", () => {
    expect(englishToolMessage(cases[0]!)).toContain("commands[0].kind: expected string, got undefined");
    expect(englishToolMessage(cases[1]!)).toContain("unknown kind: battle — did you mean: tacticsBattle, battleProcessing, wait?");
    expect(englishToolMessage(cases[2]!)).toContain("commands[0].options must be an array");
    expect(englishToolMessage(cases[3]!)).toContain("options[0].text must be a string");
  });

  it("다른 거절 글은 그대로다", () => {
    expect(englishToolMessage("트룹에는 최소 1마리의 적이 있어야 합니다")).toContain("A troop needs at least one enemy");
    expect(englishToolMessage("알 수 없는 무언가가 잘못됐다")).toBe("Tool said (Korean): 알 수 없는 무언가가 잘못됐다");
  });
});
