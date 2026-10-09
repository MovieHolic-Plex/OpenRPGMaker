// test/commandContracts/learnSkill.contract.test.ts
// G1 계약: learnSkill (스펙 §5.3 행 — "액터 스킬 목록에 추가(중복 없음)").
//
// 실측 메모 (§3 이탈 프로토콜):
// - §5 표 초안은 "없는 actor/skill → warn + 스킵"이라 했으나, 실제 구현(project/session.ts
//   learnSkill)은 세션 레벨 기록만 하고 프로젝트 DB 를 조회하지 않는다 → 존재하지 않는
//   actorId/skillId 도 경고 없이 그대로 기록된다(크래시 없음). 케이스 2는 실측 동작을 고정하고,
//   표와의 차이는 보고서 "표 대조 결과"에 기록한다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

// 하네스의 기본 프로젝트(createBlankProject)와 같은 DB 에서 유효 id 를 얻는다.
function validIds(): { actorId: string; skillId: string } {
  const project = createBlankProject();
  const actorId = project.database.actors[0]?.id;
  const skillId = project.database.skills[0]?.id;
  if (!actorId || !skillId) throw new Error("blank project 에 actor/skill 이 있어야 한다");
  return { actorId, skillId };
}

describe("learnSkill 계약", () => {
  it("정상 효과: 액터 스킬 목록에 추가되고, 같은 스킬을 다시 배워도 중복되지 않는다", () => {
    const { actorId, skillId } = validIds();
    const commands: Command[] = [
      { kind: "learnSkill", actorId, skillId },
      { kind: "learnSkill", actorId, skillId }, // 중복 습득 시도
    ];

    const result = runCommandContract(commands, {
      mutateSession: (session) => {
        session.partyActorIds = [actorId];
      },
    });

    expect(result.session.actorSkillIds?.[actorId]).toEqual([skillId]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("여러 스킬은 습득 순서대로 누적된다", () => {
    const { actorId } = validIds();
    const project = createBlankProject();
    const skillIds = project.database.skills.slice(0, 2).map((skill) => skill.id);
    expect(skillIds.length).toBe(2);

    const result = runCommandContract(
      skillIds.map((skillId) => ({ kind: "learnSkill", actorId, skillId }) satisfies Command)
    );

    expect(result.session.actorSkillIds?.[actorId]).toEqual(skillIds);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 actor/skill 이어도 크래시 없이 진행된다 — 실측: 경고 없이 세션에 기록(§5 표 초안은 warn+스킵)", () => {
    const result = runCommandContract([
      { kind: "learnSkill", actorId: "actor_missing", skillId: "skill_missing" },
      { kind: "setSwitch", switchId: "after_learn", value: true },
    ]);

    // 크래시 없이 다음 명령까지 진행.
    expect(result.session.switches.after_learn).toBe(true);
    expect(result.finished).toBe(true);
    // 실측 고정: DB 검증이 없어 경고가 발생하지 않고, 미지의 id 가 그대로 기록된다.
    expect(result.warnings).toEqual([]);
    expect(result.session.actorSkillIds?.actor_missing).toEqual(["skill_missing"]);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const { actorId, skillId } = validIds();
    const commands: Command[] = [{ kind: "learnSkill", actorId, skillId }];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: learnSkill 은 non-blocking — pause 가 발생하지 않는다", () => {
    const { actorId, skillId } = validIds();
    const result = runCommandContract([{ kind: "learnSkill", actorId, skillId }]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
