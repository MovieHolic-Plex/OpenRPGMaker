// 조수 v2 «적 개성» 검사 — 게임에 나오는 적이 서로 다른 기술을 갖는가.
//
// 왜(2026-11-09 fs-use-tools, 보상 레인 43판 실측): 던전·청사진 빌더가 적을 결정적으로 만들어 주지만 기술은 같은 틀이다
// (해골 기사·살아있는 갑옷이 둘 다 「맹독 이빨」뿐, 보스에 기본 공격만). upsert_enemy·upsert_skill 을 쓰는 판이 0이었다.
// 도구 호출 기록이 아니라 프로젝트 데이터로만 판정한다 — 빌더 적을 upsert_enemy 로 고쳐도 통과로 센다. 전투가 없는 게임은 대상이 아니다.
import type { Project } from "@/project/types";
import { allCommands } from "./combatChecks";

const BOSS_WORDS = /boss|보스|마왕|魔王|드래곤|dragon|용왕|수문장|두목|우두머리|군주/iu;
const isBasicAttack = (skillId: string, name: string): boolean => skillId === "skill_attack" || /_attack$/u.test(skillId) || name === "공격";

/** 전투가 실제로 쓰는 무리 id — 이벤트 전투·무작위 조우표·필드 적 스폰. */
function troopIdsInUse(project: Project): Set<string> {
  const ids = new Set<string>();
  for (const { cmd } of allCommands(project)) if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") ids.add(cmd.troopId);
  for (const map of Object.values(project.maps)) {
    for (const e of map.encounterTable ?? []) if (e.troopId) ids.add(e.troopId);
    for (const id of map.troopIds ?? []) ids.add(id);
    for (const spawn of map.fieldSpawns ?? []) if (spawn.troopId) ids.add(spawn.troopId);
  }
  return ids;
}

interface Foe { readonly name: string; boss: boolean; readonly skills: Set<string>; readonly ids: Set<string> }

/** 쓰이는 적을 이름으로 묶는다(청사진 길의 사본 enemy_path_* 와 원본은 같은 적) — 기본 공격을 뺀 기술 이름 집합. */
function foesInUse(project: Project): Foe[] {
  const skillName = new Map(project.database.skills.map((s) => [s.id, s.name] as const));
  const enemyById = new Map(project.database.enemies.map((e) => [e.id, e] as const));
  const byName = new Map<string, Foe>();
  for (const troopId of troopIdsInUse(project)) {
    const troop = project.database.troops.find((t) => t.id === troopId);
    if (!troop) continue;
    const bossTroop = BOSS_WORDS.test(troop.name);
    for (const enemyId of troop.members?.map((m) => m.enemyId) ?? troop.enemyIds) {
      const enemy = enemyById.get(enemyId);
      if (!enemy) continue;
      const foe = byName.get(enemy.name) ?? { name: enemy.name, boss: false, skills: new Set<string>(), ids: new Set<string>() };
      const boss = bossTroop || BOSS_WORDS.test(`${enemy.id} ${enemy.name}`) || enemy.collapseEffect === "bossSink";
      foe.boss = foe.boss || boss;
      byName.set(enemy.name, foe);
      foe.ids.add(enemy.id);
      for (const skillId of [...enemy.skillIds, ...enemy.actions.map((a) => a.skillId)]) {
        const name = skillName.get(skillId) ?? skillId;
        if (!isBasicAttack(skillId, name)) foe.skills.add(name);
      }
    }
  }
  return [...byName.values()];
}

const same = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * 끝맺음 관문에 올릴 문제(빈 배열이면 통과). 게임을 만드는 요청이고 쓰이는 적이 있을 때만 본다.
 * ① 보스가 기본 공격 말고 자기 기술이 없다. ② 보스가 아닌 적이 2종 이상인데 기술이 전부 같다(기본 공격 제외, 이름 기준).
 */
export function enemyIdentityProblems(project: Project): string[] {
  const foes = foesInUse(project);
  if (!foes.length) return [];
  const problems: string[] = [];
  const how = "upsert_skill 로 그 적다운 기술(이름·효과·약점)을 만들고 upsert_enemy{enemy:{id, skillIds, actions}} 로 걸어 준다";
  const flatBosses = foes.filter((f) => f.boss && !f.skills.size);
  if (flatBosses.length) problems.push(`[게임 검사 적 개성] 보스 ${flatBosses.slice(0, 3).map((f) => `「${f.name}」(${[...f.ids][0]})`).join(", ")} 이 기본 공격뿐이다 — 보스는 자기 기술이 있어야 한다. ${how}.`);
  const mobs = foes.filter((f) => !f.boss);
  if (mobs.length >= 2 && mobs.every((f) => same(f.skills, mobs[0]!.skills))) {
    problems.push(`[게임 검사 적 개성] 일반 적 ${mobs.length}종(${mobs.slice(0, 3).map((f) => `「${f.name}」`).join(", ")})의 기술이 모두 같다(${mobs[0]!.skills.size ? [...mobs[0]!.skills].join("·") : "기본 공격뿐"}) — 적 종류마다 다른 기술 하나는 있어야 한다. ${how}.`);
  }
  return problems;
}
