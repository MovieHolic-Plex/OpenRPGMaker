// editor/tools/battleTools.ts
// 전투 밸런스 툴: simulate_battle(읽기, 시뮬 지표) / tune_enemy(쓰기, 데미지 공식 역산 튜닝).

import { computeEnemyTuning, simulateBattle } from "@/battle/simulate";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { EnemyRecord } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const simulateBattleTool: ToolDefinition = {
  name: "simulate_battle",
  description: "전투를 헤드리스로 N회 시뮬레이션해 승률/평균 타수/포션 사용/잔여 HP를 반환한다(seed로 재현 가능).",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      troopId: { type: "string" },
      heroLevel: { type: "integer" },
      inventory: { type: "object", description: "{ itemId: 수량 }" },
      potionItemId: { type: "string", description: "저HP 시 사용할 회복 아이템 id" },
      n: { type: "integer", description: "시뮬 횟수(기본 50)" },
      seed: { type: "integer", description: "PRNG 시드(재현성)" },
      battleFlow: { type: "string", enum: ["gauge", "strict"], description: "전투 흐름(gauge 기본, strict 엄격 턴제)" },
      activeSlots: { type: "integer", description: "동시 참전 액터 수 override(미지정 시 시스템/트룹 설정)" },
      strictScript: {
        type: "array",
        description: "strict 전용 라운드별 명령. 예: [[{actorId:'actor_hero', command:'attack', target:'enemy-1'}, {actorId:'actor_mage', command:'switch', switchActorId:'actor_healer'}]]",
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              actorId: { type: "string" },
              command: { type: "string", enum: ["attack", "skill", "item", "guard", "defend", "escape", "switch"] },
              skillId: { type: "string" },
              itemId: { type: "string" },
              target: { type: "string" },
              switchActorId: { type: "string" },
            },
            required: ["actorId", "command"],
          },
        },
      },
    },
    required: ["troopId", "heroLevel"],
  },
  run(project, args): ToolExecResult {
    const troopId = args.troopId as string;
    if (!project.database.troops.some((troop) => troop.id === troopId)) {
      throw new ToolError(`트룹을 찾을 수 없습니다: ${troopId}`, { code: "troop-not-found" });
    }
    const result = simulateBattle({
      project,
      troopId,
      heroLevel: args.heroLevel as number,
      inventory: args.inventory as Record<string, number> | undefined,
      potionItemId: args.potionItemId as string | undefined,
      n: args.n as number | undefined,
      seed: args.seed as number | undefined,
      battleFlow: args.battleFlow as "gauge" | "strict" | undefined,
      activeSlots: args.activeSlots as number | undefined,
      strictScript: args.strictScript as Parameters<typeof simulateBattle>[0]["strictScript"],
    });
    return {
      summary: `전투 시뮬(${troopId}, Lv${args.heroLevel}, n=${result.samples}): 승률 ${(result.winRate * 100).toFixed(0)}%, 평균 ${result.avgTurns.toFixed(1)}타`,
      data: result,
    };
  },
};

const tuneEnemy: ToolDefinition = {
  name: "tune_enemy",
  description: "데미지 공식을 역산해 적의 maxHp/attack을 목표(처치 타수/영웅 피해량)에 맞춘다. 반환 data에 산출 근거 포함.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enemyId: { type: "string" },
      targetHitsToKill: { type: "integer", description: "영웅 평타 몇 대에 처치" },
      targetDamageToHeroPerHit: { type: "integer", description: "적 평타가 영웅에게 주는 목표 데미지" },
      heroLevel: { type: "integer", description: "기준 영웅 레벨(기본 1)" },
    },
    required: ["enemyId", "targetHitsToKill", "targetDamageToHeroPerHit"],
  },
  run(draft, args): ToolExecResult {
    const enemyId = args.enemyId as string;
    const enemy = draft.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) throw new ToolError(`적을 찾을 수 없습니다: ${enemyId}`, { code: "enemy-not-found" });
    const tuning = computeEnemyTuning({
      project: draft,
      heroLevel: (args.heroLevel as number | undefined) ?? 1,
      enemyDefense: enemy.stats.defense,
      targetHitsToKill: args.targetHitsToKill as number,
      targetDamageToHeroPerHit: args.targetDamageToHeroPerHit as number,
    });
    const updated: EnemyRecord = normalizeEnemyRecord({
      ...enemy,
      stats: { ...enemy.stats, maxHp: tuning.maxHp, attack: tuning.attack },
    });
    const index = draft.database.enemies.findIndex((entry) => entry.id === enemyId);
    draft.database.enemies[index] = updated;
    return {
      summary: `적 '${enemy.name}' 튜닝: maxHp ${enemy.stats.maxHp}→${updated.stats.maxHp}, attack ${enemy.stats.attack}→${updated.stats.attack}`,
      data: { enemyId, before: { maxHp: enemy.stats.maxHp, attack: enemy.stats.attack }, after: { maxHp: updated.stats.maxHp, attack: updated.stats.attack }, rationale: tuning.rationale },
    };
  },
};

export const BATTLE_TOOLS: readonly ToolDefinition[] = [simulateBattleTool, tuneEnemy];
