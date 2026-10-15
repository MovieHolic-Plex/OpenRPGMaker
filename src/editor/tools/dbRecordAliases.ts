// editor/tools/dbRecordAliases.ts
// DB 레코드 도구(upsert_actor·upsert_enemy …)의 레코드 안쪽 칸 별칭·교정. 순수 함수.
//
// 2026-10-15 FF6 감사 #34(역할극 3판): upsert_actor description 거부 6회 · classId 누락 6회 · upsert_enemy role/maxHp/attack/exp/gold
// 거부 4회. 모델이 흔히 쓰는 모양과 실제 스키마가 어긋난 자리다. 두 갈래로 다룬다.
//   - 옮겨도 뜻이 같은 것(enemy.maxHp → enemy.stats.maxHp, enemy.exp → enemy.rewards.exp, actor.class → actor.classId,
//     enemy.role → 도구 바깥 role)은 옮기고 「X 는 Y 입니다」 경고를 남긴다.
//   - 이 레코드에 둘 칸이 없는 자유 설명(description·memo …)은 저장하지 않았다고 경고하고 버린다 — 조용히 버리지 않는다.
//   - 나머지 모르는 칸은 건드리지 않고 거절한다(dbTools.rejectUnknownFields 가 가장 가까운 칸과 예시를 붙인다).

import type { JsonSchema } from "./types";
import { closestDeclaredKey } from "./argRepair";

type RecordLike = Record<string, unknown>;

interface Move {
  /** 레코드 안 경로(점) — 예: "stats.maxHp". */
  readonly to?: string;
  /** 도구 최상위 인자로 올린다 — 예: upsert_enemy 의 role. */
  readonly outer?: string;
}

/** label → 틀린 칸 → 옮길 곳. 옮겨도 뜻이 같은 것만. */
const MOVES: Readonly<Record<string, Readonly<Record<string, Move>>>> = {
  enemy: {
    maxHp: { to: "stats.maxHp" }, hp: { to: "stats.maxHp" }, HP: { to: "stats.maxHp" },
    maxMp: { to: "stats.maxMp" }, mp: { to: "stats.maxMp" }, MP: { to: "stats.maxMp" },
    attack: { to: "stats.attack" }, atk: { to: "stats.attack" },
    defense: { to: "stats.defense" }, def: { to: "stats.defense" },
    mind: { to: "stats.mind" }, magic: { to: "stats.mind" },
    agility: { to: "stats.agility" }, speed: { to: "stats.agility" }, agi: { to: "stats.agility" },
    exp: { to: "rewards.exp" }, gold: { to: "rewards.gold" }, tp: { to: "rewards.tp" },
    dropItemId: { to: "rewards.dropItemId" }, dropRatePercent: { to: "rewards.dropRatePercent" },
    role: { outer: "role" },
    graphicId: { to: "monsterResourceId" }, monsterId: { to: "monsterResourceId" },
    skills: { to: "skillIds" },
  },
  actor: {
    class: { to: "classId" }, job: { to: "classId" }, jobId: { to: "classId" }, class_id: { to: "classId" },
    level: { to: "initialLevel" }, startLevel: { to: "initialLevel" },
    face: { to: "faceResourceId" }, faceId: { to: "faceResourceId" },
    charset: { to: "characterResourceId" }, charsetId: { to: "characterResourceId" }, characterId: { to: "characterResourceId" },
    skills: { to: "skillIds" },
  },
  equipment: { type: { to: "slot" }, equipSlot: { to: "slot" }, bonuses: { to: "statBonuses" }, stats: { to: "statBonuses" } },
  skill: { cost: { to: "mpCost" } },
};

/** 레코드에 둘 칸이 없는 자유 서술 칸 — 저장하지 않았다고 알리고 버린다. */
const FREE_TEXT_KEYS: ReadonlySet<string> = new Set(["description", "desc", "memo", "note", "notes", "comment", "summary", "bio", "backstory", "flavor", "flavorText", "lore", "tags"]);

