// 조수 v2 «적 개성» 검사 — 게임에 나오는 적이 서로 다른 기술을 갖는가.
//
// 왜(2026-11-09 fs-use-tools, 보상 레인 43판 실측): 던전·청사진 빌더가 적을 결정적으로 만들어 주지만 기술은 같은 틀이다
// (해골 기사·살아있는 갑옷이 둘 다 「맹독 이빨」뿐, 보스에 기본 공격만). upsert_enemy·upsert_skill 을 쓰는 판이 0이었다.
// 도구 호출 기록이 아니라 프로젝트 데이터로만 판정한다 — 빌더 적을 upsert_enemy 로 고쳐도 통과로 센다. 전투가 없는 게임은 대상이 아니다.
import type { Project } from "@/project/types";
import { allCommands } from "./combatChecks";
import { tagged, type Finding } from "./finding";

const BOSS_WORDS = /boss|보스|마왕|魔王|드래곤|dragon|용왕|수문장|두목|우두머리|군주/iu;
const isBasicAttack = (skillId: string, name: string): boolean => skillId === "skill_attack" || /_attack$/u.test(skillId) || name === "공격";

/** 그 적의 기술 이름(기본 공격 제외) — 적 개성을 재는 단위. 적을 고르는 쪽(place/placeTheme)도 같은 값으로 고른다. */
export function foeSkillNames(project: Project, enemyId: string | undefined): Set<string> {
  const enemy = project.database.enemies.find((e) => e.id === enemyId);
  const out = new Set<string>();
  for (const skillId of [...(enemy?.skillIds ?? []), ...(enemy?.actions ?? []).map((a) => a.skillId)]) {
    const name = project.database.skills.find((s) => s.id === skillId)?.name ?? skillId;
    if (!isBasicAttack(skillId, name)) out.add(name);
  }
  return out;
}

interface Foe { readonly name: string; boss: boolean; readonly skills: Set<string>; readonly ids: Set<string> }

/** 맵 하나가 부르는 무리 id — 이벤트 전투·무작위 조우표·필드 적 스폰. mapId "common" 은 공용 이벤트(어느 맵인지 모른다). */
function troopIdsByMap(project: Project): Map<string, Set<string>> {
  const byMap = new Map<string, Set<string>>();
  const add = (mapId: string, id: string | undefined) => { if (id) (byMap.get(mapId) ?? byMap.set(mapId, new Set()).get(mapId)!).add(id); };
  for (const { cmd, mapId } of allCommands(project)) if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") add(mapId, cmd.troopId);
  for (const map of Object.values(project.maps)) {
    for (const e of map.encounterTable ?? []) add(map.id, e.troopId);
    for (const id of map.troopIds ?? []) add(map.id, id);
    for (const spawn of map.fieldSpawns ?? []) add(map.id, spawn.troopId);
  }
  return byMap;
}

