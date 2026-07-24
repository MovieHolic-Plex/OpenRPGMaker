import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeActionCombatConfig, normalizeEnemyActionProfile } from "@/project/actionCombat";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import type { EnemyActionProfile, EnemyRecord, FieldSpawnDef, Project } from "@/project/types";

const enemyHpBarsSchema: JsonSchema = { type: "string", enum: ["always", "damaged", "never"] };

const actionProfileSchema: JsonSchema = {
  type: "object",
  properties: {
    contactDamage: { type: "integer" },
    moveIntervalMs: { type: "integer" },
    aggroRange: { type: "integer" },
    knockbackResist: { type: "number" },
    attack: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["melee", "projectile", "dash"] },
        windupMs: { type: "integer" },
        recoverMs: { type: "integer" },
        damage: { type: "integer" },
        range: { type: "integer" },
        cooldownMs: { type: "integer" },
        projectileSpeedTilesPerSec: { type: "integer" },
      },
      required: ["kind", "windupMs", "recoverMs", "damage", "range"],
    },
  },
};

const setActionCombat: ToolDefinition = {
  name: "set_action_combat",
  description: "실시간 액션 전투 패키지를 설정한다. system.actionCombat을 쓰고, mapId가 있으면 그 맵의 액션 전투 옵트인(actionCombat)을 함께 전환한다.",
  mode: "write",
  domains: ["map", "database"],
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean" },
      mapId: { type: "string" },
      playerIframesMs: { type: "integer" },
      swingCooldownMs: { type: "integer" },
      swingDamageBonus: { type: "integer" },
      hearts: { type: "boolean" },
      stamina: { type: "boolean" },
      enemyHpBars: enemyHpBarsSchema,
    },
    required: ["enabled"],
  },
  run(draft, args): ToolExecResult {
    const existing: Partial<import("@/project/types").SystemActionCombat> = draft.system.actionCombat ?? {};
    const hud = {
      ...(existing.hud ?? {}),
      ...(args.hearts !== undefined ? { hearts: args.hearts === true } : {}),
      ...(args.stamina !== undefined ? { stamina: args.stamina === true } : {}),
      ...(args.enemyHpBars !== undefined ? { enemyHpBars: args.enemyHpBars as "always" | "damaged" | "never" } : {}),
    };
    const normalized = normalizeActionCombatConfig({
      ...existing,
      enabled: args.enabled === true,
      ...(args.playerIframesMs !== undefined ? { playerIframesMs: args.playerIframesMs as number } : {}),
      ...(args.swingCooldownMs !== undefined ? { swingCooldownMs: args.swingCooldownMs as number } : {}),
      ...(args.swingDamageBonus !== undefined ? { swingDamageBonus: args.swingDamageBonus as number } : {}),
      ...(Object.keys(hud).length > 0 ? { hud } : {}),
    });
    draft.system.actionCombat = normalized;
    let mapNote = "";
    if (typeof args.mapId === "string" && args.mapId.length > 0) {
      const map = requireMap(draft, args.mapId);
      map.actionCombat = args.enabled === true;
      mapNote = `, 맵 '${map.name}' 액션 전투 ${map.actionCombat ? "옵트인" : "옵트아웃"}`;
    }
    return {
      summary: `액션 전투 패키지 ${normalized?.enabled === true ? "활성" : "비활성"}${mapNote}`,
      data: { actionCombat: normalized ?? null },
    };
  },
};

function upsertActionEnemy(draft: Project, args: Record<string, unknown>): { enemy: EnemyRecord; outcome: "added" | "modified" } {
  const enemyId = args.enemyId as string;
  const profile = normalizeEnemyActionProfile(args.actionProfile as Partial<EnemyActionProfile> | undefined);
  if (!profile) throw new ToolError("actionProfile이 비었거나 유효하지 않습니다. attack.kind는 melee/projectile/dash 중 하나여야 합니다.", { code: "invalid-action-profile" });
  const existing = draft.database.enemies.find((entry) => entry.id === enemyId);
  if (existing) {
    existing.actionProfile = profile;
    return { enemy: existing, outcome: "modified" };
  }
  if (typeof args.name !== "string" || args.name.length === 0) {
    throw new ToolError(`적 '${enemyId}'가 없습니다. 새로 만들려면 name이 필요합니다(기존 적 수정은 enemyId만).`, { code: "enemy-not-found" });
  }
  const stats = (args.stats ?? {}) as Partial<EnemyRecord["stats"]>;
  const enemy = normalizeEnemyRecord({
    id: enemyId,
    name: args.name,
    stats: {
      maxHp: stats.maxHp ?? 30,
      maxMp: stats.maxMp ?? 0,
      attack: stats.attack ?? 10,
      defense: stats.defense ?? 5,
      mind: stats.mind ?? 5,
      agility: stats.agility ?? 10,
    },
  });
  enemy.actionProfile = profile;
  draft.database.enemies.push(enemy);
  return { enemy, outcome: "added" };
}