/** 거절할 때 붙이는 사정 설명(옮길 곳이 따로 없는 틀린 칸). */
export const DB_FIELD_REJECT_HINTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  actor: {
    maxHp: "능력치는 배우가 아니라 직업(classId)의 곡선이나 actor.parameterCurves 로 정한다 — 시작 레벨은 initialLevel",
    hp: "능력치는 직업(classId)의 곡선이나 actor.parameterCurves 로 정한다",
    attack: "능력치는 직업(classId)의 곡선이나 actor.parameterCurves 로 정한다",
  },
};

function setPath(target: RecordLike, path: string, value: unknown): boolean {
  const parts = path.split(".");
  let cursor: RecordLike = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (next === undefined) cursor[part] = {};
    else if (typeof next !== "object" || next === null || Array.isArray(next)) return false;
    cursor = cursor[part] as RecordLike;
  }
  const last = parts[parts.length - 1]!;
  if (cursor[last] !== undefined) return false;
  cursor[last] = value;
  return true;
}

export interface RecordRepairResult {
  readonly args: Record<string, unknown>;
  readonly notes: readonly string[];
}

/**
 * args[recordKey] 안의 모르는 칸을 교정한다. 입력 args 는 바꾸지 않는다(필요한 층만 복사).
 * `schema` 는 레코드 스키마(properties 로 알려진 칸 판정), `outerSchema` 는 도구 전체 스키마(role 처럼 바깥으로 올릴 칸).
 */
export function repairRecordArgs(label: string, recordKey: string, args: Record<string, unknown>, schema: JsonSchema, outerSchema: JsonSchema): RecordRepairResult {
  const record = args[recordKey];
  if (typeof record !== "object" || record === null || Array.isArray(record)) return { args, notes: [] };
  const declared = Object.keys(schema.properties ?? {});
  const unknown = Object.keys(record as RecordLike).filter((key) => !declared.includes(key));
  if (unknown.length === 0) return { args, notes: [] };
  const nextRecord: RecordLike = structuredClone(record as RecordLike);
  const nextArgs: Record<string, unknown> = { ...args };
  const notes: string[] = [];
  for (const key of unknown) {
    const value = nextRecord[key];
    const move = MOVES[label]?.[key];
    if (move?.outer && outerSchema.properties?.[move.outer] !== undefined && nextArgs[move.outer] === undefined) {
      nextArgs[move.outer] = value;
      delete nextRecord[key];
      notes.push(`${label}.${key} 는 ${label} 안이 아니라 도구 인자 '${move.outer}' 입니다 — 옮겨서 실행했습니다. 다음부터 {"${recordKey}":{…},"${move.outer}":${JSON.stringify(value)}} 로 보내세요.`);
      continue;
    }
    if (move?.to && declared.includes(move.to.split(".")[0]!)) {
      if (setPath(nextRecord, move.to, value)) {
        delete nextRecord[key];
        notes.push(`${label}.${key} 는 ${label}.${move.to} 입니다 — 옮겨서 실행했습니다. 다음부터 ${label}.${move.to} 로 보내세요.`);
        continue;
      }
    }
    const camelTarget = declared.find((name) => name.toLowerCase() === key.replace(/[_-]+/gu, "").toLowerCase());
    if (camelTarget && nextRecord[camelTarget] === undefined) {
      nextRecord[camelTarget] = value;
      delete nextRecord[key];
      notes.push(`${label}.${key} 는 ${label}.${camelTarget} 입니다 — 옮겨서 실행했습니다.`);
      continue;
    }
    if (FREE_TEXT_KEYS.has(key)) {
      delete nextRecord[key];
      const near = closestDeclaredKey(key, declared);
      notes.push(`${label}.${key} 칸은 이 레코드에 없어 저장하지 않았습니다${near ? ` (비슷한 칸: ${label}.${near})` : ""}. 설명 문구가 꼭 필요하면 인물은 upsert_character_profile, 세계 설정은 set_world_canon 에 적으세요.`);
    }
  }
  nextArgs[recordKey] = nextRecord;
  return { args: nextArgs, notes };
}
