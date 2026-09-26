// 강하게 다시 하기(New Game+)와 장(챕터) 표시 — Chrono Trigger 식.
//
// 저작 레코드(system.newGamePlus / system.chapter)의 정규화, 클리어 기록의 모양, 그리고
// 새 세션에 이월 필드를 입히는 순수 함수만 둔다. 저장소(localStorage) 접근은 플레이어 쪽
// src/player/clearRecord.ts 가 소유한다 — 인터프리터와 세션 모듈은 저장소를 모른다.
import type { ActorInitialEquipment } from "@/project/types";
import { refreshGrowthVitals } from "@/project/growth/vitals";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export const NEW_GAME_PLUS_CARRY_FIELDS = ["levels", "skills", "equipment", "inventory", "gold"] as const;
export type NewGamePlusCarryField = (typeof NEW_GAME_PLUS_CARRY_FIELDS)[number];

export const DEFAULT_NEW_GAME_PLUS_LABEL = "강하게 다시 하기";
export const NEW_GAME_PLUS_LABEL_MAX = 24;
export const CHAPTER_LABEL_MAX = 40;
/** 새 세션의 session.flags 에 켜지는 키. 이벤트는 {kind:"newGamePlus"} 엔딩 조건이나 flags 로 읽는다. */
export const NEW_GAME_PLUS_FLAG = "ngplus";

export type NewGamePlusSettings = {
  readonly enabled: boolean;
  readonly label?: string;
  readonly carry: NewGamePlusCarryField[];
};

export type ChapterSettings = {
  readonly variableId: string;
  /** 변수 값(정수 문자열) → 표시 이름. */
  readonly labels: Record<string, string>;
};

/** 엔딩을 실제로 본 시점의 이월 스냅숏. carry 에 고른 필드만 채운다. */
export type ClearCarrySnapshot = {
  readonly partyActorIds?: readonly string[];
  readonly actorLevels?: Record<string, number>;
  readonly actorExperience?: Record<string, number>;
  readonly actorSkillIds?: Record<string, string[]>;
  readonly actorEquipment?: Record<string, ActorInitialEquipment>;
  readonly inventory?: Record<string, number>;
  readonly gold?: number;
};

export type ClearRecord = {
  readonly endingIds: readonly string[];
  readonly clearedAt: string;
  readonly carry: ClearCarrySnapshot;
};

export function isNewGamePlusCarryField(value: unknown): value is NewGamePlusCarryField {
  return typeof value === "string" && (NEW_GAME_PLUS_CARRY_FIELDS as readonly string[]).includes(value);
}

/** 꺼져 있고 이름도 이월 항목도 없으면 필드를 저장하지 않는다(갤러리와 같은 계약). */
export function normalizeNewGamePlusSettings(
  value: { readonly enabled?: unknown; readonly label?: unknown; readonly carry?: unknown } | undefined,
): NewGamePlusSettings | undefined {
  if (!value || typeof value !== "object") return undefined;
  const enabled = value.enabled === true;
  const label = typeof value.label === "string" ? value.label.trim().slice(0, NEW_GAME_PLUS_LABEL_MAX) : "";
  const customLabel = label.length > 0 && label !== DEFAULT_NEW_GAME_PLUS_LABEL;
  const carry = Array.isArray(value.carry)
    ? NEW_GAME_PLUS_CARRY_FIELDS.filter((field) => (value.carry as unknown[]).includes(field))
    : [];
  if (!enabled && !customLabel && carry.length === 0) return undefined;
  return { enabled, ...(customLabel ? { label } : {}), carry };
}

/** 변수 id 가 비었거나 이름표가 하나도 없으면 필드를 저장하지 않는다. */
export function normalizeChapterSettings(
  value: { readonly variableId?: unknown; readonly labels?: unknown } | undefined,
): ChapterSettings | undefined {
  if (!value || typeof value !== "object") return undefined;
  const variableId = typeof value.variableId === "string" ? value.variableId.trim() : "";
  if (!variableId) return undefined;
  const labels: Record<string, string> = {};
  if (value.labels && typeof value.labels === "object" && !Array.isArray(value.labels)) {
    for (const [key, raw] of Object.entries(value.labels as Record<string, unknown>)) {
      const number = Number(key.trim());
      if (!Number.isInteger(number) || typeof raw !== "string") continue;
      const label = raw.trim().slice(0, CHAPTER_LABEL_MAX);
      if (label) labels[String(number)] = label;
    }
  }
  if (Object.keys(labels).length === 0) return undefined;
  return { variableId, labels };
}

