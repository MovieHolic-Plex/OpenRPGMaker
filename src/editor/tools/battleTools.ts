// editor/tools/battleTools.ts
// 전투 밸런스 툴: simulate_battle(읽기, 시뮬 지표) / tune_enemy(쓰기, 데미지 공식 역산 튜닝).

import { computeEnemyTuning, simulateBattle } from "@/battle/simulate";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { EnemyRecord } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const simulateBattleTool: ToolDefinition = {
  name: "simulate_battle",
  description: "전투를 헤드리스로 N회 시뮬레이션해 승률/평균 타수/포션 사용/잔여 HP를 반환한다(seed로 재현 가능). 힘 모으기(chargeTurns) 기술이 있으면 data.chargeBreaks 에 모으기 시작·충전 끊기(chargeBreak) 횟수가 기술별로 나온다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      troopId: { type: "string" },
      heroLevel: { type: "integer" },
      partyActorIds: { type: "array", items: { type: "string" }, description: "모의전 파티(배우 id). 생략하면 시작 파티 — 동료가 나중에 합류하는 게임은 합류가 끝난 파티로 보스를 재 볼 것" },
      inventory: {
        type: "object",
        description: "{ itemId: 수량 } — 키가 아이템 id 인 동적 맵",
        additionalProperties: true,
      },
      potionItemId: { type: "string", description: "저HP 시 사용할 회복 아이템 id" },
      n: { type: "integer", description: "시뮬 횟수(기본 50)" },
      seed: { type: "integer", description: "PRNG 시드(재현성)" },
      battleFlow: { type: "string", enum: ["gauge", "strict"], description: "전투 흐름(gauge 기본, strict 엄격 턴제)" },
      activeSlots: { type: "integer", description: "동시 참전 액터 수 override(미지정 시 시스템/트룹 설정)" },
      useSkills: { type: "boolean", description: "true = 아군이 자동 전투 AI(기술·회복·연계기)로 행동한다. 기본 false 는 통상 공격+회복약뿐이라 기술·연계기 밸런스를 못 잰다. 결과 data.skillUses 에 기술별 사용 횟수가 나온다. 연계기는 짝도 게이지 만충이어야 열려 자동 전투에서는 드물게만 쓰인다(skillUses 에 안 잡혀도 연계기가 죽은 것이 아니다 — 위력은 upsert_skill 값과 comboCombinedStats 로 직접 계산해 맞춰라)" },
      strictScript: {
        type: "array",
        description: "strict 전용 라운드별 명령. 예: [[{actorId:'actor_hero', command:'attack', target:'enemy-1'}, {actorId:'actor_mage', command:'switch', switchActorId:'actor_healer'}]]",
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              actorId: { type: "string" },
              command: { type: "string", enum: ["attack", "skill", "item", "capture", "guard", "defend", "escape", "switch"] },
              skillId: { type: "string" },
              itemId: { type: "string" },
              captureItemId: { type: "string" },
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
    const partyActorIds = Array.isArray(args.partyActorIds) ? (args.partyActorIds as unknown[]).filter((id): id is string => typeof id === "string") : undefined;
    const missingActors = partyActorIds?.filter((id) => !project.database.actors.some((actor) => actor.id === id)) ?? [];
    if (missingActors.length > 0) {
      throw new ToolError(`partyActorIds 에 없는 배우: ${missingActors.join(", ")} — 배우 id: ${project.database.actors.slice(0, 8).map((actor) => actor.id).join(", ")}`, { code: "actor-not-found" });
    }
    const result = simulateBattle({
      project,
      troopId,
      heroLevel: args.heroLevel as number,
      ...(partyActorIds && partyActorIds.length > 0 ? { partyActorIds } : {}),
      inventory: args.inventory as Record<string, number> | undefined,
      potionItemId: args.potionItemId as string | undefined,
      n: args.n as number | undefined,
      seed: args.seed as number | undefined,
      battleFlow: args.battleFlow as "gauge" | "strict" | undefined,
      activeSlots: args.activeSlots as number | undefined,
      ...(args.useSkills === true ? { useSkills: true } : {}),
      strictScript: args.strictScript as Parameters<typeof simulateBattle>[0]["strictScript"],
    });
    // 페이즈(전투 이벤트 페이지)는 승률과 같은 급의 1차 지표다 — 넣은 연출이 실제로 떴는지를
    // data 안쪽에 묻어두면 모델이 안 읽는다. 요약과 경고로 올린다.
    const phases = result.phaseCoverage;
    const silent = phases.filter((phase) => phase.firedRuns === 0);
    const unsupported = phases.filter((phase) => phase.unsupported > 0);
    const phaseNote = phases.length === 0
      ? ""
      : `, 페이즈 ${phases.length - silent.length}/${phases.length} 발동`;
    const skillEntries = Object.entries(result.skillUses);
    const skillNote = skillEntries.length > 0
      ? `, 기술 ${skillEntries.map(([id, count]) => `${project.database.skills.find((skill) => skill.id === id)?.name ?? id}×${count}`).join("·")}`
      : args.useSkills === true ? ", 기술 사용 0회(연계기·기술이 조건/MP/해금으로 막혔는지 확인)" : "";
    const charge = result.chargeBreaks;
    const chargeNote = charge.started > 0 ? `, 힘 모으기 ${charge.started}회 중 끊김 ${charge.broken}회` : "";
    const warnings: string[] = [];
    if (silent.length > 0) {
      warnings.push(
        `${result.samples}판 동안 한 번도 발동하지 않은 전투 이벤트 페이지: ` +
          `${silent.map((phase) => `${phase.name || phase.pageId}(${phase.pageId})`).join(", ")} — ` +
          `조건이 도달 불가합니다(HP 임계가 너무 낮거나 라운드 조건이 전투 길이보다 깁니다). ` +
          `upsert_troop_battle_page 로 조건을 고치거나 heroLevel/n 을 바꿔 다시 확인하세요.`,
      );
    }
    if (unsupported.length > 0) {
      warnings.push(
        `런타임이 처리하지 못한 커맨드가 있는 페이지: ` +
          `${unsupported.map((phase) => `${phase.pageId}(${phase.unsupported}건)`).join(", ")} — 연출이 조용히 생략됩니다.`,
      );
    }
    return {
      summary: `전투 시뮬(${troopId}, Lv${args.heroLevel}, n=${result.samples}): 승률 ${(result.winRate * 100).toFixed(0)}%, 평균 ${result.avgTurns.toFixed(1)}타${phaseNote}${skillNote}${chargeNote}`,
      data: result,
      ...(warnings.length > 0 ? { warnings } : {}),
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
