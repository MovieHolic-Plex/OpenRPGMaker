import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeActionCombatConfig, normalizeEnemyActionProfile } from "@/project/actionCombat";
import { normalizeProjectFactions, PLAYER_FACTION_ID } from "@/project/factions";
import { requireMap } from "./mapHelpers";
import { ensureMonsterGraphic } from "./monsterGraphicAssignment";
import { validateArgs } from "./jsonSchema";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import type { EnemyActionProfile, EnemyRecord, FactionDef, FactionRelationDef, FieldSpawnDef, Project } from "@/project/types";

const enemyHpBarsSchema: JsonSchema = { type: "string", enum: ["always", "damaged", "never"] };

const actionAttackSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
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
};

const actionProfileSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    contactDamage: { type: "integer" },
    moveIntervalMs: { type: "integer" },
    aggroRange: { type: "integer" },
    knockbackResist: { type: "number" },
    attack: actionAttackSchema,
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
      dodgeStaminaCost: { type: "integer" },
      dodgeIframesMs: { type: "integer" },
      guardDamageReductionPercent: { type: "integer" },
      guardStaminaDrainPerSec: { type: "integer" },
      hearts: { type: "boolean" },
      stamina: { type: "boolean" },
      enemyHpBars: enemyHpBarsSchema,
    },
    required: ["enabled"],
  },
  run(draft, args): ToolExecResult {
    const map = typeof args.mapId === "string" && args.mapId.length > 0 ? requireMap(draft, args.mapId) : undefined;
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
      ...(typeof args.dodgeStaminaCost === "number" ? { dodgeStaminaCost: args.dodgeStaminaCost } : {}),
      ...(typeof args.dodgeIframesMs === "number" ? { dodgeIframesMs: args.dodgeIframesMs } : {}),
      ...(typeof args.guardDamageReductionPercent === "number" ? { guardDamageReductionPercent: args.guardDamageReductionPercent } : {}),
      ...(typeof args.guardStaminaDrainPerSec === "number" ? { guardStaminaDrainPerSec: args.guardStaminaDrainPerSec } : {}),
      ...(Object.keys(hud).length > 0 ? { hud } : {}),
    });
    draft.system.actionCombat = normalized;
    let mapNote = "";
    if (map) {
      map.actionCombat = args.enabled === true;
      mapNote = `, 맵 '${map.name}' 액션 전투 ${map.actionCombat ? "옵트인" : "옵트아웃"}`;
    }
    return {
      summary: `액션 전투 패키지 ${normalized?.enabled === true ? "활성" : "비활성"}${mapNote}`,
      data: { actionCombat: normalized ?? null },
    };
  },
};

