import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { monsterBattleStatsForSpecies, monsterSpeciesById } from "@/project/monsterCollection";
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

/** 3세대 주요 상태 문장. 걸림·풀림·못 움직임. 주요 상태가 아니면 undefined(일반 문장으로). */
export function emeraldMajorStatusLine(phase: "added" | "removed" | "held", status: string | undefined, name: string): string | undefined {
  const topic = withJosa(name, "은/는");
  if (phase === "held") {
    return status === "freeze" ? `${topic} 얼어붙어서 움직일 수 없다!`
      : status === "sleep" ? `${topic} 쿨쿨 잠들어 있다!`
      : status === "paralysis" ? `${topic} 몸이 저려서 움직일 수 없다!`
      // 잠에서 막 깬 차례(1세대 규칙은 깬 턴을 쓴다).
      : `${topic} 아직 몸을 움직이지 못했다!`;
  }
  if (phase === "removed") {
    return status === "freeze" ? `${name}의 얼음이 녹았다!`
      : status === "sleep" ? `${topic} 잠에서 깨어났다!`
      : status === "paralysis" ? `${name}의 마비가 풀렸다!`
      : status === "poison" || status === "toxic" ? `${name}의 독이 사라졌다!`
      : status === "burn" ? `${name}의 화상이 나았다!`
      : status === "confusion" ? `${name}의 혼란이 풀렸다!` : undefined;
  }
  return status === "freeze" ? `${topic} 얼어 버렸다!`
    : status === "sleep" ? `${topic} 잠들어 버렸다!`
    : status === "paralysis" ? `${topic} 마비되어 기술이 나오기 어려워졌다!`
    : status === "poison" ? `${topic} 독에 걸렸다!`
    : status === "toxic" ? `${topic} 맹독에 걸렸다!`
    : status === "burn" ? `${topic} 화상을 입었다!`
    : status === "confusion" ? `${topic} 혼란에 빠졌다!` : undefined;
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

export type EmeraldStatLine = { readonly label: string; readonly value: string };
export type EmeraldResultRow = {
  readonly kind: string;
  readonly label: string;
  readonly value: string;
  /** 레벨업 능력치 상자. delta = 오른 양(+3), final = 새 수치. 문장 창 위에 얹히고 마지막으로 공개된 줄일 때만 보인다. */
  readonly stats?: { readonly mode: "delta" | "final"; readonly lines: readonly EmeraldStatLine[] };
};

/** 3세대 레벨업 상자: 먼저 오른 양, 확인키 뒤 새 수치. 몬스터 능력치 식(monsterBattleStatsForSpecies)을 그대로 쓴다. */
function levelUpStatRows(snapshot: BattleSnapshot, levelUp: { readonly instanceId: string; readonly fromLevel: number; readonly toLevel: number }): EmeraldResultRow[] {
  const instance = snapshot.eventState.monsterCollection?.instances[levelUp.instanceId];
  if (!instance) return [];
  const species = monsterSpeciesById(store.getCurrent(), instance.speciesId);
  if (!species) return [];
  const before = monsterBattleStatsForSpecies(species, levelUp.fromLevel, instance.ivs);
  const after = monsterBattleStatsForSpecies(species, levelUp.toLevel, instance.ivs);
  const defs: readonly [string, "maxHp" | "attack" | "defense" | "mind" | "agility"][] = [
    ["체력", "maxHp"], ["공격", "attack"], ["방어", "defense"], ["지능", "mind"], ["민첩", "agility"],
  ];
  const delta = defs.map(([label, key]) => ({ label, value: `+${after[key] - before[key]}` }));
  const final = defs.map(([label, key]) => ({ label, value: String(after[key]) }));
  return [
    { kind: "msg", label: "", value: "", stats: { mode: "delta", lines: delta } },
    { kind: "msg", label: "", value: "", stats: { mode: "final", lines: final } },
  ];
}

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
    const statRows = levelUpStatRows(snapshot, levelUp);
    const levelLine = `${withJosa(levelUp.name, "은/는")} ${withJosa(`레벨 ${levelUp.toLevel}`, "이/가")} 되었다!`;
    // 첫 상자(오른 양)는 레벨 문장과 같은 줄에 붙는다 — 문장 줄을 따로 쌓으면 상자가 한 박자 늦게 뜬다.
    if (statRows.length > 0) rows.push({ kind: "msg", label: levelLine, value: "", stats: statRows[0]!.stats });
    else rows.push({ kind: "msg", label: levelLine, value: "" });
    if (statRows.length > 1) rows.push(statRows[1]!);
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