/** 무리 목록에서 적을 이름으로 묶는다(청사진 길의 사본 enemy_path_* 와 원본은 같은 적) — 기본 공격을 뺀 기술 이름 집합. */
function foesOf(project: Project, troopIds: Iterable<string>): Foe[] {
  const skillName = new Map(project.database.skills.map((s) => [s.id, s.name] as const));
  const enemyById = new Map(project.database.enemies.map((e) => [e.id, e] as const));
  const byName = new Map<string, Foe>();
  for (const troopId of troopIds) {
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

/** 어느 적에게도 없는 쓸 만한 기존 기술(적 대상·피해·기본 공격 아님) 이름 — 안내문에 후보로 보인다. */
function spareSkills(project: Project, taken: ReadonlySet<string>, limit: number): string[] {
  const used = new Set<string>();
  for (const e of project.database.enemies) for (const id of [...e.skillIds, ...e.actions.map((a) => a.skillId)]) used.add(id);
  const out: string[] = [];
  for (const s of project.database.skills) {
    if (out.length >= limit) break;
    if (used.has(s.id) || s.id.startsWith("skill_item_") || isBasicAttack(s.id, s.name) || taken.has(s.name) || s.scope !== "enemy" || !(s.power > 0)) continue;
    out.push(`${s.id}(${s.name})`);
    taken = new Set([...taken, s.name]);
  }
  return out;
}

/**
 * 끝맺음 관문에 올릴 문제(빈 배열이면 통과). 게임을 만드는 요청이고 쓰이는 적이 있을 때만 본다. **맵마다** 본다(2026-11-09 hero-2: 숲 적이 서로 달라
 * 프로젝트 전체 규칙이 안 울렸는데 마왕성의 임프·타락한 기사·중간 보스는 기술이 같았다).
 * ① 보스가 그 맵의 일반 적 기술과 겹치지 않는 자기 기술이 없다. ② 일반 적이 2종 이상인데 어느 한 종도 다른 종에 없는 기술을 못 가졌다(기본 공격 제외, 이름 기준).
 * 안내문은 적 id 와 아직 쓰이지 않은 기존 기술 후보를 보여 upsert_enemy 한 번(적마다)으로 풀리게 한다 — upsert_skill 은 새 기술이 필요할 때만.
 * 실측: 안내문이 upsert_skill 부터 시킨 판은 스키마 오류 6번에 막혔다(upsert_enemy 는 한 번도 안 불렸다).
 */
export function enemyIdentityProblems(project: Project): Finding[] {
  const problems: Finding[] = [];
  const seen = new Set<string>();
  for (const [mapId, troopIds] of troopIdsByMap(project)) {
    const foes = foesOf(project, troopIds);
    if (!foes.length) continue;
    const where = mapId === "common" ? "공용 이벤트" : `「${project.maps[mapId]?.name ?? mapId}」`;
    const mobs = foes.filter((f) => !f.boss);
    const mobSkills = new Set(mobs.flatMap((f) => [...f.skills]));
    const flatBosses = foes.filter((f) => f.boss && ![...f.skills].some((s) => !mobSkills.has(s)));
    const key = (f: Foe) => [...f.ids][0]!;
    const fresh = (taken: ReadonlySet<string>) => spareSkills(project, taken, 3);
    const fix = (ids: string, taken: ReadonlySet<string>) => {
      const spare = fresh(taken);
      return `upsert_enemy{enemy:{id:${ids}, skillIds:[…기존 기술 id…], actions:[…]}} 로 기술을 바꿔 준다${spare.length ? ` — 기존 기술 후보: ${spare.join(", ")}` : " — 맞는 기존 기술이 없으면 그때 upsert_skill"}`;
    };
    const flatKey = flatBosses.map(key).join(",");
    if (flatBosses.length && !seen.has(`b:${flatKey}`)) {
      seen.add(`b:${flatKey}`);
      problems.push(tagged("game", "적 개성", `${where} 보스 ${flatBosses.slice(0, 3).map((f) => `「${f.name}」(${key(f)})`).join(", ")} 이 그 맵 일반 적과 겹치지 않는 자기 기술이 없다(기본 공격뿐이거나 졸개와 같은 기술) — ${fix(flatBosses.slice(0, 3).map(key).join("|"), mobSkills)}.`, { variant: "flat-boss" }));
    }
    const ownSkill = (f: Foe) => [...f.skills].some((s) => mobs.every((o) => o === f || !o.skills.has(s)));
    const lacking = mobs.length >= 2 ? mobs.filter((f) => !ownSkill(f)) : [];
    if (lacking.length >= 1) {
      const dup = lacking.slice(0, 3);
      const k = `m:${dup.map(key).join(",")}`;
      if (!seen.has(k)) {
        seen.add(k);
        problems.push(tagged("game", "적 개성", `${where} 일반 적 ${mobs.length}종 중 ${dup.map((f) => `「${f.name}」(${key(f)})`).join(", ")} 은 다른 적이 안 가진 자기 기술이 없다(기술이 같거나 다른 적의 일부뿐) — 적 종류마다 자기 기술 하나는 있어야 한다. ${fix(dup.slice(0, 2).map(key).join("|"), new Set(foes.flatMap((f) => [...f.skills])))}.`, { variant: "same-mobs" }));
      }
    }
  }
  return problems;
}