export function newGamePlusMenuLabel(project: Pick<Project, "system">): string {
  const override = project.system.titleScreen?.menuLabels.newGamePlus?.trim();
  if (override) return override;
  const label = project.system.newGamePlus?.label?.trim();
  return label || DEFAULT_NEW_GAME_PLUS_LABEL;
}

/** 현재 변수 값에 대응하는 장 이름. 설정이 없거나 이름표가 없는 값이면 undefined. */
export function currentChapterLabel(
  project: Pick<Project, "system">,
  session: { readonly variables: Record<string, number> },
): string | undefined {
  const chapter = project.system.chapter;
  if (!chapter) return undefined;
  const value = session.variables[chapter.variableId] ?? 0;
  return chapter.labels[String(Math.trunc(value))];
}

/** 엔딩 순간의 세션에서 carry 필드만 떠 둔다. 이야기 상태(스위치·변수·상자·맵)는 담지 않는다. */
export function captureClearCarry(
  session: Pick<PlaySession, "partyActorIds" | "actorLevels" | "actorExperience" | "actorSkillIds" | "actorEquipment" | "inventory" | "gold">,
  carry: readonly NewGamePlusCarryField[],
): ClearCarrySnapshot {
  const fields = new Set(carry);
  return {
    ...(fields.size > 0 ? { partyActorIds: [...session.partyActorIds] } : {}),
    ...(fields.has("levels")
      ? { actorLevels: structuredClone(session.actorLevels), actorExperience: structuredClone(session.actorExperience) }
      : {}),
    ...(fields.has("skills") ? { actorSkillIds: structuredClone(session.actorSkillIds) } : {}),
    ...(fields.has("equipment") ? { actorEquipment: structuredClone(session.actorEquipment) } : {}),
    ...(fields.has("inventory") ? { inventory: structuredClone(session.inventory) } : {}),
    ...(fields.has("gold") ? { gold: session.gold } : {}),
  };
}

/** 이월 필드만 새 세션에 입힌다. 지금 프로젝트에 없는 배우·아이템 id 는 버린다. */
export function applyClearCarry(project: Project, session: PlaySession, carry: ClearCarrySnapshot): void {
  const actorIds = new Set(project.database.actors.map((actor) => actor.id));
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const known = <T>(record: Record<string, T> | undefined): [string, T][] =>
    Object.entries(record ?? {}).filter(([actorId]) => actorIds.has(actorId));
  for (const [actorId, level] of known(carry.actorLevels)) {
    if (typeof level === "number" && Number.isFinite(level)) session.actorLevels[actorId] = Math.max(1, Math.trunc(level));
  }
  for (const [actorId, exp] of known(carry.actorExperience)) {
    if (typeof exp === "number" && Number.isFinite(exp)) session.actorExperience[actorId] = Math.max(0, Math.trunc(exp));
  }
  for (const [actorId, skills] of known(carry.actorSkillIds)) {
    if (Array.isArray(skills)) session.actorSkillIds[actorId] = skills.filter((id) => typeof id === "string");
  }
  for (const [actorId, equipment] of known(carry.actorEquipment)) {
    session.actorEquipment[actorId] = structuredClone(equipment);
  }
  if (carry.inventory) {
    for (const [itemId, count] of Object.entries(carry.inventory)) {
      if (itemIds.has(itemId) && typeof count === "number" && count > 0) {
        session.inventory[itemId] = Math.max(session.inventory[itemId] ?? 0, Math.trunc(count));
      }
    }
  }
  if (typeof carry.gold === "number" && Number.isFinite(carry.gold)) {
    session.gold = Math.max(session.gold, Math.trunc(carry.gold));
  }
  if (carry.actorLevels) {
    for (const actorId of session.partyActorIds) {
      delete session.actorVitals[actorId];
      refreshGrowthVitals(project, session, actorId);
    }
  }
  session.flags[NEW_GAME_PLUS_FLAG] = true;
}
