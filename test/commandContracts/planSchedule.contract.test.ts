// test/commandContracts/planSchedule.contract.test.ts
// G4 계약: planSchedule (주간 일정표 — 슬롯마다 활동 고르기).
//
// 실측 메모:
// - 재개 값은 고른 활동 id 배열. 보이지 않는 활동·모르는 id·문자열이 아닌 값은 걸러지고, 슬롯 수를 넘기지 않는다.
// - 고른 목록은 session.schedulePlans[scheduleId] 에 저장된다(빈 선택도 빈 배열로 저장).
// - 없는 일정표(또는 슬롯 0개)는 pause 없이 warn 후 다음 명령으로 진행한다.
// - 존재하지 않는 scheduleId 참조는 deserialize 의 참조 검증이 막는다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

const plan: Extract<Command, { kind: "planSchedule" }> = { kind: "planSchedule", scheduleId: "schedule_contract" };

function registerSchedule(project: Project): void {
  project.switches.push({ id: "sw_secret", name: "secret" });
  project.commonEvents.push({ id: "ce_study", name: "study", trigger: "none", commands: [] });
  project.commonEvents.push({ id: "ce_rest", name: "rest", trigger: "none", commands: [] });
  project.database.schedules = [
    {
      id: "schedule_contract",
      title: "한 주",
      slots: [{ label: "월" }, { label: "화" }],
      activities: [
        { id: "study", label: "공부", description: "책을 읽는다", commonEventId: "ce_study" },
        { id: "rest", label: "휴식", description: "쉰다", commonEventId: "ce_rest", maxUses: 1 },
        {
          id: "secret",
          label: "비밀 훈련",
          description: "조건부",
          commonEventId: "ce_study",
          condition: { kind: "switch", switchId: "sw_secret", value: true },
        },
        { id: "extra", label: "여분", description: "넷째 활동", commonEventId: "ce_rest" },
      ],
    },
  ];
}

describe("planSchedule 계약", () => {
  it("정상 효과: pause 로 뷰를 내고, 고른 활동 id 를 session.schedulePlans 에 저장한다", () => {
    const result = runCommandContract([plan], { mutateProject: registerSchedule, answers: [["study", "rest"]] });
    expect(result.pauses).toEqual([
      expect.objectContaining({
        kind: "planSchedule",
        view: expect.objectContaining({
          scheduleId: "schedule_contract",
          slots: ["월", "화"],
          activities: [
            expect.objectContaining({ id: "study" }),
            expect.objectContaining({ id: "rest", remaining: 1 }),
            expect.objectContaining({ id: "extra" }),
          ],
        }),
      }),
    ]);
    expect(result.session.schedulePlans).toEqual({ schedule_contract: ["study", "rest"] });
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("조건이 거짓인 활동은 숨겨지고, 골라도 무시된다", () => {
    const result = runCommandContract([plan], { mutateProject: registerSchedule, answers: [["secret", "study"]] });
    expect(result.session.schedulePlans).toEqual({ schedule_contract: ["study"] });
  });

  it("틀린 입력: 모르는 id·문자열 아닌 값·슬롯 초과는 걸러진다", () => {
    const result = runCommandContract([plan], {
      mutateProject: registerSchedule,
      answers: [["nope", 7, "study", "extra", "study"]],
    });
    expect(result.session.schedulePlans).toEqual({ schedule_contract: ["study", "extra"] });
    expect(result.finished).toBe(true);
  });

  it("경계: 취소(배열 아님)는 빈 계획으로 저장하고, slotCount 는 칩 수를 줄인다", () => {
    const empty = runCommandContract([plan], { mutateProject: registerSchedule, answers: [undefined] });
    expect(empty.session.schedulePlans).toEqual({ schedule_contract: [] });
    expect(empty.finished).toBe(true);

    const limited = runCommandContract([{ ...plan, slotCount: 1 }], {
      mutateProject: registerSchedule,
      answers: [["study", "extra"]],
    });
    expect(limited.pauses[0]).toEqual(expect.objectContaining({ view: expect.objectContaining({ slots: ["월"] }) }));
    expect(limited.session.schedulePlans).toEqual({ schedule_contract: ["study"] });
  });

  it("결측 참조: 없는 일정표는 pause 없이 건너뛴다", () => {
    const result = runCommandContract([{ kind: "planSchedule", scheduleId: "schedule_missing" }, { kind: "setSwitch", switchId: "after", value: true }]);
    expect(result.pauses).toEqual([]);
    expect(result.session.switches.after).toBe(true);
    expect(result.session.schedulePlans).toBeUndefined();
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후에도 명령과 결과가 같다", () => {
    const commands: Command[] = [{ ...plan, slotCount: 2 }];
    const original = runCommandContract(commands, { mutateProject: registerSchedule, answers: [["study", "rest"]] });
    const restoredCommands = roundtripCommands(commands, registerSchedule);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { mutateProject: registerSchedule, answers: [["study", "rest"]] });
    expect(restored.session).toEqual(original.session);
    expect(restored.pauses).toEqual(original.pauses);
  });

  it("참조 무결성: 없는 scheduleId 는 deserialize 가 거부한다", () => {
    expect(() => roundtripCommands([{ kind: "planSchedule", scheduleId: "schedule_missing" }], registerSchedule))
      .toThrow(/planSchedule.*schedule_missing/);
  });
});