const makeActionEnemy: ToolDefinition = {
  name: "make_action_enemy",
  description: "실시간 액션 전투용 적을 만든다. 적 레코드에 actionProfile(접촉/선딜 공격)을 설정하고, spawn이 있으면 해당 맵에 추격 필드 스폰을 추가한다. 맵은 set_action_combat으로 옵트인되어 있어야 실시간으로 싸운다.",
  mode: "write",
  domains: ["database", "map"],
  parameters: {
    type: "object",
    properties: {
      enemyId: { type: "string" },
      name: { type: "string" },
      stats: {
        type: "object",
        properties: {
          maxHp: { type: "integer" }, maxMp: { type: "integer" }, attack: { type: "integer" },
          defense: { type: "integer" }, mind: { type: "integer" }, agility: { type: "integer" },
        },
      },
      actionProfile: actionProfileSchema,
      spawn: {
        type: "object",
        properties: {
          mapId: { type: "string" },
          troopId: { type: "string" },
          area: {
            type: "object",
            properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
            required: ["x", "y", "w", "h"],
          },
          maxAlive: { type: "integer" },
          respawnSec: { type: "integer" },
          chase: { type: "boolean" },
          graphic: { type: "object", additionalProperties: true },
        },
        required: ["mapId", "troopId", "area"],
      },
    },
    required: ["enemyId", "actionProfile"],
  },
  run(draft, args): ToolExecResult {
    const { enemy, outcome } = upsertActionEnemy(draft, args);
    const notes: string[] = [`적 '${enemy.name}' ${outcome === "added" ? "추가" : "수정"}(actionProfile)`];
    const spawn = args.spawn as Record<string, unknown> | undefined;
    if (spawn) {
      const map = requireMap(draft, spawn.mapId as string);
      const troopId = spawn.troopId as string;
      const troop = draft.database.troops.find((entry) => entry.id === troopId);
      if (!troop) {
        throw new ToolError(`존재하지 않는 troopId: ${troopId} — 먼저 upsert_troop으로 트룹을 만드세요.`, { code: "troop-not-found" });
      }
      const troopEnemyIds = new Set([...(troop.enemyIds ?? []), ...(troop.members ?? []).map((member) => member.enemyId)]);
      if (!troopEnemyIds.has(enemy.id)) {
        throw new ToolError(`트룹 '${troopId}'에 적 '${enemy.id}'가 포함되어 있지 않습니다. 스폰은 트룹의 첫 적으로 생성되므로, 트룹에 이 적을 추가하거나 맞는 트룹을 지정하세요.`, { code: "enemy-not-in-troop" });
      }
      const area = spawn.area as { x: number; y: number; w: number; h: number };
      if (area.x < 0 || area.y < 0 || area.w < 1 || area.h < 1 || area.x + area.w > map.width || area.y + area.h > map.height) {
        throw new ToolError(`area가 맵 범위를 벗어납니다 (맵 ${map.width}x${map.height}).`, { code: "area-out-of-bounds" });
      }
      const def: FieldSpawnDef = {
        id: `spawn_${enemy.id}_${map.fieldSpawns?.length ?? 0}`,
        troopId,
        area,
        ...(spawn.maxAlive !== undefined ? { maxAlive: Math.max(1, Math.trunc(spawn.maxAlive as number)) } : {}),
        ...(spawn.respawnSec !== undefined ? { respawnSec: Math.max(1, Math.trunc(spawn.respawnSec as number)) } : {}),
        chase: spawn.chase !== false,
        ...(spawn.graphic !== undefined ? { graphic: structuredClone(spawn.graphic) as FieldSpawnDef["graphic"] } : {}),
      };
      map.fieldSpawns = [...(map.fieldSpawns ?? []), def];
      notes.push(`맵 '${map.name}'에 스폰 ${def.id} 추가`);
      if (map.actionCombat !== true) notes.push("주의: 이 맵은 아직 액션 옵트인이 아닙니다 — set_action_combat { enabled:true, mapId } 필요");
    }
    return { summary: notes.join(" / "), data: { enemyId: enemy.id, actionProfile: enemy.actionProfile ?? null } };
  },
};

export const ACTION_TOOLS: readonly ToolDefinition[] = [setActionCombat, makeActionEnemy];
