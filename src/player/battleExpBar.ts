import type { BattleSnapshot } from "@/battle/runtime";
import { totalExpForLevel } from "@/project/actorModel";
import { ACTOR_LEVEL_MAX } from "@/project/actorModel";
import { DEFAULT_MONSTER_EXP_CURVE, monsterExpInLevelBand, monsterSpeciesById } from "@/project/monsterCollection";
import { store } from "@/project/store";

/** 에메랄드 HUD 의 EXP 바: 이 전투에서 몬스터의 레벨 구간 안 진행률(0~100)과 승리 뒤 채워질 값. */
export interface MonsterExpBarProgress {
  /** 전투 시작 때(승리 보상 전) 진행률. */
  readonly fromPct: number;
  /** 승리 보상 뒤 진행률. 레벨이 오르면 100(바가 끝까지 찬 뒤 새 구간 값으로 굴러간다). */
  readonly toPct: number;
  readonly levelUp: boolean;
  /** 레벨업 뒤 새 레벨과 그 구간의 진행률(레벨업이 아니면 없음). */
  readonly afterLevel?: number;
  readonly afterPct?: number;
}

const pct = (value: number): number => Math.max(0, Math.min(100, value * 100));

/** 보상 계산(battleRewardsToSession → applyMonsterExperienceAndEvolution)과 같은 식: 참가자만 `rewards.exp` 를 그대로 받는다. */
export function monsterExpBarProgress(snapshot: BattleSnapshot, instanceId: string): MonsterExpBarProgress | undefined {
  const instance = snapshot.eventState.monsterCollection?.instances[instanceId];
  if (!instance) return undefined;
  const project = store.getCurrent();
  const species = monsterSpeciesById(project, instance.speciesId);
  if (!species) return undefined;
  const curve = species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  const base = totalExpForLevel(curve, instance.level);
  const next = totalExpForLevel(curve, instance.level + 1);
  if (!(next > base)) return undefined;
  const current = monsterExpInLevelBand(species, instance.level, instance.exp);
  const fromPct = pct((current - base) / (next - base));
  const gained = snapshot.result === "victory" && snapshot.participatingActorIds.includes(instanceId)
    ? Math.max(0, Math.trunc(snapshot.rewards.exp)) : 0;
  const total = current + gained;
  if (total < next) return { fromPct, toPct: pct((total - base) / (next - base)), levelUp: false };
  let level = instance.level;
  while (level < ACTOR_LEVEL_MAX && total >= totalExpForLevel(curve, level + 1)) level += 1;
  const levelBase = totalExpForLevel(curve, level);
  const levelNext = totalExpForLevel(curve, level + 1);
  return {
    fromPct,
    toPct: 100,
    levelUp: true,
    afterLevel: level,
    afterPct: levelNext > levelBase ? pct((total - levelBase) / (levelNext - levelBase)) : 100,
  };
}