function prepareActionEnemy(
  draft: Project,
  args: Record<string, unknown>,
  warnings: string[],
): { enemy: EnemyRecord; outcome: "added" | "modified" } {
  const enemyId = args.enemyId as string;
  const suppliedProfile = args.actionProfile as Partial<EnemyActionProfile> | undefined;
  const errors = validateArgs(actionProfileSchema, suppliedProfile);
  if (suppliedProfile?.attack !== undefined) {
    errors.push(...validateArgs(actionAttackSchema, suppliedProfile.attack).map((message) => `attack: ${message}`));
  }
  if (errors.length > 0) {
    throw new ToolError(`actionProfile: ${errors.join(" / ")}`, { code: "invalid-args" });
  }
  const existing = draft.database.enemies.find((entry) => entry.id === enemyId);
  const profile = normalizeEnemyActionProfile({ ...existing?.actionProfile, ...suppliedProfile });
  if (!profile) throw new ToolError("actionProfile이 비었거나 유효하지 않습니다. attack.kind는 melee/projectile/dash 중 하나여야 합니다.", { code: "invalid-action-profile" });
  const factionId = typeof args.factionId === "string" && args.factionId.length > 0 ? args.factionId : undefined;
  if (existing) {
    const enemy = structuredClone(existing);
    enemy.actionProfile = profile;
    if (factionId !== undefined) enemy.factionId = factionId;
    if (args.monsterResourceId !== undefined) enemy.monsterResourceId = args.monsterResourceId as string;
    if (args.transparent !== undefined) enemy.transparent = args.transparent as boolean;
    ensureMonsterGraphic(draft, enemy, enemy, "monsterResourceId", warnings);
    return { enemy, outcome: "modified" };
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
  return { enemy, outcome: "added" };
}

const makeActionEnemy: ToolDefinition = {
  name: "make_action_enemy",
  description: "실시간 액션 전투용 적을 만든다. 기존 actionProfile은 보낸 필드만 수정하고 생략한 공격·속성은 유지한다. 먼저 적과 upsert_troop 트룹을 만든 뒤 spawn을 지정한다. 새 저작은 spawnMode:add로 추가, 교정은 spawnMode:update와 기존 spawn.id로 수정한다. add의 ID 충돌과 update의 없는 ID는 무변경 오류다. spawnMode 생략은 기존 ID 갱신/새 ID 추가의 레거시 동작이다. 삭제는 remove_field_spawn을 쓴다. 리소스·맵·트룹 검증 실패 시 아무것도 바꾸지 않는다. 맵은 set_action_combat으로 옵트인되어 있어야 한다.",
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
      spawnMode: { type: "string", enum: ["add", "update"], description: "add는 새 스폰만 추가하고, update는 해당 맵의 기존 spawn.id만 수정한다. 새 저작·교정에서는 의도를 명시한다." },
      spawn: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1, description: "같은 맵에서 재시도할 때 갱신할 스폰 ID. 생략하면 새 스폰을 추가한다." },
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
    const spawnMode = args.spawnMode;
    const spawn = args.spawn as Record<string, unknown> | undefined;
    if (spawnMode !== undefined) {
      if (spawnMode !== "add" && spawnMode !== "update") {
        throw new ToolError("spawnMode는 add 또는 update여야 합니다.", { code: "invalid-args" });
      }
      if (!spawn || typeof spawn !== "object" || Array.isArray(spawn)) {
        throw new ToolError("spawnMode를 지정하면 spawn도 필요합니다.", { code: "invalid-args" });
      }
      if ((spawnMode === "update" || spawn.id !== undefined) && (typeof spawn.id !== "string" || spawn.id.trim().length === 0)) {
        throw new ToolError("명시적 스폰 수정에는 비어 있지 않은 spawn.id가 필요합니다.", { code: "invalid-args" });
      }
    }
    const warnings: string[] = [];
    const { enemy, outcome } = prepareActionEnemy(draft, args, warnings);
    const notes: string[] = [`적 '${enemy.name}' ${outcome === "added" ? "추가" : "수정"}(actionProfile)`];
    let spawnChange: { mapId: string; spawnId: string; spawnOutcome: "added" | "modified" } | undefined;
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
      const existingSpawn = typeof spawn.id === "string" ? map.fieldSpawns?.find((entry) => entry.id === spawn.id) : undefined;
      if (spawnMode === "update" && !existingSpawn) {
        throw new ToolError(`맵 '${map.id}'에 스폰 '${spawn.id}'가 없습니다. 기존 ID를 조회하거나 새 배치에는 spawnMode:add를 사용하세요.`, { code: "spawn-not-found", mapId: map.id });
      }
      if (spawnMode === "add" && existingSpawn) {
        throw new ToolError(`맵 '${map.id}'에 스폰 '${existingSpawn.id}'가 이미 있습니다. 수정에는 spawnMode:update를 사용하세요.`, { code: "spawn-already-exists", mapId: map.id });
      }
      let spawnId = typeof spawn.id === "string" ? spawn.id : `spawn_${enemy.id}_${map.fieldSpawns?.length ?? 0}`;
      if (spawn.id === undefined) {
        let suffix = map.fieldSpawns?.length ?? 0;
        while (map.fieldSpawns?.some((entry) => entry.id === spawnId)) spawnId = `spawn_${enemy.id}_${++suffix}`;
      }
      const def: FieldSpawnDef = {
        ...existingSpawn,
        id: spawnId,
        troopId,
        area: { x: area.x, y: area.y, w: area.w, h: area.h },
        ...(spawn.maxAlive !== undefined ? { maxAlive: Math.max(1, Math.trunc(spawn.maxAlive as number)) } : {}),
        ...(spawn.respawnSec !== undefined ? { respawnSec: Math.max(1, Math.trunc(spawn.respawnSec as number)) } : {}),
        chase: spawn.chase !== undefined ? spawn.chase !== false : existingSpawn?.chase ?? true,
        ...(typeof spawn.factionId === "string" && spawn.factionId.length > 0 ? { factionId: spawn.factionId } : {}),
        ...(spawn.graphic !== undefined ? { graphic: structuredClone(spawn.graphic) as FieldSpawnDef["graphic"] } : {}),
      };
      map.fieldSpawns = existingSpawn
        ? (map.fieldSpawns ?? []).map((entry) => entry.id === def.id ? def : entry)
        : [...(map.fieldSpawns ?? []), def];
      spawnChange = { mapId: map.id, spawnId: def.id, spawnOutcome: existingSpawn ? "modified" : "added" };
      notes.push(`맵 '${map.name}'에 스폰 ${def.id} ${existingSpawn ? "수정" : "추가"}`);
      if (map.actionCombat !== true) notes.push("주의: 이 맵은 아직 액션 옵트인이 아닙니다 — set_action_combat { enabled:true, mapId } 필요");
    }
    const enemyIndex = draft.database.enemies.findIndex((entry) => entry.id === enemy.id);
    if (enemyIndex >= 0) draft.database.enemies[enemyIndex] = enemy;
    else draft.database.enemies.push(enemy);
    return {
      summary: notes.join(" / "),
      data: { enemyId: enemy.id, actionProfile: enemy.actionProfile ?? null, ...spawnChange },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const removeFieldSpawn: ToolDefinition = {
  name: "remove_field_spawn",
  description: "지정한 맵의 정확한 spawnId 하나만 삭제한다. 적·트룹·다른 스폰은 유지한다. 없는 스폰이나 로그라이크 encounterSlots에서 참조 중인 스폰은 무변경 오류다.",
  mode: "write",
  domains: ["map"],
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      mapId: { type: "string", minLength: 1 },
      spawnId: { type: "string", minLength: 1 },
    },
    required: ["mapId", "spawnId"],
  },
  run(draft, args): ToolExecResult {
    const errors = validateArgs(removeFieldSpawn.parameters, args);
    if (errors.length > 0) throw new ToolError(errors.join(" / "), { code: "invalid-args" });
    const map = requireMap(draft, args.mapId as string);
    const spawnId = args.spawnId as string;
    if (!map.fieldSpawns?.some((entry) => entry.id === spawnId)) {
      throw new ToolError(`맵 '${map.id}'에 스폰 '${spawnId}'가 없습니다.`, { code: "spawn-not-found", mapId: map.id });
    }
    if (map.roguelikeRoom?.encounterSlots?.some((slot) => slot.choices.some((choice) => choice.fieldSpawnId === spawnId))) {
      throw new ToolError(`스폰 '${spawnId}'는 로그라이크 encounterSlots에서 참조 중입니다. 먼저 해당 참조를 수정하세요.`, { code: "spawn-in-use", mapId: map.id });
    }
    map.fieldSpawns = map.fieldSpawns.filter((entry) => entry.id !== spawnId);
    return { summary: `맵 '${map.name}'에서 스폰 '${spawnId}' 삭제`, data: { mapId: map.id, spawnId } };
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

export const ACTION_TOOLS: readonly ToolDefinition[] = [setActionCombat, makeActionEnemy, removeFieldSpawn, setFactions];
