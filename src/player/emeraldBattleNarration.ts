import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import { withJosa } from "@/util/josa";

/**
 * 에메랄드 참고 프로필의 전투 문장(3세대 문법). 일반 포켓몬 스킨·RPG 스킨의 문장 계약은 건드리지 않는다.
 *
 * - 피해 숫자를 말하지 않는다 — 양은 HP 바가 센다. 「새싹토가 3 피해를 입었다!」가 반쪽 창에서 세 줄로 접혀
 *   첫 줄이 잘렸다(2026-10-07 플레이 영상).
 * - 상대는 「야생 ○○」·「상대 ○○」로 부른다. 「적의 공격!」은 RPG 문장이다.
 * - 결과는 패널이 아니라 문장 창 몇 쪽(경험치·레벨·기술·상금)이다.
 */
export function emeraldNarrationActive(): boolean {
  return isEmeraldMonsterStyle(store.getCurrent());
}

export function emeraldTrainerTroop(snapshot: Pick<BattleSnapshot, "troopId">): { readonly name: string } | undefined {
  const troop = store.getCurrent().database.troops.find((entry) => entry.id === snapshot.troopId);
  return troop?.trainerBattle === true ? { name: troop.name } : undefined;
}

/** 상대 몬스터 호칭. 아군이면 이름 그대로. */
export function emeraldBattlerName(battler: BattleBattlerSnapshot | undefined, snapshot: BattleSnapshot): string {
  if (!battler) return "상대";
  const isEnemy = [...snapshot.enemies, ...(snapshot.departedEnemies ?? [])].some((enemy) => enemy.id === battler.id)
    && !snapshot.actors.some((actor) => actor.id === battler.id);
  if (!isEnemy) return battler.name;
  return `${emeraldTrainerTroop(snapshot) ? "상대" : "야생"} ${battler.name}`;
}

export function emeraldMoveLine(userName: string, skillName: string | undefined): string {
  return skillName && skillName !== "공격" ? `${userName}의 ${skillName}!` : `${userName}의 몸통박치기!`;
}

/** 기술 결과 한 줄. 보통 명중이면 빈 문자열(HP 바가 말한다). */
export function emeraldOutcomeLine(input: {
  readonly hit: boolean;
  readonly amount: number;
  readonly critical?: boolean;
  readonly effectiveness?: number;
  readonly healing?: boolean;
  readonly targetName: string;
}): string {
  if (!input.hit) return "그러나 공격은 빗나갔다!";
  if (input.healing) return `${withJosa(input.targetName, "은/는")} 체력을 회복했다!`;
  if (input.effectiveness === 0) return `${input.targetName}에게는 효과가 없는 것 같다…`;
  const phrase = input.effectiveness === undefined || input.effectiveness === 1 ? ""
    : input.effectiveness > 1 ? "효과가 굉장했다!" : "효과가 별로인 듯하다…";
  if (input.critical && input.amount > 0) return phrase ? `급소에 맞았다! ${phrase}` : "급소에 맞았다!";
  return input.amount > 0 ? phrase : "";
}

export function emeraldFaintLine(target: BattleBattlerSnapshot, snapshot: BattleSnapshot): string {
  return `${withJosa(emeraldBattlerName(target, snapshot), "은/는")} 쓰러졌다!`;
}

export function emeraldTrainerSendOutLine(trainerName: string, monsterName: string): string {
  return `${withJosa(trainerName, "은/는")} ${withJosa(monsterName, "을/를")} 내보냈다!`;
}

export function emeraldIntroSendOut(snapshot: BattleSnapshot): string | undefined {
  const trainer = emeraldTrainerTroop(snapshot);
  const first = snapshot.enemies.find((enemy) => !enemy.defeated);
  return trainer && first ? emeraldTrainerSendOutLine(trainer.name, first.name) : undefined;
}

export type EmeraldResultRow = { readonly kind: string; readonly label: string; readonly value: string };

/** 승리·패배를 문장 창 쪽들로. 도주는 쪽이 없다(「무사히 도망쳤다!」로 닫힌다). */
export function emeraldResultRows(snapshot: BattleSnapshot, skillName: (skillId: string) => string): EmeraldResultRow[] {
  const project = store.getCurrent();
  const currency = resolveTerms(project).gold.trim() || "원";
  if (snapshot.result === "defeat") {
    return [
      { kind: "msg", label: "싸울 수 있는 몬스터가 없다!", value: "" },
      { kind: "msg", label: "눈앞이 캄캄해졌다…", value: "" },
    ];
  }
  if (snapshot.result !== "victory") return [];
  const rows: EmeraldResultRow[] = [];
  // 포획: 「신난다! ○○를 잡았다!」는 포획 연출이 말했다 — 결과 쪽은 새 동료 한 줄(경험치 0·상금 0 줄은 없다).
  for (const caught of snapshot.capturedMonsters) {
    const name = project.database.monsterSpecies?.find((species) => species.id === caught.speciesId)?.name;
    if (name) rows.push({ kind: "msg", label: `${withJosa(name, "은/는")} 새 동료가 되었다!`, value: "" });
  }
  const trainer = emeraldTrainerTroop(snapshot);
  if (trainer) rows.push({ kind: "msg", label: `${trainer.name}에게 이겼다!`, value: "" });
  const exp = Math.max(0, Math.trunc(snapshot.rewards.exp));
  const levelUps = new Map((snapshot.rewards.monsterLevelUps ?? []).map((entry) => [entry.instanceId, entry]));
  for (const actor of snapshot.actors) {
    const instanceId = actor.monsterInstanceId;
    if (!instanceId || !snapshot.participatingActorIds.includes(instanceId) || actor.defeated) continue;
    if (exp > 0) rows.push({ kind: "msg", label: `${withJosa(actor.name, "은/는")} 경험치를 ${exp} 얻었다!`, value: "" });
    const levelUp = levelUps.get(instanceId);
    if (!levelUp) continue;
    rows.push({ kind: "msg", label: `${withJosa(levelUp.name, "은/는")} ${withJosa(`레벨 ${levelUp.toLevel}`, "이/가")} 되었다!`, value: "" });
    for (const skillId of levelUp.learnedSkillIds) {
      rows.push({ kind: "msg", label: `${withJosa(levelUp.name, "은/는")} ${withJosa(skillName(skillId), "을/를")} 배웠다!`, value: "" });
    }
  }
  if (snapshot.rewards.gold > 0) {
    // 화폐 단위가 「G」면 조사가 「48G을」로 틀렸다 — 조사 없는 문형으로.
    const amount = `${snapshot.rewards.gold}${currency}`;
    rows.push({ kind: "msg", label: trainer ? `상금으로 ${amount} 받았다!` : `${amount} 주웠다!`, value: "" });
  }
  const items = new Map<string, number>();
  for (const itemId of snapshot.rewards.items) items.set(itemId, (items.get(itemId) ?? 0) + 1);
  for (const [itemId, count] of items) {
    const name = project.database.items.find((item) => item.id === itemId)?.name ?? itemId;
    rows.push({ kind: "msg", label: `${withJosa(count > 1 ? `${name} ${count}개` : name, "을/를")} 손에 넣었다!`, value: "" });
  }
  return rows;
}
