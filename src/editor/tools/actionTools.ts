import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeActionCombatConfig, normalizeEnemyActionProfile } from "@/project/actionCombat";
import { normalizeProjectFactions, PLAYER_FACTION_ID } from "@/project/factions";
import { requireMap } from "./mapHelpers";
import { ensureMonsterGraphic } from "./monsterGraphicAssignment";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import type { EnemyActionProfile, EnemyRecord, FactionDef, FactionRelationDef, FieldSpawnDef, Project } from "@/project/types";

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

function upsertActionEnemy(
  draft: Project,
  args: Record<string, unknown>,
  warnings: string[],
): { enemy: EnemyRecord; outcome: "added" | "modified" } {
  const enemyId = args.enemyId as string;
  const profile = normalizeEnemyActionProfile(args.actionProfile as Partial<EnemyActionProfile> | undefined);
  if (!profile) throw new ToolError("actionProfile이 비었거나 유효하지 않습니다. attack.kind는 melee/projectile/dash 중 하나여야 합니다.", { code: "invalid-action-profile" });
  const existing = draft.database.enemies.find((entry) => entry.id === enemyId);
  const factionId = typeof args.factionId === "string" && args.factionId.length > 0 ? args.factionId : undefined;
  if (existing) {
    existing.actionProfile = profile;
    if (factionId !== undefined) existing.factionId = factionId;
    if (args.monsterResourceId !== undefined) existing.monsterResourceId = args.monsterResourceId as string;
    if (args.transparent !== undefined) existing.transparent = args.transparent as boolean;
    ensureMonsterGraphic(draft, existing, existing, "monsterResourceId", warnings);
    return { enemy: existing, outcome: "modified" };
  }
  if (typeof args.name !== "string" || args.name.length === 0) {
    throw new ToolError(`적 '${enemyId}'가 없습니다. 새로 만들려면 name이 필요합니다(기존 적 수정은 enemyId만).`, { code: "enemy-not-found" });
  }
  const stats = (args.stats ?? {}) as Partial<EnemyRecord["stats"]>;
  const enemy = normalizeEnemyRecord({
    id: enemyId,
    name: args.name,
    monsterResourceId: args.monsterResourceId as string | undefined,
    transparent: args.transparent as boolean | undefined,
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
  if (factionId !== undefined) enemy.factionId = factionId;
  ensureMonsterGraphic(draft, enemy, enemy, "monsterResourceId", warnings);
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
      monsterResourceId: { type: "string", description: "명시할 몬스터 리소스 ID. 이름으로 확실히 매칭되지 않으면 필수(list_resources로 조회)." },
      transparent: { type: "boolean", description: "의도적으로 외형을 숨길 때만 true." },
      stats: {
        type: "object",
        properties: {
          maxHp: { type: "integer" }, maxMp: { type: "integer" }, attack: { type: "integer" },
          defense: { type: "integer" }, mind: { type: "integer" }, agility: { type: "integer" },
        },
      },
      actionProfile: actionProfileSchema,
      factionId: { type: "string" },
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
          factionId: { type: "string" },
          graphic: { type: "object", additionalProperties: true },
        },
        required: ["mapId", "troopId", "area"],
      },
    },
    required: ["enemyId", "actionProfile"],
  },
  run(draft, args): ToolExecResult {
    const warnings: string[] = [];
    const { enemy, outcome } = upsertActionEnemy(draft, args, warnings);
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
        ...(typeof spawn.factionId === "string" && spawn.factionId.length > 0 ? { factionId: spawn.factionId } : {}),
        ...(spawn.graphic !== undefined ? { graphic: structuredClone(spawn.graphic) as FieldSpawnDef["graphic"] } : {}),
      };
      map.fieldSpawns = [...(map.fieldSpawns ?? []), def];
      notes.push(`맵 '${map.name}'에 스폰 ${def.id} 추가`);
      if (map.actionCombat !== true) notes.push("주의: 이 맵은 아직 액션 옵트인이 아닙니다 — set_action_combat { enabled:true, mapId } 필요");
    }
    return {
      summary: notes.join(" / "),
      data: { enemyId: enemy.id, actionProfile: enemy.actionProfile ?? null },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setFactions: ToolDefinition = {
  name: "set_factions",
  description: "진영(faction) 레지스트리와 진영 간 태도를 설정한다. 태도는 -2 최악의 적 / -1 적 / 0 중립 / 1 우호 / 2 동맹이며, 적지 않은 쌍은 중립이다. aggression 은 0 비공격 / 1 적에게만 선공 / 2 중립에게도 선공 / 3 광폭. 예약 id 'player'와 'enemy'는 자동으로 있고 서로 적이다. 적 레코드나 필드 스폰에 factionId 를 줘서 소속을 지정하면 NPC 들이 서로 싸운다.",
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      defs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            color: { type: "string" },
            aggression: { type: "integer" },
            protectedFromNpcs: { type: "boolean" },
          },
          required: ["id", "name"],
        },
      },
      relations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string" },
            stance: { type: "integer" },
          },
          required: ["a", "b", "stance"],
        },
      },
      replace: { type: "boolean" },
    },
  },
  run(draft, args): ToolExecResult {
    const incomingDefs = (args.defs ?? []) as FactionDef[];
    const incomingRelations = (args.relations ?? []) as FactionRelationDef[];
    const replace = args.replace === true;
    const baseDefs = replace ? [] : [...(draft.factions?.defs ?? [])];
    const baseRelations = replace ? [] : [...(draft.factions?.relations ?? [])];
    for (const def of incomingDefs) {
      const index = baseDefs.findIndex((entry) => entry.id === def.id);
      if (index >= 0) baseDefs[index] = { ...baseDefs[index], ...def };
      else baseDefs.push(def);
    }
    for (const relation of incomingRelations) {
      const index = baseRelations.findIndex((entry) => (
        (entry.a === relation.a && entry.b === relation.b) || (entry.a === relation.b && entry.b === relation.a)
      ));
      if (index >= 0) baseRelations[index] = relation;
      else baseRelations.push(relation);
    }
    const normalized = normalizeProjectFactions({ defs: baseDefs, relations: baseRelations });
    const declared = new Set([PLAYER_FACTION_ID, "enemy", ...(normalized?.defs ?? []).map((def) => def.id)]);
    const dropped = incomingRelations.filter((relation) => !declared.has(relation.a) || !declared.has(relation.b));
    if (dropped.length > 0) {
      throw new ToolError(
        `정의되지 않은 진영을 가리키는 관계가 있습니다: ${dropped.map((relation) => `${relation.a}↔${relation.b}`).join(", ")} — defs 에 먼저 추가하세요.`,
        { code: "unknown-faction" }
      );
    }
    if (normalized) draft.factions = normalized;
    else delete draft.factions;
    return {
      summary: `진영 ${normalized?.defs.length ?? 0}개 / 관계 ${normalized?.relations.length ?? 0}개 설정`,
      data: { factions: normalized ?? null },
    };
  },
};

export const ACTION_TOOLS: readonly ToolDefinition[] = [setActionCombat, makeActionEnemy, setFactions];
