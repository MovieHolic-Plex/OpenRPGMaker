import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { normalizeLifeSkillRecord, levelForXp, MAX_LIFE_SKILL_LEVEL } from "@/project/skillModel";
import { createInterpreter } from "@/player/interpreter";
import { startSession, type PlaySession } from "@/project/session";
import type { LifeSkillRecord, Project } from "@/project/types";

function roundTrip(project: Project): Project {
  return deserialize(serialize(project));
}

function projectWithFarmingSkill(): Project {
  const project = createBlankProject();
  project.database.lifeSkills = [
    { id: "skill_farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 2, switchId: "sw_farming_lv2" }] },
  ];
  project.switches.push({ id: "sw_farming_lv2", name: "농사 레벨 2" });
  return project;
}

function runLifeSkillExp(project: Project, session: PlaySession, amount: number): void {
  const interpreter = createInterpreter(
    [{ kind: "changeLifeSkillExp", skillId: "skill_farming", op: "+=", amount }],
    session,
    project
  );
  interpreter.start();
}

describe("생활 스킬 시스템", () => {
  // 회귀: normalizeSystemRecords 가 화이트리스트 방식이라 skillSystem 이 목록에 없으면
  // 사용자가 켠 플래그가 저장/로드 1회 왕복에 조용히 사라졌다.
  it("skillSystem 플래그가 저장/로드 왕복에서 보존된다", () => {
    const project = createBlankProject();
    project.system.skillSystem = { enabled: true };
    expect(roundTrip(project).system.skillSystem?.enabled).toBe(true);
  });

  it("skillSystem 미설정이면 JSON 에 생략된다(기본 계약)", () => {
    expect(roundTrip(createBlankProject()).system.skillSystem).toBeUndefined();
  });

  it("lifeSkills 레코드가 저장/로드 왕복에서 정규화되어 보존된다", () => {
    const project = createBlankProject();
    project.database.lifeSkills = [
      { id: "skill_farming", name: "  농사  ", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 2, switchId: "sw_lv2" }] },
    ];
    expect(roundTrip(project).database.lifeSkills?.[0]).toMatchObject({
      id: "skill_farming",
      name: "농사",
      skillType: "farming",
      maxLevel: 10,
    });
  });

  it("잘못된 skillType 과 빈 이름은 정규화된다", () => {
    const record = normalizeLifeSkillRecord({ id: "s1", name: "   ", skillType: "alchemy" as never, maxLevel: 0 });
    expect(record.skillType).toBe("farming");
    expect(record.name).toBe("스킬");
  });

  // 회귀: maxLevel 은 1..100 으로 정규화됐지만 XP 테이블은 10단계뿐이라
  // maxLevel 50 레코드가 영원히 레벨 10 에 머물렀다(스키마/런타임 불일치).
  it("maxLevel 은 XP 곡선이 지원하는 상한을 넘지 않는다", () => {
    const record = normalizeLifeSkillRecord({ id: "s1", name: "농사", maxLevel: 50 });
    expect(record.maxLevel).toBe(MAX_LIFE_SKILL_LEVEL);
    expect(levelForXp(999_999, record.maxLevel)).toBe(record.maxLevel);
  });

  it("도달 불가능한 레벨의 보상은 maxLevel 로 클램프된다", () => {
    const input = { id: "s1", name: "농사", maxLevel: 5, levelUpRewards: [{ level: 99, switchId: "sw_x" }] };
    const record = normalizeLifeSkillRecord(input as Partial<LifeSkillRecord> & Pick<LifeSkillRecord, "id" | "name">);
    expect(record.levelUpRewards[0]?.level).toBe(5);
  });

  it("switchId·recipeId 가 모두 없는 보상은 버려진다", () => {
    const record = normalizeLifeSkillRecord({ id: "s1", name: "농사", levelUpRewards: [{ level: 2 }] });
    expect(record.levelUpRewards).toHaveLength(0);
  });

  it("changeLifeSkillExp 명령으로 XP를 증가시키고 레벨업 시 스위치가 켜진다", () => {
    const project = projectWithFarmingSkill();
    project.system.skillSystem = { enabled: true };
    const session = startSession(project, 1);
    runLifeSkillExp(project, session, 100);
    expect(session.lifeSkills!.skill_farming.xp).toBe(100);
    expect(session.lifeSkills!.skill_farming.level).toBe(2);
    expect(session.switches.sw_farming_lv2).toBe(true);
  });

  // 회귀: "opt-in" 이라 문서화됐지만 게이트를 읽는 코드가 없어 플래그와 무관하게 동작했다.
  it("skillSystem 이 꺼져 있으면 changeLifeSkillExp 는 아무 일도 하지 않는다", () => {
    const project = projectWithFarmingSkill();
    const session = startSession(project, 1);
    runLifeSkillExp(project, session, 100);
    expect(session.lifeSkills?.skill_farming).toBeUndefined();
    // 세션 시작 시 선언된 스위치는 false 로 초기화된다 — 켜지지 않았음을 확인.
    expect(session.switches.sw_farming_lv2).toBe(false);
  });
});
