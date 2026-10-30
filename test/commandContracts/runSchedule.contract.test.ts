// test/commandContracts/runSchedule.contract.test.ts
// G4 계약: runSchedule (저장된 주간 계획을 슬롯 순서대로 실행).
//
// 실측 메모:
// - 슬롯마다 slotVariableId(1부터)를 쓰고, 그 활동의 공용 이벤트를 부르고, session.scheduleUses 를 1 올린다.
// - 공용 이벤트가 끝나면 같은 명령으로 돌아와 다음 슬롯을 실행한다. 마지막 슬롯 뒤 session.scheduleRun 은 지워진다.
// - 계획에 없는/없어진 활동 슬롯은 건너뛴다. 계획이 비었으면 아무것도 하지 않고 다음 명령으로 진행한다.
// - 존재하지 않는 scheduleId·slotVariableId 참조는 deserialize 의 참조 검증이 막는다.
import { describe, expect, it } from "vitest";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

const run: Extract<Command, { kind: "runSchedule" }> = {
  kind: "runSchedule",
  scheduleId: "schedule_contract",
  slotVariableId: "var_slot",
};

function registerSchedule(project: Project): void {
  project.variables.push({ id: "var_slot", name: "slot" }, { id: "var_log", name: "log" });
  project.commonEvents.push({ id: "ce_study", name: "study", trigger: "none", commands: [] });
  project.commonEvents.push({ id: "ce_rest", name: "rest", trigger: "none", commands: [] });
  project.database.schedules = [
    {
      id: "schedule_contract",
      title: "한 주",
      slots: [{ label: "월" }, { label: "화" }],
      activities: [
        { id: "study", label: "공부", description: "", commonEventId: "ce_study" },
        { id: "rest", label: "휴식", description: "", commonEventId: "ce_rest" },
      ],
    },
  ];
}

/** 두 공용 이벤트가 각자 흔적(var_log=1, 스위치 rested)을 남긴다. */
function seed(plan: string[] | undefined) {
  return (session: PlaySessionLike) => {
    session.commonEvents = [
      { id: "ce_study", commands: [{ kind: "setVariable", variableId: "var_log", op: "=", value: 1 }] },
      { id: "ce_rest", commands: [{ kind: "setSwitch", switchId: "rested", value: true }] },
    ];
    if (plan) session.schedulePlans = { schedule_contract: plan };
  };
}

describe("runSchedule 계약", () => {
  it("정상 효과: 두 슬롯의 공용 이벤트를 순서대로 부르고 슬롯 변수·사용 횟수를 갱신한다", () => {
    const result = runCommandContract(
      [run, { kind: "setSwitch", switchId: "after_run", value: true }],
      { mutateProject: registerSchedule, mutateSession: seed(["study", "rest"]) },
    );
    expect(result.session.variables.var_log).toBe(1);
    expect(result.session.switches.rested).toBe(true);
    expect(result.session.variables.var_slot).toBe(2);
    expect(result.session.scheduleUses).toEqual({ schedule_contract: { study: 1, rest: 1 } });
    expect(result.session.scheduleRun).toBeUndefined();
    expect(result.session.switches.after_run).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("같은 활동을 두 번 고르면 사용 횟수가 2가 되고 슬롯 변수는 1,2 로 간다", () => {
    const result = runCommandContract([run], { mutateProject: registerSchedule, mutateSession: seed(["study", "study"]) });
    expect(result.session.scheduleUses).toEqual({ schedule_contract: { study: 2 } });
    expect(result.session.variables.var_slot).toBe(2);
    expect(result.finished).toBe(true);
  });

  it("경계: 계획이 없거나 비면 아무것도 실행하지 않고 다음 명령으로 진행한다", () => {
    for (const plan of [undefined, []]) {
      const result = runCommandContract(
        [run, { kind: "setSwitch", switchId: "after_run", value: true }],
        { mutateProject: registerSchedule, mutateSession: seed(plan) },
      );
      expect(result.session.scheduleUses).toBeUndefined();
      expect(result.session.scheduleRun).toBeUndefined();
      expect(result.session.switches.after_run).toBe(true);
      expect(result.finished).toBe(true);
    }
  });

  it("결측: 계획에 있던 활동이 일정표에서 없어졌으면 그 슬롯은 건너뛴다", () => {
    const result = runCommandContract([run], { mutateProject: registerSchedule, mutateSession: seed(["gone", "rest"]) });
    expect(result.session.switches.rested).toBe(true);
    expect(result.session.scheduleUses).toEqual({ schedule_contract: { rest: 1 } });
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후에도 명령과 결과가 같다", () => {
    const commands: Command[] = [run];
    const options = { mutateProject: registerSchedule, mutateSession: seed(["study", "rest"]) };
    const original = runCommandContract(commands, options);
    const restoredCommands = roundtripCommands(commands, registerSchedule);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, options);
    expect(restored.session).toEqual(original.session);
  });

  it("참조 무결성: 없는 scheduleId·slotVariableId 는 deserialize 가 거부한다", () => {
    expect(() => roundtripCommands([{ kind: "runSchedule", scheduleId: "schedule_missing" }], registerSchedule))
      .toThrow(/runSchedule.*schedule_missing/);
    expect(() => roundtripCommands([{ kind: "runSchedule", scheduleId: "schedule_contract", slotVariableId: "var_missing" }], registerSchedule))
      .toThrow(/runSchedule.*var_missing/);
  });
});
