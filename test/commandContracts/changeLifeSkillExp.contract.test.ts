// test/commandContracts/changeLifeSkillExp.contract.test.ts
// 계약: changeLifeSkillExp (생활 스킬 XP). system.skillSystem.enabled 옵트인 게이트를 포함한다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

const SKILL_ID = "skill_farming";
const REWARD_SWITCH = "sw_farming_lv2";

function enableSkillSystem(project: Project): void {
  project.system.skillSystem = { enabled: true };
  project.database.lifeSkills = [
    {
      id: SKILL_ID,
      name: "농사",
      skillType: "farming",
      maxLevel: 10,
      levelUpRewards: [{ level: 2, switchId: REWARD_SWITCH }],
    },
  ];
  project.switches.push({ id: REWARD_SWITCH, name: "농사 레벨 2" });
}

function withSkillsButDisabled(project: Project): void {
  enableSkillSystem(project);
  delete project.system.skillSystem;
}

describe("changeLifeSkillExp 계약", () => {
  it("정상 효과: XP 를 누적하고 레벨을 갱신한다", () => {
    const result = runCommandContract(
      [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 100 }],
      { mutateProject: enableSkillSystem }
    );

    expect(result.session.lifeSkills?.[SKILL_ID]).toEqual({ xp: 100, level: 2 });
    expect(result.finished).toBe(true);
  });

  it("레벨업 보상 스위치가 켜진다", () => {
    const result = runCommandContract(
      [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 250 }],
      { mutateProject: enableSkillSystem }
    );

    expect(result.session.switches[REWARD_SWITCH]).toBe(true);
  });

  it("XP 는 0 미만으로 내려가지 않는다", () => {
    const result = runCommandContract(
      [
        { kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "=", amount: 50 },
        { kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "-=", amount: 999 },
      ],
      { mutateProject: enableSkillSystem }
    );

    expect(result.session.lifeSkills?.[SKILL_ID]).toEqual({ xp: 0, level: 1 });
  });

  // 회귀: 게이트를 읽는 코드가 없어 "opt-in" 문서와 달리 항상 동작했다.
  it("옵트인 게이트: skillSystem 이 꺼져 있으면 세션을 변경하지 않는다", () => {
    const result = runCommandContract(
      [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 100 }],
      { mutateProject: withSkillsButDisabled }
    );

    expect(result.session.lifeSkills?.[SKILL_ID]).toBeUndefined();
    expect(result.session.switches[REWARD_SWITCH]).not.toBe(true);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands: Command[] = [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 120 }];

    const original = runCommandContract(commands, { mutateProject: enableSkillSystem });
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { mutateProject: enableSkillSystem });

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract(
      [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 1 }],
      { mutateProject: enableSkillSystem }
    );

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
